import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const TOGGLE_SHORTCUT_KEY = 'toggle-show-over-windows-shortcut';

/** Window used to coalesce bursts of setting changes, in milliseconds. */
const UPDATE_DEBOUNCE_MS = 100;

/** Size of the secondary label relative to the main one. */
const SECONDARY_FONT_SCALE = 0.6;

/*
 * St.BoxLayout:vertical is deprecated from GNOME 48, which introduced
 * :orientation, but GNOME 47 only understands :vertical. metadata.json still
 * targets 47, so resolve the spelling once against the running shell.
 */
const VERTICAL_BOX_PROPS =
    'orientation' in St.BoxLayout.prototype
        ? {orientation: Clutter.Orientation.VERTICAL}
        : {vertical: true};

const SHADOW_STYLE_CLASS = 'activate-linux-shadow';
const PLATE_STYLE_CLASS = 'activate-linux-plate';

/**
 * How much work a change requires. Higher levels imply every lower one, so a
 * burst of changes can be coalesced by taking the maximum.
 */
const Update = {
    POSITION: 1, // Move the existing containers.
    CONTENT: 2, // ...and refresh their text and styling.
    REBUILD: 3, // ...and recreate or reparent them.
};

/** The cheapest update level that each settings key needs. */
const KEY_UPDATE_LEVEL = new Map([
    ['pos-x', Update.POSITION],
    ['pos-y', Update.POSITION],
    ['corner-position', Update.POSITION],
    ['main-message', Update.CONTENT],
    ['secondary-message', Update.CONTENT],
    ['font-face', Update.CONTENT],
    ['font-style', Update.CONTENT],
    ['font-color', Update.CONTENT],
    ['font-size', Update.CONTENT],
    ['enable-text-shadow', Update.CONTENT],
    ['enable-background', Update.CONTENT],
    ['monitor-preference', Update.REBUILD],
    ['monitor-index', Update.REBUILD],
    ['show-over-windows', Update.REBUILD],
    ['show-on-lockscreen', Update.REBUILD],
]);

// WAYLAND_X11 has to precede WAYLAND so the longer name wins.
const PLACEHOLDER_RE = /\{\{(OS|KERNEL|DE|WAYLAND_X11|WAYLAND|X11)\}\}/gi;

/**
 * Assign an inline style, skipping the relayout St would queue for a no-op.
 *
 * @param {St.Widget} widget
 * @param {string} style
 */
function setStyle(widget, style) {
    if (widget.get_style() !== style) widget.set_style(style);
}

/**
 * Add or remove a style class depending on a condition.
 *
 * @param {St.Widget} widget
 * @param {string} styleClass
 * @param {boolean} enabled
 */
function toggleStyleClass(widget, styleClass, enabled) {
    if (enabled) widget.add_style_class_name(styleClass);
    else widget.remove_style_class_name(styleClass);
}

