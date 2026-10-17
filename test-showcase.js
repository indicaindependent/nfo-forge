const S = require("./showcase.js"), fs = require("fs");
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log("PASS", n); } else { fail++; console.log("FAIL", n, x === undefined ? "" : x); } }
const base = S.compose();
ok("default output is 80 columns wide on every row", base.lines.every(l => l.length === 80), [...new Set(base.lines.map(l => l.length))]);
ok("default output is pure keyboard ASCII", base.lines.every(l => /^[\x20-\x7e]*$/.test(l)));
ok("default is deterministic", JSON.stringify(S.compose().lines) === JSON.stringify(base.lines));
// the approved piece is the contract; this file is committed as iim-painted-A.txt
{ const want = fs.readFileSync("iim-painted-A.txt", "utf8"); ok("default output is byte-identical to the approved iim-painted-A.txt", base.lines.join("\n") + "\n" === want); }
ok("frame corners and rules are intact", base.lines[0][0] === "." && base.lines[0][79] === "." && base.lines[2] === "+" + "=".repeat(78) + "+" && base.lines[base.lines.length - 1][0] === "'");
ok("title, tagline and footer present", base.lines[1].includes("INDICA INDEPENDENT MEDIA") && base.lines.some(l => l.includes("100% CREATIVE CLARITY")) && base.lines.some(l => l.includes("made with NFO Forge 2.0")));
// letter counts: the original maths assumed three letters, so every length is tested
for (const letters of ["A", "IM", "IIM", "ABCD", "ABCDE"]) {
  const r = S.compose({ letters });
  ok(`${letters.length} letter(s) "${letters}": rows are all 80 wide`, r.lines.every(l => l.length === 80), [...new Set(r.lines.map(l => l.length))]);
  ok(`${letters.length} letter(s) "${letters}": keyboard ASCII only`, r.lines.every(l => /^[\x20-\x7e]*$/.test(l)));
  const interior = r.lines.slice(3, r.lines.length - 3).join("");
  ok(`${letters.length} letter(s) "${letters}": the banner draws something`, /[#@&$%]/.test(interior));
}
ok("letters beyond five are cut, not widened", S.compose({ letters: "ABCDEFGH" }).lines.every(l => l.length === 80));
ok("lower-case letters are accepted", S.compose({ letters: "iim" }).lines.join("\n") === base.lines.join("\n"));
// text that cannot fit is cut, never allowed to widen the frame
ok("a 200-character title cannot widen the frame", S.compose({ title: "X".repeat(200) }).lines.every(l => l.length === 80));
ok("a 200-character tagline cannot widen the frame", S.compose({ tagline: "Y".repeat(200) }).lines.every(l => l.length === 80));
ok("non-ASCII input becomes '?' and keeps the frame", (() => { const r = S.compose({ title: "caf\u00e9 \u2728" }); return r.lines.every(l => l.length === 80 && /^[\x20-\x7e]*$/.test(l)) && r.lines[1].includes("caf? ?"); })());
ok("empty strings fall back to the defaults", S.compose({ title: "", tagline: "" }).lines.join("\n") === base.lines.join("\n"));
ok("seed changes the texture", S.compose({ seed: 3 }).lines.join("\n") !== base.lines.join("\n"));
ok("same seed gives the same texture", S.compose({ seed: 3 }).lines.join("\n") === S.compose({ seed: 3 }).lines.join("\n"));
ok("leafRows is clamped to 24..60", S.compose({ leafRows: 5 }).rows >= 30 && S.compose({ leafRows: 500 }).rows <= 90);
ok("result reports its own size honestly", base.cols === 80 && base.rows === base.lines.length && base.rows === 56);
// Pins the symbol weighting across the banner: dominant heavy symbol per third. A later change to how letters are shaded must be deliberate.
{
  // Layout from the bottom of the frame, which is fixed: [... banner(15) , blank, tagline, rule, footer, bottom border].
  // Counting up from the tagline is exact; searching for the banner by content is not (it picked up leaf rows).
  const dominant = (letters) => { const r = S.compose({ letters }), tag = r.lines.findIndex(l => l.includes("100% CREATIVE CLARITY")), b = r.lines.slice(tag - 1 - 15, tag - 1).map(l => l.slice(2, 78));
    // slice thirds across the ink's own extent, not the 76-column slot (which is mostly blank margin around a centred banner)
    let lo = 99, hi = -1; b.forEach(l => { for (let x = 0; x < l.length; x++) if (l[x] !== " ") { lo = Math.min(lo, x); hi = Math.max(hi, x); } });
    const w = (hi - lo + 1) / 3;
    return [0, 1, 2].map(k => { const cnt = {}; b.forEach(l => { for (const ch of l.slice(Math.round(lo + k * w), Math.round(lo + (k + 1) * w))) if ("#@&$%".includes(ch)) cnt[ch] = (cnt[ch] || 0) + 1; }); return Object.entries(cnt).sort((x, y) => y[1] - x[1])[0][0]; }).join(""); };
  ok("3 letters shade the banner # @ # across its thirds (the approved design)", dominant("IIM") === "#@#", dominant("IIM"));
  ok("5 letters shade the banner # @ # across its thirds", dominant("ABCDE") === "#@#", dominant("ABCDE"));
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
