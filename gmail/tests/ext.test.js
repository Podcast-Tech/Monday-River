// Loads the real unpacked extension in Chromium: manifest valid, service worker up, content script injected on mail.google.com.
const { chromium } = require("playwright"), path = require("path"), os = require("os"), fs = require("fs");
(async () => {
  const ext = path.join(__dirname, ".."), dir = fs.mkdtempSync(path.join(os.tmpdir(), "rv-"));
  const ctx = await chromium.launchPersistentContext(dir, { headless: true, channel: "chromium", args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 10000 });
  console.log("✓ service worker running:", sw.url().replace(/^chrome-extension:\/\/[a-z]+/, "chrome-extension://…"));
  const p = await ctx.newPage();
  await ctx.route("https://mail.google.com/**", r => r.fulfill({ contentType: "text/html", body: "<div role=main><h2 class=hP>Hello</h2><span email='jane@acme.com' name='Jane Doe'>Jane</span></div>" }));
  await p.goto("https://mail.google.com/mail/u/0/");
  await p.waitForFunction(() => { const h = document.querySelector("#poddster-river"); return h && h.shadowRoot && /Connect Monday/.test(h.shadowRoot.textContent); }, null, { timeout: 10000 });
  console.log("✓ content script injected in Gmail; with no token it asks to connect Monday");
  const id = sw.url().split("/")[2]; const o = await ctx.newPage(); await o.goto(`chrome-extension://${id}/options.html`);
  console.log("✓ token screen opens:", (await o.textContent("b")).trim());
  await ctx.close(); console.log("Extension loads cleanly.");
})().catch(e => { console.error("✗", e.message); process.exit(1); });
