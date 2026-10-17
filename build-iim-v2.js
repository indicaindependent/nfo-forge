// Version A: the leaf is the hero at full size, IIM is a large painted banner beneath it.
const P = require("./painter.js"), L = require("./paint-leaf.js"), F = require("./fonts.js"), fs = require("fs");
const W = 80, COLS = 76, LEAF_ROWS = +process.env.LEAF_ROWS || 44;
const leaf = P.paint(L.toneMap(COLS, LEAF_ROWS), { set: "punct", seed: 7 });
// trim fully blank rows at the top and bottom of the leaf so no dead space is left
let a = 0, b = leaf.length; while (a < b && /^ *$/.test(leaf[a])) a++; while (b > a && /^ *$/.test(leaf[b - 1])) b--;
// A leaf has a short petiole. Keep the stem to at most STEM rows below the last row where the blade is wide.
const STEM = 4;
const wideEnough = (r) => (r.replace(/ /g, "").length >= 6);
let lastBlade = b - 1; while (lastBlade > a && !wideEnough(leaf[lastBlade])) lastBlade--;
b = Math.min(b, lastBlade + 1 + STEM);
const body = leaf.slice(a, b);
const center = (s, w) => { const l = Math.floor((w - s.length) / 2); return " ".repeat(l) + s + " ".repeat(w - s.length - l); };
const word = F.render("IIM", "shadow");                      // 35 x 15, bold letters with a drop shadow
const heavyFor = (X, Y, ox) => { const letter = X < ox + 11 ? 0 : X < ox + 23 ? 1 : 2; return P.hash(X, Y, 11) < 0.82 ? "#@#"[letter] : "&$%"[letter]; };
const ox = Math.floor((COLS - word.width) / 2);
const banner = word.lines.map((ln, y) => {
  let row = " ".repeat(COLS).split("");
  [...ln].forEach((ch, x) => { const X = ox + x; if (ch === "\u2588") row[X] = heavyFor(X, y, ox); else if (ch === "\u2593") row[X] = ":.'"[Math.floor(P.hash(X, y, 9) * 3)]; });
  return row.join("");
});
const out = [];
out.push("." + "-".repeat(W - 2) + ".");
out.push("|" + center("~ INDICA INDEPENDENT MEDIA ~", W - 2) + "|");
out.push("+" + "=".repeat(W - 2) + "+");
body.forEach(r => out.push("| " + r + " |"));
out.push("| " + " ".repeat(COLS) + " |");
banner.forEach(r => out.push("| " + r + " |"));
out.push("| " + " ".repeat(COLS) + " |");
out.push("|" + center("100% CREATIVE CLARITY", W - 2) + "|");
out.push("+" + "=".repeat(W - 2) + "+");
out.push("|" + center("made with NFO Forge 2.0  ::  fork it, paint your own", W - 2) + "|");
out.push("'" + "-".repeat(W - 2) + "'");
fs.writeFileSync("iim-painted-A.txt", out.join("\n") + "\n");
console.log("rows", out.length, "| widths", [...new Set(out.map(l => l.length))].join(","), "| leaf rows kept", body.length, "of", LEAF_ROWS, "| keyboard-only", /^[\x20-\x7e\n]*$/.test(out.join("\n")));
