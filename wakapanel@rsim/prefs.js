import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class WakaPanelPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // preferences page
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        // API key group
        const apiKeyGroup = new Adw.PreferencesGroup({
            title: 'WakaTime API Key',
            description: 'Your personal WakaTime API key.',
        });
        page.add(apiKeyGroup);

        // API key entry row
        const apiKeyRow = new Adw.PasswordEntryRow({
            title: 'API Key',
        });
        apiKeyGroup.add(apiKeyRow);

        // bind API key entry to GSettings key
        settings.bind(
            'api-key',
            apiKeyRow,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );

        // link to WakaTime API key settings page
        const apiKeyLinkRow = new Adw.ActionRow({
            title: 'Where to find your API key?',
            subtitle: 'Get your API key from WakaTime settings',
        });
        apiKeyGroup.add(apiKeyLinkRow);

        const linkButton = new Gtk.LinkButton({
            uri: 'https://wakatime.com/settings/api-key',
            label: 'Open WakaTime Settings',
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        apiKeyLinkRow.add_suffix(linkButton);

        // base URL group
        const baseUrlGroup = new Adw.PreferencesGroup({
            title: 'Base URL',
            description: 'For self-hosted Wakapi instances. Leave default for WakaTime.',
        });
        page.add(baseUrlGroup);

        const baseUrlRow = new Adw.EntryRow({
            title: 'Base URL',
        });
        baseUrlGroup.add(baseUrlRow);

        settings.bind(
            'base-url',
            baseUrlRow,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );

        // refresh interval group
        const refreshGroup = new Adw.PreferencesGroup({
            title: 'Refresh Settings',
            description: 'How often to update your coding stats.',
        });
        page.add(refreshGroup);

        const refreshRow = new Adw.ActionRow({
            title: 'Refresh Interval',
            subtitle: 'Minutes between API calls',
        });
        refreshGroup.add(refreshRow);

        const refreshSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 60,
                step_increment: 1,
                page_increment: 5,
            }),
            numeric: true,
            valign: Gtk.Align.CENTER,
        });
        refreshSpinButton.set_value(settings.get_int('refresh-interval'));
        refreshRow.add_suffix(refreshSpinButton);
        refreshRow.activatable_widget = refreshSpinButton;

        settings.bind(
            'refresh-interval',
            refreshSpinButton,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        // display options group
        const displayGroup = new Adw.PreferencesGroup({
            title: 'Display Options',
            description: 'Choose what to show in the dropdown menu.',
        });
        page.add(displayGroup);

        // show languages chart
        const showLanguagesRow = new Adw.SwitchRow({
            title: 'Show Languages Chart',
            subtitle: 'Display programming languages breakdown',
        });
        settings.bind('show-languages-chart', showLanguagesRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        displayGroup.add(showLanguagesRow);

        // show projects chart
        const showProjectsRow = new Adw.SwitchRow({
            title: 'Show Projects Chart',
            subtitle: 'Display projects breakdown',
        });
        settings.bind('show-projects-chart', showProjectsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        displayGroup.add(showProjectsRow);

        // show editors chart
        const showEditorsRow = new Adw.SwitchRow({
            title: 'Show Editors Chart',
            subtitle: 'Display editors breakdown',
        });
        settings.bind('show-editors-chart', showEditorsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        displayGroup.add(showEditorsRow);

        // default time range group
        const rangeGroup = new Adw.PreferencesGroup({
            title: 'Default Time Range',
            description: 'Default time range when extension loads.',
        });
        page.add(rangeGroup);

        const rangeRow = new Adw.ComboRow({
            title: 'Default Range',
            subtitle: 'Can be changed in dropdown',
        });
        const rangeModel = new Gtk.StringList();
        rangeModel.append('Today');
        rangeModel.append('Last 7 Days');
        rangeModel.append('Last 30 Days');
        rangeRow.set_model(rangeModel);

        // set initial value
        const currentRange = settings.get_string('default-range');
        if (currentRange === 'last_7_days') {
            rangeRow.set_selected(1);
        } else if (currentRange === 'last_30_days') {
            rangeRow.set_selected(2);
        } else {
            rangeRow.set_selected(0);
        }

        // connect signal to save changes
        rangeRow.connect('notify::selected', () => {
            const selected = rangeRow.get_selected();
            if (selected === 1) {
                settings.set_string('default-range', 'last_7_days');
            } else if (selected === 2) {
                settings.set_string('default-range', 'last_30_days');
            } else {
                settings.set_string('default-range', 'today');
            }
        });

        rangeGroup.add(rangeRow);
    }
}