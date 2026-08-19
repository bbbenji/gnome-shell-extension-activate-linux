/* ShortcutSettingWidget: an Adw.ActionRow that edits a single keybinding. */
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import Gdk from 'gi://Gdk';
import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

/** Keys that stay reserved for navigation rather than being bound. */
const FORBIDDEN_KEYVALS = [
    Gdk.KEY_Home,
    Gdk.KEY_Left,
    Gdk.KEY_Up,
    Gdk.KEY_Right,
    Gdk.KEY_Down,
    Gdk.KEY_Page_Up,
    Gdk.KEY_Page_Down,
    Gdk.KEY_End,
    Gdk.KEY_Tab,
    Gdk.KEY_KP_Enter,
    Gdk.KEY_Return,
    Gdk.KEY_Mode_switch,
];

/**
 * Whether a key combination is usable as a global shortcut.
 *
 * @param {number} mask Active modifiers.
 * @param {number} keycode
 * @param {number} keyval
 * @returns {boolean}
 */
function isValidBinding(mask, keycode, keyval) {
    if (mask === 0) return false;
    if (mask !== Gdk.ModifierType.SHIFT_MASK || keycode === 0) return true;

    // Shift on its own does not make a printable or reserved key bindable.
    const isPrintable =
        (keyval >= Gdk.KEY_a && keyval <= Gdk.KEY_z) ||
        (keyval >= Gdk.KEY_A && keyval <= Gdk.KEY_Z) ||
        (keyval >= Gdk.KEY_0 && keyval <= Gdk.KEY_9);

    return !isPrintable && !FORBIDDEN_KEYVALS.includes(keyval);
}

/**
 * Whether GTK considers the combination a well-formed accelerator.
 *
 * @param {number} mask Active modifiers.
 * @param {number} keyval
 * @returns {boolean}
 */
function isValidAccel(mask, keyval) {
    return Gtk.accelerator_valid(keyval, mask) || (keyval === Gdk.KEY_Tab && mask !== 0);
}

export const ShortcutSettingWidget = class extends Adw.ActionRow {
    static {
        GObject.registerClass(
            {
                Properties: {
                    shortcut: GObject.ParamSpec.string(
                        'shortcut',
                        'shortcut',
                        'shortcut',
                        GObject.ParamFlags.READWRITE,
                        ''
                    ),
                },
                Signals: {
                    changed: {param_types: [GObject.TYPE_STRING]},
                },
            },
            this
        );
    }

    constructor(settings, key, label, sublabel) {
        super({
            title: label,
            subtitle: sublabel,
            activatable: true,
        });

        this._settings = settings;
        this._key = key;
        this._description = sublabel;
        this._editor = null;

        this._shortcutLabel = new Gtk.ShortcutLabel({
            disabled_text: _('New accelerator…'),
            valign: Gtk.Align.CENTER,
            hexpand: false,
            vexpand: false,
        });

        this.connect('activated', this._onActivated.bind(this));
        this.bind_property(
            'shortcut',
            this._shortcutLabel,
            'accelerator',
            GObject.BindingFlags.DEFAULT
        );

        const [accelerator] = this._settings.get_strv(this._key);
        this.shortcut = accelerator ?? '';

        this.add_suffix(this._shortcutLabel);
    }

    _onActivated(widget) {
        const controller = new Gtk.EventControllerKey();

        this._editor = new Adw.Window({
            modal: true,
            transient_for: widget.get_root(),
            width_request: 480,
            height_request: 320,
            content: new Adw.StatusPage({
                title: _('New accelerator…'),
                description: this._description,
                icon_name: 'preferences-desktop-keyboard-shortcuts-symbolic',
            }),
        });

        controller.connect('key-pressed', this._onKeyPressed.bind(this));
        this._editor.add_controller(controller);
        this._editor.present();
    }

    _onKeyPressed(_controller, keyval, keycode, state) {
        let mask = state & Gtk.accelerator_get_default_mod_mask();
        mask &= ~Gdk.ModifierType.LOCK_MASK;

        if (!mask && keyval === Gdk.KEY_Escape) this._closeEditor();
        else if (keyval === Gdk.KEY_BackSpace) this._saveShortcut('');
        else if (isValidBinding(mask, keycode, keyval) && isValidAccel(mask, keyval))
            this._saveShortcut(Gtk.accelerator_name_with_keycode(null, keyval, keycode, mask));

        // Anything else is rejected, leaving the editor open for another try.
        return Gdk.EVENT_STOP;
    }

    /**
     * Store an accelerator, or clear the binding when given an empty string.
     *
     * @param {string} accelerator
     */
    _saveShortcut(accelerator) {
        this.shortcut = accelerator;
        this.emit('changed', accelerator);
        this._settings.set_strv(this._key, accelerator ? [accelerator] : []);
        this._closeEditor();
    }

    _closeEditor() {
        this._editor?.destroy();
        this._editor = null;
    }
};
