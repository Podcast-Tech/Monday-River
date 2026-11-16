import Toybox.Application;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

// Glance: the river as one bar of stage colours, plus what needs you. Shows the last saved summary.
(:glance)
class RiverGlance extends WatchUi.GlanceView {

    function initialize() {
        GlanceView.initialize();
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var x0 = 6;
        var needs = Application.Storage.getValue("needs");
        var late = Application.Storage.getValue("late");
        var at = Application.Storage.getValue("at");

        dc.setColor(Theme.WATER, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x0, h * 0.22, Graphics.FONT_GLANCE, "RIVER", Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
        if (at != null) {
            dc.setColor(Theme.FAINT, Graphics.COLOR_TRANSPARENT);
            dc.drawText(w - 4, h * 0.22, Graphics.FONT_GLANCE, at as String, Graphics.TEXT_JUSTIFY_RIGHT | Graphics.TEXT_JUSTIFY_VCENTER);
        }

        // Stage bar
        var st = Application.Storage.getValue("st");
        var barY = (h * 0.47).toNumber();
        var barW = w - x0 - 4;
        if (st instanceof Array && st.size() == Theme.FLOW.size()) {
            var total = 0;
            for (var i = 0; i < st.size(); i++) { total += st[i] as Number; }
            var x = x0;
            for (var i = 0; i < st.size() && total > 0; i++) {
                var seg = ((st[i] as Number) * barW / total).toNumber();
                if (seg <= 0) { continue; }
                dc.setColor(Theme.FLOW_COLORS[i] as Number, Graphics.COLOR_TRANSPARENT);
                dc.fillRoundedRectangle(x, barY, seg > 3 ? seg - 2 : seg, 8, 4);
                x += seg;
            }
        } else {
            dc.setColor(Theme.CARD, Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(x0, barY, barW, 8, 4);
        }

        var y = h * 0.76;
        if (needs == null) {
            dc.setColor(Theme.MUTED, Graphics.COLOR_TRANSPARENT);
            dc.drawText(x0, y, Graphics.FONT_GLANCE, "Open to load", Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
            return;
        }
        var a = needs.toString() + " need you";
        dc.setColor(Theme.INK, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x0, y, Graphics.FONT_GLANCE, a, Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
        var aw = dc.getTextWidthInPixels(a + "  ", Graphics.FONT_GLANCE);
        dc.setColor(Theme.LATE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x0 + aw, y, Graphics.FONT_GLANCE, late + " late", Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
    }
}