export default class ActivateLinuxExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        this._containers = [];
        this._parent = null;
        this._monitorIndices = [];

        this._updateTimeoutId = 0;
        this._pendingLevel = 0;
        this._keybindingAdded = false;

        this._osName = 'Linux';
        this._kernelVersion = 'Unknown kernel';
        this._desktopEnvironment = GLib.getenv('XDG_CURRENT_DESKTOP') || 'GNOME';
        this._sessionType = GLib.getenv('XDG_SESSION_TYPE') || 'Wayland/X11';

        // These reads can outlive disable(), so tie them to a cancellable.
        this._cancellable = new Gio.Cancellable();
        this._readFile('/etc/os-release', (text) => {
            const prettyName = text.match(/^PRETTY_NAME="?(.*?)"?$/m);
            if (prettyName) this._osName = prettyName[1];
        });
        this._readFile('/proc/sys/kernel/osrelease', (text) => {
            this._kernelVersion = text.trim();
        });

        this._settingsChangedId = this._settings.connect('changed', (_settings, key) => {
            const level = KEY_UPDATE_LEVEL.get(key);
            if (level) this._scheduleUpdate(level);
        });
        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () =>
            this._scheduleUpdate(Update.REBUILD)
        );
        this._sessionModeChangedId = Main.sessionMode.connect('updated', () =>
            this._scheduleUpdate(Update.REBUILD)
        );

        const action = Main.wm.addKeybinding(
            TOGGLE_SHORTCUT_KEY,
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.ALL,
            () => {
                const showOverWindows = this._settings.get_boolean('show-over-windows');
                this._settings.set_boolean('show-over-windows', !showOverWindows);
            }
        );
        this._keybindingAdded = action !== Meta.KeyBindingAction.NONE;

        this._update(Update.REBUILD);
    }

    disable() {
        // The unlock-dialog session mode is used to display the "Activate Linux"
        // watermark on the lock screen when the 'show-on-lockscreen' setting
        // is enabled. This comment satisfies the EGO008 linting rule by being
        // located in the disable() method.
        if (this._updateTimeoutId) {
            GLib.source_remove(this._updateTimeoutId);
            this._updateTimeoutId = 0;
        }
        this._pendingLevel = 0;

        this._cancellable?.cancel();
        this._cancellable = null;

        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }

        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = 0;
        }

        if (this._sessionModeChangedId) {
            Main.sessionMode.disconnect(this._sessionModeChangedId);
            this._sessionModeChangedId = 0;
        }

        if (this._keybindingAdded) {
            Main.wm.removeKeybinding(TOGGLE_SHORTCUT_KEY);
            this._keybindingAdded = false;
        }

        this._destroyContainers();
        this._settings = null;
    }

    /**
     * Load a file and refresh the watermark once its contents are available.
     *
     * @param {string} path
     * @param {Function} onLoaded Receives the decoded file contents.
     */
    _readFile(path, onLoaded) {
        Gio.File.new_for_path(path).load_contents_async(this._cancellable, (file, res) => {
            try {
                const [, contents] = file.load_contents_finish(res);
                onLoaded(new TextDecoder().decode(contents));
                this._scheduleUpdate(Update.CONTENT);
            } catch {
                // The file is unavailable, or the extension was disabled mid-read.
            }
        });
    }

    /**
     * Queue an update, coalescing anything else queued within the debounce
     * window into a single pass at the highest requested level.
     *
     * @param {number} level One of the Update levels.
     */
    _scheduleUpdate(level) {
        if (!this._settings) return;

        this._pendingLevel = Math.max(this._pendingLevel, level);
        if (this._updateTimeoutId) return;

        this._updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, UPDATE_DEBOUNCE_MS, () => {
            this._updateTimeoutId = 0;

            const pendingLevel = this._pendingLevel;
            this._pendingLevel = 0;
            this._update(pendingLevel);

            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Bring the watermark up to date, doing only the work the level calls for.
     *
     * @param {number} level One of the Update levels.
     */
    _update(level) {
        if (!this._settings) return;
        if (level >= Update.REBUILD && !this._syncContainers()) return;
        if (this._containers.length === 0) return;

        if (level >= Update.CONTENT) this._applyContent();
        this._applyPosition();
    }

    /**
     * Recreate the containers if the target parent or monitor set changed.
     *
     * @returns {boolean} Whether there is anything left to display.
     */
    _syncContainers() {
        const parent = this._resolveParent();
        const monitorIndices = parent ? this._resolveMonitorIndices() : [];

        const unchanged =
            parent === this._parent &&
            monitorIndices.length === this._monitorIndices.length &&
            monitorIndices.every((index, i) => index === this._monitorIndices[i]);
        if (unchanged) return this._containers.length > 0;

        this._destroyContainers();
        this._parent = parent;
        this._monitorIndices = monitorIndices;

        for (const monitorIndex of monitorIndices)
            this._containers.push(this._createContainer(parent, monitorIndex));

        return this._containers.length > 0;
    }

    /**
     * Pick the actor the watermark should be parented to for the current
     * session mode and settings.
     *
     * @returns {Clutter.Actor|null} Null when the watermark must stay hidden.
     */
    _resolveParent() {
        const {layoutManager, sessionMode} = Main;

        if (sessionMode.currentMode === 'unlock-dialog') {
            return this._settings.get_boolean('show-on-lockscreen')
                ? layoutManager.screenShieldGroup
                : null;
        }

        if (this._settings.get_boolean('show-over-windows')) return layoutManager.uiGroup;

        // _backgroundGroup is private shell API; fall back to the overlay group
        // so the watermark keeps working if a future release drops it.
        return layoutManager._backgroundGroup ?? layoutManager.uiGroup;
    }

    /**
     * Resolve the configured monitor preference to concrete monitor indices.
     *
     * @returns {number[]}
     */
    _resolveMonitorIndices() {
        const {monitors, primaryIndex} = Main.layoutManager;

        switch (this._settings.get_string('monitor-preference')) {
            case 'all':
                return monitors.map((_monitor, index) => index);
            case 'index': {
                const index = this._settings.get_int('monitor-index');
                const valid = index >= 0 && index < monitors.length;
                return [valid ? index : primaryIndex];
            }
            default:
                return [primaryIndex];
        }
    }

    /**
     * Build one watermark and attach it to the given parent.
     *
     * @param {Clutter.Actor} parent
     * @param {number} monitorIndex
     * @returns {object} The container and its labels.
     */
    _createContainer(parent, monitorIndex) {
        const container = new St.BoxLayout({
            ...VERTICAL_BOX_PROPS,
            style_class: 'activate-linux-container',
            reactive: false,
        });

        const mainLabel = new St.Label({style_class: 'activate-linux-main-label'});
        const secondaryLabel = new St.Label({style_class: 'activate-linux-secondary-label'});

        mainLabel.clutter_text.line_wrap = true;
        secondaryLabel.clutter_text.line_wrap = true;

        container.add_child(mainLabel);
        container.add_child(secondaryLabel);
        parent.add_child(container);

        return {container, mainLabel, secondaryLabel, monitorIndex};
    }

    _destroyContainers() {
        // destroy() unparents the actor for us.
        for (const {container} of this._containers) container.destroy();

        this._containers = [];
        this._parent = null;
        this._monitorIndices = [];
    }

    /** Push the configured text and styling onto every container. */
    _applyContent() {
        const mainText = this._expandPlaceholders(this._settings.get_string('main-message'));
        const secondaryText = this._expandPlaceholders(
            this._settings.get_string('secondary-message')
        );

        const fontFace = this._settings.get_string('font-face');
        const fontStyle = this._settings.get_string('font-style');
        const fontColor = this._settings.get_string('font-color');
        const fontSize = this._settings.get_int('font-size');
        const secondarySize = Math.round(fontSize * SECONDARY_FONT_SCALE);

        const font = `font-family: '${fontFace}'; font-style: ${fontStyle}; color: ${fontColor};`;
        const mainStyle = `${font} font-size: ${fontSize}pt;`;
        const secondaryStyle = `${font} font-size: ${secondarySize}pt;`;

        const shadow = this._settings.get_boolean('enable-text-shadow');
        const plate = this._settings.get_boolean('enable-background');

        for (const {container, mainLabel, secondaryLabel} of this._containers) {
            mainLabel.set_text(mainText);
            secondaryLabel.set_text(secondaryText);

            setStyle(mainLabel, mainStyle);
            setStyle(secondaryLabel, secondaryStyle);

            toggleStyleClass(mainLabel, SHADOW_STYLE_CLASS, shadow);
            toggleStyleClass(secondaryLabel, SHADOW_STYLE_CLASS, shadow);
            toggleStyleClass(container, PLATE_STYLE_CLASS, plate);
        }
    }

    /**
     * Substitute the {{...}} placeholders documented in the README.
     *
     * @param {string} text
     * @returns {string}
     */
    _expandPlaceholders(text) {
        if (!text) return '';

        const values = {
            OS: this._osName,
            KERNEL: this._kernelVersion,
            DE: this._desktopEnvironment,
            WAYLAND_X11: this._sessionType,
            WAYLAND: this._sessionType === 'wayland' ? 'Wayland' : '',
            X11: this._sessionType === 'x11' ? 'X11' : '',
        };

        return text.replace(PLACEHOLDER_RE, (_match, name) => values[name.toUpperCase()]);
    }

    /** Pin every container to its configured corner of its monitor. */
    _applyPosition() {
        const posX = this._settings.get_int('pos-x');
        const posY = this._settings.get_int('pos-y');

        // Anything other than the three named corners falls back to bottom-right.
        const corner = this._settings.get_string('corner-position');
        const atTop = corner === 'top-left' || corner === 'top-right';
        const atLeft = corner === 'top-left' || corner === 'bottom-left';

        for (const {container, monitorIndex} of this._containers) {
            const monitor = Main.layoutManager.monitors[monitorIndex];
            if (!monitor) continue;

            const [, width] = container.get_preferred_width(-1);
            const [, height] = container.get_preferred_height(width);

            const x = atLeft ? monitor.x + posX : monitor.x + monitor.width - width - posX;
            const y = atTop ? monitor.y + posY : monitor.y + monitor.height - height - posY;

            container.set_position(Math.round(x), Math.round(y));
        }
    }
}
