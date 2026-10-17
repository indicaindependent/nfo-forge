// Builds the coloured IIM leaf as a grid of cells: lines[y][x] glyph, fg[y][x], bg[y][x].
const A = require("./art.js"), F = require("./fonts.js"), S = require("./shade16.js"), leaf = require("./leaf.js");
const W = 78;                                    // inner width; the frame adds 2 columns for a 80-col screen

function blank(w, h) { return { lines: Array.from({ length: h }, () => " ".repeat(w).split("")), fg: Array.from({ length: h }, () => Array(w).fill(7)), bg: Array.from({ length: h }, () => Array(w).fill(0)) }; }
function put(g, x, y, ch, fg, bg) { if (y < 0 || y >= g.lines.length || x < 0 || x >= g.lines[0].length) return; g.lines[y][x] = ch; if (fg != null) g.fg[y][x] = fg; if (bg != null) g.bg[y][x] = bg; }

// Paint the leaf: sample the picture per cell (2 sub-rows per cell so shapes are crisp), turn brightness into a green.
function paintLeaf(g, ox, oy, cols, rows) {
  // A text cell is 8 px wide and 16 px tall, so the source picture must be cols*8 by rows*16 pixels
  // (scaled up for detail) or the leaf is stretched. Using the cell's real aspect is the fix.
  const img = leaf(cols * 16, rows * 32);
  const sm = A.resample(img, cols, rows * 2);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const t = sm.data[((y * 2) * cols + x) * 4] / 255, b = sm.data[((y * 2 + 1) * cols + x) * 4] / 255;
    const v = (t + b) / 2;
    if (v < 0.10) continue;                                            // background stays black
    // tone to a green on the achievable ramp: dim blade -> bright vein; edge is darker than blade
    const g1 = Math.round(Math.min(1, v) * 255);
    const lit = Math.min(1, Math.max(0, v));
    const target = [Math.round(Math.max(0, lit - 0.55) * 160), Math.round(34 + lit * 214), Math.round(Math.max(0, lit - 0.55) * 140)];
    const m = S.nearest(target);
    // if the top and bottom halves differ a lot, a half-block carries the shape better
    if (Math.abs(t - b) > 0.35) {
      const topOn = t > b, hi = nearestFor(Math.max(t, b)), lo = nearestFor(Math.min(t, b));
      put(g, ox + x, oy + y, topOn ? "\u2580" : "\u2584", hi.fg, hi.bg === 0 && lo.rgb[1] < 30 ? 0 : Math.min(lo.fg, 7));
    } else put(g, ox + x, oy + y, m.g, m.fg, m.bg);
  }
}
function nearestFor(v) { const lit = Math.min(1, Math.max(0, v)); return S.nearest([Math.round(lit * 40), Math.round(40 + lit * 200), Math.round(lit * 30)]); }
module.exports = { blank, put, paintLeaf, W };
if (require.main === module) {
  const g = blank(78, 38); paintLeaf(g, 7, 0, 64, 37);
  const X = require("./ansi.js");
  const e = X.encode(g.lines.map(r => r.join("")), { fg: g.fg, bg: g.bg });
  require("fs").writeFileSync("/tmp/leaf-test.ans", Buffer.from(e.bytes));
  const used = new Set(); g.lines.forEach((r, y) => r.forEach((c, x) => { if (c !== " ") used.add(g.fg[y][x] + "/" + g.bg[y][x]); }));
  console.log("cells painted:", g.lines.flat().filter(c => c !== " ").length, "| distinct fg/bg pairs used:", used.size, "| bytes", e.bytes.length, "| lossy", e.lossy.length);
}
