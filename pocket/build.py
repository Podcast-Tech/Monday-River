#!/usr/bin/env python3
"""Builds pocket/index.html (River Pocket, the phone view) from src/ plus River's own Monday logic, copied verbatim
from ../index.html so both pages always follow the same rules (Corrections dates, lateness, notes, package, notifications)."""
import pathlib, re
here = pathlib.Path(__file__).parent
river = (here.parent / "index.html").read_text()
script = river[river.index("<script>") + 8: river.rindex("</script>")]
def cut(start, end):
    i = script.index(start); j = script.index(end, i + len(start)); return script[i:j].rstrip() + "\n"
core = cut('const SERVER = "monday.com";', "/* geometry */")
core = re.sub(r"\nconst S = \{[^\n]*\};", '\nconst S = { items: [], storedAt: null, error: null, loading: true, q: "", sel: null, busy: false, draft: "", corr: true, mention: true, unlock: false };', core, 1)
assert "unlock: false" in core
parts = [
  "/* ===== Shared with River (index.html), copied by pocket/build.py — edit River, then rebuild ===== */\n",
  core,
  cut("function errorCopy(err) {", "\nfunction renderSync"),
  cut("/* package: the studio booking", "\n/* Monday notifications: AG"),
  cut("/* Monday notifications: AG", "\nfunction onNotifs(ev)"),
  cut("const shortItem = ", "\nfunction renderBell"),
  cut("function nago(t)", "\nfunction openInbox"),
  cut("/* add task */", "\nfunction openAdd("),
  cut("async function createTask()", "\n/* Live ripples"),
  cut("/* actions */", "\n/* Drag to reassign"),
  cut("/* Posts an editor note.", "\n/* Clear the gates: walks"),
]
shared = "".join(parts)
page = (here / "src/head.html").read_text() + "\n<script>\n" + shared + (here / "src/app.js").read_text() + "</script>\n"
(here / "index.html").write_text(page)
print("pocket/index.html:", len(page), "bytes")
