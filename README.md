# Activate Linux

A GNOME extension that adds an "Activate Linux" watermark to your desktop, inspired by the "Activate Windows" watermark.

## Features

- Customizable main and secondary messages
- Customizable font face, style, size, and color
- Customizable position (X and Y margins)
- Toggle to show the watermark over all windows or only on the desktop background
- Works on Wayland

## Installation

### From GNOME Extensions

(Coming soon)

### Manual Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/bbbenji/gnome-shell-extension-activate-linux.git
   ```
2. Navigate to the extension directory:
   ```bash
   cd activate-linux
   ```
3. Compile the schemas:
   ```bash
   glib-compile-schemas schemas/
   ```
4. Copy the extension files to your local extension directory:
   ```bash
   ext_dir="$HOME/.local/share/gnome-shell/extensions/activate-linux@bbbenji"
   mkdir -p "$ext_dir"
   cp -r * "$ext_dir"/
   ```
5. Restart GNOME Shell:
   - **X11**: Press `Alt` + `F2`, type `r`, and press `Enter`.
   - **Wayland**: Log out and log back in.
6. Enable the extension via the Extensions app or using the command line:
   ```bash
   gnome-extensions enable activate-linux@bbbenji
   ```

## Configuration

You can configure the extension's behavior and appearance using the GNOME Extensions app. Click the settings gear icon next to "Activate Linux" to access the preferences:

- **Appearance**: Set the text for the main and secondary messages, and customize the font face, style, and color (CSS format, e.g., `rgba(255, 255, 255, 0.5)`).
- **Position & Size**: Adjust the font size, set the X and Y margins from the bottom right corner, and toggle whether the watermark should overlay all windows or stay on the desktop background.
