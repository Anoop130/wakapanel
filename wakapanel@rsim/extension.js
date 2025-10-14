const { GObject, St, Gio, Soup, GLib } = imports.gi;
const ByteArray = imports.byteArray;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();

let _panelButton;

const WakaPanelButton = GObject.registerClass(
    { GTypeName: 'WakaPanelButton' },
    class WakaPanelButton extends PanelMenu.Button {
        _init() {
            super._init(0.0, Me.metadata.name);

            this._httpSession = new Soup.Session();
            this._timeoutSourceId = 0;

            // GSettings for preferences
            try {
                this._settings = ExtensionUtils.getSettings(Me.metadata['settings-schema']);
            } catch (e) {
                this._settings = null;
                log(`[${Me.metadata.name}] Warning: settings schema not available: ${e.message}`);
            }

            // Label shown on the panel
            this.label = new St.Label({
                text: '--m',
                y_align: St.Align.MIDDLE,
            });
            this.add_child(this.label);

            // Menu items
            this.totalLabel = new St.Label({ text: 'Today Total: --', x_align: St.Align.START });
            this.totalItem = new PopupMenu.PopupMenuItem(this.totalLabel);
            this.menu.addMenuItem(this.totalItem);

            this.projectLabel = new St.Label({ text: 'Top Project: --', x_align: St.Align.START });
            this.projectItem = new PopupMenu.PopupMenuItem(this.projectLabel);
            this.menu.addMenuItem(this.projectItem);

            this.languageLabel = new St.Label({ text: 'Top Language: --', x_align: St.Align.START });
            this.languageItem = new PopupMenu.PopupMenuItem(this.languageLabel);
            this.menu.addMenuItem(this.languageItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.dashboardButton = new PopupMenu.PopupMenuItem('Open WakaTime Dashboard');
            this.menu.addMenuItem(this.dashboardButton);

            // Connect the activate signal to open the dashboard
            this.dashboardButton.connect('activate', () => {
                log(`[${Me.metadata.name}] Opening WakaTime Dashboard.`);
                if (!this._settings) {
                    log(`[${Me.metadata.name}] Cannot open dashboard: Settings not available.`);
                    return;
                }
                const baseUrl = this._settings.get_string('base-url');
                const dashboardUrl = `${baseUrl}/dashboard`;

                try {
                    Gio.AppInfo.launch_default_for_uri(dashboardUrl, null);
                    this.menu.close(false);
                } catch (e) {
                    logError(e, `[${Me.metadata.name}] Failed to open dashboard URL: ${dashboardUrl}`);
                }
            });
        }

        // Helper to format duration text to "xh ym"
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
            log(`[${Me.metadata.name}] Updating stats...`);

            this.label.set_text('Loading...');
            this.totalLabel.set_text('Today Total: Loading...');
            this.projectLabel.set_text('Top Project: Loading...');
            this.languageLabel.set_text('Top Language: Loading...');

            if (!this._settings) {
                this.label.set_text('Error!');
                this.totalLabel.set_text('Today Total: Settings error');
                this.projectLabel.set_text('Top Project: N/A');
                this.languageLabel.set_text('Top Language: N/A');
                this._scheduleNextUpdate();
                return;
            }

            const apiKey = this._settings.get_string('api-key');
            let baseUrl = this._settings.get_string('base-url');

            baseUrl = (baseUrl || 'https://wakatime.com').replace(/\/+$/g, '');

            if (!apiKey) {
                this.label.set_text('API Key Missing!');
                this.totalLabel.set_text('Today Total: Please set API Key in preferences.');
                this.projectLabel.set_text('Top Project: N/A');
                this.languageLabel.set_text('Top Language: N/A');
                this._scheduleNextUpdate();
                return;
            }

            const url = `${baseUrl}/api/v1/users/current/summaries?range=today`;
            log(`[${Me.metadata.name}] Fetching from: ${url}`);

            try {
                const message = Soup.Message.new('GET', url);
                const authString = GLib.base64_encode(ByteArray.fromString(`${apiKey}:`));
                message.request_headers.append('Authorization', `Basic ${authString}`);

                const responseBytes = await this._httpSession.send_and_read_async(message, null);

                if (message.status_code !== Soup.Status.OK) {
                    this.label.set_text('API Error!');
                    this.totalLabel.set_text(`API Error: ${message.status_code}`);
                    this.projectLabel.set_text('Top Project: Check API Key / URL');
                    this.languageLabel.set_text('Top Language: N/A');
                    return;
                }

                const jsonString = ByteArray.toString(responseBytes);
                const data = JSON.parse(jsonString);

                if (!data?.data?.[0]?.grand_total?.text || data.data[0].grand_total.text === '0 secs') {
                    this.label.set_text('0m');
                    this.totalLabel.set_text('Today Total: No coding yet');
                    this.projectLabel.set_text('Top Project: No coding yet');
                    this.languageLabel.set_text('Top Language: No coding yet');
                    return;
                }

                const grandTotalRaw = data.data[0].grand_total.text;
                const topProject = data.data[0].projects?.[0];
                const topLanguage = data.data[0].languages?.[0];

                const formattedGrandTotal = this._formatDuration(grandTotalRaw);
                const formattedProjectTime = topProject ? this._formatDuration(topProject.total_text) : '';
                const formattedLanguageTime = topLanguage ? this._formatDuration(topLanguage.total_text) : '';

                this.label.set_text(formattedGrandTotal);
                this.totalLabel.set_text(`Today Total: ${grandTotalRaw}`);
                this.projectLabel.set_text(`Top Project: ${topProject?.name || 'N/A'} ${formattedProjectTime ? `(${formattedProjectTime})` : ''}`);
                this.languageLabel.set_text(`Top Language: ${topLanguage?.name || 'N/A'} ${formattedLanguageTime ? `(${formattedLanguageTime})` : ''}`);

            } catch (e) {
                logError(e, `[${Me.metadata.name}] Failed to fetch/parse WakaTime data.`);
                this.label.set_text('Error!');
                this.totalLabel.set_text('Today Total: Network Error');
                this.projectLabel.set_text('Top Project: N/A');
                this.languageLabel.set_text('Top Language: N/A');
            } finally {
                this._scheduleNextUpdate();
            }
        }

        _scheduleNextUpdate() {
            if (this._timeoutSourceId > 0) {
                GLib.source_remove(this._timeoutSourceId);
                this._timeoutSourceId = 0;
            }

            if (!this._settings) {
                log(`[${Me.metadata.name}] Cannot schedule next update: Settings not available.`);
                return;
            }

            const refreshMinutes = this._settings.get_int('refresh-interval');
            const intervalSec = Math.max(60, refreshMinutes * 60);

            log(`[${Me.metadata.name}] Next update scheduled in ${intervalSec / 60} minutes.`);

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
                this._httpSession.cancel_all_messages();
            }
            super.destroy();
        }
    }
);

function init() {
    log(`${Me.metadata.name} initializing`);
}

function enable() {
    log(`${Me.metadata.name} enabling`);
    _panelButton = new WakaPanelButton();
    Main.panel.addToStatusArea(Me.uuid, _panelButton);
    _panelButton._updateStats();
}

function disable() {
    log(`${Me.metadata.name} disabling`);
    if (_panelButton) {
        _panelButton.destroy();
        _panelButton = null;
    }
}