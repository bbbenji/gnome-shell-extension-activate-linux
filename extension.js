import GLib from "gi://GLib";
import St from "gi://St";
import Meta from "gi://Meta";
import Shell from "gi://Shell";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

export default class ActivateLinuxExtension extends Extension {
  enable() {
    this._settings = this.getSettings();

    this._container = new St.BoxLayout({
      vertical: true,
      style_class: "activate-linux-container",
      reactive: false,
    });

    this._mainLabel = new St.Label({
      style_class: "activate-linux-main-label",
    });

    this._secondaryLabel = new St.Label({
      style_class: "activate-linux-secondary-label",
    });

    this._mainLabel.clutter_text.line_wrap = true;
    this._secondaryLabel.clutter_text.line_wrap = true;

    this._container.add_child(this._mainLabel);
    this._container.add_child(this._secondaryLabel);

    this._settingsChangedId = this._settings.connect(
      "changed",
      this._debouncedUpdate.bind(this),
    );
    this._monitorsChangedId = Main.layoutManager.connect(
      "monitors-changed",
      this._debouncedUpdate.bind(this),
    );

    Main.wm.addKeybinding(
      "toggle-show-over-windows-shortcut",
      this._settings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.ALL,
      () => {
        const current = this._settings.get_boolean("show-over-windows");
        this._settings.set_boolean("show-over-windows", !current);
      }
    );

    this._updateUI();
  }

  disable() {
    if (this._updateTimeoutId) {
      GLib.source_remove(this._updateTimeoutId);
      this._updateTimeoutId = null;
    }

    if (this._settingsChangedId) {
      this._settings.disconnect(this._settingsChangedId);
      this._settingsChangedId = null;
    }

    if (this._monitorsChangedId) {
      Main.layoutManager.disconnect(this._monitorsChangedId);
      this._monitorsChangedId = null;
    }

    Main.wm.removeKeybinding("toggle-show-over-windows-shortcut");

    if (this._container) {
      if (this._container.get_parent()) {
        this._container.get_parent().remove_child(this._container);
      }
      this._container.destroy();
      this._container = null;
    }

    this._settings = null;
    this._mainLabel = null;
    this._secondaryLabel = null;
  }

  _debouncedUpdate() {
    if (this._updateTimeoutId) {
      GLib.source_remove(this._updateTimeoutId);
    }
    this._updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      this._updateUI();
      this._updateTimeoutId = null;
      return GLib.SOURCE_REMOVE;
    });
  }

  _updateUI() {
    if (!this._container) return;

    const mainMessage = this._settings.get_string("main-message");
    const secondaryMessage = this._settings.get_string("secondary-message");
    const fontFace = this._settings.get_string("font-face");
    const fontStyle = this._settings.get_string("font-style");
    const fontColor = this._settings.get_string("font-color");
    const fontSize = this._settings.get_int("font-size");
    const showOverWindows = this._settings.get_boolean("show-over-windows");

    if (this._container.get_parent()) {
      this._container.get_parent().remove_child(this._container);
    }

    if (showOverWindows) {
      Main.layoutManager.uiGroup.add_child(this._container);
    } else {
      Main.layoutManager._backgroundGroup.add_child(this._container);
    }

    this._mainLabel.set_text(mainMessage);
    this._secondaryLabel.set_text(secondaryMessage);

    const mainStyle = `font-family: '${fontFace}'; font-style: ${fontStyle}; color: ${fontColor}; font-size: ${fontSize}pt;`;
    const secondaryStyle = `font-family: '${fontFace}'; font-style: ${fontStyle}; color: ${fontColor}; font-size: ${Math.round(fontSize * 0.6)}pt;`;

    this._mainLabel.set_style(mainStyle);
    this._secondaryLabel.set_style(secondaryStyle);

    this._updatePosition();
  }

  _updatePosition() {
    if (!this._container) return;

    const posX = this._settings.get_int("pos-x");
    const posY = this._settings.get_int("pos-y");

    const monitorIndex = Main.layoutManager.primaryIndex;
    if (monitorIndex < 0) return;
    const monitor = Main.layoutManager.monitors[monitorIndex];

    if (!monitor) return;

    const [, natWidth] = this._container.get_preferred_width(-1);
    const [, natHeight] = this._container.get_preferred_height(natWidth);

    const x = monitor.x + monitor.width - natWidth - posX;
    const y = monitor.y + monitor.height - natHeight - posY;

    this._container.set_position(Math.round(x), Math.round(y));
  }
}
