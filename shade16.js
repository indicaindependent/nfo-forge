// Tone-matching for a 16-colour text screen. A cell is (glyph, fg, bg). The glyphs below cover a known
// fraction of the cell with the foreground colour, the rest shows the background, so the cell reads as a
// blend. This picks, for any target RGB, the (glyph, fg, bg) whose blend is closest.
const A = require("./art.js");
const COVER = [[" ", 0], ["\u2591", 0.25], ["\u2592", 0.5], ["\u2593", 0.75], ["\u2588", 1]];
const W = [0.3, 0.59, 0.11];
function mix(a, b, t) { return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t]; }
function dist(a, b) { return W[0] * (a[0] - b[0]) ** 2 + W[1] * (a[1] - b[1]) ** 2 + W[2] * (a[2] - b[2]) ** 2; }
// Precompute every distinct achievable blend once. fg may be any of 16; bg any of 8 (the bright bg
// set needs the iCE-colours bit or blink off, which many viewers lack, so we stay to 8 for safety).
const TABLE = [];
for (let fg = 0; fg < 16; fg++) for (let bg = 0; bg < 8; bg++) for (const [g, c] of COVER) {
  if (c === 0 && fg !== bg) continue;                 // a space shows only the bg; skip duplicates
  if (c === 1 && bg !== 0) continue;                  // a full block hides the bg; one copy is enough
  TABLE.push({ g, fg, bg, rgb: mix(A.VGA[bg], A.VGA[fg], c), c });
}
function nearest(rgb) {
  let best = null, bd = Infinity;
  for (const t of TABLE) { const d = dist(rgb, t.rgb); if (d < bd) { bd = d; best = t; } }
  return best;
}
module.exports = { nearest, TABLE, mix, COVER };
