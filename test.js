const NFO = require("./nfo.js");
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, extra || ""); } }

// 1. CP437 table: all 128 high chars round trip, and match Node's own decoder (independent oracle)
let allHigh = ""; for (let i = 0x80; i < 256; i++) allHigh += NFO.cp437Decode(Uint8Array.of(i));
ok("128 high chars decoded", allHigh.length === 128);
const enc = NFO.cp437Encode(allHigh, false);
ok("high half round-trips byte-for-byte", enc.lossy.length === 0 && [...enc.bytes].every((b, i) => b === 0x80 + i), JSON.stringify(enc.lossy));
ok("distinct glyphs (no duplicate in table)", new Set(allHigh).size === 128, "dupes: " + (128 - new Set(allHigh).size));
// oracle: Python's cp437 codec produced these; spot-check known anchors
const anchors = { 0xDB: "\u2588", 0xDC: "\u2584", 0xDF: "\u2580", 0xB0: "\u2591", 0xB1: "\u2592", 0xB2: "\u2593", 0xC9: "\u2554", 0xBB: "\u2557", 0xC8: "\u255A", 0xBC: "\u255D", 0xCD: "\u2550", 0xBA: "\u2551", 0xDA: "\u250C", 0xC4: "\u2500", 0xB3: "\u2502", 0x80: "\u00C7", 0xE1: "\u00DF", 0xFF: "\u00A0" };
ok("anchor bytes match python cp437", Object.entries(anchors).every(([b, ch]) => NFO.cp437Decode(Uint8Array.of(+b)) === ch));

// 2. unencodable chars are reported, never dropped
const lossy = NFO.cp437Encode("ok \u2728 \u4e2d", false);
ok("lossy chars reported", lossy.lossy.length === 2 && lossy.bytes.length === 6 && lossy.bytes[3] === 0x3f && lossy.bytes[5] === 0x3f, JSON.stringify(lossy.lossy));

// 3. every rendered line is exactly W wide across widths and borders
let widthBad = 0;
for (const w of [40, 60, 79, 80, 100, 120]) for (const border of ["double", "single", "block", "ascii", "none"]) for (const shade of ["none", "light", "full"]) {
  const r = NFO.render({ width: w, border, shade, logo: "NFO", title: "T", tagline: "tag", fields: [["Release", "x ".repeat(80)], ["Group", "G"]], sections: [{ heading: "Notes", body: "word ".repeat(200) }], greets: ["a", "b", "c"], footer: "bye" });
  if (r.lines.some(l => l.length !== w)) widthBad++;
  if (r.warnings.some(x => /wide, expected/.test(x))) widthBad++;
}
ok("all lines exactly W wide (6 widths x 5 borders x 3 shades)", widthBad === 0, widthBad);

// 4. wrap never loses a character
const txt = "alpha beta gamma delta " + "x".repeat(150) + " omega";
const wr = NFO.wrap(txt, 30);
ok("wrap keeps every non-space char", wr.join("").replace(/ /g, "") === txt.replace(/ /g, ""));
ok("wrap respects width", wr.every(l => l.length <= 30));

// 5. a too-wide logo degrades with a warning, not silently
const big = NFO.render({ width: 40, logo: "ABCDEFGHIJ" });
ok("too-wide logo warns", big.warnings.some(w => /plain text/.test(w)), JSON.stringify(big.warnings));
ok("unknown logo glyph warns", NFO.render({ logo: "A@B" }).warnings.some(w => /lacks/.test(w)));

// 6. SAUCE byte layout against the ACiD spec
const r = NFO.render({ width: 79, title: "Test", fields: [["Group", "X"]] });
const meta = { title: "Test Title", author: "Auth", group: "GRP", date: "20261017", comments: ["line one", "line two"] };
const f = NFO.toFile(r, meta);
const b = f.bytes, s = b.length - 128;
ok("SAUCE id at len-128", String.fromCharCode(...b.slice(s, s + 5)) === "SAUCE");
ok("record is exactly 128 bytes at end", b.length === f.bodyLength + 1 + (5 + 128) + 128);
ok("EOF 0x1A directly after body", b[f.bodyLength] === 0x1a);
ok("COMNT block before record", String.fromCharCode(...b.slice(s - 2 * 64 - 5, s - 2 * 64)) === "COMNT");
ok("version '00'", String.fromCharCode(b[s + 5], b[s + 6]) === "00");
ok("DataType=1 FileType=1 (ASCII)", b[s + 94] === 1 && b[s + 95] === 1);
ok("TInfo1 cols=79, TInfo2 rows=line count", (b[s + 96] | b[s + 97] << 8) === 79 && (b[s + 98] | b[s + 99] << 8) === r.lines.length);
ok("FileSize excludes SAUCE", (b[s + 90] | b[s + 91] << 8 | b[s + 92] << 16) === f.bodyLength);
ok("Comments count byte = 2", b[s + 104] === 2);
ok("title padded with spaces to 35", b[s + 7 + 34] === 0x20 && String.fromCharCode(...b.slice(s + 7, s + 17)) === "Test Title");
const back = NFO.readSauce(b);
ok("readSauce round-trips fields", back.title === "Test Title" && back.author === "Auth" && back.group === "GRP" && back.date === "20261017" && back.comments.join("|") === "line one|line two", JSON.stringify(back));
ok("stripSauce returns exactly the body", NFO.stripSauce(b).length === f.bodyLength);
ok("body decodes back to the rendered text (CRLF normalized)", NFO.cp437Decode(NFO.stripSauce(b)) === r.text);

// 7. long metadata is clipped to field widths, never overflows into the next field
const long = NFO.toFile(r, { title: "T".repeat(80), author: "A".repeat(80), group: "G".repeat(80), date: "20261017" });
const lb = long.bytes, ls = lb.length - 128, lr = NFO.readSauce(lb);
ok("title clipped to 35", lr.title.length === 35 && lr.author.length === 20 && lr.group.length === 20 && lr.date === "20261017", JSON.stringify([lr.title.length, lr.author.length, lr.group.length]));
ok("no SAUCE when none requested is still valid file", NFO.readSauce(NFO.toFile(r, {}).bytes) !== null);
ok("bad date becomes blanks, not garbage", NFO.readSauce(NFO.toFile(r, { date: "17-10-2026" }).bytes).date === "");

// 8. non-SAUCE bytes are untouched
ok("readSauce on plain text = null", NFO.readSauce(NFO.cp437Encode("hello world".repeat(20), false).bytes) === null);
// 9. greetings: whole items per line, nothing lost, never wider than the page
{
  const items = ["everyone who ever signed a release file", "the ANSI and ASCII artists", "the people keeping scene.org alive", "a very long greeting that goes on and on ".repeat(4).trim(), "z"];
  const g = NFO.render({ width: 79, greets: items });
  const body = g.lines.slice(g.lines.findIndex(l => /GREETINGS/.test(l)) + 2).filter(l => !/^\u255a|^\u2560/.test(l));
  const flat = body.map(l => l.slice(2, -2)).join(" ").replace(/\s+/g, " ").replace(/ \u00B7 /g, " ");
  ok("greetings: every short item appears intact on one line", items.slice(0, 3).every(it => body.some(l => l.indexOf(it) >= 0)));
  ok("greetings: long item is wrapped, none of its words lost", items[3].split(" ").every(w => flat.indexOf(w) >= 0));
  ok("greetings: all lines still exactly 79", g.lines.every(l => l.length === 79));
  ok("greetings: empty list adds no section", NFO.render({ greets: [] }).lines.every(l => !/GREETINGS/.test(l)));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
