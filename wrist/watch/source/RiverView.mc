import Toybox.Application;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

// Main screen.
// Bezel ring: open episodes by stage in River's colours (Queue → Client Review, clockwise from 12).
// Centre: how many need you, then late / next 48h / with clients, then the next edit to chase.
class RiverView extends WatchUi.View {

    var data as Dictionary or Null = null;
    private var _err as String or Null = null;
    private var _busy as Boolean = false;

    function initialize() {
        View.initialize();
    }

    function onShow() as Void {
        if (data == null) { refresh(); }
    }

    function refresh() as Void {
        if (_busy) { return; }
        _busy = true;
        _err = null;
        WatchUi.requestUpdate();
        Api.load(method(:onLoad));
    }

    function onLoad(code as Number, d as Dictionary or String or Null) as Void {
        _busy = false;
        if (code == 200 && d instanceof Dictionary) {
            data = d;
            Api.save(d);
        } else {
            _err = Api.errorText(code, d);
        }
        WatchUi.requestUpdate();
    }

    function episodes() as Array {
        if (data == null || data["eps"] == null) { return []; }
        return data["eps"] as Array;
    }

    function stages() as Array {
        if (data == null || data["stages"] == null) { return []; }
        return data["stages"] as Array;
    }

    // Most urgent edit first (what to chase), falling back to the most urgent of anything.
    private function nextUp() as Dictionary or Null {
        var eps = episodes();
        for (var i = 0; i < eps.size(); i++) {
            var e = eps[i] as Dictionary;
            if (!(e["s"] as String).equals("Client Review") && e["lk"] != 1) { return e; }
        }
        return eps.size() > 0 ? eps[0] as Dictionary : null;
    }

    private function val(key as String) {
        if (data != null) { return data[key]; }
        return Application.Storage.getValue(key);
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var cy = h / 2;
        var vc = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        dc.setAntiAlias(true);

        dc.setColor(Theme.NIGHT, Theme.NIGHT);
        dc.clear();

        drawRing(dc, cx, cy, cx - 14);

        // Header
        var at = val("at");
        dc.setColor(Theme.WATER, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.13, Graphics.FONT_XTINY, "RIVER", vc);
        dc.setColor(_busy ? Theme.TODAY : Theme.FAINT, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.195, Graphics.FONT_XTINY, _busy ? "updating…" : (at != null ? at as String : ""), vc);

        // Hero: needs you
        var eps = data != null ? episodes().size() : Application.Storage.getValue("needs");
        dc.setColor(Theme.INK, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.335, Graphics.FONT_NUMBER_MEDIUM, eps != null ? eps.toString() : "–", vc);
        dc.setColor(Theme.MUTED, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.46, Graphics.FONT_XTINY, "NEED YOU", vc);

        // Stats row
        drawStat(dc, w * 0.25, h * 0.565, val("late"), "LATE", Theme.LATE);
        drawStat(dc, w * 0.50, h * 0.565, val("soon"), "48H", Theme.TODAY);
        drawStat(dc, w * 0.75, h * 0.565, val("review"), "CLIENTS", Theme.OK);

        // Divider
        dc.setColor(Theme.CARD, Graphics.COLOR_TRANSPARENT);
        dc.setPenWidth(2);
        dc.drawLine(w * 0.30, h * 0.695, w * 0.70, h * 0.695);

        // Next up, or the error
        if (_err != null) {
            dc.setColor(Theme.LATE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.75, Graphics.FONT_XTINY, _err as String, vc);
            dc.setColor(Theme.FAINT, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.81, Graphics.FONT_XTINY, "START to retry", vc);
            return;
        }
        var n = nextUp();
        if (n != null) {
            var col = Theme.urgencyColor(n["k"]);
            dc.setColor(Theme.stageColor(n["s"] as String), Graphics.COLOR_TRANSPARENT);
            dc.fillCircle(w * 0.22, h * 0.75, 6);
            dc.setColor(Theme.INK, Graphics.COLOR_TRANSPARENT);
            dc.drawText(w * 0.26, h * 0.75, Graphics.FONT_XTINY, fit(dc, n["n"] as String, w * 0.54, Graphics.FONT_XTINY), Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
            dc.setColor(col, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.81, Graphics.FONT_XTINY, fit(dc, (n["r"] as String) + " · " + n["s"], w * 0.62, Graphics.FONT_XTINY), vc);
        } else if (data != null) {
            dc.setColor(Theme.OK, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.77, Graphics.FONT_XTINY, "Nothing pressing", vc);
        }
    }

    // One arc per stage, sized by its open episodes, with small gaps between.
    private function drawRing(dc as Graphics.Dc, cx as Number, cy as Number, r as Number) as Void {
        var st = val("st");
        dc.setPenWidth(12);
        if (!(st instanceof Array) || st.size() != Theme.FLOW.size()) {
            dc.setColor(Theme.CARD, Graphics.COLOR_TRANSPARENT);
            dc.drawCircle(cx, cy, r);
            return;
        }
        var total = 0;
        var parts = 0;
        for (var i = 0; i < st.size(); i++) {
            total += st[i] as Number;
            if ((st[i] as Number) > 0) { parts++; }
        }
        if (total == 0) {
            dc.setColor(Theme.CARD, Graphics.COLOR_TRANSPARENT);
            dc.drawCircle(cx, cy, r);
            return;
        }
        var gap = parts > 1 ? 3.0 : 0.0;
        var usable = 360.0 - gap * parts;
        var start = 90.0;
        for (var i = 0; i < st.size(); i++) {
            var c = st[i] as Number;
            if (c <= 0) { continue; }
            var span = usable * c / total;
            if (span < 1.5) { span = 1.5; }
            dc.setColor(Theme.FLOW_COLORS[i] as Number, Graphics.COLOR_TRANSPARENT);
            dc.drawArc(cx, cy, r, Graphics.ARC_CLOCKWISE, start, start - span);
            start = start - span - gap;
        }
    }

    private function drawStat(dc as Graphics.Dc, x as Numeric, y as Numeric, value, label as String, color as Number) as Void {
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y, Graphics.FONT_MEDIUM, value != null ? value.toString() : "–", Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
        dc.setColor(Theme.FAINT, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y + 40, Graphics.FONT_XTINY, label, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
    }
}

// Shorten text with an ellipsis until it fits the width.
function fit(dc as Graphics.Dc, s as String, maxW as Numeric, font as Graphics.FontType) as String {
    if (dc.getTextWidthInPixels(s, font) <= maxW) { return s; }
    var t = s;
    while (t.length() > 1 && dc.getTextWidthInPixels(t + "…", font) > maxW) {
        t = t.substring(0, t.length() - 1) as String;
    }
    return t + "…";
}
