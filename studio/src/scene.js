
/* ================= The illustrated studio (isometric SVG, drawn from live data) =================
   World units: x runs down-right, y down-left, z up. 1 unit = SC px. Rooms (x × y):
   Green room 0–16 × 0–22 · Delivery 0–16 × 22–46 · Edit booths 16–48 × 0–28 · Screening 48–64 × 0–28 · Control room 16–64 × 28–46.
   Everything is painted back to front, room by room. */
const SC = 15, CX = 0.8660254, HY = 0.5, OX = 800, OY = 322;
let YOFF = 0; /* the post-production floor sits 14 units in front of the recording wing */
const P = (x, y, z = 0) => [OX + (x - (y + YOFF)) * CX * SC, OY + (x + y + YOFF) * HY * SC - z * SC];
const pts = a => a.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => f >= 1 ? v + (255 - v) * (f - 1) : v * f);
  return "#" + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function box(x, y, z, w, d, h, col, o = {}) {
  const st = o.stroke === undefined ? 'stroke="rgb(0 0 0 / .45)" stroke-width=".7" stroke-linejoin="round"' : o.stroke;
  const top = pts([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)]);
  const left = pts([P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x, y + d, z)]);
  const right = pts([P(x + w, y, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x + w, y, z)]);
  return `<g ${o.attrs || ""}><polygon points="${right}" fill="${o.right || shade(col, .62)}" ${st}/><polygon points="${left}" fill="${o.left || shade(col, .82)}" ${st}/><polygon points="${top}" fill="${o.top || shade(col, 1.12)}" ${st}/></g>`;
}
const quad = (x, y, w, d, fill, z = 0, attrs = "") => `<polygon points="${pts([P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z)])}" fill="${fill}" ${attrs}/>`;
/* Draw flat things onto a surface: fy = a wall facing the viewer (plane y), fx = a side wall (plane x), fz = the floor or a desk top. */
const fy = (x, y, z, inner, attrs = "") => { const [X, Y] = P(x, y, z); return `<g transform="matrix(${CX * SC} ${HY * SC} 0 ${SC} ${X.toFixed(1)} ${Y.toFixed(1)})" ${attrs}>${inner}</g>`; };
const fx = (x, y, z, inner, attrs = "") => { const [X, Y] = P(x, y, z); return `<g transform="matrix(${CX * SC} ${-HY * SC} 0 ${SC} ${X.toFixed(1)} ${Y.toFixed(1)})" ${attrs}>${inner}</g>`; };
const fz = (x, y, z, inner, attrs = "") => { const [X, Y] = P(x, y, z); return `<g transform="matrix(${CX * SC} ${HY * SC} ${-CX * SC} ${HY * SC} ${X.toFixed(1)} ${Y.toFixed(1)})" ${attrs}>${inner}</g>`; };
const TX = (u, v, s, txt, fill = "#EEF3FA", o = "") => `<text x="${u}" y="${v}" font-size="${s}" fill="${fill}" font-family="Geist, ui-sans-serif, system-ui, sans-serif" ${o}>${esc(txt)}</text>`;
const TM = (u, v, s, txt, fill = "#EEF3FA", o = "") => `<text x="${u}" y="${v}" font-size="${s}" fill="${fill}" font-family="Geist Mono, ui-monospace, monospace" ${o}>${esc(txt)}</text>`;
const SKIN = ["#E8C2A0", "#C99A76", "#9B6B4C", "#6E4A35", "#F0CFB4", "#B78462"], HAIR = ["#1B1512", "#3A2617", "#5C3B22", "#141414", "#7A5230", "#2B2B2B"];
const hash = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
/* A person, sitting or standing. back = seen from behind (facing away from you). */
function person(x, y, z, shirt, key, o = {}) {
  const [px, py] = P(x, y, z), h = hash(key), skin = SKIN[h % SKIN.length], hair = HAIR[(h >> 3) % HAIR.length], s = SC;
  const torsoH = o.seated ? 1.25 : 1.9, top = py - torsoH * s;
  const legs = o.seated ? "" : `<rect x="${px - .32 * s}" y="${py - .9 * s}" width="${.26 * s}" height="${.9 * s}" rx="3" fill="#20242C"/><rect x="${px + .06 * s}" y="${py - .9 * s}" width="${.26 * s}" height="${.9 * s}" rx="3" fill="#20242C"/>`;
  const body = `<path d="M${px - .5 * s},${(o.seated ? py : py - .85 * s).toFixed(1)} Q${px - .55 * s},${(top + .2 * s).toFixed(1)} ${px},${(top).toFixed(1)} Q${px + .55 * s},${(top + .2 * s).toFixed(1)} ${px + .5 * s},${(o.seated ? py : py - .85 * s).toFixed(1)} Z" fill="${shirt}" stroke="rgb(0 0 0 / .35)" stroke-width=".7"/>`;
  const hy = top - .42 * s, hr = .36 * s;
  const head = o.back
    ? `<circle cx="${px}" cy="${hy}" r="${hr}" fill="${hair}"/><path d="M${px - hr},${hy + hr * .2} Q${px},${hy + hr * 1.25} ${px + hr},${hy + hr * .2}" fill="${skin}" opacity=".9"/>`
    : `<circle cx="${px}" cy="${hy}" r="${hr}" fill="${skin}"/><path d="M${px - hr},${hy - hr * .05} Q${px - hr * .9},${hy - hr * 1.15} ${px},${hy - hr * 1.05} Q${px + hr * .95},${hy - hr * 1.1} ${px + hr},${hy - hr * .05} Q${px},${hy - hr * .55} ${px - hr},${hy - hr * .05} Z" fill="${hair}"/>`;
  return `<ellipse cx="${px}" cy="${py + .1 * s}" rx="${.6 * s}" ry="${.28 * s}" fill="rgb(0 0 0 / .35)"/>${legs}${body}${head}`;
}
function bubble(x, y, z, txt, col) { const [px, py] = P(x, y, z), w = txt.length * 6.4 + 12; return `<g><rect x="${px - w / 2}" y="${py - 17}" width="${w}" height="16" rx="8" fill="${col}"/><path d="M${px - 3},${py - 1.5} L${px},${py + 3} L${px + 3},${py - 1.5}Z" fill="${col}"/>${`<text x="${px}" y="${py - 5.5}" font-size="10.5" font-weight="600" fill="#05080D" text-anchor="middle" font-family="Geist Mono, monospace">${esc(txt)}</text>`}</g>`; }
const tip = (title, sub) => `data-tip="${esc(title)}" data-tip2="${esc(sub || "")}"`;
const waitCol = d => d >= 2 ? "#FF4D6A" : d >= 1 ? "#F6B64A" : "#8693A8";
const ageCol = (a, corp) => corp ? "#9C8CFF" : a > 7 ? "#FF4D6A" : a >= 4 ? "#F6B64A" : "#3EDC97";
const stageHex = st => ({ "Queue": "#8693A8", "Assigned": "#C9D3E2", "In Process": "#F6C94A", "In Review": "#5EB2FF", "Corrections": "#FF8F45", "Client Review": "#3EDC97", "Done": "#9C8CFF" }[st] || "#A68CFF");

