// Sample board items and studio bookings shared by the Studio tests (one live Eden session).
const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const mk = (id, name, stage, editor, avail, draft, o = {}) => ({ id, name, url: "https://poddsterstudios-team.monday.com/boards/2472462203/pulses/" + id, updated_at: o.upd || "2026-10-08T10:00:00Z", created_at: d(-8) + "T10:00:00Z",
  column_values: { status: stage, person: editor, date: avail, date4: draft, date_mkx87nb3: o.v1 || null, board_relation_mkxb8cpz: [{ id: "1", name: "AG - " + name.split(" - ")[0] }], numeric_mm1y5e6b: String(o.u || 1), link_mkxbtnjf: "https://f.io/x" } });
const ITEMS = [
  mk("1", "Laiba Khan - Session 23.09.26 (REC 2)", "In Process", "Igor Garčev", d(-8), d(-3), { u: 2 }),
  mk("2", "Al Tamimi - Session 08.10.26", "In Process", "Stipe Majić", d(-4), d(0)),
  mk("3", "Olga Melnyk - Session 02.10.26", "Corrections", "Motasem Jammal", d(-9), d(-6), { v1: d(1) }),
  mk("4", "Katie Robertson - Session 01.10.26 - Highlights", "Queue", "", d(-3), d(2)),
  mk("5", "Rayhan Aleem - Session 12.10.26", "Queue", "", d(0), d(2)),
  mk("6", "Eric Krawetz - Session 25.09.26", "In Review", "Georges Saliba", d(-6), d(-1)),
  mk("7", "Alice Lovell - Session 04.10.26 - Ep 4", "In Process", "Akssat", d(-5), d(4)),
  mk("8", "Alice Lovell - Session 04.10.26 - Ep 5", "Assigned", "Akssat", d(-2), d(6)),
  mk("9", "Joana Castro - Session 03.07.26", "In Process", "Igor Garčev", d(-10), d(5), { u: 3 }),
  mk("10", "Brett King - Session 02.10.26", "Client Review", "Akssat", d(-8), d(-5)),
  mk("11", "Laiba Khan - Session 23.09.26 (REC 1 P2)", "Client Review", "Igor Garčev", d(-14), d(-12)),
  mk("12", "Chris Steiner - Session 01.10.26", "Client Review", "Stefan Mikić", d(-6), d(-2)),
  mk("13", "Dmitrii Tverdokhleb - Session 07.08.26 (P#2)", "Client Review", "Stefan Mikić", d(-60), d(-55)),
  mk("14", "ENBD (Finwell - Arabic) - Session 02.10.26", "Client Review", "Mahmoud", d(-9), d(-8)),
  mk("15", "Saeed Alghafri - Session 28.06.26 (P#1)", "Done", "Stefan Mikić", d(-100), d(-99), { upd: new Date().toISOString() }),
];
const wd = n => { const x = new Date(); let k = 0; while (k < n) { x.setDate(x.getDate() + 1); if (x.getDay() % 6) k++; } return x.toISOString().slice(0, 10); };
const ev = (id, name, day, services, addons) => ({ id, summary: name + " | Poddster Booking", status: "confirmed", start: { dateTime: day + "T14:00:00+04:00" }, end: { dateTime: day + "T15:00:00+04:00" }, organizer: { displayName: "Al Barsha Studio 1" },
  description: `Order ID: X${id}\nCustomer: ${name}\nSeats: 2\nSetup: ${["Eden", "Nest", "Apex", "Cove", "Exec"][id.charCodeAt(0) % 5]}\nServices:\n${services}` + (addons ? `\nAdditional Services:\n${addons}` : "") });
const nowIso = ms => new Date(Date.now() + ms).toISOString();
const LIVE = { id: "live1", summary: "Katie Robertson | Poddster Booking", status: "confirmed", start: { dateTime: nowIso(-20 * 60000) }, end: { dateTime: nowIso(40 * 60000) }, organizer: { displayName: "Al Barsha Studio 1" },
  description: "Order ID: L1\nCustomer: Katie Robertson\nSeats: 3\nSetup: Eden\nServices:\nRecording + Pro Edit + Reels" };
const EVENTS0 = [ev("a", "Test Client", wd(1), "Recording + Pro Edit + Reels"), ev("b", "Olga Melnyk", wd(1), "Recording + Professional Edit", "Standard Reel (12)"),
  ev("c", "Sharon Pakir", wd(2), "Recording + Live Mix"), ev("d", "Laura Person", wd(2), "Recording + Professional Edit"), ev("e", "Brand New Co", wd(1), "Recording + Pro Edit + Reels")];
const EVENTS = EVENTS0.concat([LIVE]);
const MINE = [{ id: "m1", summary: "Weekly sync with Loulou", status: "confirmed", start: { dateTime: nowIso(70 * 60000) }, end: { dateTime: nowIso(100 * 60000) }, htmlLink: "https://calendar.google.com/x", attendees: [{ email: "abdullah@poddster.com", self: true }, { email: "loulou@poddster.com" }] },
  { id: "m2", summary: "Trina Leave", status: "confirmed", start: { date: new Date().toISOString().slice(0, 10) + "T00:00:00Z" }, end: { date: new Date(Date.now() + 864e5).toISOString().slice(0, 10) + "T00:00:00Z" } }];
module.exports = { ITEMS, EVENTS, MINE };
