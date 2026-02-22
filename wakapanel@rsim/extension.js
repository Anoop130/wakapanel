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
                icon_name: 'utilities-system-monitor-symbolic',
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

            // Constrain the popup menu box width
            this.menu.box.style_class = 'wakapanel-menu-box';

            this._buildMenu();
        }

        _buildMenu() {
            // ── Branded header ──
            const headerItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: 'wakapanel-header-item' });
            const headerBox = new St.BoxLayout({ vertical: false, x_expand: true, y_align: Clutter.ActorAlign.CENTER, style_class: 'wakapanel-header-box' });

            const headerLabel = new St.Label({
                text: 'WakaPanel',
                style_class: 'wakapanel-header-label',
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
            });

            const headerSub = new St.Label({
                text: 'coding stats',
                style_class: 'wakapanel-header-sub',
                y_align: Clutter.ActorAlign.CENTER,
            });

            headerBox.add_child(headerLabel);
            headerBox.add_child(headerSub);
            headerItem.add_child(headerBox);
            this.menu.addMenuItem(headerItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // time range toggle
            this.rangeItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: 'wakapanel-range-container' });
            const rangeBox = new St.BoxLayout({ vertical: false, x_expand: true, style_class: 'wakapanel-range-box' });

            this.todayBtn  = new St.Button({ label: 'Today',   style_class: 'wakapanel-range-button', x_expand: true });
            this.week7Btn  = new St.Button({ label: '7 Days',  style_class: 'wakapanel-range-button', x_expand: true });
            this.days30Btn = new St.Button({ label: '30 Days', style_class: 'wakapanel-range-button', x_expand: true });

            this.todayBtn.connect('clicked',  () => this._switchRange('today'));
            this.week7Btn.connect('clicked',  () => this._switchRange('last_7_days'));
            this.days30Btn.connect('clicked', () => this._switchRange('last_30_days'));

            rangeBox.add_child(this.todayBtn);
            rangeBox.add_child(this.week7Btn);
            rangeBox.add_child(this.days30Btn);
            this.rangeItem.add_child(rangeBox);
            this.menu.addMenuItem(this.rangeItem);

            this._updateRangeButtons();

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // main stats
            this.totalItem = new PopupMenu.PopupMenuItem('Total: --');
            this.totalItem.add_style_class_name('wakapanel-stat-item');
            this.menu.addMenuItem(this.totalItem);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // languages chart container
            this.languagesChartItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            this.languagesChartBox = new St.BoxLayout({ vertical: true, style_class: 'wakapanel-chart-box' });
            this.languagesChartItem.add_child(this.languagesChartBox);
            if (this._settings.get_boolean('show-languages-chart')) {
                this.menu.addMenuItem(this.languagesChartItem);
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }

            // projects chart container
            this.projectsChartItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            this.projectsChartBox = new St.BoxLayout({ vertical: true, style_class: 'wakapanel-chart-box' });
            this.projectsChartItem.add_child(this.projectsChartBox);
            if (this._settings.get_boolean('show-projects-chart')) {
                this.menu.addMenuItem(this.projectsChartItem);
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }

            // editors chart container
            this.editorsChartItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            this.editorsChartBox = new St.BoxLayout({ vertical: true, style_class: 'wakapanel-chart-box' });
            this.editorsChartItem.add_child(this.editorsChartBox);
            if (this._settings.get_boolean('show-editors-chart')) {
                this.menu.addMenuItem(this.editorsChartItem);
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
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

            if (!apiKey) return;

            // all_time stats gives the true lifetime current streak, not bounded to a window
            // Response: { data: { streak: { current: N, longest: N } } }
            const bytes = await this._httpFetch(`${baseUrl}/api/v1/users/current/stats/all_time`);
            if (!bytes) return;

            try {
                const json = JSON.parse(new TextDecoder('utf-8').decode(bytes.get_data()));
                this._streakData = json?.data ?? null;
            } catch (e) {
                console.error('Failed to parse streak response:', e);
            }
        }

        /**
         * Builds a chart section inside `container`.
         *
         * Bar rendering notes for GNOME Shell / Clutter:
         *   - St.Widget uses ClutterFixedLayout: children don't auto-position, they
         *     all overlap at (0,0). Using it as a bar track means the filled bar
         *     renders on top of the track background but may not align properly.
         *   - St.BoxLayout uses ClutterBoxLayout: children are placed sequentially.
         *     We use a horizontal BoxLayout as the track with the filled bar as the
         *     first (and only) child — it naturally anchors to the left edge.
         *   - Both track and bar have fixed pixel heights set via inline style so
         *     Clutter doesn't collapse them to zero.
         *   - Track width is fixed at BAR_MAX_PX via inline style; bar width is
         *     proportional in pixels (ratio × BAR_MAX_PX), minimum 2px.
         */
        _buildChart(container, title, items, _iconName, _unused, _unused2) {
            const BAR_MAX_PX = 130; // px width of the full bar track
            const BAR_H_PX  = 7;   // px height — must match .wakapanel-bar height

            container.destroy_all_children();

            const titleLabel = new St.Label({
                text: title,
                style_class: 'wakapanel-chart-title',
            });
            container.add_child(titleLabel);

            if (!items || items.length === 0) {
                const emptyLabel = new St.Label({
                    text: 'No data available',
                    style_class: 'wakapanel-chart-empty',
                });
                container.add_child(emptyLabel);
                return;
            }

            const totalTime = items.reduce((sum, item) => sum + (item.total_seconds || 0), 0);
            const displayCount = Math.min(5, items.length);

            for (let i = 0; i < displayCount; i++) {
                const item        = items[i];
                const percentage  = ((item.total_seconds / totalTime) * 100).toFixed(1);
                // Scale bar relative to totalTime so the bar width visually matches the % shown
                const barFilledPx = Math.max(2, Math.round((item.total_seconds / totalTime) * BAR_MAX_PX));

                // Outer row
                const itemBox = new St.BoxLayout({
                    vertical: false,
                    x_expand: true,
                    style_class: 'wakapanel-chart-item',
                });

                // Name column — ellipsize long names
                const nameLabel = new St.Label({
                    text: item.name,
                    style_class: 'wakapanel-chart-name',
                    x_expand: false,
                });
                nameLabel.clutter_text.ellipsize = 3; // PANGO_ELLIPSIZE_END

                // Time column
                const timeLabel = new St.Label({
                    text: this._formatDuration(item.text),
                    style_class: 'wakapanel-chart-time',
                    x_expand: false,
                });

                // Track: horizontal BoxLayout so the filled child anchors left
                // Fixed pixel size via inline style — no CSS width/height needed
                const barTrack = new St.BoxLayout({
                    vertical: false,
                    x_expand: false,
                    y_align: Clutter.ActorAlign.CENTER,
                    style: `
                        width: ${BAR_MAX_PX}px;
                        height: ${BAR_H_PX}px;
                        background-color: rgba(255,255,255,0.10);
                        border-radius: 4px;
                    `,
                });

                // Filled bar: fixed pixel width, colour from CSS class
                const bar = new St.Widget({
                    x_expand: false,
                    y_expand: true,
                    style_class: `wakapanel-bar-${i}`,
                    style: `
                        width: ${barFilledPx}px;
                        border-radius: 4px;
                    `,
                });
                barTrack.add_child(bar);

                // Percent column
                const percentLabel = new St.Label({
                    text: `${percentage}%`,
                    style_class: 'wakapanel-chart-percent',
                    x_expand: false,
                });

                itemBox.add_child(nameLabel);
                itemBox.add_child(timeLabel);
                itemBox.add_child(barTrack);
                itemBox.add_child(percentLabel);
                container.add_child(itemBox);
            }
        }

        async _updateStats() {
            this.label.set_text('...');
            this.totalItem.label.set_text('Total: Loading...');

            const apiKey = this._settings.get_string('api-key');
            let baseUrl = this._settings.get_string('base-url');

            baseUrl = (baseUrl || 'https://wakatime.com').replace(/\/+$/g, '');

            if (!apiKey) {
                this.label.set_text('⚠');
                this.totalItem.label.set_text('Total: Please set API Key in preferences.');
                this._scheduleNextUpdate();
                return;
            }

            const summaryUrl = `${baseUrl}/api/v1/users/current/summaries?range=${this._currentRange}`;

            try {
                // Fetch summary and streak in parallel — neither blocks the other
                const [summaryBytes] = await Promise.all([
                    this._httpFetch(summaryUrl),
                    this._fetchStreakData(),   // updates this._streakData as a side-effect
                ]);

                if (!summaryBytes) {
                    this.label.set_text('⚠');
                    this.totalItem.label.set_text('Total: Network Error');
                    this._scheduleNextUpdate();
                    return;
                }

                const decoder   = new TextDecoder('utf-8');
                const data      = JSON.parse(decoder.decode(summaryBytes.get_data()));

                // For multi-day ranges the API returns one entry per day in data.data[].
                // Aggregate grand_total across all days so "30 Days" reflects the full period.
                const allDays = data?.data ?? [];
                const totalSecs = allDays.reduce(
                    (sum, day) => sum + (day?.grand_total?.total_seconds ?? 0), 0
                );

                // Merge language/project/editor arrays across all days
                const mergeItems = (key) => {
                    const map = new Map();
                    for (const day of allDays) {
                        for (const item of (day[key] ?? [])) {
                            const prev = map.get(item.name) ?? { ...item, total_seconds: 0 };
                            prev.total_seconds += item.total_seconds ?? 0;
                            map.set(item.name, prev);
                        }
                    }
                    // Re-generate .text for the merged totals
                    const sorted = [...map.values()].sort((a, b) => b.total_seconds - a.total_seconds);
                    for (const item of sorted) {
                        item.text = this._secondsToText(item.total_seconds);
                    }
                    return sorted;
                };

                if (totalSecs === 0) {
                    this.label.set_text('0m');
                    this.totalItem.label.set_text('Total: No coding yet');
                    this._scheduleNextUpdate();
                    return;
                }

                const totalText = this._secondsToText(totalSecs);
                this.label.set_text(this._formatDuration(totalText));

                this.totalItem.label.set_text(`Total: ${totalText}`);


                // Charts — use merged data across all days
                if (this._settings.get_boolean('show-languages-chart')) {
                    this._buildChart(this.languagesChartBox, 'Languages', mergeItems('languages'), null, false, false);
                    // 📊 📁 ✏️ 
                }
                if (this._settings.get_boolean('show-projects-chart')) {
                    this._buildChart(this.projectsChartBox, 'Projects', mergeItems('projects'), null, false, true);
                }
                if (this._settings.get_boolean('show-editors-chart')) {
                    this._buildChart(this.editorsChartBox, 'Editors', mergeItems('editors'), null, false, false);
                }

            } catch (e) {
                console.error('Failed to fetch/parse WakaTime data:', e);
                this.label.set_text('⚠');
                this.totalItem.label.set_text('Total: Network Error');
            } finally {
                this._scheduleNextUpdate();
            }
        }

        // Simple HTTP GET helper — returns the raw GLib.Bytes or null on error
        async _httpFetch(url) {
            try {
                const apiKey = this._settings.get_string('api-key');
                const message = Soup.Message.new('GET', url);
                const authString = GLib.base64_encode(new TextEncoder().encode(`${apiKey}:`));
                message.request_headers.append('Authorization', `Basic ${authString}`);
                const bytes = await this._httpSession.send_and_read_async(
                    message, GLib.PRIORITY_DEFAULT, null
                );
                return message.status_code === Soup.Status.OK ? bytes : null;
            } catch (e) {
                console.error('HTTP fetch failed:', url, e);
                return null;
            }
        }

        // Convert raw seconds to a human-readable string (e.g. "2 hrs 14 mins")
        _secondsToText(totalSeconds) {
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            if (h > 0 && m > 0) return `${h} hr${h !== 1 ? 's' : ''} ${m} min${m !== 1 ? 's' : ''}`;
            if (h > 0)          return `${h} hr${h !== 1 ? 's' : ''}`;
            if (m > 0)          return `${m} min${m !== 1 ? 's' : ''}`;
            return `${s} sec${s !== 1 ? 's' : ''}`;
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