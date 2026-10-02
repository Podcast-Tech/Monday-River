// Syntax check: extracts the inline script from index.html and parses it.
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("No inline <script> found"); process.exit(1); }
const out = path.join(__dirname, ".page.js");
fs.writeFileSync(out, m[1]);
try { execFileSync(process.execPath, ["--check", out], { stdio: "inherit" }); console.log("Syntax OK"); }
catch (e) { process.exit(1); }
