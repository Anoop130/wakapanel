// prefs.js
// Imports necessary Gtk and Adw components
const { Adw, Gtk, GObject, Gio } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;

// Get your extension's UUID from metadata.json
const Me = ExtensionUtils.getCurrentExtension();

// Our preferences class, which builds the UI
class WakaPanelPreferences extends GObject.Object {
    _init(params = {}) {
        super._init(params);
        // Get the GSettings object for our schema
        this._settings = ExtensionUtils.getSettings(Me.metadata['settings-schema']);
    }

    fillPreferencesWindow(window) {
        // Create a PreferencesPage
        const page = new Adw.PreferencesPage();
        window.add(page);

        // --- API Key Group ---
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
            hexpand: true, // Expand horizontally
            // In a real production extension, you might consider Adw.PasswordEntry
            // or Gtk.Entry.visibility for security, but for dev, plain is fine.
        });
        apiKeyRow.add_suffix(apiKeyEntry);
        apiKeyRow.activatable_widget = apiKeyEntry; // Make clicking row activate the entry

        // Bind the API key entry to our GSettings key
        // The GSettings key is 'apiKey' (camelCase from your gschema.xml)
        // The widget property is 'text'
        // The binding flags ensure two-way synchronization
        this._settings.bind(
            'api-key', // GSettings key name
            apiKeyEntry, // Widget to bind to
            'text',      // Widget property to bind
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
            xalign: 0.0, // Align text to the start
        });
        apiKeyLinkRow.add_suffix(linkButton);


        // --- Base URL Group ---
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
        });
        baseUrlRow.add_suffix(baseUrlEntry);
        baseUrlRow.activatable_widget = baseUrlEntry;

        this._settings.bind(
            'base-url', // GSettings key name
            baseUrlEntry,
            'text',
            Gio.SettingsBindFlags.DEFAULT
        );


        // --- Refresh Interval Group ---
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
                lower: 1,     // Minimum 1 minute
                upper: 60,    // Maximum 60 minutes (or more if you prefer)
                step_increment: 1,
                page_increment: 5,
            }),
            numeric: true,
            value: this._settings.get_int('refresh-interval'), // Set initial value from settings
            width_chars: 4, // Make it wide enough for a few digits
        });
        refreshRow.add_suffix(refreshSpinButton);
        refreshRow.activatable_widget = refreshSpinButton;

        this._settings.bind(
            'refresh-interval', // GSettings key name
            refreshSpinButton,
            'value', // SpinButton's value property
            Gio.SettingsBindFlags.DEFAULT
        );
    }
}

// Export the preferences class for GNOME Shell
function init() {
    return new WakaPanelPreferences();
}