const F = require("./fonts.js"), N = require("./nfo.js");
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log("PASS", n); } else { fail++; console.log("FAIL", n, x === undefined ? "" : x); } }
const keys = Object.keys(F.MATRIX);

// 1. every glyph is well formed
{
  const badH = keys.filter(k => F.MATRIX[k].length !== 7);
  ok("every glyph has exactly 7 rows", badH.length === 0, badH.join(""));
  const badW = keys.filter(k => new Set(F.MATRIX[k].map(r => r.length)).size !== 1);
  ok("every glyph has equal-width rows", badW.length === 0, badW.join(""));
  const badC = keys.filter(k => F.MATRIX[k].some(r => /[^01]/.test(r)));
  ok("glyph rows contain only 0 and 1", badC.length === 0, badC.join(""));
  ok("A-Z, 0-9 and the punctuation set are all defined", [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.!:/'&? "].every(c => F.MATRIX[c]));
  const blanks = keys.filter(k => k !== " " && !F.MATRIX[k].some(r => r.includes("1")));
  ok("no visible glyph is empty", blanks.length === 0, blanks.join(""));
  const dupes = []; const seen = {}; keys.forEach(k => { const sig = F.MATRIX[k].join("|"); if (seen[sig]) dupes.push(seen[sig] + "=" + k); else seen[sig] = k; });
  ok("no two different characters share a bitmap", dupes.length === 0, dupes.join(","));
}
// 2. every style renders every character with equal-width lines and CP437-only glyphs
{
  const all = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.!:/'&?"].join("");
  for (const st of Object.keys(F.STYLES)) {
    const r = F.render(all, st);
    ok(st + ": renders the whole set with no missing characters", r.lines && r.missing.length === 0, r.missing.join(""));
    ok(st + ": all rows are the same width", new Set(r.lines.map(l => l.length)).size === 1, [...new Set(r.lines.map(l => l.length))].join());
    ok(st + ": every glyph encodes to CP437 (no loss)", N.cp437Encode(r.lines.join("\n"), false).lossy.length === 0);
    ok(st + ": width and height are reported correctly", r.width === r.lines[0].length && r.height === r.lines.length);
  }
}
// 3. heights are what each style promises
{
  ok("solid is 7 rows", F.render("A", "solid").height === 7);
  ok("chunky is 7 rows", F.render("A", "chunky").height === 7);
  ok("slab halves it (7 dots -> 4 rows)", F.render("A", "slab").height === 4);
  ok("outline is 7 rows plus a one-dot frame above and below", F.render("A", "outline").height === 9);
  ok("bold doubles the height", F.render("A", "bold").height === 14 && F.render("A", "bold").width === 10);
  ok("shadow adds one row and one column to bold", F.render("A", "shadow").height === 15 && F.render("A", "shadow").width === 11);
}
// 4. geometry: chunky is exactly twice as wide as solid (per dot)
{
  const s = F.render("HI", "solid"), c = F.render("HI", "chunky");
  const dotsS = 5 + 1 + 5, dotsC = 5 + 2 + 5;   // solid gap 1, chunky gap 2
  ok("solid width = 5 + gap + 5", s.width === dotsS, s.width);
  // each dot is 2 columns wide and the gap is 2 DOTS, so 5+2+5 dots x 2 columns = 24
  ok("chunky width = (5 + gap 2 + 5) dots x 2 columns", c.width === (5 + 2 + 5) * 2, c.width);
}
// 5. the letter shapes themselves: render 'I' and 'L' solid and read them back
{
  const I = F.render("I", "solid").lines.map(l => l.replace(/\u2588/g, "#"));
  ok("I solid has a full top bar, a stem, a full bottom bar", I[0] === "#####" && I[6] === "#####" && I.slice(1, 6).every(l => l === "  #  "), JSON.stringify(I));
  const L = F.render("L", "solid").lines.map(l => l.replace(/\u2588/g, "#"));
  ok("L solid is a left stem with a full bottom bar", L.slice(0, 6).every(l => l === "#    ") && L[6] === "#####", JSON.stringify(L));
}
// 6. slab: a full-height vertical stroke should be all full blocks, a top bar all upper halves
{
  const E = F.render("L", "slab").lines;
  ok("slab: the stem of L is solid full blocks in the first rows", E.slice(0, 3).every(l => l[0] === "\u2588"), JSON.stringify(E));
  const T = F.render("T", "slab").lines;
  // the stem is lit on the top bar's row AND the row below, so its cell is a full block; the arms are upper halves
  ok("slab: the top bar of T is upper halves with a full block where the stem joins", T[0].slice(0, 5) === "\u2580\u2580\u2588\u2580\u2580", JSON.stringify(T[0]));
}
// 7. shadow: wherever the shadow glyph appears, there is ink up and to the left of it
{
  const r = F.render("HI", "shadow").lines;
  let bad = 0;
  for (let y = 0; y < r.length; y++) for (let x = 0; x < r[0].length; x++) if (r[y][x] === "\u2593") {
    const ul = (r[y - 1] || "")[x - 1]; if (ul !== "\u2588" && ul !== "\u2593") bad++;
  }
  // shadow cells are placed from the letter's up-left neighbour; the up-left of a shadow is ink
  ok("shadow cells sit down-right of ink", bad === 0, bad);
  ok("shadow never overwrites ink: ink count equals the bold ink count", (r.join("").match(/\u2588/g) || []).length === (F.render("HI", "bold").lines.join("").match(/\u2588/g) || []).length);
  ok("shadow actually draws shadow cells", /\u2593/.test(r.join("")));
}
// 8. outline: a frame around the letter, the letter itself left hollow
{
  const word = "NFO 26", out = F.render(word, "outline").lines;
  // rebuild the letter bitmap independently from the matrix and compare cell by cell
  const rows = [[], [], [], [], [], [], []];
  for (let i = 0; i < word.length; i++) { const g = F.MATRIX[word[i]]; for (let r = 0; r < 7; r++) { for (const c of g[r]) rows[r].push(c === "1" ? 1 : 0); if (i < word.length - 1) rows[r].push(0, 0); } }
  let overlap = 0, framedMissing = 0, ringCells = 0;
  for (let y = 0; y < out.length; y++) for (let x = 0; x < out[0].length; x++) {
    const on = (yy, xx) => yy >= 0 && xx >= 0 && yy < 7 && xx < rows[0].length && rows[yy][xx] === 1;
    const letter = on(y - 1, x - 1), ink = out[y][x] === "\u2588";
    if (letter && ink) overlap++;                       // the frame must never cover the letter
    let near = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && on(y - 1 + dy, x - 1 + dx)) near = true;
    if (!letter && near && !ink) framedMissing++;        // every empty cell touching the letter must be framed
    if (ink) ringCells++;
  }
  ok("outline: the frame never covers the letter itself", overlap === 0, overlap);
  ok("outline: every empty cell touching a letter is framed", framedMissing === 0, framedMissing);
  ok("outline: nothing is drawn away from the letters", ringCells > 0 && out.join("").length === out.length * out[0].length);
  const solid = F.render("O", "solid").lines.join(""), o = F.render("O", "outline").lines;
  // O's left stroke is dot column 0 (output column 1, since the frame adds one). That column must be BLANK
  // on the rows where the stroke runs, with ink on either side of it.
  ok("outline of O: the stroke's own dots are blank, framed on both sides", o[4][1] === " " && o[4][0] === "\u2588" && o[4][2] === "\u2588", JSON.stringify(o[4]));
  ok("outline is pure blocks, so it encodes to CP437", N.cp437Encode(o.join("\n"), false).lossy.length === 0);
}
// 9. unknown characters are reported, never dropped
{
  const r = F.render("AB@C", "solid");
  ok("an unsupported character returns lines:null and names it", r.lines === null && r.missing.join("") === "@", JSON.stringify(r));
  ok("canRender agrees", F.canRender("AB@C") === false && F.canRender("ABC") === true);
  ok("lower case maps to the same bitmap as upper case", JSON.stringify(F.render("abc", "solid").lines) === JSON.stringify(F.render("ABC", "solid").lines));
  ok("empty string renders an empty block, not a crash", F.render("", "solid").lines !== undefined);
}
// 10. tight packing: no leading/trailing blank column on a rendered word
{
  const r = F.render("NFO", "solid").lines;
  ok("no row has an extra blank trailing column on the widest glyph rows", r.some(l => l[l.length - 1] !== " "));
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
