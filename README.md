# WakaPanel

A minimalist GNOME Shell extension that displays your WakaTime coding statistics directly in your top panel.

![GNOME Shell Version](https://img.shields.io/badge/GNOME%20Shell-45%20|%2046%20|%2047-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 📊 **Real-time Stats**: Shows today's total coding time in the panel
- 📁 **Top Project**: View your most active project
- 💻 **Top Language**: See which language you're coding in most
- 🔄 **Auto-refresh**: Configurable refresh interval (1-60 minutes)
- 🌐 **Self-hosted Support**: Works with WakaTime API
- 🎨 **Minimalist Design**: Clean, unobtrusive interface with icons

## Screenshots

> Add screenshots here showing the panel and menu

## Installation

### From Source (Manual Installation)

1. Download or clone this repository:
   ```bash
   git clone https://github.com/Anoop130/wakapanel.git
   cd wakapanel
   ```

2. Copy the extension to your GNOME extensions directory:
   ```bash
   cp -r wakapanel@rsim ~/.local/share/gnome-shell/extensions/
   ```

3. Compile the settings schema:
   ```bash
   cd ~/.local/share/gnome-shell/extensions/wakapanel@rsim/schemas
   glib-compile-schemas .
   ```

4. Restart GNOME Shell:
   - **X11**: Press `Alt+F2`, type `r`, and press Enter
   - **Wayland**: Log out and log back in
   - If you do not understand this, best guess is to logout and log back in.

5. Enable the extension:
   ```bash
   gnome-extensions enable wakapanel@rsim
   ```

### From ZIP File

1. Download the latest `wakapanel@rsim.shell-extension.zip` from [Releases](https://github.com/Anoop130/wakapanel/releases)
2. Install using GNOME Extensions app or command line:
   ```bash
   gnome-extensions install wakapanel@rsim.shell-extension.zip
   gnome-extensions enable wakapanel@rsim
   ```

## Configuration

1. Open Extension Settings (GNOME Extensions app or `gnome-extensions prefs wakapanel@rsim`)
2. Enter your WakaTime API Key (get it from [wakatime.com/settings/api-key](https://wakatime.com/settings/api-key))
3. (Optional) Set refresh interval (default: 1 minute)

## Usage

Once configured, WakaPanel will:
- Display your coding time in the top panel (e.g., "2h 15m")
- Show detailed stats in the dropdown menu
- Update automatically based on your refresh interval
- Provide a quick link to your WakaTime dashboard

## Requirements

- GNOME Shell 45, 46, or 47
- WakaTime account and API key
- Active WakaTime integration in your code editor (see [wakatime.com/integrations](https://wakatime.com/integrations))

## Compatibility

- ✅ WakaTime (wakatime.com)
- ✅ Wakapi (self-hosted)
- ✅ Any WakaTime-compatible API

## Development

```bash
# Clone the repository
git clone https://github.com/Anoop130/wakapanel.git
cd wakapanel

# Install to local extensions directory
ln -s $(pwd)/wakapanel@rsim ~/.local/share/gnome-shell/extensions/wakapanel@rsim

# View logs
journalctl -f -o cat /usr/bin/gnome-shell
```

## Troubleshooting

### Extension not showing
- Make sure you've enabled the extension: `gnome-extensions enable wakapanel@rsim`
- Check logs: `journalctl -f -o cat /usr/bin/gnome-shell`

### "API Key Missing" error
- Open preferences and ensure your API key is entered
- Verify your API key at [wakatime.com/settings/api-key](https://wakatime.com/settings/api-key)

### Settings not saving
- Ensure schemas are compiled: `glib-compile-schemas ~/.local/share/gnome-shell/extensions/wakapanel@rsim/schemas/`
- Restart GNOME Shell after installation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

- Built with ❤️ for the GNOME community
- Powered by [WakaTime](https://wakatime.com)

## Support

If you find this extension useful, consider:
- ⭐ Starring the repository
- 🐛 Reporting issues
- 🔀 Contributing improvements

---

**Note**: This is an unofficial extension and is not affiliated with WakaTime.
