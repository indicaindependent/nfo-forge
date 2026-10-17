/*!
 * NFO Forge 2.0 ANSI layer. Zero dependencies, browser and Node.
 *
 * Colour is carried as a parallel grid: for every text cell, a foreground and a
 * background index 0-15 in VGA order. This module
 *   - encodes (lines + colours) into a real ANSI byte stream (.ans), CP437, SGR codes
 *   - decodes an ANSI stream back into cells (so files can be opened and checked)
 *   - writes the plain-text SAUCE record for ANSI (DataType 1, FileType 1 = ANSi)
 *
 * VGA index order here is the DOS attribute order: 0 black, 1 blue, 2 green, 3 cyan,
 * 4 red, 5 magenta, 6 brown, 7 light grey, 8-15 the bright versions. ANSI SGR numbers
 * the colours differently (30 black, 31 red, 32 green, 33 yellow, 34 blue, ...), so
 * the two must be translated. That swap is the classic bug in hand-made ANSI writers.
 *
 * Licence: MIT.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./nfo.js"));
  else root.NFOAnsi = factory(root.NFO);
})(typeof self !== "undefined" ? self : this, function (NFO) {
  "use strict";

  // DOS attribute colour index -> ANSI SGR colour number 0-7 (add 30 fg / 40 bg).
  // DOS: 0 K, 1 B, 2 G, 3 C, 4 R, 5 M, 6 Y(brown), 7 W    ANSI: 0 K, 1 R, 2 G, 3 Y, 4 B, 5 M, 6 C, 7 W
  var DOS2ANSI = [0, 4, 2, 6, 1, 5, 3, 7];
  var ANSI2DOS = [0, 4, 2, 6, 1, 5, 3, 7]; // the mapping is its own inverse (a swap of 1<->4 and 3<->6)

  var ESC = 0x1b;

  function sgrFor(fg, bg, prev) {
    // Always emit a full, self-contained state when anything changes: reset, then bold if
    // bright foreground, then fg and bg. Verbose but unambiguous in every viewer.
    var codes = [0];
    if (fg > 7) codes.push(1);
    codes.push(30 + DOS2ANSI[fg & 7]);
    codes.push(40 + DOS2ANSI[bg & 7]);
    return "[" + codes.join(";") + "m";
  }

  // lines: array of equal-or-unequal strings. colors: optional {fg:[[..]], bg:[[..]]}, grids of 0-15
  // defaults: fg 7, bg 0. Returns {bytes, lossy}.
  function encode(lines, colors, opts) {
    opts = opts || {};
    var fgG = colors && colors.fg, bgG = colors && colors.bg;
    var out = [], lossy = [];
    var cf = -1, cb = -1;
    function pushStr(s) { for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); }
    for (var y = 0; y < lines.length; y++) {
      var line = lines[y];
      for (var x = 0; x < line.length; x++) {
        var fg = fgG && fgG[y] && fgG[y][x] != null ? fgG[y][x] : 7;
        var bg = bgG && bgG[y] && bgG[y][x] != null ? bgG[y][x] : 0;
        if (fg !== cf || bg !== cb) {
          out.push(ESC); pushStr(sgrFor(fg, bg)); cf = fg; cb = bg;
        }
        var enc = NFO.cp437Encode(line.charAt(x), false);
        if (enc.lossy.length && lossy.indexOf(line.charAt(x)) < 0) lossy.push(line.charAt(x));
        out.push(enc.bytes[0]);
      }
      // end of row: reset so a viewer wider than the art does not smear the background
      out.push(ESC); pushStr("[0m"); cf = -1; cb = -1;
      out.push(0x0d, 0x0a);
    }
    return { bytes: Uint8Array.from(out), lossy: lossy };
  }

  // Minimal, strict decoder for the subset we write: ESC [ params m, CR, LF, printable CP437.
  // Anything else is reported in `unknown`, never silently skipped.
  function decode(bytes) {
    var rows = [], row = [], unknown = [];
    var fg = 7, bg = 0, bold = false;
    var i = 0;
    function newRow() { rows.push(row); row = []; }
    while (i < bytes.length) {
      var b = bytes[i];
      if (b === 0x1a) break;
      if (b === ESC && bytes[i + 1] === 0x5b) {
        var j = i + 2, p = "";
        while (j < bytes.length && ((bytes[j] >= 0x30 && bytes[j] <= 0x39) || bytes[j] === 0x3b)) { p += String.fromCharCode(bytes[j]); j++; }
        var fin = bytes[j];
        if (fin === 0x6d) { // 'm'
          var codes = p === "" ? [0] : p.split(";").map(function (n) { return n === "" ? 0 : parseInt(n, 10); });
          codes.forEach(function (c) {
            if (c === 0) { fg = 7; bg = 0; bold = false; }
            else if (c === 1) bold = true;
            else if (c >= 30 && c <= 37) fg = ANSI2DOS[c - 30];
            else if (c >= 40 && c <= 47) bg = ANSI2DOS[c - 40];
            else unknown.push("SGR " + c);
          });
        } else unknown.push("CSI " + p + String.fromCharCode(fin || 63));
        i = j + 1; continue;
      }
      if (b === 0x0d) { i++; continue; }
      if (b === 0x0a) { newRow(); i++; continue; }
      row.push({ ch: NFO.cp437Decode(Uint8Array.of(b)), fg: bold ? (fg | 8) : fg, bg: bg });
      i++;
    }
    if (row.length) newRow();
    return {
      lines: rows.map(function (r) { return r.map(function (c) { return c.ch; }).join(""); }),
      fg: rows.map(function (r) { return r.map(function (c) { return c.fg; }); }),
      bg: rows.map(function (r) { return r.map(function (c) { return c.bg; }); }),
      unknown: unknown
    };
  }

  // SAUCE for an ANSi file: DataType 1 (Character), FileType 1 (ANSi). TInfo1/2 = columns/rows.
  function toFile(lines, colors, meta) {
    var e = encode(lines, colors), body = e.bytes;
    var width = 0; lines.forEach(function (l) { if (l.length > width) width = l.length; });
    var comments = ((meta && meta.comments) || []).slice(0, 255).map(function (c) { return String(c).slice(0, 64); });
    var parts = [body, Uint8Array.of(0x1a)];
    var cb = null;
    if (comments.length) {
      cb = new Uint8Array(5 + comments.length * 64);
      "COMNT".split("").forEach(function (c, k) { cb[k] = c.charCodeAt(0); });
      comments.forEach(function (c, ci) { for (var k = 0; k < 64; k++) cb[5 + ci * 64 + k] = k < c.length ? (NFO.cp437Encode(c.charAt(k), false).bytes[0] || 0x3f) : 0x20; });
      parts.push(cb);
    }
    var rec = new Uint8Array(128);
    function put(off, str, len) { str = String(str == null ? "" : str); for (var k = 0; k < len; k++) rec[off + k] = k < str.length ? (NFO.cp437Encode(str.charAt(k), false).bytes[0] || 0x3f) : 0x20; }
    function u16(off, v) { rec[off] = v & 255; rec[off + 1] = (v >> 8) & 255; }
    function u32(off, v) { rec[off] = v & 255; rec[off + 1] = (v >>> 8) & 255; rec[off + 2] = (v >>> 16) & 255; rec[off + 3] = (v >>> 24) & 255; }
    meta = meta || {};
    put(0, "SAUCE", 5); put(5, "00", 2); put(7, meta.title, 35); put(42, meta.author, 20); put(62, meta.group, 20);
    put(82, /^\d{8}$/.test(meta.date || "") ? meta.date : "        ", 8);
    u32(90, body.length); rec[94] = 1; rec[95] = 1; u16(96, width); u16(98, lines.length); u16(100, 0); u16(102, 0);
    rec[104] = comments.length; rec[105] = 0;
    for (var k = 106; k < 128; k++) rec[k] = 0;
    parts.push(rec);
    var total = parts.reduce(function (n, p) { return n + p.length; }, 0), file = new Uint8Array(total), o = 0;
    parts.forEach(function (p) { file.set(p, o); o += p.length; });
    return { bytes: file, lossy: e.lossy, bodyLength: body.length };
  }

  // The HTML rendering of a coloured grid, for the in-page preview. Uses the VGA palette.
  var VGA_HEX = ["#000000", "#0000AA", "#00AA00", "#00AAAA", "#AA0000", "#AA00AA", "#AA5500", "#AAAAAA",
                 "#555555", "#5555FF", "#55FF55", "#55FFFF", "#FF5555", "#FF55FF", "#FFFF55", "#FFFFFF"];
  function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function toHtml(lines, colors) {
    var fgG = colors && colors.fg, bgG = colors && colors.bg, out = "";
    for (var y = 0; y < lines.length; y++) {
      var line = lines[y], x = 0;
      while (x < line.length) {
        var fg = fgG && fgG[y] && fgG[y][x] != null ? fgG[y][x] : 7, bg = bgG && bgG[y] && bgG[y][x] != null ? bgG[y][x] : 0;
        var run = "";
        while (x < line.length) {
          var f2 = fgG && fgG[y] && fgG[y][x] != null ? fgG[y][x] : 7, b2 = bgG && bgG[y] && bgG[y][x] != null ? bgG[y][x] : 0;
          if (f2 !== fg || b2 !== bg) break; run += line.charAt(x); x++;
        }
        out += '<span style="color:' + VGA_HEX[fg & 15] + (bg ? ";background:" + VGA_HEX[bg & 15] : "") + '">' + escapeHtml(run) + "</span>";
      }
      out += "\n";
    }
    return out;
  }

  return { encode: encode, decode: decode, toFile: toFile, toHtml: toHtml, DOS2ANSI: DOS2ANSI, VGA_HEX: VGA_HEX };
});
