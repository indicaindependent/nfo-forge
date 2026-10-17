// IIM leaf painted entirely from keyboard symbols, in the hand-painted scene style.
const P = require("./painter.js"), L = require("./paint-leaf.js"), F = require("./fonts.js"), fs = require("fs");
const N = require("./nfo.js");
const W = 80, IN = 76;                                       // frame is 80 wide; 76 inside after border + pad
const COLS = IN, LEAF_ROWS = 40;
// 1. leaf tones -> symbols
const tones = L.toneMap(COLS, LEAF_ROWS);
const leaf = P.paint(tones, { set: "punct", seed: 7 }).map(r => r.split(""));
// 2. IIM lettering. Painted ASCII needs CONTRAST by design: clear a quiet backing panel out of the leaf,
// then draw the letters solid in the densest symbols on a light dot ground, so they cannot dissolve into the foliage.
const word = F.render("IIM", "bold");                        // 34 x 14
const ox = Math.floor((COLS - word.width) / 2), oy = 17;
const PAD_X = 3, PAD_Y = 1;                                   // margin of quiet ground around the letters
const lit = (X, Y) => !!(word.lines[Y - oy] && word.lines[Y - oy][X - ox] && word.lines[Y - oy][X - ox] !== " ");
const ground = ".'`,-:";
// One dominant symbol per letter keeps each stroke visually solid; a second heavy symbol appears only
// occasionally for texture. Six equally weighted symbols made the strokes read as noise.
const heavyFor = (X, Y) => { const letter = X < ox + 11 ? 0 : X < ox + 23 ? 1 : 2; const main = "#@#"[letter]; const alt = "&$%"[letter]; return P.hash(X, Y, 11) < 0.80 ? main : alt; };
for (let y = oy - PAD_Y; y < oy + word.height + PAD_Y; y++) for (let x = ox - PAD_X; x < ox + word.width + PAD_X; x++) {
  if (y < 0 || y >= LEAF_ROWS || x < 0 || x >= COLS) continue;
  if (lit(x, y)) leaf[y][x] = heavyFor(x, y);
  else leaf[y][x] = (P.hash(x, y, 3) < 0.10) ? ground[Math.floor(P.hash(x, y, 5) * ground.length)] : " ";   // a few dots on a quiet ground
}
// a one-cell outline of mid-weight symbols around the panel so it reads as a deliberate cartouche
const mid = "|+=";
for (let x = ox - PAD_X - 1; x <= ox + word.width + PAD_X; x++) for (const y of [oy - PAD_Y - 1, oy + word.height + PAD_Y]) if (y >= 0 && y < LEAF_ROWS && x >= 0 && x < COLS) leaf[y][x] = "=";
for (let y = oy - PAD_Y - 1; y <= oy + word.height + PAD_Y; y++) for (const x of [ox - PAD_X - 1, ox + word.width + PAD_X]) if (y >= 0 && y < LEAF_ROWS && x >= 0 && x < COLS) leaf[y][x] = "|";
for (const [x, y] of [[ox - PAD_X - 1, oy - PAD_Y - 1], [ox + word.width + PAD_X, oy - PAD_Y - 1], [ox - PAD_X - 1, oy + word.height + PAD_Y], [ox + word.width + PAD_X, oy + word.height + PAD_Y]]) if (y >= 0 && y < LEAF_ROWS) leaf[y][x] = "+";
// 3. frame, header, footer
const rule = "=".repeat(W - 2), box = (s) => "|" + s + "|";
const center = (s, w) => { const l = Math.floor((w - s.length) / 2); return " ".repeat(l) + s + " ".repeat(w - s.length - l); };
const out = [];
out.push("." + "-".repeat(W - 2) + ".");
out.push(box(center("I N D I C A   I N D E P E N D E N T   M E D I A", W - 2)));
out.push(box(center("~ 100% Creative Clarity ~", W - 2)));
out.push("+" + "=".repeat(W - 2) + "+");
leaf.forEach(r => out.push("| " + r.join("") + " |"));
out.push("+" + "=".repeat(W - 2) + "+");
out.push(box(center("made with NFO Forge 2.0  ::  fork it, paint your own", W - 2)));
out.push("'" + "-".repeat(W - 2) + "'");
fs.writeFileSync("iim-painted.txt", out.join("\n") + "\n");
const widths = new Set(out.map(l => l.length));
console.log("rows", out.length, "| line widths", [...widths].join(","), "| distinct symbols", new Set(out.join("").replace(/[\n ]/g, "")).size);
console.log("only keyboard ASCII:", /^[\x20-\x7e\n]*$/.test(out.join("\n")));
