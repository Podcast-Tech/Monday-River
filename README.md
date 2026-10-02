# Monday River (Poddster)

The live Monday.com episode pipeline for Poddster, drawn as a river. It runs as a claude.ai Artifact: https://claude.ai/artifact/VdyYthkp8rzoVTWecnXpoF

- `index.html`: the whole app.
- `CLAUDE.md`: context for Claude Code, covering board IDs, rules, quirks, design and how to publish.
- `ROADMAP.md`: the ten approved upgrades, in build order.
- `tests/`: `node tests/check.js` checks syntax and `node tests/smoke.js` runs a test with sample data.
- `archive/`: the earlier four-view version (Orbit, Heartbeat, Arrivals, River).

To start in Claude Code, open this folder and ask: "Read CLAUDE.md and ROADMAP.md, then build roadmap items 1, 2 and 7."
