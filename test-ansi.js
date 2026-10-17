const N = require("./nfo.js"), X = require("./ansi.js");
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log("PASS", n); } else { fail++; console.log("FAIL", n, x === undefined ? "" : x); } }
const str = b => Buffer.from(b).toString("latin1");

// 1. ground truth from the ANSI standard, NOT from my decoder
// DOS colour 4 is RED; ANSI red foreground is 31. DOS 1 is BLUE; ANSI blue is 34.
{
  const red = str(X.encode(["A"], { fg: [[4]], bg: [[0]] }).bytes);
  ok("DOS red (4) is written as ESC[0;31;40m", red.startsWith("\x1b[0;31;40mA"), JSON.stringify(red));
  const blue = str(X.encode(["A"], { fg: [[1]], bg: [[0]] }).bytes);
  ok("DOS blue (1) is written as ESC[0;34;40m", blue.startsWith("\x1b[0;34;40mA"), JSON.stringify(blue));
  const brown = str(X.encode(["A"], { fg: [[6]], bg: [[0]] }).bytes);
  ok("DOS brown (6) is written as ANSI yellow 33", brown.startsWith("\x1b[0;33;40mA"), JSON.stringify(brown));
  const cyan = str(X.encode(["A"], { fg: [[3]], bg: [[0]] }).bytes);
  ok("DOS cyan (3) is written as ANSI 36", cyan.startsWith("\x1b[0;36;40mA"), JSON.stringify(cyan));
  const bright = str(X.encode(["A"], { fg: [[12]], bg: [[0]] }).bytes);
  ok("bright red (12) is bold + 31", bright.startsWith("\x1b[0;1;31;40mA"), JSON.stringify(bright));
  const bgred = str(X.encode(["A"], { fg: [[7]], bg: [[4]] }).bytes);
  ok("DOS red background (4) is 41", bgred.startsWith("\x1b[0;37;41mA"), JSON.stringify(bgred));
}
// 2. the mapping is a true permutation that round-trips all 8 colours
{
  const m = X.DOS2ANSI;
  ok("the colour map is a permutation of 0-7", [...m].sort().join("") === "01234567");
  ok("applying it twice returns every colour (self-inverse)", m.every((v, i) => m[v] === i));
}
// 3. round trip: every one of 16 fg x 8 bg combinations survives encode -> decode
{
  let bad = [];
  for (let fg = 0; fg < 16; fg++) for (let bg = 0; bg < 8; bg++) {
    const d = X.decode(X.encode(["X"], { fg: [[fg]], bg: [[bg]] }).bytes);
    if (d.fg[0][0] !== fg || d.bg[0][0] !== bg || d.lines[0] !== "X") bad.push([fg, bg, d.fg[0][0], d.bg[0][0]]);
  }
  ok("all 128 fg/bg combinations round-trip", bad.length === 0, JSON.stringify(bad.slice(0, 4)));
}
// 4. a multi-row picture round-trips text AND colour exactly, including block glyphs
{
  const lines = ["\u2588\u2591\u2592\u2593 AB", "\u2580\u2584\u258c\u2590 cd", "\u2554\u2550\u2557  ef"];
  const fg = lines.map((l, y) => [...l].map((_, x) => (x + y * 3) % 16)), bg = lines.map((l, y) => [...l].map((_, x) => (x + y) % 8));
  const e = X.encode(lines, { fg, bg }), d = X.decode(e.bytes);
  ok("text round-trips", JSON.stringify(d.lines) === JSON.stringify(lines), JSON.stringify(d.lines));
  ok("foreground grid round-trips", JSON.stringify(d.fg) === JSON.stringify(fg));
  ok("background grid round-trips", JSON.stringify(d.bg) === JSON.stringify(bg));
  ok("no unknown escape sequences", d.unknown.length === 0, d.unknown.join());
  ok("no characters lost", e.lossy.length === 0);
}
// 5. uncoloured input is the default grey on black, and compact (one SGR per row, not per cell)
{
  const e = X.encode(["hello world"], null), s = str(e.bytes);
  ok("uncoloured text uses a single colour switch", (s.match(/\x1b\[0;37;40m/g) || []).length === 1, JSON.stringify(s));
  ok("each row ends with a reset", s.includes("\x1b[0m\r\n"));
}
// 6. runs are coalesced: identical neighbours do not repeat the escape
{
  const e = str(X.encode(["AAAAAAAA"], { fg: [[4, 4, 4, 4, 1, 1, 1, 1]], bg: [[0, 0, 0, 0, 0, 0, 0, 0]] }).bytes);
  ok("two colour runs give exactly two colour switches", (e.match(/\x1b\[0;/g) || []).length === 2, JSON.stringify(e));
}
// 7. an independent Python reader (separate file, written from the SGR table) must agree
{
  const fs = require("fs"), cp = require("child_process");
  const lines = ["\u2588\u2588 hi", "\u2593\u2593 yo"], fg = [[12, 12, 7, 10, 10], [9, 9, 7, 14, 14]], bg = [[0, 0, 0, 0, 0], [1, 1, 0, 0, 0]];
  fs.writeFileSync("/tmp/probe.ans", Buffer.from(X.encode(lines, { fg, bg }).bytes));
  const out = JSON.parse(cp.execFileSync("python3", ["ans_decode_check.py", "/tmp/probe.ans"]).toString());
  ok("independent Python decoder reads the same text", JSON.stringify(out.t) === JSON.stringify(lines), JSON.stringify(out.t));
  ok("independent Python decoder reads the same foreground colours", JSON.stringify(out.f) === JSON.stringify(fg), JSON.stringify(out.f));
  ok("independent Python decoder reads the same background colours", JSON.stringify(out.b) === JSON.stringify(bg), JSON.stringify(out.b));
}
// 8. SAUCE for ANSi
{
  const lines = ["\u2588\u2588\u2588", "\u2588 \u2588"], fg = [[12, 12, 12], [12, 7, 12]];
  const f = X.toFile(lines, { fg }, { title: "Probe", author: "me", group: "grp", date: "20261017", comments: ["one"] });
  const b = f.bytes, s = b.length - 128;
  ok("SAUCE id present", str(b.slice(s, s + 5)) === "SAUCE");
  ok("DataType 1 / FileType 1 (ANSi)", b[s + 94] === 1 && b[s + 95] === 1);
  ok("TInfo1 = widest row (3), TInfo2 = rows (2)", (b[s + 96] | b[s + 97] << 8) === 3 && (b[s + 98] | b[s + 99] << 8) === 2);
  ok("FileSize = ANSI body bytes (escape codes included)", (b[s + 90] | b[s + 91] << 8 | b[s + 92] << 16) === f.bodyLength);
  ok("EOF byte 0x1A precedes the comment block", b[f.bodyLength] === 0x1a);
  ok("body strips cleanly and still decodes", X.decode(b.slice(0, f.bodyLength)).lines.join("|") === lines.join("|"));
}
// 9. HTML preview carries the right colours and escapes markup
{
  const h = X.toHtml(["<&>"], { fg: [[12, 12, 12]], bg: [[0, 0, 0]] });
  ok("HTML escapes < & >", h.includes("&lt;&amp;&gt;") && !h.includes("<&>"));
  ok("bright red is #FF5555", h.includes("#FF5555"));
  ok("HTML runs coalesce (one span for three same-colour cells)", (h.match(/<span/g) || []).length === 1);
}
// 10. characters outside CP437 are reported, not hidden
{
  const e = X.encode(["a\u2728b"], null);
  ok("lossy glyphs reported", e.lossy.join("") === "\u2728");
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
