import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {ShortcutSettingWidget} from './shortcut_widget.js';

export default class ActivateLinuxPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: _('Appearance'),
            description: _('Configure the watermark appearance'),
        });
        page.add(group);

        // Main Message
        const mainMessageRow = new Adw.EntryRow({
            title: _('Main Message'),
            text: settings.get_string('main-message'),
        });
        mainMessageRow.connect('notify::text', () => {
            settings.set_string('main-message', mainMessageRow.text);
        });
        group.add(mainMessageRow);

        // Secondary Message
        const secondaryMessageRow = new Adw.EntryRow({
            title: _('Secondary Message'),
            text: settings.get_string('secondary-message'),
        });
        secondaryMessageRow.connect('notify::text', () => {
            settings.set_string('secondary-message', secondaryMessageRow.text);
        });
        group.add(secondaryMessageRow);

        // Font Face
        const fontFaceRow = new Adw.EntryRow({
            title: _('Font Face'),
            text: settings.get_string('font-face'),
        });
        fontFaceRow.connect('notify::text', () => {
            settings.set_string('font-face', fontFaceRow.text);
        });
        group.add(fontFaceRow);

        // Font Style
        const fontStyleRow = new Adw.EntryRow({
            title: _('Font Style'),
            text: settings.get_string('font-style'),
        });
        fontStyleRow.connect('notify::text', () => {
            settings.set_string('font-style', fontStyleRow.text);
        });
        group.add(fontStyleRow);

        // Font Color
        const fontColorRow = new Adw.EntryRow({
            title: _('Font Color (CSS/RGBA)'),
            text: settings.get_string('font-color'),
        });

        // Setup ColorDialogButton
        const colorDialog = new Gtk.ColorDialog();
        const colorButton = new Gtk.ColorDialogButton({
            dialog: colorDialog,
            valign: Gtk.Align.CENTER,
            tooltip_text: _('Choose Font Color'),
        });

        // Helper to convert GTK color to CSS string
        function rgbaToCssString(rgba) {
            return `rgba(${Math.round(rgba.red * 255)}, ${Math.round(rgba.green * 255)}, ${Math.round(rgba.blue * 255)}, ${rgba.alpha.toFixed(2)})`;
        }

        // Initialize colorButton state
        const initialRgba = new Gdk.RGBA();
        const parsed = initialRgba.parse(fontColorRow.text);
        if (parsed)
            colorButton.set_rgba(initialRgba);

        // Update settings when text entry changes
        fontColorRow.connect('notify::text', () => {
            const currentText = fontColorRow.text;
            settings.set_string('font-color', currentText);

            // Sync with color button if valid
            const newRgba = new Gdk.RGBA();
            if (newRgba.parse(currentText))
                colorButton.set_rgba(newRgba);
        });

        // Update text entry when color button changes
        colorButton.connect('notify::rgba', () => {
            const rgba = colorButton.get_rgba();
            if (rgba) {
                const cssStr = rgbaToCssString(rgba);
                if (cssStr !== fontColorRow.text)
                    fontColorRow.text = cssStr;
            }
        });

        fontColorRow.add_suffix(colorButton);
        group.add(fontColorRow);

        // Text Shadow
        const textShadowRow = new Adw.SwitchRow({
            title: _('Enable Text Shadow'),
            subtitle: _('Adds a shadow to the text to improve readability on varied backgrounds'),
            active: settings.get_boolean('enable-text-shadow'),
        });
        textShadowRow.connect('notify::active', () => {
            settings.set_boolean('enable-text-shadow', textShadowRow.active);
        });
        group.add(textShadowRow);

        // Background Plate
        const backgroundRow = new Adw.SwitchRow({
            title: _('Enable Background Plate'),
            subtitle: _('Adds a semi-transparent dark background box behind the text'),
            active: settings.get_boolean('enable-background'),
        });
        backgroundRow.connect('notify::active', () => {
            settings.set_boolean('enable-background', backgroundRow.active);
        });
        group.add(backgroundRow);

        const positionGroup = new Adw.PreferencesGroup({
            title: _('Position & Size'),
            description: _('Configure the size and position on the screen'),
        });
        page.add(positionGroup);

        // Corner Position
        const cornerPositions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
        const cornerPositionRow = new Adw.ComboRow({
            title: _('Corner Position'),
            model: Gtk.StringList.new([_('Bottom Right'), _('Bottom Left'), _('Top Right'), _('Top Left')]),
        });
        const currentCorner = settings.get_string('corner-position');
        cornerPositionRow.selected = Math.max(0, cornerPositions.indexOf(currentCorner));
        cornerPositionRow.connect('notify::selected', () => {
            settings.set_string('corner-position', cornerPositions[cornerPositionRow.selected]);
        });
        positionGroup.add(cornerPositionRow);

        // Font Size
        const fontSizeRow = new Adw.SpinRow({
            title: _('Font Size'),
            adjustment: new Gtk.Adjustment({
                lower: 8,
                upper: 144,
                step_increment: 1,
            }),
            value: settings.get_int('font-size'),
        });
        fontSizeRow.connect('notify::value', () => {
            settings.set_int('font-size', fontSizeRow.value);
        });
        positionGroup.add(fontSizeRow);

        // X Margin
        const posXRow = new Adw.SpinRow({
            title: _('X Margin'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 4000,
                step_increment: 10,
            }),
            value: settings.get_int('pos-x'),
        });
        posXRow.connect('notify::value', () => {
            settings.set_int('pos-x', posXRow.value);
        });
        positionGroup.add(posXRow);

        // Y Margin
        const posYRow = new Adw.SpinRow({
            title: _('Y Margin'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 4000,
                step_increment: 10,
            }),
            value: settings.get_int('pos-y'),
        });
        posYRow.connect('notify::value', () => {
            settings.set_int('pos-y', posYRow.value);
        });
        positionGroup.add(posYRow);

        // Overlay Windows
        const overlayRow = new Adw.SwitchRow({
            title: _('Show Over Windows'),
            subtitle: _('When disabled, the watermark stays on the background'),
            active: settings.get_boolean('show-over-windows'),
        });
        overlayRow.connect('notify::active', () => {
            settings.set_boolean('show-over-windows', overlayRow.active);
        });
        positionGroup.add(overlayRow);

        // Show on Lock Screen
        const lockscreenRow = new Adw.SwitchRow({
            title: _('Show on Lock Screen'),
            subtitle: _('Whether to be visible when the screen is locked'),
            active: settings.get_boolean('show-on-lockscreen'),
        });
        lockscreenRow.connect('notify::active', () => {
            settings.set_boolean('show-on-lockscreen', lockscreenRow.active);
        });
        positionGroup.add(lockscreenRow);

        // Toggle Shortcut
        const shortcutRow = new ShortcutSettingWidget(
            settings,
            'toggle-show-over-windows-shortcut',
            _('Toggle Shortcut'),
            _('Press Backspace to clear')
        );
        positionGroup.add(shortcutRow);

        const monitorsGroup = new Adw.PreferencesGroup({
            title: _('Monitors'),
            description: _('Configure which monitors the watermark appears on'),
        });
        page.add(monitorsGroup);

        // Monitor Preference
        const monitorPrefs = ['primary', 'all', 'index'];
        const monitorPrefRow = new Adw.ComboRow({
            title: _('Monitor Preference'),
            model: Gtk.StringList.new([_('Primary Display Only'), _('All Displays'), _('Specific Display')]),
        });
        const currentPref = settings.get_string('monitor-preference');
        monitorPrefRow.selected = Math.max(0, monitorPrefs.indexOf(currentPref));
        monitorsGroup.add(monitorPrefRow);

        // Monitor Index
        const monitorIndexRow = new Adw.SpinRow({
            title: _('Display Index'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 10,
                step_increment: 1,
            }),
            value: settings.get_int('monitor-index'),
            sensitive: currentPref === 'index',
        });
        monitorIndexRow.connect('notify::value', () => {
            settings.set_int('monitor-index', monitorIndexRow.value);
        });
        monitorsGroup.add(monitorIndexRow);

        monitorPrefRow.connect('notify::selected', () => {
            settings.set_string('monitor-preference', monitorPrefs[monitorPrefRow.selected]);
            monitorIndexRow.sensitive = monitorPrefs[monitorPrefRow.selected] === 'index';
        });

        window.add(page);
    }
}
