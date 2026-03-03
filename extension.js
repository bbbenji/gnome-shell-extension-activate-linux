import GLib from "gi://GLib";
import St from "gi://St";
import Meta from "gi://Meta";
import Shell from "gi://Shell";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

export default class ActivateLinuxExtension extends Extension {
  enable() {
    this._settings = this.getSettings();
    this._containersData = []; // Array of { container, mainLabel, secondaryLabel, monitorIndex }

    this._osName = "Linux";
    this._kernelVersion = "Unknown kernel";
    try {
        const [successOS, contentsOS] = GLib.file_get_contents('/etc/os-release');
        if (successOS) {
            const osRelease = new TextDecoder().decode(contentsOS);
            const prettyNameMatch = osRelease.match(/^PRETTY_NAME="?(.*?)"?$/m);
            if (prettyNameMatch) this._osName = prettyNameMatch[1];
        }
    } catch {
        /* ignore missing file */
    }
    try {
        const [successKernel, contentsKernel] = GLib.file_get_contents('/proc/sys/kernel/osrelease');
        if (successKernel) {
            this._kernelVersion = new TextDecoder().decode(contentsKernel).trim();
        }
    } catch {
        /* ignore missing file */
    }

    this._desktopEnvironment = GLib.getenv("XDG_CURRENT_DESKTOP") || "GNOME";
    this._sessionType = GLib.getenv("XDG_SESSION_TYPE") || "Wayland/X11";

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

    this._clearContainers();
    this._settings = null;
  }

  _clearContainers() {
      if (!this._containersData) return;
      for (const data of this._containersData) {
          if (data.container.get_parent()) {
              data.container.get_parent().remove_child(data.container);
          }
          data.container.destroy();
      }
      this._containersData = [];
  }

  _createContainer() {
    const container = new St.BoxLayout({
      vertical: true,
      style_class: "activate-linux-container",
      reactive: false,
    });

    const mainLabel = new St.Label({
      style_class: "activate-linux-main-label",
    });

    const secondaryLabel = new St.Label({
      style_class: "activate-linux-secondary-label",
    });

    mainLabel.clutter_text.line_wrap = true;
    secondaryLabel.clutter_text.line_wrap = true;

    container.add_child(mainLabel);
    container.add_child(secondaryLabel);
    
    return { container, mainLabel, secondaryLabel };
  }

  _replacePlaceholders(text) {
      if (!text) return "";
      return text
          .replace(/\{\{OS\}\}/g, this._osName)
          .replace(/\{\{KERNEL\}\}/g, this._kernelVersion)
          .replace(/\{\{DE\}\}/g, this._desktopEnvironment)
          .replace(/\{\{WAYLAND\}\}/gi, this._sessionType === 'wayland' ? 'Wayland' : '')
          .replace(/\{\{X11\}\}/gi, this._sessionType === 'x11' ? 'X11' : '')
          .replace(/\{\{WAYLAND_X11\}\}/gi, this._sessionType);
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
    this._clearContainers();

    const monitorPref = this._settings.get_string("monitor-preference");
    let targetMonitors = [];

    if (monitorPref === "all") {
        for (let i = 0; i < Main.layoutManager.monitors.length; i++) {
            targetMonitors.push(i);
        }
    } else if (monitorPref === "index") {
        const idx = this._settings.get_int("monitor-index");
        if (idx >= 0 && idx < Main.layoutManager.monitors.length) {
            targetMonitors.push(idx);
        } else {
            targetMonitors.push(Main.layoutManager.primaryIndex);
        }
    } else { // primary
        targetMonitors.push(Main.layoutManager.primaryIndex);
    }

    const rawMainMessage = this._settings.get_string("main-message");
    const rawSecondaryMessage = this._settings.get_string("secondary-message");
    const mainMessage = this._replacePlaceholders(rawMainMessage);
    const secondaryMessage = this._replacePlaceholders(rawSecondaryMessage);

    const fontFace = this._settings.get_string("font-face");
    const fontStyle = this._settings.get_string("font-style");
    const fontColor = this._settings.get_string("font-color");
    const fontSize = this._settings.get_int("font-size");
    const showOverWindows = this._settings.get_boolean("show-over-windows");
    
    const enableShadow = this._settings.get_boolean("enable-text-shadow");
    const enableBackground = this._settings.get_boolean("enable-background");

    const shadowCss = enableShadow ? `text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);` : '';
    const mainStyle = `font-family: '${fontFace}'; font-style: ${fontStyle}; color: ${fontColor}; font-size: ${fontSize}pt; ${shadowCss}`;
    const secondaryStyle = `font-family: '${fontFace}'; font-style: ${fontStyle}; color: ${fontColor}; font-size: ${Math.round(fontSize * 0.6)}pt; ${shadowCss}`;
    const containerStyle = enableBackground ? `background-color: rgba(0, 0, 0, 0.5); border-radius: 8px; padding: 16px;` : '';

    for (const monitorIndex of targetMonitors) {
        const data = this._createContainer();
        data.monitorIndex = monitorIndex;
        
        if (showOverWindows) {
            Main.layoutManager.uiGroup.add_child(data.container);
        } else {
            Main.layoutManager._backgroundGroup.add_child(data.container);
        }

        data.mainLabel.set_text(mainMessage);
        data.secondaryLabel.set_text(secondaryMessage);

        data.mainLabel.set_style(mainStyle);
        data.secondaryLabel.set_style(secondaryStyle);
        if (containerStyle) {
            data.container.set_style(containerStyle);
        }

        this._containersData.push(data);
    }

    this._updatePosition();
  }

  _updatePosition() {
    if (!this._containersData || this._containersData.length === 0) return;

    const posX = this._settings.get_int("pos-x");
    const posY = this._settings.get_int("pos-y");
    const corner = this._settings.get_string("corner-position");

    for (const data of this._containersData) {
        const monitor = Main.layoutManager.monitors[data.monitorIndex];
        if (!monitor) continue;

        const [, natWidth] = data.container.get_preferred_width(-1);
        const [, natHeight] = data.container.get_preferred_height(natWidth);

        let x, y;
        
        switch (corner) {
            case 'bottom-left':
                x = monitor.x + posX;
                y = monitor.y + monitor.height - natHeight - posY;
                break;
            case 'top-right':
                x = monitor.x + monitor.width - natWidth - posX;
                y = monitor.y + posY;
                break;
            case 'top-left':
                x = monitor.x + posX;
                y = monitor.y + posY;
                break;
            case 'bottom-right':
            default:
                x = monitor.x + monitor.width - natWidth - posX;
                y = monitor.y + monitor.height - natHeight - posY;
                break;
        }

        data.container.set_position(Math.round(x), Math.round(y));
    }
  }
}
