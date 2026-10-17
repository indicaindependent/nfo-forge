const P = require("./painter.js"), Pic = require("./picture.js"), X = require("./ansi.js"), fs = require("fs"), vm = require("vm");
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log("PASS", n); } else { fail++; console.log("FAIL", n, x === undefined ? "" : x); } }
const D = P.DENSITY;
function img(W, H, f) { const d = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = f(x, y), i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; } return { width: W, height: H, data: d }; }

// 1. the density table is real data, not a remembered ordering
ok("density table covers all 94 printable symbols", Object.keys(D).length === 94);
ok("every density is between 0 and 0.4", Object.values(D).every(v => v > 0 && v < 0.4));
ok("dots are lighter than hash and at-sign", D["."] < D["#"] && D["`"] < D["@"] && D["-"] < D["W"]);

// 2. painter behaviour
const pal = P.build("punct");
ok("blank tone gives a space", P.pick(pal, 0, 3, 3) === " ");
ok("deterministic for a given cell", P.pick(pal, 0.5, 11, 4) === P.pick(pal, 0.5, 11, 4));
{
  let worst = 0, sum = 0, n = 0;
  for (let t = 0.05; t <= 1; t += 0.01) for (let x = 0; x < 30; x++) { const c = P.pick(pal, t, x, 3), e = Math.abs(D[c] - (pal.lo + t * (pal.hi - pal.lo))); worst = Math.max(worst, e); sum += e; n++; }
  ok("mean tone error stays small", sum / n < 0.02, (sum / n).toFixed(4));
  ok("worst tone error under a fifth of the range", worst < 0.2 * (pal.hi - pal.lo), worst.toFixed(4));
}
// the bug found today: a gap in the symbol set left one candidate and a whole row printed as a single character
{
  const bad = [];
  for (let t = 0.1; t <= 1.0; t += 0.02) { const row = P.paint([Array(80).fill(t)], { set: "punct" })[0].replace(/ /g, ""); if (row.length && new Set(row).size < 4) bad.push(t.toFixed(2) + ":" + new Set(row).size); }
  ok("no tone prints as a flat run of one or two symbols", bad.length === 0, bad.join(" "));
}
ok("darker tone gives denser symbols on average", (() => { const avg = t => { const r = P.paint([Array(200).fill(t)], { set: "punct" })[0].replace(/ /g, ""); return [...r].reduce((a, c) => a + D[c], 0) / r.length; }; return avg(0.2) < avg(0.5) && avg(0.5) < avg(0.9); })());
ok("painted output is keyboard ASCII only", P.paint([[0.1, 0.4, 0.7, 1]], { set: "classic" })[0].split("").every(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126));
ok("different seeds change the texture", P.paint([Array(60).fill(0.5)], { set: "punct", seed: 1 })[0] !== P.paint([Array(60).fill(0.5)], { set: "punct", seed: 2 })[0]);

// 3. browser loading: without density.js the painter must refuse, loudly
{
  let threw = null;
  try { vm.runInNewContext(fs.readFileSync("./painter.js", "utf8"), { self: {} }); } catch (e) { threw = e.message; }
  ok("browser painter without density.js throws a clear error", threw && /density\.js/.test(threw), threw);
  const ctx = { self: {} }; vm.runInNewContext(fs.readFileSync("./density.js", "utf8"), ctx); vm.runInNewContext(fs.readFileSync("./painter.js", "utf8"), ctx);
  ok("browser painter works once density.js is loaded", !!ctx.self.NFOPainter && ctx.self.NFOPainter.paint([[0.5]])[0].length === 1);
  ok("density.js matches ascii-density.json to 4 places", Object.keys(D).every(k => Math.abs(ctx.self.NFO_DENSITY[k] - D[k]) < 0.0001));
}

// 4. picture module, every style, mono and colour
const test = img(160, 120, (x, y) => [x * 255 / 160, y * 255 / 120, 120]);
for (const m of Pic.MODES) for (const colour of [false, true]) {
  const r = Pic.convert(test, { mode: m.id, cols: 40, colour });
  ok(`${m.id} ${colour ? "colour" : "mono"}: uniform width and sane size`, new Set(r.lines.map(l => l.length)).size === 1 && r.lines[0].length === 40 && r.rows >= 5, r.rows);
  if (colour) ok(`${m.id} colour grid matches the text grid`, r.colors.fg.length === r.rows && r.colors.fg[0].length === 40);
}
ok("width is clamped to 20..120", Pic.convert(test, { mode: "ramp", cols: 5 }).cols === 20 && Pic.convert(test, { mode: "ramp", cols: 999 }).cols === 120);
ok("invert flips a dark image to dense symbols", (() => { const dark = img(60, 60, () => [10, 10, 10]); const a = Pic.convert(dark, { mode: "paint", cols: 30 }).lines.join(""), b = Pic.convert(dark, { mode: "paint", cols: 30, invert: true }).lines.join(""); return a.replace(/ /g, "").length < b.replace(/ /g, "").length; })());
ok("contrast changes the picture", Pic.convert(test, { mode: "paint", cols: 30, contrast: 0 }).lines.join("") !== Pic.convert(test, { mode: "paint", cols: 30, contrast: 70 }).lines.join(""));

// 5. true half-block colour: red over blue must give an upper-half block with two colours
{
  const W = 40, H = 44, im = img(W, H, (x, y) => y < 22 ? [255, 0, 0] : [0, 0, 255]);
  const r = Pic.convert(im, { mode: "half", cols: 20, colour: true });
  const seam = r.lines.findIndex(l => l[0] === "\u2580");
  ok("half-block colour has a two-colour seam cell", seam >= 0, r.lines.map(l => l[0]).join(""));
  ok("seam cell is red above blue", r.colors.fg[seam][0] === 4 && r.colors.bg[seam][0] === 1, [r.colors.fg[seam][0], r.colors.bg[seam][0]]);
  const e = X.encode(r.lines, r.colors), back = X.decode(e.bytes);
  ok("half-block colour survives the ANSI encoder and decoder", JSON.stringify(back.lines) === JSON.stringify(r.lines) && JSON.stringify(back.fg) === JSON.stringify(r.colors.fg) && JSON.stringify(back.bg) === JSON.stringify(r.colors.bg) && back.unknown.length === 0);
}
// 6. a painted colour picture round-trips too
{
  const r = Pic.convert(test, { mode: "paint", cols: 50, colour: true });
  const back = X.decode(X.encode(r.lines, r.colors).bytes);
  ok("painted colour picture round-trips through ANSI", JSON.stringify(back.lines) === JSON.stringify(r.lines) && JSON.stringify(back.fg) === JSON.stringify(r.colors.fg) && back.unknown.length === 0);
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