function renderScene() {
  const svg = $("scene"); if (!svg) return;
  const ready = S.items.length > 0, sm = new Map(suites().map(s => [firstName(s.name).toLowerCase(), s]));
  let h = `<defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <linearGradient id="scr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EAF6FF"/><stop offset="1" stop-color="#9FCBEE"/></linearGradient>
    <radialGradient id="pool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE7B8" stop-opacity=".22"/><stop offset="1" stop-color="#FFE7B8" stop-opacity="0"/></radialGradient></defs>`;
  YOFF = 0; h += drawOutside() + drawWing();
  YOFF = 14;
  /* slab + floors */
  h += box(-0.6, -0.6, -1, 65.2, 47.2, 1, "#10141B", { stroke: 'stroke="none"' });
  h += quad(0, 0, 16, 22, "#1F2B27") + quad(0, 22, 16, 24, "#1A1E26") + quad(16, 0, 32, 28, "#1B1F27") + quad(48, 0, 16, 28, "#2A1820") + quad(16, 28, 48, 18, "#151A22");
  for (let k = 1; k < 32; k += 2) h += `<polyline points="${pts([P(16 + k, 0), P(16 + k, 28)])}" stroke="rgb(255 255 255 / .025)" stroke-width="1"/>`;
  /* back walls with acoustic foam */
  h += box(-0.6, -0.6, 0, 65.2, 0.6, 1.1, "#232A36") + `<polygon points="${pts([P(0, 0, 1.1), P(64, 0, 1.1), P(64, 0, 3.4), P(0, 0, 3.4)])}" fill="rgb(160 200 255 / .05)" stroke="rgb(160 200 255 / .16)" stroke-width=".8" pointer-events="none"/>`;
  h += box(-0.6, 0, 0, 0.6, 46, 8.5, "#232A36", { stroke: 'stroke="rgb(0 0 0 / .4)" stroke-width=".7"' });
  h += fz(1.2, 0.5, .02, TM(0, .9, .95, "GREEN ROOM", "#7FA391", 'letter-spacing=".25"') + TM(0, 1.8, .55, "QUEUE", "#5E7A6C", 'letter-spacing=".2"'));
  h += fz(31.5, 26.4, .02, TM(0, .9, .95, "EDIT SUITES", "#7D8AA3", 'letter-spacing=".25"'));
  h += fz(48.8, 26.6, .02, TM(0, .6, .55, "SCREENING · CLIENT REVIEW", "#B98A98", 'letter-spacing=".15"'));
  h += fx(0, 44, 7.6, TM(0, 0.9, 0.85, "DELIVERY", "#B7A9FF", 'letter-spacing=".25"') + TM(0, 1.9, 0.55, "DONE THIS WEEK", "#7D74B8", 'letter-spacing=".2"'));

  /* ---------- green room ---------- */
  const g = guests();
  h += `<g data-room="green" ${tip("Green room", g.length + " waiting for an editor · click for the list")}>${quad(1.6, 3.6, 12.4, 13.4, "#2A3B34")}${quad(2.2, 4.2, 11.2, 12.2, "#30443B")}`;
  h += box(13, 1, 0, 1.6, 1.6, 1.1, "#5B4632") + `<circle cx="${P(13.8, 1.8, 2.6)[0]}" cy="${P(13.8, 1.8, 2.6)[1]}" r="${1.1 * SC}" fill="#2F6B46"/><circle cx="${P(13.3, 1.8, 3.2)[0]}" cy="${P(13.3, 1.8, 3.2)[1]}" r="${.75 * SC}" fill="#3C8A57"/>`;
  h += box(2, 1, 0, 10.4, 2.4, 1.0, "#2F5C4F") + box(2, 0.6, 1.0, 10.4, 0.6, 1.6, "#2A5246");
  h += box(1, 5, 0, 2.4, 12, 1.0, "#2F5C4F") + box(0.6, 5, 1.0, 0.6, 12, 1.6, "#2A5246");
  const seatsA = [[3, 2.3], [5, 2.3], [7, 2.3], [9, 2.3], [11, 2.3]], seatsB = [[2.4, 7], [2.4, 9.2], [2.4, 11.4], [2.4, 13.6], [2.4, 15.8]];
  const gpos = seatsA.concat(seatsB);
  g.slice(0, 10).forEach(({ it, wait }, i) => {
    const [x, y] = gpos[i];
    h += `<g class="hot" data-gep="${esc(it.id)}" tabindex="0" ${tip(it.name, (wait ? "Waiting " + wait + (wait === 1 ? " day" : " days") : "Arrived today") + " · drag into a booth to assign")}>${person(x, y, 1.0, waitCol(wait), it.id, { seated: true })}${wait ? bubble(x, y, 3.7, wait + "d", waitCol(wait)) : ""}</g>`;
  });
  if (g.length > 10) h += fz(5, 18, 0.02, `<rect x="0" y="0" width="5" height="1.3" rx=".3" fill="#0B0F14" stroke="#F6B64A" stroke-width=".06"/>` + TX(.3, .95, .75, "+" + (g.length - 10) + " more waiting", "#F6B64A"));
  h += box(6, 8.5, 0, 4.2, 3, 0.7, "#5B4632") + box(7.4, 9.3, 0.7, 1.2, 0.8, 0.35, "#D9DFE8");
  if (ready && !g.length) h += fz(4.5, 13, 0.02, TX(0, 0, .9, "Nobody waiting", "#9FB8A8"));
  h += "</g>";

  /* ---------- due today: departure board + dispatch desk ---------- */
  const dues = dueToday();
  h += `<g data-room="due" ${tip("Due today", dues.length + " episodes due today · click for the list")}>` + quad(0.3, 22.3, 15.2, 10.7, "#2A2414");
  h += box(2.4, 23, 0, .3, .3, 5.4, "#2B2F37") + box(13.4, 23, 0, .3, .3, 5.4, "#2B2F37") + box(2.2, 23, 1.5, 11.6, .3, 3.9, "#0A0C10");
  h += fy(2.4, 23.3, 5.2, dueBoard(11.2, 3.6), 'class="flick"');
  h += box(3, 27, 0, 10, 2, 1.1, "#5B4632");
  dues.slice(0, 10).forEach((it, i) => { const late = isLate(it); h += `<g class="hot${late ? " blink" : ""}" data-ep="${esc(it.id)}" ${tip(it.name, it.stage + " · " + rel(it).txt)}>${box(3.3 + i * .97, 27.5, 1.1, .55, .9, .9, late ? "#FF4D6A" : stageHex(it.stage))}</g>`; });
  h += fz(1, 30.2, .02, TX(0, .9, 1.4, String(dues.length), "#F6C94A", 'font-weight="700"') + TX(1.6 + String(dues.length).length * .7, .9, .7, "due today", "#B89A4E"));
  h += "</g>" + box(0, 33.2, 0, 9, 0.3, 1.1, "#2B323E");
  /* ---------- done this week: the delivery shelf ---------- */
  const done = doneWeek();
  h += `<g data-room="done" ${tip("Done this week", done.length + " delivered in the last 7 days · click for the list")}>` + quad(0.3, 33.5, 15.2, 12.2, "#1C1A2A");
  h += box(0.2, 34, 0, 1.6, 11.8, 5.4, "#30353F");
  for (let shelf = 0; shelf < 4; shelf++) h += box(0.2, 34, 0.3 + shelf * 1.3, 1.7, 11.8, 0.12, "#4A505C");
  done.slice(0, 48).forEach((it, i) => { const sh = Math.floor(i / 12), k = i % 12; h += `<g class="hot" data-ep="${esc(it.id)}" ${tip(it.name, "Done")}>${box(0.45, 34.4 + k * .95, 0.42 + sh * 1.3, 1.1, .7, 1.0, "#7B6FD6")}</g>`; });
  h += fz(4, 39, 0.02, TX(0, 0, 2.2, String(done.length), "#9C8CFF", 'font-weight="700"') + TX(0, 1.3, .8, "delivered this week", "#7D74B8"));
  h += box(9, 41.5, 0, 5, 2.2, 1.1, "#3B2E5C") + box(9, 43.5, 1.1, 5, 0.4, 1.2, "#33284F") + "</g>";

  /* wall between green room and booths (door at y 10–13), low wall to delivery */
  h += box(15.7, 0, 0, 0.3, 10, 4.2, "#2B323E") + box(15.7, 13, 0, 0.3, 15, 4.2, "#2B323E");
  h += box(0, 21.8, 0, 9, 0.3, 1.1, "#2B323E");

  /* ---------- edit booths ---------- */
  const booths = [], tags = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) booths.push({ r, c, ed: EDITORS[r * 4 + c] });
  booths.sort((a, b) => (a.r + a.c) - (b.r + b.c) || a.r - b.r).forEach(({ r, c, ed }) => {
    const bx = 16 + c * 8, by = r * 9 + 0.4;
    if (!ed) { h += box(bx + 1, by + 1.2, 0, 5.8, 2, 1.4, "#2A2F38") + fz(bx + 1.6, by + 5.5, 0.02, TX(0, 0, .8, "Spare booth", "#55617A")); return; }
    const name = ed[0], s = sm.get(firstName(name).toLowerCase()) || { name, edit: [], cr: [], late: 0, u: 0 };
    const rows = s.edit.slice().sort((a, b) => (isLate(b) - isLate(a)) || ((daysTo(a) ?? 99) - (daysTo(b) ?? 99)));
    const ratio = s.u / capOf(name), lit = s.edit.some(i => i.stage === "In Process"), busy = rows.length > 0;
    h += `<g class="booth" data-drop="${esc(name)}" data-room="suite:${esc(name)}" ${tip(name + "'s booth", fmtU(s.u) + " units in edit of " + capOf(name) + "/wk · " + s.late + " late · " + s.cr.length + " with clients")}>
      ${quad(bx + 0.3, by + 0.3, 7.4, 8.3, busy ? "#20252F" : "#1A1E26")}${quad(bx + 0.3, by + 0.3, 7.4, 8.3, "rgb(63 169 255 / .28)", 0.01, 'class="floorhl"')}`;
    h += box(bx + 0.3, by, 0, 7.4, 0.3, 2.8, "#2B323E") + box(bx, by, 0, 0.3, 8.6, 2.8, "#29303B");
    h += fy(bx + 0.7, by + 0.3, 2.55, `<rect x="0" y="0" width="3.6" height=".75" rx=".12" fill="#0C1016" stroke="rgb(255 255 255 / .12)" stroke-width=".04"/>` + TX(.2, .55, .5, firstName(name).toUpperCase(), "#EEF3FA", 'font-weight="600" letter-spacing=".08"'));
    /* ON AIR lamp */
    h += fy(bx + 4.6, by + 0.3, 2.6, `<rect x="0" y="0" width="1.7" height=".55" rx=".08" fill="${lit ? "#E0002F" : "#2A1418"}"/>` + TM(.17, .41, .38, "ON AIR", lit ? "#fff" : "#5A2A33", 'font-weight="700"'), lit ? 'class="flick"' : "");
    if (lit) { const [lx, ly] = P(bx + 5.5, by + 0.3, 2.35); h += `<ellipse cx="${lx}" cy="${ly}" rx="22" ry="10" fill="#FF003C" opacity=".45" filter="url(#glow)" pointer-events="none"/>`; }
    /* load meter on the partition */
    const ledsOn = Math.round(Math.min(1.5, ratio) / 1.5 * 6);
    h += fy(bx + 6.55, by + 0.3, 2.3, Array.from({ length: 6 }, (_, k) => `<rect x="0" y="${(5 - k) * .34}" width=".55" height=".26" rx=".05" fill="${k < ledsOn ? (k >= 4 ? "#FF4D6A" : k >= 3 ? "#F6B64A" : "#3EDC97") : "#141922"}"/>`).join(""));
    /* desk + monitors */
    h += box(bx + 0.8, by + 0.8, 0, 6.0, 2.3, 1.45, "#6A4F37");
    const ep1 = rows[0], ep2 = rows[1];
    [[bx + 1.2, ep1], [bx + 3.75, ep2]].forEach(([mx, ep], k) => {
      const z0 = 1.75, my = by + 1.05;
      h += box(mx + 1, my + 0.1, 1.45, 0.4, 0.3, 0.3, "#15181E");
      h += `<g ${ep ? `class="hot" data-ep="${esc(ep.id)}" ${tip(ep.name, ep.stage + " · " + rel(ep).txt)}` : ""}>` + box(mx, my, z0, 2.4, 0.22, 1.55, "#0A0C10");
      if (ep) {
        const col = stageHex(ep.stage), late = isLate(ep);
        h += fy(mx + 0.12, my + 0.22, z0 + 1.43, `<rect x="0" y="0" width="2.16" height="1.31" fill="#0E1C2B"/><rect x="0" y="0" width="2.16" height=".24" fill="${late ? "#FF4D6A" : col}"/>`
          + TX(.1, .18, .17, (late ? "LATE · " : "") + ep.stage.toUpperCase(), "#05080D", 'font-weight="700"')
          + TX(.1, .6, .3, label(ep).slice(0, 13), "#EEF3FA", 'font-weight="600"')
          + Array.from({ length: 14 }, (_, q) => `<rect x="${.1 + q * .146}" y="${1.05 - (.12 + ((hash(ep.id + q) % 9) / 9) * .32)}" width=".09" height="${.12 + ((hash(ep.id + q) % 9) / 9) * .32}" fill="${col}" opacity=".8"/>`).join("")
          + `<rect x=".1" y="1.12" width="1.96" height=".05" fill="rgb(255 255 255 / .15)"/><rect x="${.1 + 1.96 * ((hash(ep.id) % 70) / 100 + .15)}" y="1.02" width=".04" height=".22" fill="#FF003C"/>`, 'class="flick"');
        const [gx, gy] = P(mx + 1.2, my + 1.6, 1.46); h += `<ellipse cx="${gx}" cy="${gy}" rx="34" ry="13" fill="${col}" opacity=".16" filter="url(#glow)" pointer-events="none"/>`;
      } else h += fy(mx + 0.12, my + 0.22, z0 + 1.43, `<rect x="0" y="0" width="2.16" height="1.31" fill="#0B0F15"/>` + (k === 0 && !busy ? TX(.45, .75, .26, "No edits", "#3A4558") : ""));
      h += `</g>`;
    });
    /* tapes on the desk: one per episode in edit */
    rows.slice(0, 7).forEach((ep, i) => {
      const late = isLate(ep);
      h += `<g class="hot${late ? " blink" : ""}" data-ep="${esc(ep.id)}" ${tip(ep.name, ep.stage + " · " + rel(ep).txt + (ep.editor ? " · " + ep.editor : ""))}>${box(bx + 1.0 + i * 0.42, by + 2.3, 1.45, 0.34, 0.62, 0.62, late ? "#FF4D6A" : stageHex(ep.stage))}</g>`;
    });
    if (rows.length > 7) h += fz(bx + 4.0, by + 2.45, 1.47, TX(0, .3, .42, "+" + (rows.length - 7), "#C9D3E2", 'font-weight="600"'));
    /* chair + editor (seen from behind) */
    h += box(bx + 3.3, by + 4.3, 0, 1.5, 1.5, 0.85, "#252A33");
    if (busy) h += person(bx + 4.05, by + 4.9, 0.85, stageHex(rows[0].stage) === "#C9D3E2" ? "#6C7A91" : shade(stageHex(rows[0].stage), .7), name, { seated: true, back: true });
    h += box(bx + 3.3, by + 5.6, 0.85, 1.5, 0.28, 1.25, "#2D333D");
    /* floor label */
    h += fz(bx + 1.0, by + 7.0, 0.02, TX(0, 0, .62, firstName(name), busy ? "#C9D3E2" : "#55617A", 'font-weight="600"') + TX(0, .85, .48, busy ? `${fmtU(s.u)}u of ${capOf(name)}/wk${s.late ? " · " + s.late + " late" : ""}` : s.cr.length ? s.cr.length + " with clients" : "Free", s.late ? "#FF6B82" : "#6F7C92"));
    h += "</g>";
    tags.push({ x: bx + 5.4, y: by + 0.2, name, busy, late: s.late, txt: firstName(name) + (busy ? " · " + fmtU(s.u) + "/" + capOf(name) : " · free"), lit });
  });
  tags.forEach(t => { const [px, py] = P(t.x, t.y, 4.7), w = t.txt.length * 6.3 + 18, br = t.late ? "#FF4D6A" : t.busy ? "rgb(238 243 250 / .55)" : "rgb(160 200 255 / .2)";
    h += `<g data-room="suite:${esc(t.name)}" ${tip(t.name + "'s booth", "Click for the suite and capacity")}><rect x="${px - w / 2}" y="${py - 10}" width="${w}" height="19" rx="9.5" fill="#0B0F15" fill-opacity=".92" stroke="${br}" stroke-width="1"/>${t.lit ? `<circle cx="${px - w / 2 + 9}" cy="${py - .5}" r="3" fill="#FF003C"/>` : ""}<text x="${px + (t.lit ? 4 : 0)}" y="${py + 3.5}" text-anchor="middle" font-size="11" font-weight="600" fill="${t.busy ? "#EEF3FA" : "#6F7C92"}" font-family="Geist, sans-serif">${esc(t.txt)}</text></g>`; });
  /* wall between booths and screening (door at y 21–24) */
  h += box(47.7, 0, 0, 0.3, 21, 4.2, "#2B323E") + box(47.7, 24, 0, 0.3, 4, 4.2, "#2B323E");

  /* ---------- screening room ---------- */
  const cr = screening(), vip = cr.filter(i => CORPORATE.test(i.name)), reg = cr.filter(i => !CORPORATE.test(i.name));
  h += `<g data-room="screening" ${tip("Screening room", cr.length + " with clients · click for the seats")}>${quad(48.3, 0.3, 15.4, 27.4, "#2E1A23")}`;
  h += fy(50, 0, 6.8, `<rect x="0" y="0" width="12" height="4.6" rx=".1" fill="url(#scr)"/>` + TX(.6, 1.6, .9, "CLIENT REVIEW", "#0E2A44", 'font-weight="700" letter-spacing=".05"') + TX(.6, 2.9, 1.3, String(cr.length) + " in review", "#0E2A44", 'font-weight="600"') + TX(.6, 3.9, .5, reg.filter(isLate).length + " quiet for more than 7 days", "#5B2030"), 'class="flick"');
  { const [sx, sy] = P(56, 0.4, 4.5); h += `<ellipse cx="${sx}" cy="${sy + 40}" rx="150" ry="60" fill="#CFE8FF" opacity=".09" filter="url(#glow)" pointer-events="none"/>`; }
  h += box(48.6, 0.4, 0, 1.1, 1.1, 4.6, "#1A1D23") + box(62.4, 0.4, 0, 1.1, 1.1, 4.6, "#1A1D23");
  const seatAt = (row, col) => [49.6 + col * 2.35, 6.2 + row * 3.3];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) {
    const [x, y] = seatAt(row, col), vipRow = row === 4, idx = row * 6 + col;
    const it = vipRow ? vip[col] : reg[idx], colr = vipRow ? "#6B5521" : "#5E1B2A";
    h += box(x, y, 0, 1.7, 1.4, 0.75, colr);
    if (it) { const a = ageDays(it), c = ageCol(a, vipRow);
      h += `<g class="hot" data-ep="${esc(it.id)}" ${tip(it.name, a + (a === 1 ? " day" : " days") + " with the client" + (vipRow ? " · corporate" : ""))}>${person(x + 0.85, y + 0.6, 0.75, shade(c, .55), it.id, { seated: true, back: true })}${bubble(x + 0.85, y + 0.6, 3.35, a + "d", c)}</g>`; }
    h += box(x, y + 1.25, 0.75, 1.7, 0.35, 1.05, shade(colr, 1.1));
  }
  if (reg.length > 24) h += fz(50, 24.3, .02, TX(0, 0, .75, "+" + (reg.length - 24) + " more in review", "#F6B64A"));
  { const [a1, a2] = [P(49.4, 19.0, 1.3), P(63.2, 19.0, 1.3)]; h += box(49.2, 18.8, 0, .35, .35, 1.5, "#C9A23A") + box(62.9, 18.8, 0, .35, .35, 1.5, "#C9A23A") + `<path d="M${a1[0]},${a1[1]} Q${(a1[0] + a2[0]) / 2},${(a1[1] + a2[1]) / 2 + 14} ${a2[0]},${a2[1]}" stroke="#B0102E" stroke-width="3" fill="none"/>`
    + fz(50, 26.6, .02, TM(0, 0, .55, "VIP · CORPORATE, OPEN-ENDED REVIEW", "#B7A060", 'letter-spacing=".1"')); }
  h += "</g>";

  /* glass wall to the control room */
  h += box(16, 27.8, 0, 48, 0.3, 1.2, "#2B323E") + `<polygon points="${pts([P(16, 28, 1.2), P(64, 28, 1.2), P(64, 28, 4.2), P(16, 28, 4.2)])}" fill="rgb(160 200 255 / .06)" stroke="rgb(160 200 255 / .18)" stroke-width=".8" pointer-events="none"/>`;

  /* ---------- control room ---------- */
  h += `<g data-room="control" ${tip("Control room", "Capacity, forecast and bottlenecks · click to open")}>${quad(16.3, 28.4, 47.4, 17.4, "#161B24")}`;
  /* the console */
  h += `<g class="hot" data-room="control" ${tip("Mixing console", "One channel per editor: load against weekly capacity · click to adjust")}>` + box(21.5, 35, 0, 35, 3.8, 1.25, "#2B3039", { top: "#323844" });
  h += `</g>`;
  /* wall screen 1: the on-air board */
  const days = workdaysAhead(10), capDay = EDITORS.reduce((a, [n]) => a + capOf(n), 0) / 5;
  const due = d => active().filter(i => EDIT_STAGES.includes(i.stage) && nextDue(i) === d).reduce((a, i) => a + units(i), 0);
  const inc = d => (S.bookings || []).filter(b => b.arrives === d && b.owner !== "laura").reduce((a, b) => a + b.units, 0);
  const cols = days.map(d => ({ d, due: due(d), inc: inc(d) })), mx = Math.max(capDay * 1.3, ...cols.map(c => c.due + c.inc), 1), overN = cols.filter(c => c.due + c.inc > capDay).length;
    h += `<g class="hot" data-room="board" ${tip("On-air board", "Work landing per working day against team capacity · click for details")}>` + box(23.0, 34.6, 1.25, 11.3, 0.3, 4.5, "#0A0C10");
  h += fy(23.15, 34.9, 5.6, `<g transform="scale(.8)"><rect x="0" y="0" width="13.6" height="5.2" fill="#07101A"/>` + TX(.3, .55, .38, "ON-AIR BOARD · NEXT 10 WORKING DAYS", "#7FA9D1", 'font-weight="600" letter-spacing=".04"')
    + TX(9.3, .55, .38, overN ? overN + " over capacity" : "within capacity", overN ? "#FF6B82" : "#3EDC97", 'font-weight="600"')
    + cols.map((c, k) => { const x0 = .5 + k * 1.3, hb = 3.6, b = 4.5, hd = c.due / mx * hb, hi = c.inc / mx * hb, over = c.due + c.inc > capDay;
        return `<rect x="${x0}" y="${b - hd}" width=".9" height="${hd}" fill="#FF8F45"/><rect x="${x0}" y="${b - hd - hi}" width=".9" height="${hi}" fill="#3FA9FF"/>` + TX(x0 + .05, 4.95, .3, dayLabel(c.d).split(" ")[0].slice(0, 2) + " " + dayLabel(c.d).split(" ")[1], over ? "#FF6B82" : "#6F8AA6"); }).join("")
    + `<rect x=".4" y="${(4.5 - capDay / mx * 3.6).toFixed(2)}" width="12.9" height=".05" fill="#EEF3FA" opacity=".7"/></g>`, 'class="flick"') + `</g>`;
  /* wall screen 2: bottleneck meter */
  const nk = FLOW.map(st => { const gg = active().filter(i => i.stage === st); return { st, n: gg.length, u: gg.reduce((a, i) => a + units(i), 0) }; }), nmax = Math.max(1, ...nk.map(r => r.u)), worst = nk.reduce((a, r) => r.u > a.u ? r : a, nk[0]);
    h += `<g class="hot" data-room="necks" ${tip("Bottleneck meter", "Where work is held · click for details")}>` + box(36.2, 34.6, 1.25, 9.1, 0.3, 4.5, "#0A0C10");
  h += fy(36.35, 34.9, 5.6, `<g transform="scale(.8)"><rect x="0" y="0" width="11" height="5.2" fill="#100A12"/>` + TX(.3, .55, .38, "BOTTLENECK METER", "#C9A0B4", 'font-weight="600" letter-spacing=".04"')
    + nk.map((r, k) => `${TX(.3, 1.25 + k * .62, .32, r.st, r === worst ? "#EEF3FA" : "#8C95A8")}<rect x="3.3" y="${.98 + k * .62}" width="${(r.u / nmax * 6.6).toFixed(2)}" height=".36" fill="${stageHex(r.st)}" opacity="${r === worst ? 1 : .7}"/>${TX(10.1, 1.25 + k * .62, .3, String(r.n), "#8C95A8")}`).join("") + `</g>`, 'class="flick"') + `</g>`;
  h += `<g class="hot" data-room="control">`;
  EDITORS.forEach(([n], i) => {
    const s = sm.get(firstName(n).toLowerCase()) || { u: 0, late: 0 }, ratio = s.u / capOf(n), x = 22.4 + i * 3.1;
    h += quad(x, 35.4, 2.4, 3.1, "#262B33", 1.26) + quad(x + 1.05, 35.6, .3, 2.7, "#0B0D11", 1.27);
    const ky = 35.6 + (1 - Math.min(2, ratio) / 2) * 2.4;
    h += box(x + .75, ky, 1.27, .9, .45, .28, ratio > 1 ? "#E23A57" : "#C9D0DA");
    h += box(x + 1.9, 37.9, 1.27, .32, .32, .16, s.late ? "#FF4D6A" : "#1B2330", s.late ? { attrs: 'class="blink"' } : {});
    h += fz(x + .25, 38.25, 1.28, TM(0, .35, .42, initials(n), "#C9D3E2", 'font-weight="600"'));
  });
  h += box(21.2, 35.2, 1.25, .9, .9, 1.6, "#15181E") + box(56.6, 35.2, 1.25, .9, .9, 1.6, "#15181E") + `</g>`;
  /* you, at the desk */
  h += box(38.2, 40.3, 0, 1.6, 1.6, .85, "#252A33") + person(39, 40.9, .85, "#B0102E", "AG", { seated: true, back: true }) + box(38.2, 41.6, .85, 1.6, .28, 1.25, "#2D333D");
  h += bubble(39, 40.9, 3.4, "You", "#EEF3FA");
  h += fz(24, 43.6, .02, TM(0, 0, .95, "CONTROL ROOM", "#4B5874", 'letter-spacing=".3"'));
  h += fz(52, 43.0, .02, TX(0, 0, .7, `${fmtU(suites().reduce((a, s) => a + s.u, 0))} of ${EDITORS.reduce((a, [n]) => a + capOf(n), 0)} units/wk in edit`, "#6F7C92"));
  h += "</g>";
  /* warm pools of light */
  [[8, 10], [32, 13], [56, 14], [39, 37]].forEach(([x, y]) => { const [lx, ly] = P(x, y, 0); h += `<ellipse cx="${lx}" cy="${ly}" rx="190" ry="95" fill="url(#pool)" pointer-events="none"/>`; });
  if (!ready) { const [lx, ly] = P(32, 12, 6); h += `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="22" fill="#8693A8" font-family="Geist, sans-serif">${S.error ? "Couldn't read your board" : "Opening the studio…"}</text>`; }
  YOFF = 0; h += drawRoad();
  svg.innerHTML = h;
}

