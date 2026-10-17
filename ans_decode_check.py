# Independent ANSI reader. Written from the ANSI/ECMA-48 SGR table, NOT derived from ansi.js.
# SGR colour number (0-7) -> DOS text attribute colour index. Red is 1 in SGR and 4 in DOS, etc.
import re, json, sys
SGR2DOS = {0: 0, 1: 4, 2: 2, 3: 6, 4: 1, 5: 5, 6: 3, 7: 7}
d = open(sys.argv[1], "rb").read()
# The EOF byte 0x1A ends the art; anything after it is the SAUCE record, not picture data.
if b"\x1a" in d: d = d[:d.index(b"\x1a")]
fg, bg, bold = 7, 0, False
rows = [[]]
i = 0
pat = re.compile(rb"\x1b\[([0-9;]*)m")
while i < len(d):
    m = pat.match(d, i)
    if m:
        for c in (m.group(1).split(b";") if m.group(1) else [b"0"]):
            c = int(c or 0)
            if c == 0: fg, bg, bold = 7, 0, False
            elif c == 1: bold = True
            elif 30 <= c <= 37: fg = SGR2DOS[c - 30]
            elif 40 <= c <= 47: bg = SGR2DOS[c - 40]
        i = m.end(); continue
    if d[i:i + 2] == b"\r\n":
        rows.append([]); i += 2; continue
    rows[-1].append((d[i:i + 1].decode("cp437"), (fg | 8) if bold else fg, bg)); i += 1
rows = [r for r in rows if r]
print(json.dumps({"t": ["".join(c[0] for c in r) for r in rows], "f": [[c[1] for c in r] for r in rows], "b": [[c[2] for c in r] for r in rows]}))
