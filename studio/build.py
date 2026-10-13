#!/usr/bin/env python3
"""Builds studio/index.html (River Studio) from src/ plus River's own Monday logic and episode panel, copied verbatim from
../index.html, so Studio follows exactly the same rules (Corrections dates, lateness, notes, package, reassign)."""
import pathlib, re
here = pathlib.Path(__file__).parent
river = (here.parent / "index.html").read_text()
css_all = river[river.index("<style>", river.index("Geist+Mono")) + 7: river.index("</style>", river.index("Geist+Mono"))]
script = river[river.index("<script>") + 8: river.rindex("</script>")]
def cut(src, start, end):
    i = src.index(start); j = src.index(end, i + len(start)); return src[i:j].rstrip() + "\n"
panel_css = cut(css_all, ".scrim{", "/* Live: ripples")
core = cut(script, 'const SERVER = "monday.com";', "/* geometry */")
core = re.sub(r"\nconst S = \{[^\n]*\};", '\nconst S = { items: [], storedAt: null, error: null, loading: true, sel: null, busy: false, draft: "", corr: true, mention: true };', core, 1)
assert "corr: true, mention: true };" in core
js = "".join([
  "/* ===== Shared with River (index.html), copied by studio/build.py — edit River, then rebuild ===== */\n",
  core,
  cut(script, "const editorId = ", "\n/* Live load per editor"),
  cut(script, "function errorCopy(err) {", "\nfunction renderSync"),
  cut(script, "/* panel */", "\n/* package: the studio booking"),
  cut(script, "/* package: the studio booking", "\n/* Monday notifications: AG"),
  cut(script, "/* Monday notifications: AG", "\nfunction onNotifs(ev)"),
  cut(script, "const shortItem = ", "\nfunction renderBell"),
  cut(script, "function nago(t)", "\nfunction openInbox"),
  cut(script, "function episodeNotifs(it)", "\n/* add task */"),
  cut(script, "/* add task */", "\nfunction openAdd("),
  cut(script, "/* actions */", "\n/* Posts an editor note."),
  cut(script, "/* Posts an editor note.", "\n/* Clear the gates: walks"),
])
page = (here / "src/head.html").read_text() + panel_css + (here / "src/body.html").read_text() + "\n<script>\n" + js + (here / "src/app.js").read_text() + "</script>\n"
(here / "index.html").write_text(page)
print("studio/index.html:", len(page), "bytes")
