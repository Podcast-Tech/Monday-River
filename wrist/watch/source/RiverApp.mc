import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

// River Wrist: AG's Monday episodes on the fēnix 8 Pro.
// The app loads a small summary from the River back end; the glance shows the last one saved.
(:glance)
class RiverApp extends Application.AppBase {

    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        var view = new RiverView();
        return [view, new RiverDelegate(view)];
    }

    (:glance)
    function getGlanceView() as [WatchUi.GlanceView] or [WatchUi.GlanceView, WatchUi.GlanceViewDelegate] or Null {
        return [new RiverGlance()];
    }
}
