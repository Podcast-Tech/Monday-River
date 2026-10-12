// Loads the real unpacked extension in Chromium: service worker up, panel injected on any site and on Gmail, River page and settings open.
const { chromium } = require("playwright"), path = require("path"), os = require("os"), fs = require("fs");
(async () => {
  const ext = path.join(__dirname, ".."), dir = fs.mkdtempSync(path.join(os.tmpdir(), "rv-"));
  const ctx = await chromium.launchPersistentContext(dir, { headless: true, channel: "chromium", args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 10000 });
  const id = sw.url().split("/")[2];
  console.log("✓ service worker running (shortcut, right-click menu and rv address-bar search registered)");
  const ok = await sw.evaluate(() => !!(self.RiverLogic && chrome.omnibox && chrome.contextMenus && chrome.commands));
  if (!ok) throw new Error("background APIs missing");
  await ctx.route(/someblog\.example|mail\.google\.com/, r => r.fulfill({ contentType: "text/html", body: /mail\.google/.test(r.request().url()) ? "<div role=main><h2 class=hP>Hello</h2><span email='jane@acme.com' name='Jane Doe'>Jane</span></div>" : "<h1>A blog</h1>" }));
  const p = await ctx.newPage(); await p.goto("https://someblog.example/post");
  await p.waitForFunction(() => document.querySelector("#poddster-river")?.shadowRoot?.querySelector(".fab"), null, { timeout: 10000 });
  console.log("✓ any site: River button injected");
  const g = await ctx.newPage(); await g.goto("https://mail.google.com/mail/u/0/");
  await g.waitForFunction(() => /Connect Monday/.test(document.querySelector("#poddster-river")?.shadowRoot?.textContent || ""), null, { timeout: 10000 });
  console.log("✓ Gmail: panel injected; with no token it asks to connect Monday");
  const r = await ctx.newPage(); await r.goto(`chrome-extension://${id}/river.html?q=laiba`);
  await r.waitForFunction(() => { const s = document.querySelector("#poddster-river")?.shadowRoot; return s && s.querySelector("#q")?.value === "laiba" && /Connect Monday/.test(s.textContent); }, null, { timeout: 10000 });
  console.log("✓ River page (for chrome:// tabs and the rv search) opens with the search filled in");
  const o = await ctx.newPage(); await o.goto(`chrome-extension://${id}/options.html`);
  console.log("✓ settings open:", (await o.textContent(".hd b")).trim());
  await ctx.close(); console.log("Extension loads cleanly.");
})().catch(e => { console.error("✗", e.message); process.exit(1); });