/* ---------- tooltips, keyboard, drag a guest into a booth ---------- */
(() => {
  const stage = $("stage"), tipEl = $("tip");
  const place = e => { const r = stage.getBoundingClientRect(); tipEl.style.left = Math.min(r.width - tipEl.offsetWidth - 8, e.clientX - r.left + 14) + "px"; tipEl.style.top = Math.min(r.height - tipEl.offsetHeight - 8, e.clientY - r.top + 14) + "px"; };
  stage.addEventListener("pointermove", e => {
    if (drag) return;
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (!t) { tipEl.hidden = true; return; }
    tipEl.innerHTML = `<b>${esc(t.dataset.tip)}</b>${t.dataset.tip2 ? `<span>${esc(t.dataset.tip2)}</span>` : ""}`; tipEl.hidden = false; place(e);
  });
  stage.addEventListener("pointerleave", () => { tipEl.hidden = true; });
  document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest("#scene [data-ep],#scene [data-room],#scene [data-gep]")) { e.preventDefault(); const t = e.target; if (t.dataset.gep) openEp(t.dataset.gep); else t.dispatchEvent(new MouseEvent("click", { bubbles: true })); } });
  let drag = null;
  stage.addEventListener("pointerdown", e => {
    const g = e.target.closest && e.target.closest("[data-gep]"); if (!g) return;
    e.preventDefault(); drag = { id: g.dataset.gep, x0: e.clientX, y0: e.clientY, moved: false, ghost: null, over: null };
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  });
  stage.addEventListener("pointermove", e => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
    if (!drag.moved) { drag.moved = true; const it = S.items.find(i => i.id === drag.id); drag.ghost = document.createElement("div"); drag.ghost.className = "tip"; drag.ghost.innerHTML = `<b>${esc(it ? it.name : "")}</b><span>Drop in an editor's booth</span>`; stage.appendChild(drag.ghost); tipEl.hidden = true; }
    const r = stage.getBoundingClientRect(); drag.ghost.style.left = e.clientX - r.left + 12 + "px"; drag.ghost.style.top = e.clientY - r.top + 12 + "px";
    drag.ghost.style.display = "none"; const under = document.elementFromPoint(e.clientX, e.clientY); drag.ghost.style.display = "";
    const b = under && under.closest && under.closest("[data-drop]");
    if (b !== drag.over) { if (drag.over) drag.over.classList.remove("drop"); drag.over = b; if (b) { b.classList.add("drop"); drag.ghost.querySelector("span").textContent = "Give to " + firstName(b.dataset.drop); } else drag.ghost.querySelector("span").textContent = "Drop in an editor's booth"; }
  });
  stage.addEventListener("pointerup", e => {
    if (!drag) return; const d = drag; drag = null;
    if (d.ghost) d.ghost.remove(); if (d.over) d.over.classList.remove("drop");
    const it = S.items.find(i => i.id === d.id); if (!it) return;
    if (!d.moved) { openEp(it.id); return; }
    if (d.over) reassign(it, d.over.dataset.drop);
  });
})();

