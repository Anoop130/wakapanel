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
            this._currentRange = this._settings.get_string('default-range') || 'today';
            this._streakData = null;

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

            this._buildMenu();
        }

        _buildMenu() {
            // time range toggle at top
            this.rangeItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: 'wakapanel-range-container' });
            const rangeBox = new St.BoxLayout({ vertical: false, x_expand: true, style_class: 'wakapanel-range-box' });
            
            this.todayBtn = new St.Button({ label: 'Today', style_class: 'wakapanel-range-button' });
            this.week7Btn = new St.Button({ label: '7 Days', style_class: 'wakapanel-range-button' });
            this.days30Btn = new St.Button({ label: '30 Days', style_class: 'wakapanel-range-button' });
            
            this.todayBtn.connect('clicked', () => this._switchRange('today'));
            this.week7Btn.connect('clicked', () => this._switchRange('last_7_days'));
            this.days30Btn.connect('clicked', () => this._switchRange('last_30_days'));
            
            rangeBox.add_child(this.todayBtn);
            rangeBox.add_child(this.week7Btn);
            rangeBox.add_child(this.days30Btn);
            this.rangeItem.add_child(rangeBox);
            this.menu.addMenuItem(this.rangeItem);

            this._updateRangeButtons();

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // main stats
            this.totalItem = new PopupMenu.PopupImageMenuItem('Total: --', 'appointment-soon-symbolic');
            this.menu.addMenuItem(this.totalItem);

            this.streakItem = new PopupMenu.PopupImageMenuItem('Streak: --', 'starred-symbolic');
            this.menu.addMenuItem(this.streakItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // languages chart container
            this.languagesChartItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            this.languagesChartBox = new St.BoxLayout({ vertical: true, style_class: 'wakapanel-chart-box' });
            this.languagesChartItem.add_child(this.languagesChartBox);
            if (this._settings.get_boolean('show-languages-chart')) {
                this.menu.addMenuItem(this.languagesChartItem);
            }

            // projects chart container
            this.projectsChartItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            this.projectsChartBox = new St.BoxLayout({ vertical: true, style_class: 'wakapanel-chart-box' });
            this.projectsChartItem.add_child(this.projectsChartBox);
            if (this._settings.get_boolean('show-projects-chart')) {
                this.menu.addMenuItem(this.projectsChartItem);
            }

            // editors chart container
            this.editorsChartItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            this.editorsChartBox = new St.BoxLayout({ vertical: true, style_class: 'wakapanel-chart-box' });
            this.editorsChartItem.add_child(this.editorsChartBox);
            if (this._settings.get_boolean('show-editors-chart')) {
                this.menu.addMenuItem(this.editorsChartItem);
            }

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // dashboard button
            this.dashboardButton = new PopupMenu.PopupImageMenuItem('Open WakaTime Dashboard', 'web-browser-symbolic');
            this.menu.addMenuItem(this.dashboardButton);

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

        _switchRange(newRange) {
            this._currentRange = newRange;
            this._updateRangeButtons();
            this._updateStats();
        }

        _updateRangeButtons() {
            this.todayBtn.remove_style_class_name('wakapanel-range-button-active');
            this.week7Btn.remove_style_class_name('wakapanel-range-button-active');
            this.days30Btn.remove_style_class_name('wakapanel-range-button-active');

            if (this._currentRange === 'today') {
                this.todayBtn.add_style_class_name('wakapanel-range-button-active');
            } else if (this._currentRange === 'last_7_days') {
                this.week7Btn.add_style_class_name('wakapanel-range-button-active');
            } else if (this._currentRange === 'last_30_days') {
                this.days30Btn.add_style_class_name('wakapanel-range-button-active');
            }
        }

        _formatDuration(durationText) {
            if (!durationText) {
                return '0m';
            }

            let formatted = durationText.replace(/ hrs?/, 'h');
            formatted = formatted.replace(/ mins?/, 'm');
            formatted = formatted.replace(/ $/, '');

            return formatted.trim();
        }

        async _fetchStreakData() {
            const apiKey = this._settings.get_string('api-key');
            let baseUrl = this._settings.get_string('base-url');
            baseUrl = (baseUrl || 'https://wakatime.com').replace(/\/+$/g, '');

            if (!apiKey) {
                return;
            }

            const url = `${baseUrl}/api/v1/users/current`;

            try {
                const message = Soup.Message.new('GET', url);
                const authString = GLib.base64_encode(new TextEncoder().encode(`${apiKey}:`));
                message.request_headers.append('Authorization', `Basic ${authString}`);

                const bytes = await this._httpSession.send_and_read_async(
                    message,
                    GLib.PRIORITY_DEFAULT,
                    null
                );

                if (message.status_code === Soup.Status.OK) {
                    const decoder = new TextDecoder('utf-8');
                    const jsonString = decoder.decode(bytes.get_data());
                    const data = JSON.parse(jsonString);
                    this._streakData = data.data;
                }
            } catch (e) {
                console.error('Failed to fetch streak data:', e);
            }
        }

        _buildChart(container, title, items, iconName) {
            container.destroy_all_children();

            const titleLabel = new St.Label({
                text: title,
                style_class: 'wakapanel-chart-title'
            });
            container.add_child(titleLabel);

            if (!items || items.length === 0) {
                const emptyLabel = new St.Label({
                    text: 'No data available',
                    style_class: 'wakapanel-chart-empty'
                });
                container.add_child(emptyLabel);
                return;
            }

            const maxTime = items[0].total_seconds || 1;
            const displayCount = Math.min(5, items.length);

            for (let i = 0; i < displayCount; i++) {
                const item = items[i];
                const itemBox = new St.BoxLayout({
                    vertical: false,
                    x_expand: true,
                    style_class: 'wakapanel-chart-item'
                });

                const nameLabel = new St.Label({
                    text: item.name,
                    style_class: 'wakapanel-chart-name',
                    x_expand: false
                });

                const barContainer = new St.Widget({
                    style_class: 'wakapanel-bar-container',
                    x_expand: true
                });

                const percentage = (item.total_seconds / maxTime) * 100;
                const bar = new St.Widget({
                    style_class: 'wakapanel-bar',
                    style: `width: ${percentage}%;`
                });

                barContainer.add_child(bar);

                const timeLabel = new St.Label({
                    text: this._formatDuration(item.text),
                    style_class: 'wakapanel-chart-time',
                    x_expand: false
                });

                itemBox.add_child(nameLabel);
                itemBox.add_child(barContainer);
                itemBox.add_child(timeLabel);

                container.add_child(itemBox);
            }
        }

        async _updateStats() {
            this.label.set_text('...');
            this.totalItem.label.set_text('Total: Loading...');
            this.streakItem.label.set_text('Streak: Loading...');

            const apiKey = this._settings.get_string('api-key');
            let baseUrl = this._settings.get_string('base-url');

            baseUrl = (baseUrl || 'https://wakatime.com').replace(/\/+$/g, '');

            if (!apiKey) {
                this.label.set_text('⚠');
                this.totalItem.label.set_text('Total: Please set API Key in preferences.');
                this.streakItem.label.set_text('Streak: —');
                this._scheduleNextUpdate();
                return;
            }

            const url = `${baseUrl}/api/v1/users/current/summaries?range=${this._currentRange}`;

            try {
                // fetch streak data in parallel
                this._fetchStreakData();

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
                    this.totalItem.label.set_text(`Total: API Error (${message.status_code})`);
                    this.streakItem.label.set_text('Streak: —');
                    this._scheduleNextUpdate();
                    return;
                }

                const decoder = new TextDecoder('utf-8');
                const jsonString = decoder.decode(bytes.get_data());
                const data = JSON.parse(jsonString);

                if (!data?.data?.[0]?.grand_total?.text || data.data[0].grand_total.text === '0 secs') {
                    this.label.set_text('0m');
                    this.totalItem.label.set_text('Total: No coding yet');
                    this._scheduleNextUpdate();
                    return;
                }

                const grandTotalRaw = data.data[0].grand_total.text;
                const formattedGrandTotal = this._formatDuration(grandTotalRaw);

                this.label.set_text(formattedGrandTotal);
                
                let rangeLabel = 'Today';
                if (this._currentRange === 'last_7_days') rangeLabel = 'Last 7 Days';
                if (this._currentRange === 'last_30_days') rangeLabel = 'Last 30 Days';
                
                this.totalItem.label.set_text(`Total (${rangeLabel}): ${grandTotalRaw}`);

                // update streak
                if (this._streakData && this._streakData.streak) {
                    const streak = this._streakData.streak.current_streak_days || 0;
                    this.streakItem.label.set_text(`🔥 Streak: ${streak} days`);
                } else {
                    this.streakItem.label.set_text('Streak: —');
                }

                // update charts
                if (this._settings.get_boolean('show-languages-chart') && data.data[0].languages) {
                    this._buildChart(this.languagesChartBox, '📊 Languages', data.data[0].languages, 'utilities-terminal-symbolic');
                }

                if (this._settings.get_boolean('show-projects-chart') && data.data[0].projects) {
                    this._buildChart(this.projectsChartBox, '📁 Projects', data.data[0].projects, 'folder-symbolic');
                }

                if (this._settings.get_boolean('show-editors-chart') && data.data[0].editors) {
                    this._buildChart(this.editorsChartBox, '✏️ Editors', data.data[0].editors, 'text-editor-symbolic');
                }

            } catch (e) {
                console.error('Failed to fetch/parse WakaTime data:', e);
                this.label.set_text('⚠');
                this.totalItem.label.set_text('Total: Network Error');
                this.streakItem.label.set_text('Streak: —');
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
