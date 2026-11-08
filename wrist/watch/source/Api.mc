import Toybox.Application;
import Toybox.Communications;
import Toybox.Lang;

// Talks to the River back end and keeps the last summary in Storage for the glance.
module Api {

    function headers() as Dictionary {
        return {
            "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON,
            "X-River-Key" => Config.KEY
        };
    }

    function load(cb as Method) as Void {
        Communications.makeWebRequest(Config.API_URL, null, {
            :method => Communications.HTTP_REQUEST_METHOD_GET,
            :headers => headers(),
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        }, cb);
    }

    function move(id as String, stage as String, cb as Method) as Void {
        Communications.makeWebRequest(Config.API_URL, { "id" => id, "stage" => stage }, {
            :method => Communications.HTTP_REQUEST_METHOD_POST,
            :headers => headers(),
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        }, cb);
    }

    // Plain-language reason for a failed request.
    function errorText(code as Number, data) as String {
        if (data instanceof Dictionary && data["err"] != null) {
            var err = data["err"] as String;
            if (err.equals("no_token")) { return "Add Monday token in Vercel"; }
            if (err.equals("bad_token")) { return "Monday token rejected"; }
            if (err.equals("auth")) { return "Wrong watch key"; }
            if (err.equals("locked")) { return "Laura's client: use River"; }
            if (data["msg"] != null) { return data["msg"] as String; }
        }
        if (code == Communications.BLE_CONNECTION_UNAVAILABLE) { return "No phone link"; }
        if (code == Communications.NETWORK_REQUEST_TIMED_OUT) { return "Timed out · open Garmin Connect"; }
        if (code == 404) { return "Back end not found"; }
        return "Failed · code " + code;
    }

    function save(data as Dictionary) as Void {
        var eps = data["eps"] as Array;
        Application.Storage.setValue("late", data["late"] as Number);
        Application.Storage.setValue("soon", data["soon"] as Number);
        Application.Storage.setValue("review", data["review"] as Number);
        Application.Storage.setValue("needs", eps.size());
        Application.Storage.setValue("st", data["st"] as Array);
        Application.Storage.setValue("at", data["at"] as String);
    }
}
