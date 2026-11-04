// src/v3/overview/gridTown.js
//
// The daily goal as a small power grid, drawn with a little depth (an oblique 2.5D projection): your house with solar
// panels on its roof and an inverter on the wall, a service line to two pylons and a substation, then a street of ten
// buildings. Each building is worth exactly 10% of today's target, so "8 of 10 lit" reads as 80% without counting;
// its windows light up floor by floor. At the target the street lamps come on; past it, windows turn gold and stars
// appear. Pure: no React, no clock. Coordinates are SVG user units in a VIEW_W x VIEW_H box, ground line at G.

export const VIEW_W = 640;
export const VIEW_H = 196;
export const G = 158; // where the buildings stand
export const DX = 10; // depth: the back of a box is this far right...
export const DY = -7; // ...and this far up
export const BUILDINGS_N = 10;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const r1 = (v) => Math.round(v * 10) / 10;

/** A box standing on the ground at x, as three faces (SVG path strings): front, side (right), top. */
export function box(x, w, h, base = G) {
  const t = base - h;
  return {
    front: `M${r1(x)} ${r1(t)} H${r1(x + w)} V${r1(base)} H${r1(x)} Z`,
    side: `M${r1(x + w)} ${r1(t)} L${r1(x + w + DX)} ${r1(t + DY)} V${r1(base + DY)} L${r1(x + w)} ${r1(base)} Z`,
    top: `M${r1(x)} ${r1(t)} L${r1(x + DX)} ${r1(t + DY)} H${r1(x + w + DX)} L${r1(x + w)} ${r1(t)} Z`
  };
}

// --- your home -------------------------------------------------------------------------------------------------
const HOUSE = { x: 14, w: 82, h: 44 };
const ROOF_RISE = 26;
const ROOF_IN = 10;
export const HOME = (() => {
  const { x, w, h } = HOUSE;
  const eave = G - h;
  const ridge = eave - ROOF_RISE;
  const roof = { bl: [x - 4, eave], br: [x + w + 4, eave], tr: [x + w - ROOF_IN + DX / 2, ridge], tl: [x + ROOF_IN + DX / 2, ridge] };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const at = (u, v) => lerp(lerp(roof.bl, roof.br, u), lerp(roof.tl, roof.tr, u), v); // u along the eave, v up the slope
  const panels = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const u0 = 0.1 + col * 0.205, u1 = u0 + 0.18, v0 = 0.14 + row * 0.42, v1 = v0 + 0.34;
      const q = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
      panels.push({ d: `M${q.map((p) => `${r1(p[0])} ${r1(p[1])}`).join(' L')} Z`, glint: at((u0 + u1) / 2, (v0 + v1) / 2).map(r1) });
    }
  }
  const p = (pts) => `M${pts.map((q) => `${r1(q[0])} ${r1(q[1])}`).join(' L')} Z`;
  return {
    walls: box(x, w, h),
    roof: p([roof.bl, roof.br, roof.tr, roof.tl]),
    roofSide: p([roof.br, [roof.br[0] + DX, roof.br[1] + DY], [roof.tr[0] + DX / 2, roof.tr[1] + DY / 2], roof.tr]),
    panels,
    door: { x: x + 10, y: G - 24, w: 12, h: 24 },
    window: { x: x + 30, y: eave + 10, w: 16, h: 12 },
    inverter: { x: x + 58, y: eave + 9, w: 13, h: 17, led: [x + 64.5, eave + 13.5] },
    lineOut: [x + w + 2, eave + 14]
  };
})();

// --- the grid --------------------------------------------------------------------------------------------------
function pylonAt(x) {
  const top = G - 96;
  const d = `M${x - 11} ${G} L${x} ${top} L${x + 11} ${G} M${x - 7} ${G - 30} H${x + 7} M${x - 5} ${G - 56} H${x + 5}`
    + ` M${x - 15} ${top + 10} H${x + 15} M${x - 10} ${G} L${x + 5} ${G - 56} M${x + 10} ${G} L${x - 5} ${G - 56}`;
  return { d, left: [x - 15, top + 10], right: [x + 15, top + 10] };
}
export const PYLONS = [pylonAt(142), pylonAt(194)];
export const SUBSTATION = { ...box(222, 30, 30), x: 222, coil: `M230 ${G - 20} q4 -6 8 0 t8 0`, port: [237, G - 30] };
const BUS_Y = G + 6; // the street cable, just in front of the buildings

