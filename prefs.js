import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

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

        const positionGroup = new Adw.PreferencesGroup({
            title: _('Position & Size'),
            description: _('Configure the size and position on the screen'),
        });
        page.add(positionGroup);

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

        // X Position
        const posXRow = new Adw.SpinRow({
            title: _('X Margin (Right)'),
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

        // Y Position
        const posYRow = new Adw.SpinRow({
            title: _('Y Margin (Bottom)'),
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

        window.add(page);
    }
}
