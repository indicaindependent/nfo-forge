const A = require("./art.js"), N = require("./nfo.js");
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log("PASS", n); } else { fail++; console.log("FAIL", n, x === undefined ? "" : x); } }
function img(w, h, f) { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b, a] = f(x, y); const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a === undefined ? 255 : a; } return { width: w, height: h, data: d }; }
const BLACK = img(40, 40, () => [0, 0, 0]), WHITE = img(40, 40, () => [255, 255, 255]);
const SPLIT = img(40, 40, x => x < 20 ? [0, 0, 0] : [255, 255, 255]);
const SQUARE = img(60, 60, (x, y) => (x >= 20 && x < 40 && y >= 20 && y < 40) ? [255, 255, 255] : [0, 0, 0]);

// 1. flat images, every mode
for (const mode of ["shade", "ramp", "half"]) {
  const k = A.convert(BLACK, { cols: 20, mode }), w = A.convert(WHITE, { cols: 20, mode });
  ok(mode + ": flat black is only spaces", k.lines.every(l => /^ +$/.test(l)), JSON.stringify(k.lines[0]));
  const full = mode === "ramp" ? "@" : "\u2588";
  ok(mode + ": flat white is only the densest glyph", w.lines.every(l => l === full.repeat(20)), JSON.stringify(w.lines[0]));
}
// 2. geometry: grid size follows the aspect ratio
{
  const r = A.convert(img(100, 50, () => [128, 128, 128]), { cols: 40, mode: "shade", aspect: 2 });
  ok("a 2:1 image at 40 cols and cell aspect 2 gives 10 rows", r.rows === 10 && r.lines.length === 10, r.rows);
  const sq = A.convert(img(100, 100, () => [9, 9, 9]), { cols: 40, mode: "shade", aspect: 2 });
  ok("a square image gives half as many rows as columns (cells are twice as tall)", sq.rows === 20, sq.rows);
  ok("every line has exactly cols characters", r.lines.every(l => l.length === 40));
}
// 3. split image flips at the midpoint
{
  const r = A.convert(SPLIT, { cols: 20, mode: "shade" });
  ok("split: left half blank, right half full", r.lines.every(l => l.slice(0, 10) === " ".repeat(10) && l.slice(10) === "\u2588".repeat(10)), r.lines[0]);
  const h = A.convert(SPLIT, { cols: 20, mode: "half" });
  ok("split: half mode agrees", h.lines.every(l => l.slice(0, 10) === " ".repeat(10) && l.slice(10) === "\u2588".repeat(10)));
}
// 4. a centred square stays centred and symmetric
{
  const r = A.convert(SQUARE, { cols: 30, mode: "shade" });
  const rowsWith = r.lines.map((l, i) => [i, l.indexOf("\u2588"), l.lastIndexOf("\u2588")]).filter(a => a[1] >= 0);
  ok("square is found", rowsWith.length > 0);
  const left = rowsWith[0][1], right = 30 - 1 - rowsWith[0][2];
  ok("square is horizontally centred (margins within 1)", Math.abs(left - right) <= 1, [left, right]);
  const top = rowsWith[0][0], bot = r.rows - 1 - rowsWith[rowsWith.length - 1][0];
  ok("square is vertically centred (margins within 1)", Math.abs(top - bot) <= 1, [top, bot]);
  ok("square is roughly square on screen (width ~ 2 x height in cells)", Math.abs((rowsWith[0][2] - rowsWith[0][1] + 1) - 2 * rowsWith.length) <= 3, [rowsWith[0][2] - rowsWith[0][1] + 1, rowsWith.length]);
}
// 5. contrast, brightness, invert behave
{
  const grey = img(40, 40, () => [128, 128, 128]);
  const base = A.convert(grey, { cols: 10, mode: "shade" }).lines[0][0];
  const bright = A.convert(grey, { cols: 10, mode: "shade", brightness: 40 }).lines[0][0];
  const dark = A.convert(grey, { cols: 10, mode: "shade", brightness: -40 }).lines[0][0];
  const R = " \u2591\u2592\u2593\u2588";
  ok("brightness up never lowers the glyph, down never raises it", R.indexOf(bright) >= R.indexOf(base) && R.indexOf(dark) <= R.indexOf(base), [dark, base, bright]);
  ok("invert swaps black and white", A.convert(BLACK, { cols: 10, mode: "shade", invert: true }).lines[0] === "\u2588".repeat(10));
}
// 6. dither is deterministic and preserves average tone
{
  const R = " \u2591\u2592\u2593\u2588";
  const grey = img(80, 80, () => [128, 128, 128]);
  const a = A.convert(grey, { cols: 40, mode: "shade", dither: true }).lines.join("\n");
  const b = A.convert(grey, { cols: 40, mode: "shade", dither: true }).lines.join("\n");
  ok("dither output is deterministic", a === b);
  ok("a tone that lands exactly on a level stays on it (mid-grey is level 2 of 0..4)", new Set(a.replace(/\n/g, "")).size === 1 && a[0] === R[2], [...new Set(a.replace(/\n/g, ""))].join(""));
  // 0.375 of full scale sits halfway between level 1 (0.25) and level 2 (0.5): it MUST split
  const half = img(80, 80, () => [96, 96, 96]); // 96/255 = 0.376
  const flat = A.convert(half, { cols: 40, mode: "shade", dither: true }).lines.join("").replace(/\n/g, "");
  const kinds = [...new Set(flat)].sort().join("");
  ok("a tone between two levels mixes exactly those two glyphs", kinds === [R[1], R[2]].sort().join(""), kinds);
  const share2 = [...flat].filter(c => c === R[2]).length / flat.length;
  ok("the mix is in proportion (about half level 2)", Math.abs(share2 - 0.5) < 0.1, share2.toFixed(3));
  const avgLevel = [...flat].reduce((s, c) => s + R.indexOf(c), 0) / flat.length;
  ok("average tone is preserved (target 0.376*4 = 1.504 levels)", Math.abs(avgLevel - 1.504) < 0.12, avgLevel.toFixed(3));
}
// 7. edge mode: a vertical boundary produces vertical line chars on the boundary, nothing elsewhere
{
  const r = A.convert(SPLIT, { cols: 20, mode: "edge" });
  const interior = r.lines.slice(1, -1);
  const marks = interior.map(l => [...l].map((c, i) => c !== " " ? i : -1).filter(i => i >= 0));
  ok("edge: only the boundary columns are marked (cols 9-10)", marks.every(m => m.length > 0 && m.every(i => i >= 8 && i <= 11)), JSON.stringify(marks[0]));
  ok("edge: boundary glyph is a vertical line", interior.every(l => /\u2502/.test(l)));
  const flat = A.convert(WHITE, { cols: 20, mode: "edge" });
  ok("edge: a flat image has no edges at all", flat.lines.every(l => /^ +$/.test(l)));
  const sq = A.convert(SQUARE, { cols: 30, mode: "edge" }).lines.join("\n");
  ok("edge: a square gets both horizontal and vertical strokes", /\u2500/.test(sq) && /\u2502/.test(sq));
}
// 8. every emitted character exists in CP437 (nothing is lost on save)
{
  const rnd = img(64, 64, (x, y) => [(x * 37 + y * 11) % 256, (x * 5 + y * 91) % 256, (x * 73) % 256]);
  let bad = [];
  for (const mode of ["shade", "ramp", "half", "edge"]) for (const dither of [false, true]) {
    const r = A.convert(rnd, { cols: 50, mode, dither, ramp: "fine" });
    const enc = N.cp437Encode(r.lines.join("\n"), false); if (enc.lossy.length) bad.push(mode + ":" + enc.lossy.join(""));
  }
  ok("all four modes, dithered or not, encode to CP437 with zero loss", bad.length === 0, bad.join(" | "));
}
// 9. transparent pixels read as background, not as the colour hiding underneath
{
  const t = img(40, 40, () => [255, 255, 255, 0]);
  ok("fully transparent white renders blank", A.convert(t, { cols: 10, mode: "shade" }).lines.every(l => /^ +$/.test(l)));
}
// 10. colour grid
{
  const red = img(20, 20, () => [255, 85, 85]), blue = img(20, 20, () => [0, 0, 170]);
  ok("exact VGA bright red maps to index 12", A.colorGrid(red, 4, 4)[0][0] === 12);
  ok("exact VGA blue maps to index 1", A.colorGrid(blue, 4, 4)[0][0] === 1);
  ok("black maps to 0, white to 15", A.colorGrid(BLACK, 2, 2)[0][0] === 0 && A.colorGrid(WHITE, 2, 2)[0][0] === 15);
  const all = A.VGA.every((c, i) => A.nearestVGA(c[0], c[1], c[2]) === i);
  ok("all 16 palette colours map to themselves", all);
}
// 11. input validation
{
  ok("absurd column counts are clamped, not crashed", A.convert(WHITE, { cols: 99999 }).cols === 200 && A.convert(WHITE, { cols: -5 }).cols === 4);
  ok("unknown mode falls back to shade rather than throwing", A.convert(WHITE, { cols: 10, mode: "nope" }).lines.length > 0);
}
// 12. regressions found by rendering a real shaded sphere
{
  const sph = (W) => { const d = new Uint8ClampedArray(W * W * 4); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const nx = (x - W / 2) / (W * 0.4), ny = (y - W / 2) / (W * 0.4), r2 = nx * nx + ny * ny, i = (y * W + x) * 4; if (r2 < 1) { const nz = Math.sqrt(1 - r2), l = Math.max(0, (-nx * 0.5 - ny * 0.5 + nz * 0.7)); const v = Math.min(255, 30 + l * 230); d[i] = d[i + 1] = d[i + 2] = v; } else { d[i] = 8; d[i + 1] = 8; d[i + 2] = 10; } d[i + 3] = 255; } return { width: W, height: W, data: d }; };
  const S = sph(200), R = " \u2591\u2592\u2593\u2588";
  // (a) a dithered near-black ground must stay blank: corners of the render are all background
  const dsh = A.convert(S, { cols: 44, mode: "shade", dither: true });
  const corner = [dsh.lines[0], dsh.lines[1], dsh.lines[dsh.rows - 1], dsh.lines[dsh.rows - 2]].join("");
  ok("dither: a near-black ground stays blank (no stray dots)", /^ *$/.test(corner), JSON.stringify(corner.slice(0, 60)));
  const dr = A.convert(S, { cols: 44, mode: "ramp", ramp: "classic", dither: true });
  ok("dither: same for the character ramp", /^ *$/.test([dr.lines[0], dr.lines[dr.rows - 1]].join("")));
  // (b) the dither must still split a genuine mid-tone (the sphere body has many distinct glyphs)
  ok("dither: the sphere body still uses at least 4 different glyphs", new Set(dsh.lines.join("")).size >= 4, [...new Set(dsh.lines.join(""))].join(""));
  // (c) half mode with dither keeps mid-tones: more ink than the hard threshold on a shaded sphere
  const ink = ls => [...ls.join("")].filter(c => c !== " ").length;
  const hard = A.convert(S, { cols: 44, mode: "half" }), soft = A.convert(S, { cols: 44, mode: "half", dither: true });
  ok("half: dithering does not lose the lit side", ink(soft.lines) > 0 && ink(hard.lines) > 0);
  ok("half: dithered half-blocks include partial blocks, not only full ones", /[\u2580\u2584]/.test(soft.lines.join("")));
  // (d) edge: outline is thin, closed-ish and symmetric top/bottom; no filled bars
  const ed = A.convert(sph(240), { cols: 48, mode: "edge" });
  const ch = ed.lines.join("");
  const marked = [...ch].filter(c => c !== " ").length, total = ch.length;
  ok("edge: an outline, not a fill (under 25% of cells marked)", marked / total < 0.25 && marked > 20, (marked / total).toFixed(3));
  const rowsInk = ed.lines.map((l, i) => l.trim() ? i : -1).filter(i => i >= 0);
  ok("edge: no row is a long unbroken bar (longest run under half the width)", ed.lines.every(l => (l.match(/(.)\1*/g) || []).filter(r => r[0] !== " ").every(r => r.length < 24)), "");
  ok("edge: the left AND right sides of the circle both get an outline", ed.lines.slice(8, 16).some(l => /[\u2502\\/]/.test(l.slice(0, 20))) && ed.lines.slice(8, 16).some(l => /[\u2502\\/]/.test(l.slice(28))), "");
}
// 13. diagonal direction against ground truth (screen y points down)
{
  const W = 120, mk = f => { const d = new Uint8ClampedArray(W * W * 4); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const v = f(x, y) ? 255 : 0, i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } return { width: W, height: W, data: d }; };
  const count = (im, re) => ((A.convert(im, { cols: 40, mode: "edge" }).lines.join("").match(re) || []).length);
  const back = mk((x, y) => y > x), fwd = mk((x, y) => y > W - x);
  ok("edge: a line from top-left to bottom-right is drawn with backslashes", count(back, /\\/g) > 20 && count(back, /\//g) === 0, [count(back, /\\/g), count(back, /\//g)]);
  ok("edge: a line from bottom-left to top-right is drawn with forward slashes", count(fwd, /\//g) > 20 && count(fwd, /\\/g) === 0, [count(fwd, /\//g), count(fwd, /\\/g)]);
  ok("edge: a vertical step is drawn with vertical bars only", count(mk(x => x > 60), /\u2502/g) >= 15 && count(mk(x => x > 60), /[\u2500\/\\]/g) === 0);
  ok("edge: a horizontal step is drawn with horizontal bars only", count(mk((x, y) => y > 60), /\u2500/g) >= 30 && count(mk((x, y) => y > 60), /[\u2502\/\\]/g) === 0);
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