/** The overhead line from your house to the substation, as one path. */
export const TRUNK_PATH = (() => {
  const [a, b] = PYLONS;
  const s = SUBSTATION.port;
  const o = HOME.lineOut;
  return `M${o[0]} ${o[1]} Q${(o[0] + a.left[0]) / 2} ${o[1] + 8} ${a.left[0]} ${a.left[1]} M${a.right[0]} ${a.right[1]}`
    + ` Q${(a.right[0] + b.left[0]) / 2} ${a.right[1] + 12} ${b.left[0]} ${b.left[1]} M${b.right[0]} ${b.right[1]}`
    + ` Q${(b.right[0] + s[0]) / 2} ${b.right[1] + 22} ${s[0]} ${s[1]}`;
})();

// --- the town --------------------------------------------------------------------------------------------------
const B0 = 268;
const BW = 28;
const BSTEP = 36.6; // width + gap (the gap leaves room for each box's side face)
const HEIGHTS = [40, 62, 46, 84, 52, 70, 42, 96, 58, 76];
const KINDS = ['house', 'flat', 'house', 'tower', 'school', 'flat', 'house', 'tower', 'shop', 'flat'];

export const BUILDINGS = HEIGHTS.map((h, i) => {
  const x = B0 + i * BSTEP;
  const floors = Math.max(2, Math.floor((h - 8) / 11));
  const windows = [];
  for (let f = 0; f < floors; f++) for (let c = 0; c < 3; c++) windows.push({ x: r1(x + 4 + c * 7.6), y: r1(G - 9 - (f + 1) * 11 + 2), w: 5.4, h: 6.4 });
  return { i, x, w: BW, h, kind: KINDS[i], faces: box(x, BW, h), roof: KINDS[i] === 'house' ? `M${x - 2} ${G - h} L${x + BW / 2} ${G - h - 11} L${x + BW + 2} ${G - h}` : null, windows };
});
export const BUS_START = SUBSTATION.x + 30;
export const BUS_END = B0 + BUILDINGS_N * BSTEP - (BSTEP - BW) / 2;
export const BUS = { y: BUS_Y };
export const LAMPS = [0, 1, 2, 3, 4].map((k) => r1(B0 + 16 + k * 2 * BSTEP));
// Deterministic star positions above the town (no randomness: the server and the browser draw the same picture).
export const STARS = [[290, 16], [318, 34], [347, 10], [372, 28], [401, 14], [428, 38], [455, 20], [482, 8], [506, 30], [533, 16], [561, 36], [585, 12], [612, 26], [304, 46], [389, 46], [470, 44], [548, 48], [623, 44]];

/** Where the street cable is energised to: the building being powered now. */
export function frontierX(share) {
  const s = isNum(share) ? Math.max(0, share) : 0;
  return r1(BUS_START + (BUS_END - BUS_START) * clamp01(s));
}

/**
 * What the town shows for a share of today's target (0..1+):
 *   lit[i]   windows lit in building i (its windows fill bottom-up as its 10% comes in)
 *   gold     buildings whose lit windows turn gold (past 100%: one more per 2% over)
 *   powered  whole buildings powered (0..10); lamps on at the target; stars past it
 */
export function townState(share) {
  const s = isNum(share) ? Math.max(0, share) : 0;
  const lit = BUILDINGS.map((b, i) => Math.round(b.windows.length * clamp01(s * BUILDINGS_N - i)));
  const over = Math.max(0, s - 1);
  return {
    lit,
    gold: over > 0 ? Math.min(BUILDINGS_N, Math.ceil(over * 50 - 1e-9)) : 0, // the epsilon: 1.1 - 1 is a hair over 0.1
    powered: Math.min(BUILDINGS_N, Math.floor(s * BUILDINGS_N + 1e-9)),
    lampsOn: s >= 1,
    stars: over > 0 ? Math.min(STARS.length, Math.round(over * 90)) : 0
  };
}

/** The route the energy pulses take: your roof, down to the inverter, over the pylons, along the street to the frontier. */
export function pulseRoute(share) {
  const [a, b] = PYLONS;
  const s = SUBSTATION.port;
  const inv = HOME.inverter;
  const pts = [HOME.panels[5].glint, [inv.x + inv.w / 2, inv.y], HOME.lineOut, a.left, a.right, b.left, b.right, s, [s[0], BUS_Y], [Math.max(BUS_START + 4, frontierX(share)), BUS_Y]];
  return `M${pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join(' L')}`;
}
