// Full IIM leaf piece: framed 80x? screen, leaf, shadow-lettered IIM at the base, motto, compact mark.
const C = require("./compose.js"), F = require("./fonts.js"), X = require("./ansi.js"), fs = require("fs");
const COLS = 80, AMBER = 14, TEAL = 11, GREEN = 10, DKGREEN = 2, GREY = 7, WHITE = 15;
const LEAF_ROWS = 37, TOP = 3;
const lettering = F.render("IIM", "shadow");           // 35 x 15
const motto = "100% CREATIVE CLARITY", name = "INDICA INDEPENDENT MEDIA";
const ROWS = TOP + LEAF_ROWS + 1 + 1 + 2 + 1;          // frame + leaf + gap + name + motto + frame
const g = C.blank(COLS, ROWS + 17);
// 1. leaf, centred
C.paintLeaf(g, (COLS - 64) / 2, TOP, 64, LEAF_ROWS);
// 2. IIM shadow lettering overlaid across the base of the leaf, centred
const lx = Math.floor((COLS - lettering.width) / 2) + 1, ly = TOP + LEAF_ROWS - 13;
lettering.lines.forEach((ln, y) => [...ln].forEach((ch, x) => {
  if (ch === " ") return;
  const isShadow = ch === "\u2593";
  C.put(g, lx + x, ly + y, ch, isShadow ? 8 : AMBER, isShadow ? 0 : 0);
}));
// 3. name and motto
const nameRow = TOP + LEAF_ROWS + 1, mottoRow = nameRow + 1;
[...name].forEach((ch, i) => C.put(g, Math.floor((COLS - name.length) / 2) + i, nameRow, ch, WHITE, 0));
[...motto].forEach((ch, i) => C.put(g, Math.floor((COLS - motto.length) / 2) + i, mottoRow, ch, TEAL, 0));
// 4. double frame, teal
const H = mottoRow + 2;
const box = { tl: "\u2554", tr: "\u2557", bl: "\u255a", br: "\u255d", h: "\u2550", v: "\u2551" };
for (let x = 0; x < COLS; x++) { C.put(g, x, 0, x === 0 ? box.tl : x === COLS - 1 ? box.tr : box.h, TEAL, 0); C.put(g, x, H - 1, x === 0 ? box.bl : x === COLS - 1 ? box.br : box.h, TEAL, 0); }
for (let y = 1; y < H - 1; y++) { C.put(g, 0, y, box.v, TEAL, 0); C.put(g, COLS - 1, y, box.v, TEAL, 0); }
// 5. shade bars under the top rule and above the bottom rule, in dark green
for (let x = 2; x < COLS - 2; x++) { C.put(g, x, 1, "\u2591", DKGREEN, 0); C.put(g, x, H - 2, "\u2591", DKGREEN, 0); }
const lines = g.lines.slice(0, H).map(r => r.join("")), fg = g.fg.slice(0, H), bg = g.bg.slice(0, H);
const meta = { title: "IIM", author: "Indica Independent", group: "Indica Independent", date: "20261017", comments: ["Indica Independent Media. 100% Creative Clarity.", "ANSI art made with NFO Forge 2.0."] };
const f = X.toFile(lines, { fg, bg }, meta);
fs.writeFileSync("iim-leaf.ans", Buffer.from(f.bytes));
fs.writeFileSync("iim-leaf.plain.txt", lines.join("\n") + "\n");
console.log("rows", H, "cols", COLS, "bytes", f.bytes.length, "lossy", f.lossy.length);
