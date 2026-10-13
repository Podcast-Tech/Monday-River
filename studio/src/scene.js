
/* ================= The illustrated studio (isometric SVG, drawn from live data) =================
   World units: x runs down-right, y down-left, z up. 1 unit = SC px. Rooms (x × y):
   Green room 0–16 × 0–22 · Delivery 0–16 × 22–46 · Edit booths 16–48 × 0–28 · Screening 48–64 × 0–28 · Control room 16–64 × 28–46.
   Everything is painted back to front, room by room. */
const SC = 15, CX = 0.8660254, HY = 0.5, OX = 46 * CX * SC + 30, OY = 178;
const P = (x, y, z = 0) => [OX + (x - y) * CX * SC, OY + (x + y) * HY * SC - z * SC];
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
  /* slab + floors */
  h += box(-0.6, -0.6, -1, 65.2, 47.2, 1, "#10141B", { stroke: 'stroke="none"' });
  h += quad(0, 0, 16, 22, "#1F2B27") + quad(0, 22, 16, 24, "#1A1E26") + quad(16, 0, 32, 28, "#1B1F27") + quad(48, 0, 16, 28, "#2A1820") + quad(16, 28, 48, 18, "#151A22");
  for (let k = 1; k < 32; k += 2) h += `<polyline points="${pts([P(16 + k, 0), P(16 + k, 28)])}" stroke="rgb(255 255 255 / .025)" stroke-width="1"/>`;
  /* back walls with acoustic foam */
  h += box(-0.6, -0.6, 0, 65.2, 0.6, 8.5, "#232A36", { stroke: 'stroke="rgb(0 0 0 / .4)" stroke-width=".7"' });
  h += box(-0.6, 0, 0, 0.6, 46, 8.5, "#232A36", { stroke: 'stroke="rgb(0 0 0 / .4)" stroke-width=".7"' });
  let foam = ""; for (let u = 0; u < 30; u++) for (let v = 0; v < 5; v++) foam += `<rect x="${u + .08}" y="${v + .08}" width=".84" height=".84" fill="${(u + v) % 2 ? "#2C3442" : "#262E3B"}"/><path d="M${u + .08},${v + .5} L${u + .92},${v + .5}" stroke="rgb(0 0 0 / .25)" stroke-width=".06"/>`;
  h += fy(17, 0, 7.6, foam);
  h += fy(1.5, 0, 7.9, TM(0, 0.85, 0.85, "GREEN ROOM", "#9FB8A8", 'letter-spacing=".25"') + TM(0, 1.9, 0.55, "QUEUE", "#6F8478", 'letter-spacing=".2"'));
  h += fy(17, 0, 8.2, TM(0, 0.6, 0.55, "EDIT SUITES", "#C9D3E2", 'letter-spacing=".25"'));
  h += fy(49.5, 0, 8.2, TM(0, 0.6, 0.55, "SCREENING · CLIENT REVIEW", "#E2B8C4", 'letter-spacing=".18"'));
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

  /* ---------- delivery (Done this week) ---------- */
  const done = S.items.filter(i => i.stage === "Done" && i.updated && Date.now() - Date.parse(i.updated) < 7 * 864e5);
  h += box(0.2, 25, 0, 1.6, 17, 5.4, "#30353F");
  for (let shelf = 0; shelf < 4; shelf++) h += box(0.2, 25, 0.3 + shelf * 1.3, 1.7, 17, 0.12, "#4A505C");
  done.slice(0, 48).forEach((it, i) => { const sh = Math.floor(i / 12), k = i % 12; h += `<g class="hot" data-ep="${esc(it.id)}" ${tip(it.name, "Done")}>${box(0.45, 25.6 + k * 1.35, 0.42 + sh * 1.3, 1.1, 0.9, 1.0, "#7B6FD6")}</g>`; });
  h += fz(4, 38, 0.02, TX(0, 0, 2.2, String(done.length), "#9C8CFF", 'font-weight="700"') + TX(0, 1.3, .8, "delivered this week", "#7D74B8"));
  h += box(9, 28, 0, 5, 2.2, 1.1, "#3B2E5C") + box(9, 30, 1.1, 5, 0.4, 1.2, "#33284F");

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
  if (!ready) { const [lx, ly] = P(32, 14, 6); h += `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="22" fill="#8693A8" font-family="Geist, sans-serif">${S.error ? "Couldn't read your board" : "Opening the studio…"}</text>`; }
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
