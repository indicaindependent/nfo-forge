/*!
 * NFO Forge engine. Zero dependencies. Runs in the browser and in Node.
 * Builds a classic scene-style .nfo as an array of text lines, encodes it to
 * real CP437 bytes, and can append a SAUCE record.
 *
 * Licence: MIT. See LICENSE.
 *
 * SAUCE layout follows the ACiD revision 5 specification:
 * 128-byte record, EOF byte 0x1A before it, optional COMNT block of 64-char lines.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NFO = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---- CP437 -------------------------------------------------------------
  // High half (0x80-0xFF) of code page 437, as Unicode. The low half is
  // printable ASCII for our purposes (we never emit control glyphs).
  var HIGH =
    "\u00C7\u00FC\u00E9\u00E2\u00E4\u00E0\u00E5\u00E7\u00EA\u00EB\u00E8\u00EF\u00EE\u00EC\u00C4\u00C5" +
    "\u00C9\u00E6\u00C6\u00F4\u00F6\u00F2\u00FB\u00F9\u00FF\u00D6\u00DC\u00A2\u00A3\u00A5\u20A7\u0192" +
    "\u00E1\u00ED\u00F3\u00FA\u00F1\u00D1\u00AA\u00BA\u00BF\u2310\u00AC\u00BD\u00BC\u00A1\u00AB\u00BB" +
    "\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255D\u255C\u255B\u2510" +
    "\u2514\u2534\u252C\u251C\u2500\u253C\u255E\u255F\u255A\u2554\u2569\u2566\u2560\u2550\u256C\u2567" +
    "\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256B\u256A\u2518\u250C\u2588\u2584\u258C\u2590\u2580" +
    "\u03B1\u00DF\u0393\u03C0\u03A3\u03C3\u00B5\u03C4\u03A6\u0398\u03A9\u03B4\u221E\u03C6\u03B5\u2229" +
    "\u2261\u00B1\u2265\u2264\u2320\u2321\u00F7\u2248\u00B0\u2219\u00B7\u221A\u207F\u00B2\u25A0\u00A0";

  var TO_BYTE = Object.create(null);
  (function () {
    var i;
    for (i = 0x20; i < 0x7f; i++) TO_BYTE[String.fromCharCode(i)] = i;
    for (i = 0; i < 128; i++) TO_BYTE[HIGH.charAt(i)] = 0x80 + i;
    TO_BYTE["\u00A0"] = 0xff;
  })();

  function cp437Decode(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      if (b === 0x0d) continue;
      if (b === 0x0a) out += "\n";
      else if (b >= 0x80) out += HIGH.charAt(b - 0x80);
      else if (b >= 0x20 && b < 0x7f) out += String.fromCharCode(b);
      else out += " ";
    }
    return out;
  }

  // Returns {bytes, lossy}. lossy lists characters that had no CP437 form
  // and were replaced by "?". Nothing is dropped silently.
  function cp437Encode(text, crlf) {
    var out = [], lossy = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === "\r") continue;
      if (ch === "\n") { if (crlf !== false) out.push(0x0d); out.push(0x0a); continue; }
      var b = TO_BYTE[ch];
      if (b === undefined) { out.push(0x3f); if (lossy.indexOf(ch) < 0) lossy.push(ch); }
      else out.push(b);
    }
    return { bytes: Uint8Array.from(out), lossy: lossy };
  }

  // ---- Box styles --------------------------------------------------------
  var BOX = {
    double: { tl: "\u2554", tr: "\u2557", bl: "\u255A", br: "\u255D", h: "\u2550", v: "\u2551", lt: "\u2560", rt: "\u2563" },
    single: { tl: "\u250C", tr: "\u2510", bl: "\u2514", br: "\u2518", h: "\u2500", v: "\u2502", lt: "\u251C", rt: "\u2524" },
    block:  { tl: "\u2588", tr: "\u2588", bl: "\u2588", br: "\u2588", h: "\u2588", v: "\u2588", lt: "\u2588", rt: "\u2588" },
    ascii:  { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|", lt: "+", rt: "+" },
    none:   { tl: " ", tr: " ", bl: " ", br: " ", h: " ", v: " ", lt: " ", rt: " " }
  };
  var SHADE = { light: "\u2591", medium: "\u2592", dark: "\u2593", full: "\u2588", none: " " };

  // ---- Text helpers ------------------------------------------------------
  function rep(ch, n) { var s = ""; for (var i = 0; i < n; i++) s += ch; return s; }
  function clip(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n) : s; }
  function padR(s, n) { s = clip(s, n); return s + rep(" ", n - s.length); }
  function center(s, n) {
    s = clip(s, n);
    var left = Math.floor((n - s.length) / 2);
    return rep(" ", left) + s + rep(" ", n - s.length - left);
  }

  // Greedy word wrap that never breaks a line longer than width and never
  // loses a character. Words longer than width are hard-split.
  function wrap(text, width) {
    var out = [];
    String(text == null ? "" : text).split("\n").forEach(function (para) {
      if (para.trim() === "") { out.push(""); return; }
      var line = "";
      para.split(/\s+/).forEach(function (w) {
        if (!w) return;
        while (w.length > width) {
          if (line) { out.push(line); line = ""; }
          out.push(w.slice(0, width)); w = w.slice(width);
        }
        if (!line) line = w;
        else if (line.length + 1 + w.length <= width) line += " " + w;
        else { out.push(line); line = w; }
      });
      if (line) out.push(line);
    });
    return out;
  }

  // ---- Built-in logo fonts ----------------------------------------------
  // Hand-drawn 5-row block letters, original to this project. Anything not
  // listed here falls back to a plain spaced-out uppercase rendering.
  var FONT5 = {
    A: ["\u2588\u2588\u2588\u2588\u2588", "\u2588   \u2588", "\u2588\u2588\u2588\u2588\u2588", "\u2588   \u2588", "\u2588   \u2588"],
    B: ["\u2588\u2588\u2588\u2588 ", "\u2588   \u2588", "\u2588\u2588\u2588\u2588 ", "\u2588   \u2588", "\u2588\u2588\u2588\u2588 "],
    C: ["\u2588\u2588\u2588\u2588\u2588", "\u2588    ", "\u2588    ", "\u2588    ", "\u2588\u2588\u2588\u2588\u2588"],
    D: ["\u2588\u2588\u2588\u2588 ", "\u2588   \u2588", "\u2588   \u2588", "\u2588   \u2588", "\u2588\u2588\u2588\u2588 "],
    E: ["\u2588\u2588\u2588\u2588\u2588", "\u2588    ", "\u2588\u2588\u2588  ", "\u2588    ", "\u2588\u2588\u2588\u2588\u2588"],
    F: ["\u2588\u2588\u2588\u2588\u2588", "\u2588    ", "\u2588\u2588\u2588  ", "\u2588    ", "\u2588    "],
    G: ["\u2588\u2588\u2588\u2588\u2588", "\u2588    ", "\u2588  \u2588\u2588", "\u2588   \u2588", "\u2588\u2588\u2588\u2588\u2588"],
    H: ["\u2588   \u2588", "\u2588   \u2588", "\u2588\u2588\u2588\u2588\u2588", "\u2588   \u2588", "\u2588   \u2588"],
    I: ["\u2588\u2588\u2588", " \u2588 ", " \u2588 ", " \u2588 ", "\u2588\u2588\u2588"],
    J: ["  \u2588\u2588\u2588", "   \u2588 ", "   \u2588 ", "\u2588  \u2588 ", " \u2588\u2588  "],
    K: ["\u2588   \u2588", "\u2588  \u2588 ", "\u2588\u2588\u2588  ", "\u2588  \u2588 ", "\u2588   \u2588"],
    L: ["\u2588    ", "\u2588    ", "\u2588    ", "\u2588    ", "\u2588\u2588\u2588\u2588\u2588"],
    M: ["\u2588   \u2588", "\u2588\u2588 \u2588\u2588", "\u2588 \u2588 \u2588", "\u2588   \u2588", "\u2588   \u2588"],
    N: ["\u2588   \u2588", "\u2588\u2588  \u2588", "\u2588 \u2588 \u2588", "\u2588  \u2588\u2588", "\u2588   \u2588"],
    O: ["\u2588\u2588\u2588\u2588\u2588", "\u2588   \u2588", "\u2588   \u2588", "\u2588   \u2588", "\u2588\u2588\u2588\u2588\u2588"],
    P: ["\u2588\u2588\u2588\u2588\u2588", "\u2588   \u2588", "\u2588\u2588\u2588\u2588\u2588", "\u2588    ", "\u2588    "],
    Q: ["\u2588\u2588\u2588\u2588\u2588", "\u2588   \u2588", "\u2588 \u2588 \u2588", "\u2588  \u2588 ", "\u2588\u2588\u2588 \u2588"],
    R: ["\u2588\u2588\u2588\u2588 ", "\u2588   \u2588", "\u2588\u2588\u2588\u2588 ", "\u2588  \u2588 ", "\u2588   \u2588"],
    S: ["\u2588\u2588\u2588\u2588\u2588", "\u2588    ", "\u2588\u2588\u2588\u2588\u2588", "    \u2588", "\u2588\u2588\u2588\u2588\u2588"],
    T: ["\u2588\u2588\u2588\u2588\u2588", "  \u2588  ", "  \u2588  ", "  \u2588  ", "  \u2588  "],
    U: ["\u2588   \u2588", "\u2588   \u2588", "\u2588   \u2588", "\u2588   \u2588", "\u2588\u2588\u2588\u2588\u2588"],
    V: ["\u2588   \u2588", "\u2588   \u2588", "\u2588   \u2588", " \u2588 \u2588 ", "  \u2588  "],
    W: ["\u2588   \u2588", "\u2588   \u2588", "\u2588 \u2588 \u2588", "\u2588\u2588 \u2588\u2588", "\u2588   \u2588"],
    X: ["\u2588   \u2588", " \u2588 \u2588 ", "  \u2588  ", " \u2588 \u2588 ", "\u2588   \u2588"],
    Y: ["\u2588   \u2588", " \u2588 \u2588 ", "  \u2588  ", "  \u2588  ", "  \u2588  "],
    Z: ["\u2588\u2588\u2588\u2588\u2588", "   \u2588 ", "  \u2588  ", " \u2588   ", "\u2588\u2588\u2588\u2588\u2588"],
    "0": ["\u2588\u2588\u2588\u2588\u2588", "\u2588  \u2588\u2588", "\u2588 \u2588 \u2588", "\u2588\u2588  \u2588", "\u2588\u2588\u2588\u2588\u2588"],
    "1": [" \u2588\u2588  ", "  \u2588  ", "  \u2588  ", "  \u2588  ", "\u2588\u2588\u2588\u2588\u2588"],
    "2": ["\u2588\u2588\u2588\u2588\u2588", "    \u2588", "\u2588\u2588\u2588\u2588\u2588", "\u2588    ", "\u2588\u2588\u2588\u2588\u2588"],
    "3": ["\u2588\u2588\u2588\u2588\u2588", "    \u2588", " \u2588\u2588\u2588\u2588", "    \u2588", "\u2588\u2588\u2588\u2588\u2588"],
    "4": ["\u2588   \u2588", "\u2588   \u2588", "\u2588\u2588\u2588\u2588\u2588", "    \u2588", "    \u2588"],
    "5": ["\u2588\u2588\u2588\u2588\u2588", "\u2588    ", "\u2588\u2588\u2588\u2588\u2588", "    \u2588", "\u2588\u2588\u2588\u2588\u2588"],
    "6": ["\u2588\u2588\u2588\u2588\u2588", "\u2588    ", "\u2588\u2588\u2588\u2588\u2588", "\u2588   \u2588", "\u2588\u2588\u2588\u2588\u2588"],
    "7": ["\u2588\u2588\u2588\u2588\u2588", "    \u2588", "   \u2588 ", "  \u2588  ", "  \u2588  "],
    "8": ["\u2588\u2588\u2588\u2588\u2588", "\u2588   \u2588", "\u2588\u2588\u2588\u2588\u2588", "\u2588   \u2588", "\u2588\u2588\u2588\u2588\u2588"],
    "9": ["\u2588\u2588\u2588\u2588\u2588", "\u2588   \u2588", "\u2588\u2588\u2588\u2588\u2588", "    \u2588", "\u2588\u2588\u2588\u2588\u2588"],
    "-": ["     ", "     ", "\u2588\u2588\u2588\u2588\u2588", "     ", "     "],
    ".": ["  ", "  ", "  ", "  ", "\u2588\u2588"],
    "!": ["\u2588\u2588", "\u2588\u2588", "\u2588\u2588", "  ", "\u2588\u2588"],
    " ": ["   ", "   ", "   ", "   ", "   "]
  };

  // Returns 5 strings, or null if any character is missing from the font
  // (the caller then falls back, so no glyph is ever silently dropped).
  function logoBlock(text, gap) {
    text = String(text || "").toUpperCase();
    var rows = ["", "", "", "", ""];
    for (var i = 0; i < text.length; i++) {
      var g = FONT5[text.charAt(i)];
      if (!g) return null;
      for (var r = 0; r < 5; r++) rows[r] += g[r] + (i < text.length - 1 ? rep(" ", gap) : "");
    }
    return rows;
  }

  // ---- The renderer ------------------------------------------------------
  // spec fields (all optional unless noted):
  //   width (60-100, default 79), border, shade, title, tagline, logo,
  //   fields: [[label, value], ...], sections: [{heading, body|lines}],
  //   greets: [..], footer, align
  function render(spec) {
    spec = spec || {};
    var W = Math.max(40, Math.min(120, parseInt(spec.width, 10) || 79));
    var box = BOX[spec.border] || BOX.double;
    var shade = SHADE[spec.shade] !== undefined ? SHADE[spec.shade] : SHADE.light;
    var inner = W - 4; // two border cols + one pad col each side
    var warnings = [];
    var lines = [];

    function top() { lines.push(box.tl + rep(box.h, W - 2) + box.tr); }
    function bottom() { lines.push(box.bl + rep(box.h, W - 2) + box.br); }
    function rule() { lines.push(box.lt + rep(box.h, W - 2) + box.rt); }
    function row(content) { lines.push(box.v + " " + padR(content, inner) + " " + box.v); }
    function blank() { row(""); }
    function shadeRow() { lines.push(box.v + " " + rep(shade, inner) + " " + box.v); }

    top();
    if (spec.shade && spec.shade !== "none") shadeRow();

    if (spec.logo) {
      var lb = logoBlock(spec.logo, 1);
      if (lb && lb[0].length <= inner) lb.forEach(function (r) { row(center(r, inner)); });
      else {
        if (lb) warnings.push("Logo is " + lb[0].length + " columns wide and the page is " + inner + ". Used plain text instead.");
        else warnings.push("Logo contains characters the block font lacks. Used plain text instead.");
        row(center(String(spec.logo).toUpperCase().split("").join(" "), inner));
      }
    }
    if (spec.shade && spec.shade !== "none") shadeRow();
    if (spec.title) row(center(spec.title, inner));
    if (spec.tagline) row(center(spec.tagline, inner));
    if (spec.title || spec.tagline) blank();

    var fields = (spec.fields || []).filter(function (f) { return f && String(f[0] || "").trim() !== ""; });
    if (fields.length) {
      rule();
      var lw = 0;
      fields.forEach(function (f) { lw = Math.max(lw, String(f[0]).length); });
      lw = Math.min(lw, 18);
      var vw = inner - lw - 3;
      fields.forEach(function (f) {
        var wrapped = wrap(f[1], vw);
        if (!wrapped.length) wrapped = [""];
        wrapped.forEach(function (l, i) {
          row(padR(i === 0 ? String(f[0]).toUpperCase() : "", lw) + " : " + l);
        });
      });
    }

    (spec.sections || []).forEach(function (s) {
      if (!s) return;
      rule();
      if (s.heading) {
        row(rep(SHADE.medium, 2) + " " + String(s.heading).toUpperCase() + " " + rep(SHADE.medium, Math.max(2, inner - String(s.heading).length - 4)));
        blank();
      }
      var body = s.lines ? s.lines : wrap(s.body, inner);
      body.forEach(function (l) { row(l); });
    });

    var greets = (spec.greets || []).filter(Boolean);
    if (greets.length) {
      rule();
      row(rep(SHADE.medium, 2) + " GREETINGS " + rep(SHADE.medium, Math.max(2, inner - 13)));
      blank();
      // Pack whole greetings onto lines so no name is split across two lines.
      var sep = " \u00B7 ", cur = "", packed = [];
      greets.forEach(function (g) {
        g = String(g);
        if (g.length > inner) { if (cur) { packed.push(cur); cur = ""; } wrap(g, inner).forEach(function (p) { packed.push(p); }); return; }
        if (!cur) cur = g;
        else if (cur.length + sep.length + g.length <= inner) cur += sep + g;
        else { packed.push(cur); cur = g; }
      });
      if (cur) packed.push(cur);
      packed.forEach(function (l) { row(center(l, inner)); });
    }

    if (spec.footer) { rule(); wrap(spec.footer, inner).forEach(function (l) { row(center(l, inner)); }); }
    if (spec.shade && spec.shade !== "none") shadeRow();
    bottom();

    // Invariant: every line is exactly W characters. Report, never hide.
    lines.forEach(function (l, i) {
      if (l.length !== W) warnings.push("Line " + (i + 1) + " is " + l.length + " wide, expected " + W + ".");
    });
    return { lines: lines, text: lines.join("\n") + "\n", width: W, warnings: warnings };
  }

  // ---- SAUCE -------------------------------------------------------------
  function sauceRecord(meta, fileSize, commentCount, width, height) {
    var b = new Uint8Array(128);
    function put(off, str, len) {
      str = String(str == null ? "" : str);
      for (var i = 0; i < len; i++) b[off + i] = i < str.length ? (TO_BYTE[str.charAt(i)] || 0x3f) : 0x20;
    }
    function u16(off, v) { b[off] = v & 0xff; b[off + 1] = (v >> 8) & 0xff; }
    function u32(off, v) { b[off] = v & 0xff; b[off + 1] = (v >>> 8) & 0xff; b[off + 2] = (v >>> 16) & 0xff; b[off + 3] = (v >>> 24) & 0xff; }
    put(0, "SAUCE", 5);
    put(5, "00", 2);
    put(7, clip(meta.title, 35), 35);
    put(42, clip(meta.author, 20), 20);
    put(62, clip(meta.group, 20), 20);
    put(82, /^\d{8}$/.test(meta.date || "") ? meta.date : "        ", 8);
    u32(90, fileSize);
    b[94] = 1;            // DataType: Character
    b[95] = 1;            // FileType: ASCII
    u16(96, width);       // TInfo1: columns
    u16(98, height);      // TInfo2: rows
    u16(100, 0); u16(102, 0);
    b[104] = Math.min(255, commentCount);
    b[105] = 0;           // TFlags
    for (var i = 106; i < 128; i++) b[i] = 0;
    return b;
  }

  // Full file: CP437 body + 0x1A + optional COMNT block + SAUCE record.
  function toFile(rendered, meta) {
    var enc = cp437Encode(rendered.text, true);
    var body = enc.bytes;
    var out = [Array.prototype.slice.call(body)];
    var comments = ((meta && meta.comments) || []).slice(0, 255).map(function (c) { return clip(c, 64); });
    var parts = [body, Uint8Array.of(0x1a)];
    if (comments.length) {
      var cb = new Uint8Array(5 + comments.length * 64);
      "COMNT".split("").forEach(function (c, i) { cb[i] = c.charCodeAt(0); });
      comments.forEach(function (c, ci) {
        for (var i = 0; i < 64; i++) cb[5 + ci * 64 + i] = i < c.length ? (TO_BYTE[c.charAt(i)] || 0x3f) : 0x20;
      });
      parts.push(cb);
    }
    parts.push(sauceRecord(meta || {}, body.length, comments.length, rendered.width, rendered.lines.length));
    var total = parts.reduce(function (n, p) { return n + p.length; }, 0);
    var file = new Uint8Array(total), o = 0;
    parts.forEach(function (p) { file.set(p, o); o += p.length; });
    return { bytes: file, lossy: enc.lossy, bodyLength: body.length };
  }

  function readSauce(bytes) {
    if (bytes.length < 128) return null;
    var s = bytes.length - 128;
    var id = String.fromCharCode.apply(null, bytes.slice(s, s + 5));
    if (id !== "SAUCE") return null;
    function str(off, len) { return cp437Decode(bytes.slice(s + off, s + off + len)).replace(/\s+$/, ""); }
    var comments = bytes[s + 104], list = [];
    if (comments) {
      var cs = s - comments * 64 - 5;
      if (cs >= 0 && String.fromCharCode.apply(null, bytes.slice(cs, cs + 5)) === "COMNT") {
        for (var i = 0; i < comments; i++) list.push(cp437Decode(bytes.slice(cs + 5 + i * 64, cs + 5 + (i + 1) * 64)).replace(/\s+$/, ""));
      }
    }
    return {
      version: str(5, 2), title: str(7, 35), author: str(42, 20), group: str(62, 20), date: str(82, 8),
      fileSize: bytes[s + 90] | (bytes[s + 91] << 8) | (bytes[s + 92] << 16) | (bytes[s + 93] << 24),
      dataType: bytes[s + 94], fileType: bytes[s + 95],
      columns: bytes[s + 96] | (bytes[s + 97] << 8), rows: bytes[s + 98] | (bytes[s + 99] << 8),
      comments: list
    };
  }

  // Strip SAUCE + EOF so the body can be displayed.
  function stripSauce(bytes) {
    var sa = readSauce(bytes);
    if (!sa) return bytes;
    var end = bytes.length - 128;
    if (sa.comments.length) end -= sa.comments.length * 64 + 5;
    if (end > 0 && bytes[end - 1] === 0x1a) end -= 1;
    return bytes.slice(0, end);
  }

  return {
    render: render, toFile: toFile, readSauce: readSauce, stripSauce: stripSauce,
    cp437Encode: cp437Encode, cp437Decode: cp437Decode, wrap: wrap,
    BOX: BOX, SHADE: SHADE, FONT5: FONT5, logoBlock: logoBlock
  };
});
