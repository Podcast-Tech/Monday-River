import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

// Episode card: stage pill, name, client, status, editor. START opens "Move to".
class EpisodeView extends WatchUi.View {

    var ep as Dictionary;

    function initialize(e as Dictionary) {
        View.initialize();
        ep = e;
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var vc = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        dc.setAntiAlias(true);
        dc.setColor(Theme.NIGHT, Theme.NIGHT);
        dc.clear();

        var stage = ep["s"] as String;
        var sc = Theme.stageColor(stage);

        // Thin stage-coloured ring
        dc.setColor(sc, Graphics.COLOR_TRANSPARENT);
        dc.setPenWidth(6);
        dc.drawCircle(cx, h / 2, cx - 8);

        // Stage pill
        var pw = dc.getTextWidthInPixels(stage, Graphics.FONT_XTINY) + 36;
        dc.fillRoundedRectangle(cx - pw / 2, h * 0.17, pw, 44, 22);
        dc.setColor(Theme.NIGHT, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.17 + 22, Graphics.FONT_XTINY, stage, vc);

        // Name and client
        dc.setColor(Theme.INK, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.38, Graphics.FONT_SMALL, fit(dc, ep["n"] as String, w * 0.84, Graphics.FONT_SMALL), vc);
        var client = ep["c"] as String;
        if (client.length() > 0 && (ep["n"] as String).find(client) == null) {
            dc.setColor(Theme.MUTED, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.47, Graphics.FONT_XTINY, client, vc);
        }

        // Status, big and coloured
        var uc = Theme.urgencyColor(ep["k"]);
        dc.setColor(uc == Theme.MUTED ? Theme.FOAM : uc, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.58, Graphics.FONT_LARGE, ep["r"] as String, vc);

        // Editor
        var ed = ep["e"] as String;
        dc.setColor(Theme.INK2, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.70, Graphics.FONT_XTINY, ed.equals("") ? "No editor yet" : "Editor · " + ed, vc);

        // Action hint
        if (ep["lk"] == 1) {
            dc.setColor(Theme.FAINT, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.84, Graphics.FONT_XTINY, "Laura's client · read-only", vc);
        } else {
            dc.setColor(Theme.BRAND, Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(cx - 90, h * 0.80, 180, 46, 23);
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.80 + 23, Graphics.FONT_XTINY, "Move stage", vc);
        }
    }
}
