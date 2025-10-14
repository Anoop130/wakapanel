import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const WakaPanelButton = GObject.registerClass(
    { GTypeName: 'WakaPanelButton' },
    class WakaPanelButton extends PanelMenu.Button {
        _init(settings, uuid) {
            super._init(0.0, 'WakaPanel');

            this._settings = settings;
            this._uuid = uuid;
            this._httpSession = new Soup.Session();
            this._timeoutSourceId = 0;

            // icon for the panel
            let icon = new St.Icon({
                icon_name: 'emblem-documents-symbolic',
                style_class: 'system-status-icon',
            });
            this.add_child(icon);

            // label shown on panel
            this.label = new St.Label({
                text: '--m',
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'wakapanel-label',
            });
            this.add_child(this.label);

            // menu items with icons
            this.totalItem = new PopupMenu.PopupImageMenuItem('Today Total: --', 'appointment-soon-symbolic');
            this.menu.addMenuItem(this.totalItem);

            this.projectItem = new PopupMenu.PopupImageMenuItem('Top Project: --', 'folder-symbolic');
            this.menu.addMenuItem(this.projectItem);

            this.languageItem = new PopupMenu.PopupImageMenuItem('Top Language: --', 'utilities-terminal-symbolic');
            this.menu.addMenuItem(this.languageItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.dashboardButton = new PopupMenu.PopupImageMenuItem('Open WakaTime Dashboard', 'web-browser-symbolic');
            this.menu.addMenuItem(this.dashboardButton);

            // connect activate signal to open dashboard
            this.dashboardButton.connect('activate', () => {
                const baseUrl = this._settings.get_string('base-url') || 'https://wakatime.com';
                const dashboardUrl = `${baseUrl}/dashboard`;

                try {
                    Gio.AppInfo.launch_default_for_uri(dashboardUrl, null);
                    this.menu.close(false);
                } catch (e) {
                    console.error(`Failed to open dashboard URL: ${dashboardUrl}`, e);
                }
            });
        }

        // helper to format duration text to "xh ym"
        _formatDuration(durationText) {
            if (!durationText) {
                return '0m';
            }

            let formatted = durationText.replace(/ hrs?/, 'h');
            formatted = formatted.replace(/ mins?/, 'm');
            formatted = formatted.replace(/ $/, '');

            return formatted.trim();
        }

        async _updateStats() {
            this.label.set_text('...');
            this.totalItem.label.set_text('Today Total: Loading...');
            this.projectItem.label.set_text('Top Project: Loading...');
            this.languageItem.label.set_text('Top Language: Loading...');

            const apiKey = this._settings.get_string('api-key');
            let baseUrl = this._settings.get_string('base-url');

            baseUrl = (baseUrl || 'https://wakatime.com').replace(/\/+$/g, '');

            if (!apiKey) {
                this.label.set_text('⚠');
                this.totalItem.label.set_text('Today Total: Please set API Key in preferences.');
                this.projectItem.label.set_text('Top Project: —');
                this.languageItem.label.set_text('Top Language: —');
                this._scheduleNextUpdate();
                return;
            }

            const url = `${baseUrl}/api/v1/users/current/summaries?range=today`;

            try {
                const message = Soup.Message.new('GET', url);
                const authString = GLib.base64_encode(new TextEncoder().encode(`${apiKey}:`));
                message.request_headers.append('Authorization', `Basic ${authString}`);

                const bytes = await this._httpSession.send_and_read_async(
                    message,
                    GLib.PRIORITY_DEFAULT,
                    null
                );

                if (message.status_code !== Soup.Status.OK) {
                    this.label.set_text('⚠');
                    this.totalItem.label.set_text(`Today Total: API Error (${message.status_code})`);
                    this.projectItem.label.set_text('Top Project: Check API Key / URL');
                    this.languageItem.label.set_text('Top Language: —');
                    this._scheduleNextUpdate();
                    return;
                }

                const decoder = new TextDecoder('utf-8');
                const jsonString = decoder.decode(bytes.get_data());
                const data = JSON.parse(jsonString);

                if (!data?.data?.[0]?.grand_total?.text || data.data[0].grand_total.text === '0 secs') {
                    this.label.set_text('0m');
                    this.totalItem.label.set_text('Today Total: No coding yet');
                    this.projectItem.label.set_text('Top Project: —');
                    this.languageItem.label.set_text('Top Language: —');
                    this._scheduleNextUpdate();
                    return;
                }

                const grandTotalRaw = data.data[0].grand_total.text;
                const topProject = data.data[0].projects?.[0];
                const topLanguage = data.data[0].languages?.[0];

                const formattedGrandTotal = this._formatDuration(grandTotalRaw);
                const formattedProjectTime = topProject ? this._formatDuration(topProject.text) : '';
                const formattedLanguageTime = topLanguage ? this._formatDuration(topLanguage.text) : '';

                this.label.set_text(formattedGrandTotal);
                this.totalItem.label.set_text(`Today Total: ${grandTotalRaw}`);
                this.projectItem.label.set_text(`Top Project: ${topProject?.name || '—'} ${formattedProjectTime ? `· ${formattedProjectTime}` : ''}`);
                this.languageItem.label.set_text(`Top Language: ${topLanguage?.name || '—'} ${formattedLanguageTime ? `· ${formattedLanguageTime}` : ''}`);

            } catch (e) {
                console.error('Failed to fetch/parse WakaTime data:', e);
                this.label.set_text('⚠');
                this.totalItem.label.set_text('Today Total: Network Error');
                this.projectItem.label.set_text('Top Project: Check connection');
                this.languageItem.label.set_text('Top Language: —');
            } finally {
                this._scheduleNextUpdate();
            }
        }

        _scheduleNextUpdate() {
            if (this._timeoutSourceId > 0) {
                GLib.source_remove(this._timeoutSourceId);
                this._timeoutSourceId = 0;
            }

            const refreshMinutes = this._settings.get_int('refresh-interval');
            const intervalSec = Math.max(60, refreshMinutes * 60);

            this._timeoutSourceId = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT_IDLE,
                intervalSec,
                () => {
                    this._updateStats();
                    return GLib.SOURCE_CONTINUE;
                }
            );
        }

        destroy() {
            if (this._timeoutSourceId > 0) {
                GLib.source_remove(this._timeoutSourceId);
                this._timeoutSourceId = 0;
            }
            if (this._httpSession) {
                this._httpSession.abort();
            }
            super.destroy();
        }
    }
);

export default class WakaPanelExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._panelButton = new WakaPanelButton(this._settings, this.uuid);
        Main.panel.addToStatusArea(this.uuid, this._panelButton);
        this._panelButton._updateStats();
    }

    disable() {
        if (this._panelButton) {
            this._panelButton.destroy();
            this._panelButton = null;
        }
        this._settings = null;
    }
}