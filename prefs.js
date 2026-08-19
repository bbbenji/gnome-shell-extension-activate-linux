import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {ShortcutSettingWidget} from './shortcut_widget.js';

/** Corner setting values, paired with their labels. */
const CORNER_POSITIONS = [
    ['bottom-right', () => _('Bottom Right')],
    ['bottom-left', () => _('Bottom Left')],
    ['top-right', () => _('Top Right')],
    ['top-left', () => _('Top Left')],
];

/** Monitor preference values, paired with their labels. */
const MONITOR_PREFERENCES = [
    ['primary', () => _('Primary Display Only')],
    ['all', () => _('All Displays')],
    ['index', () => _('Specific Display')],
];

/**
 * A text entry bound to a string setting.
 *
 * @param {Gio.Settings} settings
 * @param {string} key
 * @param {string} title
 * @returns {Adw.EntryRow}
 */
function entryRow(settings, key, title) {
    const row = new Adw.EntryRow({title});
    settings.bind(key, row, 'text', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

/**
 * A switch bound to a boolean setting.
 *
 * @param {Gio.Settings} settings
 * @param {string} key
 * @param {string} title
 * @param {string} subtitle
 * @returns {Adw.SwitchRow}
 */
function switchRow(settings, key, title, subtitle) {
    const row = new Adw.SwitchRow({title, subtitle});
    settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

/**
 * A spin button kept in sync with an integer setting.
 *
 * @param {Gio.Settings} settings
 * @param {string} key
 * @param {string} title
 * @param {object} range Adjustment bounds: lower, upper and optional step.
 * @returns {Adw.SpinRow}
 */
function spinRow(settings, key, title, range) {
    const {lower, upper, step = 1} = range;
    const row = new Adw.SpinRow({
        title,
        adjustment: new Gtk.Adjustment({lower, upper, step_increment: step}),
        value: settings.get_int(key),
    });

    // SpinRow:value is a double, so it cannot be bound to an 'i' key directly.
    row.connect('notify::value', () => settings.set_int(key, Math.round(row.value)));
    settings.connect(`changed::${key}`, () => {
        row.value = settings.get_int(key);
    });

    return row;
}

/**
 * A drop-down kept in sync with a string setting drawn from a fixed set.
 *
 * @param {Gio.Settings} settings
 * @param {string} key
 * @param {string} title
 * @param {Array} options Pairs of setting value and label-producing function.
 * @returns {Adw.ComboRow}
 */
function comboRow(settings, key, title, options) {
    const values = options.map(([value]) => value);
    const selectedIndex = () => Math.max(0, values.indexOf(settings.get_string(key)));

    const row = new Adw.ComboRow({
        title,
        model: Gtk.StringList.new(options.map(([, label]) => label())),
        selected: selectedIndex(),
    });

    row.connect('notify::selected', () => settings.set_string(key, values[row.selected]));
    settings.connect(`changed::${key}`, () => {
        row.selected = selectedIndex();
    });

    return row;
}

/**
 * Render a Gdk colour as the CSS string stored in settings.
 *
 * @param {Gdk.RGBA} rgba
 * @returns {string}
 */
function rgbaToCss(rgba) {
    const channel = (value) => Math.round(value * 255);
    const {red, green, blue, alpha} = rgba;
    return `rgba(${channel(red)}, ${channel(green)}, ${channel(blue)}, ${alpha.toFixed(2)})`;
}

/**
 * A CSS colour entry with a colour picker attached.
 *
 * @param {Gio.Settings} settings
 * @param {string} key
 * @param {string} title
 * @returns {Adw.EntryRow}
 */
function colorRow(settings, key, title) {
    const row = entryRow(settings, key, title);
    const button = new Gtk.ColorDialogButton({
        dialog: new Gtk.ColorDialog(),
        valign: Gtk.Align.CENTER,
        tooltip_text: _('Choose Font Color'),
    });

    // Only the picker rewrites the entry; typing must not reformat the text
    // out from under the cursor, so suppress the echo back.
    let updatingButton = false;
    const updateButton = () => {
        const rgba = new Gdk.RGBA();
        if (!rgba.parse(row.text)) return;

        updatingButton = true;
        button.set_rgba(rgba);
        updatingButton = false;
    };

    row.connect('notify::text', updateButton);
    button.connect('notify::rgba', () => {
        if (!updatingButton) row.text = rgbaToCss(button.get_rgba());
    });
    updateButton();

    row.add_suffix(button);
    return row;
}

export default class ActivateLinuxPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();

        for (const group of [
            this._buildTextGroup(settings),
            this._buildFontGroup(settings),
            this._buildLayoutGroup(settings),
            this._buildBehaviorGroup(settings),
            this._buildMonitorsGroup(settings),
        ])
            page.add(group);

        window.add(page);
    }

    /**
     * @param {Gio.Settings} settings
     * @returns {Adw.PreferencesGroup}
     */
    _buildTextGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: _('Text'),
            description: _(
                'Available placeholders: {{OS}}, {{KERNEL}}, {{DE}}, {{WAYLAND_X11}}, {{WAYLAND}}, {{X11}}'
            ),
        });

        group.add(entryRow(settings, 'main-message', _('Main Message')));
        group.add(entryRow(settings, 'secondary-message', _('Secondary Message')));

        return group;
    }

    /**
     * @param {Gio.Settings} settings
     * @returns {Adw.PreferencesGroup}
     */
    _buildFontGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: _('Font & Colors'),
            description: _('Configure the watermark appearance'),
        });

        group.add(entryRow(settings, 'font-face', _('Font Face')));
        group.add(entryRow(settings, 'font-style', _('Font Style')));
        group.add(spinRow(settings, 'font-size', _('Font Size'), {lower: 8, upper: 144}));
        group.add(colorRow(settings, 'font-color', _('Font Color (CSS/RGBA)')));
        group.add(
            switchRow(
                settings,
                'enable-text-shadow',
                _('Enable Text Shadow'),
                _('Adds a shadow to the text to improve readability on varied backgrounds')
            )
        );
        group.add(
            switchRow(
                settings,
                'enable-background',
                _('Enable Background Plate'),
                _('Adds a semi-transparent dark background box behind the text')
            )
        );

        return group;
    }

    /**
     * @param {Gio.Settings} settings
     * @returns {Adw.PreferencesGroup}
     */
    _buildLayoutGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: _('Layout & Position'),
            description: _('Configure where the watermark sits on the screen'),
        });

        group.add(comboRow(settings, 'corner-position', _('Corner Position'), CORNER_POSITIONS));
        group.add(spinRow(settings, 'pos-x', _('X Margin'), {lower: 0, upper: 4000, step: 10}));
        group.add(spinRow(settings, 'pos-y', _('Y Margin'), {lower: 0, upper: 4000, step: 10}));

        return group;
    }

    /**
     * @param {Gio.Settings} settings
     * @returns {Adw.PreferencesGroup}
     */
    _buildBehaviorGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: _('Behavior'),
            description: _('Configure when the watermark is visible'),
        });

        group.add(
            switchRow(
                settings,
                'show-over-windows',
                _('Show Over Windows'),
                _('When disabled, the watermark stays on the background')
            )
        );
        group.add(
            switchRow(
                settings,
                'show-on-lockscreen',
                _('Show on Lock Screen'),
                _('Whether to be visible when the screen is locked')
            )
        );
        group.add(
            new ShortcutSettingWidget(
                settings,
                'toggle-show-over-windows-shortcut',
                _('Toggle Shortcut'),
                _('Press Backspace to clear')
            )
        );

        return group;
    }

    /**
     * @param {Gio.Settings} settings
     * @returns {Adw.PreferencesGroup}
     */
    _buildMonitorsGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: _('Monitors'),
            description: _('Configure which monitors the watermark appears on'),
        });

        const indexRow = spinRow(settings, 'monitor-index', _('Display Index'), {
            lower: 0,
            upper: 10,
        });
        const syncSensitivity = () => {
            indexRow.sensitive = settings.get_string('monitor-preference') === 'index';
        };
        settings.connect('changed::monitor-preference', syncSensitivity);
        syncSensitivity();

        group.add(
            comboRow(settings, 'monitor-preference', _('Monitor Preference'), MONITOR_PREFERENCES)
        );
        group.add(indexRow);

        return group;
    }
}
