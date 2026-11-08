import Toybox.Lang;
import Toybox.WatchUi;

// Main screen: START refreshes, DOWN (or swipe up) opens Needs you.
class RiverDelegate extends WatchUi.BehaviorDelegate {

    private var _view as RiverView;

    function initialize(view as RiverView) {
        BehaviorDelegate.initialize();
        _view = view;
    }

    function onSelect() as Boolean {
        _view.refresh();
        return true;
    }

    function onNextPage() as Boolean {
        var eps = _view.episodes();
        if (eps.size() == 0) { return true; }
        var menu = new WatchUi.CustomMenu(96, Theme.NIGHT, {
            :focusItemHeight => 124,
            :title => new MenuTitle("Needs you", eps.size().toString()),
            :titleItemHeight => 110,
            :focus => 1
        });
        // Edits to chase first, then clients gone quiet. Inside each, River's urgency order.
        var chase = 0;
        for (var i = 0; i < eps.size(); i++) {
            if (!((eps[i] as Dictionary)["s"] as String).equals("Client Review")) { chase++; }
        }
        if (chase > 0) {
            menu.addItem(new HeaderItem("TO CHASE · " + chase, Theme.TODAY));
            for (var pass = 0; pass < 2; pass++) { // yours first, Laura's read-only ones last
                for (var i = 0; i < eps.size(); i++) {
                    var e = eps[i] as Dictionary;
                    var mine = e["lk"] != 1;
                    if (!(e["s"] as String).equals("Client Review") && (pass == 0 ? mine : !mine)) { menu.addItem(new EpisodeItem(i, e)); }
                }
            }
        }
        if (chase < eps.size()) {
            menu.addItem(new HeaderItem("QUIET CLIENTS · " + (eps.size() - chase), Theme.OK));
            for (var i = 0; i < eps.size(); i++) {
                var e = eps[i] as Dictionary;
                if ((e["s"] as String).equals("Client Review")) { menu.addItem(new EpisodeItem(i, e)); }
            }
        }
        WatchUi.pushView(menu, new NeedsDelegate(_view), WatchUi.SLIDE_UP);
        return true;
    }
}

// Needs you list → episode card.
class NeedsDelegate extends WatchUi.Menu2InputDelegate {

    private var _view as RiverView;

    function initialize(view as RiverView) {
        Menu2InputDelegate.initialize();
        _view = view;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var id = item.getId();
        if (!(id instanceof Number)) { return; } // section header
        var e = _view.episodes()[id as Number] as Dictionary;
        var card = new EpisodeView(e);
        WatchUi.pushView(card, new CardDelegate(_view, e), WatchUi.SLIDE_LEFT);
    }
}

// Episode card: START or tap opens the stage picker.
class CardDelegate extends WatchUi.BehaviorDelegate {

    private var _view as RiverView;
    private var _ep as Dictionary;

    function initialize(view as RiverView, ep as Dictionary) {
        BehaviorDelegate.initialize();
        _view = view;
        _ep = ep;
    }

    function onSelect() as Boolean {
        if (_ep["lk"] == 1) { return true; }
        var menu = new WatchUi.CustomMenu(84, Theme.NIGHT, {
            :focusItemHeight => 108,
            :title => new MenuTitle("Move to", _ep["n"] as String),
            :titleItemHeight => 110
        });
        var st = _view.stages();
        for (var i = 0; i < st.size(); i++) {
            var s = st[i] as String;
            if (!s.equals(_ep["s"] as String)) {
                menu.addItem(new StageItem(s, s.equals("Corrections") ? "Next date +2 working days" : ""));
            }
        }
        WatchUi.pushView(menu, new StageDelegate(_view, _ep), WatchUi.SLIDE_UP);
        return true;
    }
}

// Stage picker → confirm.
class StageDelegate extends WatchUi.Menu2InputDelegate {

    private var _view as RiverView;
    private var _ep as Dictionary;

    function initialize(view as RiverView, ep as Dictionary) {
        Menu2InputDelegate.initialize();
        _view = view;
        _ep = ep;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var stage = item.getId() as String;
        WatchUi.pushView(new WatchUi.Confirmation("Move to " + stage + "?"),
            new MoveConfirm(_view, _ep["id"] as String, stage), WatchUi.SLIDE_IMMEDIATE);
    }
}

class MoveConfirm extends WatchUi.ConfirmationDelegate {

    private var _view as RiverView;
    private var _id as String;
    private var _stage as String;

    function initialize(view as RiverView, id as String, stage as String) {
        ConfirmationDelegate.initialize();
        _view = view;
        _id = id;
        _stage = stage;
    }

    function onResponse(response as WatchUi.Confirm) as Boolean {
        if (response == WatchUi.CONFIRM_YES) {
            WatchUi.showToast("Moving…", null);
            Api.move(_id, _stage, method(:onMoved));
        }
        return true;
    }

    function onMoved(code as Number, d as Dictionary or String or Null) as Void {
        if (code == 200 && d instanceof Dictionary) {
            WatchUi.showToast(d["msg"] as String, null);
            // Stage picker, card and list close; back to the main screen with fresh numbers.
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
            _view.refresh();
        } else {
            WatchUi.showToast(Api.errorText(code, d), null);
        }
    }
}