/* ---------- outside: Sheikh Zayed Road, the Metro red line and the Al Barsha towers ---------- */
function drawOutside() {
  /* the Al Barsha towers behind the building */
  let h = "";
  const towers = [[-1, 12], [5, 16], [11, 9], [15, 14.5], [22, 11], [27, 17], [33, 10], [38, 15], [44, 12.5], [49, 18], [55, 10.5], [60, 14]];
  towers.forEach(([x, z], k) => {
    const w = 3.6 + (k % 3), d = 2.2, y = -10.6;
    h += box(x, y, 0, w, d, z, k % 2 ? "#172033" : "#141B2A", { stroke: 'stroke="rgb(0 0 0 / .5)" stroke-width=".6"' });
    let win = ""; for (let u = .4; u < w - .3; u += .7) for (let v = .6; v < z - .4; v += .9) if ((hash(k + ":" + u + ":" + v) % 5) < 2) win += `<rect x="${u.toFixed(2)}" y="${v.toFixed(2)}" width=".3" height=".42" fill="${(hash(k + "w" + v) % 4) ? "#E9C77A" : "#9CC8F0"}" opacity=".55"/>`;
    h += fy(x, y + d, z, win);
  });
  return h;
}
/* Sheikh Zayed Road and the Metro red line run along the building's open side, drawn last so they sit in front. */
const fzy = (x, y, z, inner) => { const [X, Y] = P(x, y, z); return `<g transform="matrix(${CX * SC} ${-HY * SC} ${CX * SC} ${HY * SC} ${X.toFixed(1)} ${Y.toFixed(1)})">${inner}</g>`; };
function drawRoad() {
  let h = quad(65, -4, 9, 66, "#0C0F14") + quad(64.6, -4, .4, 66, "#2A2F38");
  for (let y = -2; y < 60; y += 4) h += quad(69.3, y, .18, 2, "rgb(255 255 255 / .2)");
  for (let k = 0; k < 6; k++) { const y = ((hash("car" + k) % 60) + (Date.now() / 900) * (k % 2 ? 1 : -1)) % 62, yy = ((y % 62) + 62) % 62 - 2; h += box(k % 2 ? 70.2 : 66.4, yy, 0, 1.4, 2.6, .9, ["#D9DEE6", "#2E5A7A", "#8E3B2E", "#C9A24B", "#1E1E22", "#5A6170"][k]); }
  for (let y = 0; y <= 56; y += 8) h += box(72.6, y, 0, .8, .8, 3.2, "#3A404C");
  h += box(72.2, -4, 3.2, 1.6, 66, .55, "#4A515E");
  const ty = (Date.now() / 2400) % 44;
  for (let c = 0; c < 5; c++) { const y = ty + c * 3.6; h += box(72.45, y, 3.75, 1.1, 3.4, 1.05, "#D9DEE6", { right: "#C9CED6" }) + fx(73.55, y + 3.4, 4.65, `<rect x="0" y="0" width="3.4" height=".26" fill="#C8102E"/><rect x=".3" y=".36" width="2.8" height=".28" fill="#1E2A3A"/>`); }
  h += fzy(66.6, 56, .01, TM(0, .7, .85, "SHEIKH ZAYED ROAD", "rgb(255 255 255 / .25)", 'letter-spacing=".35"'));
  h += fzy(70.6, 30, .01, TM(0, .6, .55, "DUBAI METRO · RED LINE", "rgb(200 16 46 / .6)", 'letter-spacing=".25"'));
  return h;
}

