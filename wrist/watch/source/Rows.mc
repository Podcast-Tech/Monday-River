import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

const VC = Graphics.TEXT_JUSTIFY_VCENTER;

// Menu title: label plus a count.
class MenuTitle extends WatchUi.Drawable {
    private var _t as String;
    private var _n as String;
    function initialize(t as String, n as String) {
        Drawable.initialize({});
        _t = t;
        _n = n;
    }
    function draw(dc as Graphics.Dc) as Void {
        var cx = dc.getWidth() / 2;
        var cy = dc.getHeight() * 0.62;
        dc.setColor(Theme.INK, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy, Graphics.FONT_SMALL, _t, Graphics.TEXT_JUSTIFY_CENTER | VC);
        if (!_n.equals("")) {
            dc.setColor(Theme.MUTED, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, cy + 34, Graphics.FONT_XTINY, _n, Graphics.TEXT_JUSTIFY_CENTER | VC);
        }
    }
}

// Section header row inside the list ("TO CHASE · 11"). Not selectable.
class HeaderItem extends WatchUi.CustomMenuItem {
    private var _label as String;
    private var _color as Number;
    function initialize(label as String, color as Number) {
        CustomMenuItem.initialize("hdr", {});
        _label = label;
        _color = color;
    }
    function draw(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var y = dc.getHeight() * 0.62;
        dc.setColor(_color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, y, Graphics.FONT_XTINY, _label, Graphics.TEXT_JUSTIFY_CENTER | VC);
        dc.setPenWidth(2);
        var tw = dc.getTextWidthInPixels(_label, Graphics.FONT_XTINY) / 2 + 14;
        dc.drawLine(w * 0.18, y, w / 2 - tw, y);
        dc.drawLine(w / 2 + tw, y, w * 0.82, y);
    }
}

// One episode: stage colour bar, name, and "2d late · In Process · Igor".
class EpisodeItem extends WatchUi.CustomMenuItem {
    private var _e as Dictionary;
    function initialize(id as Number, e as Dictionary) {
        CustomMenuItem.initialize(id, {});
        _e = e;
    }
    function draw(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var focused = isFocused();
        var x = w * 0.14;
        var stageCol = Theme.stageColor(_e["s"] as String);

        if (focused) {
            dc.setColor(Theme.CARD, Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(w * 0.10, 6, w * 0.80, h - 12, 18);
        }
        dc.setColor(_e["lk"] == 1 ? Theme.FAINT : stageCol, Graphics.COLOR_TRANSPARENT);
        dc.fillRoundedRectangle(x - 2, h * 0.24, 7, h * 0.52, 3);

        var tx = x + 20;
        var maxW = w * 0.90 - tx;
        var nameFont = focused ? Graphics.FONT_TINY : Graphics.FONT_XTINY;
        dc.setColor(focused ? Theme.INK : Theme.INK2, Graphics.COLOR_TRANSPARENT);
        dc.drawText(tx, h * 0.36, nameFont, fit(dc, _e["n"] as String, maxW, nameFont), Graphics.TEXT_JUSTIFY_LEFT | VC);

        var r = _e["r"] as String;
        dc.setColor(Theme.urgencyColor(_e["k"]), Graphics.COLOR_TRANSPARENT);
        dc.drawText(tx, h * 0.68, Graphics.FONT_XTINY, r, Graphics.TEXT_JUSTIFY_LEFT | VC);
        var rw = dc.getTextWidthInPixels(r, Graphics.FONT_XTINY);
        var who = _e["lk"] == 1 ? "Laura" : (_e["e"] != null && !(_e["e"] as String).equals("") ? _e["e"] as String : "no editor");
        dc.setColor(Theme.FAINT, Graphics.COLOR_TRANSPARENT);
        dc.drawText(tx + rw, h * 0.68, Graphics.FONT_XTINY, fit(dc, " · " + who, maxW - rw, Graphics.FONT_XTINY), Graphics.TEXT_JUSTIFY_LEFT | VC);
    }
}

// A stage to move to: dot in the stage colour, "Move to Corrections", optional note.
class StageItem extends WatchUi.CustomMenuItem {
    private var _stage as String;
    private var _note as String;
    function initialize(stage as String, note as String) {
        CustomMenuItem.initialize(stage, {});
        _stage = stage;
        _note = note;
    }
    function draw(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var focused = isFocused();
        if (focused) {
            dc.setColor(Theme.CARD, Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(w * 0.10, 6, w * 0.80, h - 12, 18);
        }
        var x = w * 0.20;
        dc.setColor(Theme.stageColor(_stage), Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(x, h / 2, focused ? 11 : 8);
        var y = _note.equals("") ? h / 2 : h * 0.40;
        dc.setColor(focused ? Theme.INK : Theme.INK2, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x + 26, y, focused ? Graphics.FONT_SMALL : Graphics.FONT_XTINY, _stage, Graphics.TEXT_JUSTIFY_LEFT | VC);
        if (!_note.equals("")) {
            dc.setColor(Theme.FAINT, Graphics.COLOR_TRANSPARENT);
            dc.drawText(x + 26, h * 0.70, Graphics.FONT_XTINY, _note, Graphics.TEXT_JUSTIFY_LEFT | VC);
        }
    }
}
