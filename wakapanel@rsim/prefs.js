import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class WakaPanelPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // Get the GSettings object for our schema
        const settings = this.getSettings();

        // Create a PreferencesPage
        const page = new Adw.PreferencesPage();
        window.add(page);

        // API Key Group
        const apiKeyGroup = new Adw.PreferencesGroup({
            title: 'WakaTime API Key',
            description: 'Your personal WakaTime API key.',
        });
        page.add(apiKeyGroup);

        // API Key Entry Row
        const apiKeyRow = new Adw.ActionRow({
            title: 'API Key',
        });
        apiKeyGroup.add(apiKeyRow);

        const apiKeyEntry = new Gtk.Entry({
            hexpand: true,
            valign: Gtk.Align.CENTER,
        });
        apiKeyRow.add_suffix(apiKeyEntry);
        apiKeyRow.activatable_widget = apiKeyEntry;

        // Bind the API key entry to GSettings key
        settings.bind(
            'api-key',
            apiKeyEntry,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Link to WakaTime API key settings page
        const apiKeyLinkRow = new Adw.ActionRow({
            title: 'Where to find your API key?',
        });
        apiKeyGroup.add(apiKeyLinkRow);

        const linkButton = new Gtk.LinkButton({
            uri: 'https://wakatime.com/settings/api-key',
            label: 'wakatime.com/settings/api-key',
            hexpand: true,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        apiKeyLinkRow.add_suffix(linkButton);

        //  Base URL Group 
        const baseUrlGroup = new Adw.PreferencesGroup({
            title: 'WakaTime Base URL',
            description: 'The base URL for the WakaTime API. Useful for self-hosted Wakapi instances.',
        });
        page.add(baseUrlGroup);

        const baseUrlRow = new Adw.ActionRow({
            title: 'Base URL',
        });
        baseUrlGroup.add(baseUrlRow);

        const baseUrlEntry = new Gtk.Entry({
            hexpand: true,
            valign: Gtk.Align.CENTER,
        });
        baseUrlRow.add_suffix(baseUrlEntry);
        baseUrlRow.activatable_widget = baseUrlEntry;

        settings.bind(
            'base-url',
            baseUrlEntry,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );

        //  Refresh Interval Group 
        const refreshGroup = new Adw.PreferencesGroup({
            title: 'Refresh Interval',
        });
        page.add(refreshGroup);

        const refreshRow = new Adw.ActionRow({
            title: 'Refresh interval',
            subtitle: 'Time in minutes between WakaTime API calls.',
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
            width_chars: 4,
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
    }
}