/* ---------- the calendar wing: your calendar, production@ and studio@ ----------
   Each calendar is a room at the back of the building. Its wall screen is today's agenda (Dubai time); the ON AIR lamp lights
   and people sit at the table while a timed event is running. Read-only: events come from Google Calendar list_events. */
const CALS = [
  { n: "Mine", id: "primary", sub: "Your calendar", floor: "#2A1820", acc: "#FF003C" },
  { n: "Production", id: "production@poddster.com", sub: "production@poddster.com", floor: "#15223A", acc: "#3FA9FF" },
  { n: "Studio", id: "studio@poddster.com", sub: "studio@poddster.com · DMC Studio 1", floor: "#211B2B", acc: "#9C8CFF" }
];
S.cals = {};
const evDay = v => String(v || "").slice(0, 10);
function normEv(ev, cal) {
  const allDay = !(ev.start && ev.start.dateTime), st = allDay ? evDay(ev.start && ev.start.date) : ev.start.dateTime, en = allDay ? evDay(ev.end && ev.end.date) : (ev.end && ev.end.dateTime) || st;
  const att = (ev.attendees || []).filter(a => !a.resource), me = att.find(a => a.self);
  const raw = ev.summary || "(No title)", title = raw.replace(/\s*[|·-]\s*Poddster Booking\s*$/i, "").trim() || raw;
  return { id: ev.id, cal, title: title + (title !== raw ? " · booking" : ""), allDay, start: st, end: en, t0: allDay ? 0 : Date.parse(st), t1: allDay ? 0 : Date.parse(en), day: allDay ? st : dubaiISO(st),
    link: ev.htmlLink || "", where: ev.location || "", people: att.length, booking: /booking/i.test(ev.summary || ""), declined: !!(me && me.responseStatus === "declined") };
}
async function loadCals() {
  if (!mcp) return;
  const from = dubaiISO(new Date()), to = dubaiISO(new Date(Date.now() + 7 * 864e5));
  await Promise.all(CALS.map(c => mcp.callTool(GCAL, "list_events", { calendarId: c.id, startTime: from + "T00:00:00", endTime: to + "T23:59:59", timeZone: "Asia/Dubai", orderBy: "startTime", pageSize: 250 }, { cache: { staleTime: 240000 } })
    .then(r => { S.cals[c.n] = { events: ((r.payload && r.payload.events) || []).filter(e => e.status !== "cancelled").map(e => normEv(e, c.n)).filter(e => !e.declined), err: null }; },
          e => { S.cals[c.n] = { events: (S.cals[c.n] || {}).events || [], err: e }; })));
  render();
}
/* today's picture for one calendar */
function calNow(c) {
  const now = Date.now(), today = dubaiISO(new Date()), d = S.cals[c.n] || null, ev = d ? d.events : [];
  const timed = ev.filter(e => !e.allDay && e.day === today).sort((a, b) => a.t0 - b.t0);
  return { loaded: !!d, err: d && d.err, live: timed.find(e => e.t0 <= now && now < e.t1), next: timed.find(e => e.t0 > now), timed, allDay: ev.filter(e => e.allDay && e.start <= today && today < (e.end || e.start + "~")), all: ev };
}
const clip = (t, n) => t.length > n ? t.slice(0, n - 1) + "…" : t;
/* The wall screen (SVG markup, W × H world units): header, today's timeline, all-day items and the week ahead. */
function calScreen(c, W, H) {
  const k = calNow(c), now = Date.now(), subX = .35 + c.n.length * .5 + .45;
  let g = `<rect x="0" y="0" width="${W}" height="${H}" rx=".12" fill="#0A0F18"/><rect x="0" y="0" width="${W}" height="1" fill="${c.acc}" opacity=".9"/>`
    + TX(.35, .72, .58, c.n.toUpperCase(), "#05080D", 'font-weight="700"') + TX(subX, .7, .34, c.sub, "#05080D", 'font-weight="600"')
    + TX(W - .35, .7, .38, new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Dubai", weekday: "short", day: "numeric", month: "short" }), "#05080D", 'font-weight="700" text-anchor="end"');
  if (!k.loaded) return g + TX(.4, 2, .45, "Reading the calendar…", "#6F7C92");
  if (k.err && !k.all.length) return g + TX(.4, 2, .4, calErr(k.err), "#FF6B82");
  const up = k.timed.findIndex(e => e.t1 > now), N = 5, first = Math.max(0, Math.min((up < 0 ? k.timed.length : up) - 1, k.timed.length - N)), rh = .7, y0 = 1.7;
  const shown = k.timed.slice(first, first + N);
  if (!shown.length) g += TX(.4, 2.1, .46, "No timed events today", "#6F7C92");
  shown.forEach((e, i) => { const y = y0 + i * rh, live = e === k.live, past = e.t1 <= now;
    g += (live ? `<rect x=".2" y="${y - .5}" width="${W - .4}" height=".64" rx=".08" fill="#3A0612"/>` : "")
      + TM(.4, y, .38, dubaiTime(e.start), live ? "#FFD0D8" : past ? "#3A4558" : "#9FB3CC")
      + `<rect x="1.9" y="${y - .38}" width=".1" height=".44" fill="${live ? "#FF003C" : e.booking ? "#F6C94A" : c.acc}" opacity="${past ? .35 : 1}"/>`
      + TX(2.2, y, .42, clip(e.title, Math.floor((W - 4.4) / .23)), live ? "#FFFFFF" : past ? "#4B5874" : "#EEF3FA", 'font-weight="600"')
      + TM(W - .4, y, .32, live ? "NOW" : past ? "done" : dubaiTime(e.end), live ? "#FF6B82" : "#55617A", 'text-anchor="end"'); });
  if (k.timed.length > shown.length) g += TM(W - .4, 1.32, .26, (first ? first + " earlier · " : "") + (k.timed.length - first - shown.length) + " later", "#6F7C92", 'text-anchor="end"');
  const fy0 = H - .75, days = [];
  for (let d = 1; d <= 6; d++) { const iso = dubaiISO(new Date(Date.now() + d * 864e5)); days.push([iso, k.all.filter(e => !e.allDay && e.day === iso).length]); }
  g += `<rect x="0" y="${fy0}" width="${W}" height=".75" fill="#0E1520"/>`
    + TX(.4, fy0 + .5, .32, k.allDay.length ? "ALL DAY · " + clip(k.allDay.map(e => e.title).join(" · "), Math.floor((W * .45) / .18)) : "No all-day items", "#8C95A8", 'font-weight="600"')
    + days.map(([iso, n], j) => TM(W * .52 + j * (W * .46 / 6), fy0 + .5, .3, new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2) + " " + n, n ? "#C9D3E2" : "#3A4558")).join("");
  return g;
}
/* the departure board for today's deadlines (SVG markup, W × H units) */
function dueBoard(W, H) {
  const list = dueToday(), late = active().filter(isLate).length;
  let g = `<rect width="${W}" height="${H}" fill="#0B0A06"/><rect width="${W}" height=".72" fill="#F6C94A"/>` + TX(.3, .52, .42, "DUE TODAY", "#1A1406", 'font-weight="700" letter-spacing=".06"')
    + TX(W - .3, .52, .36, new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Dubai", weekday: "short", day: "numeric", month: "short" }) + " · " + list.length, "#1A1406", 'font-weight="700" text-anchor="end"');
  if (!S.items.length) return g + TX(.3, 1.5, .34, "Opening the board…", "#6F7C92");
  if (!list.length) g += TX(.3, 1.5, .36, "Nothing due today", "#8C95A8");
  list.slice(0, 3).forEach((it, i) => { const y = 1.5 + i * .64, lt = isLate(it);
    g += `<rect x=".25" y="${y - .4}" width=".1" height=".48" fill="${lt ? "#FF4D6A" : stageHex(it.stage)}"/>` + TX(.55, y, .42, clip(label(it), 24), "#EEF3FA", 'font-weight="600"')
      + TM(W * .6, y, .32, firstName(it.editor || "—").toUpperCase(), "#9FB3CC") + TM(W - .3, y, .3, it.stage.toUpperCase(), lt ? "#FF6B82" : "#F6C94A", 'text-anchor="end"'); });
  g += TM(.3, H - .2, .3, (list.length > 3 ? "+" + (list.length - 3) + " more · " : "") + (late ? late + " already late" : "nothing late"), late ? "#FF6B82" : "#6F7C92");
  return g;
}
const calTip = c => { const k = calNow(c); return k.live ? "Now: " + k.live.title + " until " + dubaiTime(k.live.end) : k.next ? "Next: " + dubaiTime(k.next.start) + " " + k.next.title : k.loaded ? "Nothing else today · click for the week" : "Reading the calendar…"; };
const calTag = c => { const k = calNow(c); return k.live ? "LIVE · " + k.live.title : k.next ? "Next " + dubaiTime(k.next.start) + " · " + k.next.title : k.loaded ? c.n + " · free" : c.n; };
const CW = 64 / 3;
function drawWing() {
  let h = box(-0.6, -0.6, -1, 65.2, 14.6, 1, "#10141B", { stroke: 'stroke="none"' });
  h += box(-0.6, -0.6, 0, 65.2, 0.6, 10.4, "#1E242E", { stroke: 'stroke="rgb(0 0 0 / .4)" stroke-width=".7"' }) + box(-0.6, 0, 0, 0.6, 14, 10.4, "#1E242E");
  h += fy(1, 0, 10.2, `<rect x="0" y="0" width="1.5" height="1.5" rx=".35" fill="#FF003C"/><rect x=".45" y=".3" width=".6" height=".68" rx=".3" fill="none" stroke="#fff" stroke-width=".14"/><path d="M.52,.82 V1.25" stroke="#fff" stroke-width=".14" stroke-linecap="round"/>`
    + TX(2, 1.15, 1.15, "PODDSTER", "#EEF3FA", 'font-weight="700" letter-spacing=".14"') + TM(10.8, 1.12, .55, "DUBAI · AL BARSHA · SHEIKH ZAYED RD · CALENDARS", "#7D8AA3", 'letter-spacing=".18"'));
  const tags = [];
  CALS.forEach((c, k) => {
    const sx = k * CW + 0.15, cx = sx + CW / 2, info = calNow(c), live = info.live;
    h += `<g data-room="cal:${c.n}" ${tip(c.n + " · " + c.sub, calTip(c))}>` + quad(sx, 0, CW - .3, 12, c.floor) + quad(sx + 1.4, 3, CW - 3.1, 7, shade(c.floor, 1.14));
    h += fy(sx + .8, 0, 7.4, calScreen(c, CW - 1.9, 5.6));
    h += fy(cx - 1, 0, 8.6, `<rect x="0" y="0" width="2" height=".62" rx=".1" fill="${live ? "#E0002F" : "#2A1418"}"/>` + TM(.25, .46, .42, "ON AIR", live ? "#fff" : "#5A2A33", 'font-weight="700"'), live ? 'class="flick"' : "");
    if (live) { const [lx, ly] = P(cx, 0, 8.3); h += `<ellipse cx="${lx}" cy="${ly}" rx="34" ry="14" fill="#FF003C" opacity=".5" filter="url(#glow)" pointer-events="none"/>`; }
    const seats = 8, ppl = live ? Math.max(1, Math.min(seats, live.people || 2)) : 0;
    for (let i = 0; i < 4; i++) h += box(cx - 4.4 + i * 2.3, 3.6, 0, 1.3, 1.1, .9, "#30353E");
    for (let i = 0; i < Math.min(4, ppl); i++) h += person(cx - 3.75 + i * 2.3, 4.2, .9, shade(c.acc, .7), (live ? live.title : "") + i, { seated: true });
    h += box(cx - 4.8, 4.9, 0, 9.6, 2.4, 1.15, "#5B4632");
    for (let i = 0; i < 4; i++) h += box(cx - 4.4 + i * 2.3, 7.5, 0, 1.3, 1.1, .9, "#30353E");
    for (let i = 4; i < ppl; i++) h += person(cx - 3.75 + (i - 4) * 2.3, 8.0, .9, shade(c.acc, .7), (live ? live.title : "") + i, { seated: true, back: true });
    h += fz(sx + .7, 10.5, .02, TX(0, .9, 1.05, c.n, "#EEF3FA", 'font-weight="700"') + TM(0, 1.6, .5, c.sub.toUpperCase(), "#7D8AA3", 'letter-spacing=".08"'));
    h += `</g>`;
    if (k < CALS.length - 1) h += box(sx + CW - .3, 0, 0, .3, 11.4, 1.6, "#2A303B") + `<polygon points="${pts([P(sx + CW - .15, 0, 1.6), P(sx + CW - .15, 11.4, 1.6), P(sx + CW - .15, 11.4, 5.4), P(sx + CW - .15, 0, 5.4)])}" fill="rgb(160 200 255 / .045)" stroke="rgb(160 200 255 / .14)" stroke-width=".7" pointer-events="none"/>`;
    tags.push({ cx, live, next: info.next, c });
  });
  h += quad(0, 12, 64, 2, "#171B22") + box(0, 11.6, 0, 64, .3, .9, "#2A303B");
  tags.forEach(t => { const [px, py] = P(t.cx, 2.2, 7.9), txt = calTag(t.c), w = Math.min(260, txt.length * 6.2 + 20), col = t.live ? "#FF003C" : t.next ? "rgb(238 243 250 / .55)" : "rgb(160 200 255 / .2)";
    h += `<g data-room="cal:${t.c.n}"><rect x="${px - w / 2}" y="${py - 10}" width="${w}" height="20" rx="10" fill="${t.live ? "#3A0612" : "#0B0F15"}" fill-opacity=".94" stroke="${col}"/><text x="${px}" y="${py + 4}" text-anchor="middle" font-size="11" font-weight="600" fill="${t.live ? "#FFD0D8" : t.next ? "#EEF3FA" : "#6F7C92"}" font-family="Geist, sans-serif">${esc(clip(txt, 38))}</text></g>`; });
  return h;
}
/* the drawer: one calendar's next seven days */
function calHtml(name) {
  const c = CALS.find(x => x.n === name); if (!c) return "";
  const k = calNow(c), now = Date.now(), byDay = new Map();
  k.all.forEach(e => { const d = e.allDay ? (e.start < dubaiISO(new Date()) ? dubaiISO(new Date()) : e.start) : e.day; if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(e); });
  const days = [...byDay.keys()].sort();
  const row = e => `<div class="bk ${e.t1 && e.t1 <= now ? "past" : ""} ${e === k.live ? "now" : ""}"><time>${e.allDay ? "All day" : dubaiTime(e.start)}</time><span title="${esc(e.title)}${e.where ? " · " + esc(e.where) : ""}">${e === k.live ? "● " : ""}${esc(e.title)}${e.where ? ` <span style="color:var(--muted)">· ${esc(e.where)}</span>` : ""}</span><em>${e.link ? `<a href="${esc(e.link)}" target="_blank" rel="noopener">Open</a>` : ""}</em></div>`;
  return `<div class="plaque"><b>${esc(c.n)}</b><span>${esc(c.sub)} · today and the next 7 days, Dubai time</span><em class="tnum">${k.timed.length} today</em></div>
    ${!k.loaded ? `<div class="skel"></div>` : k.err && !k.all.length ? `<p class="verdict bad">${esc(calErr(k.err))}</p>` : days.length ? days.map(d => `<h4 class="calday">${esc(d === dubaiISO(new Date()) ? "Today" : dayLabel(d))}</h4><div class="bks cal">${byDay.get(d).sort((a, b) => (b.allDay - a.allDay) || a.t0 - b.t0).map(row).join("")}</div>`).join("") : `<p class="empty">Nothing on this calendar in the next 7 days.</p>`}
    <p class="hint">Read-only from Google Calendar. Bookings also feed the on-air board in the control room.</p>`;
}
