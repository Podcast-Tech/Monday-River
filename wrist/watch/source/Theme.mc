import Toybox.Graphics;
import Toybox.Lang;

// River's design tokens (index.html :root), so the watch matches River, Studio and Pocket.
(:glance)
module Theme {
    const NIGHT = 0x000000;   // AMOLED black instead of --night, for battery
    const CARD = 0x0F1520;
    const HOVER = 0x151D2A;
    const INK = 0xEEF3FA;
    const INK2 = 0xC9D3E2;
    const MUTED = 0x8693A8;
    const FAINT = 0x55617A;
    const BRAND = 0xFF003C;
    const WATER = 0x3FA9FF;
    const FOAM = 0xBFE3FF;
    const LATE = 0xFF4D6A;
    const TODAY = 0xF6B64A;
    const OK = 0x3EDC97;

    // River's flow, as sent in the summary's `st` counts.
    const FLOW = ["Queue", "Assigned", "In Process", "In Review", "Corrections", "Client Review"];
    const FLOW_COLORS = [0x8693A8, 0xC9D3E2, 0xF6C94A, 0x5EB2FF, 0xFF8F45, 0x3EDC97];

    function stageColor(stage as String) as Number {
        for (var i = 0; i < FLOW.size(); i++) {
            if ((FLOW[i] as String).equals(stage)) { return FLOW_COLORS[i] as Number; }
        }
        if (stage.equals("Done")) { return 0x9C8CFF; }
        return 0xA68CFF;
    }

    // Colour for a row's status text: late, due today, or calm.
    function urgencyColor(k) as Number {
        if (k instanceof String) {
            if ((k as String).equals("late")) { return LATE; }
            if ((k as String).equals("today")) { return TODAY; }
        }
        return MUTED;
    }
}
