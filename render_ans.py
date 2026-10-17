# Render an .ans to PNG with a pixel-accurate 8x16 cell grid, using DejaVu Sans Mono for glyphs.
# Block and shade characters are drawn GEOMETRICALLY (no font), so colours and coverage are exact.
import sys, subprocess, json
from PIL import Image, ImageDraw, ImageFont
VGA=[(0,0,0),(0,0,170),(0,170,0),(0,170,170),(170,0,0),(170,0,170),(170,85,0),(170,170,170),(85,85,85),(85,85,255),(85,255,85),(85,255,255),(255,85,85),(255,85,255),(255,255,85),(255,255,255)]
d=json.loads(subprocess.check_output(["python3","ans_decode_check.py",sys.argv[1]]))
rows,F,B=d["t"],d["f"],d["b"]
CW,CH=int(sys.argv[3]) if len(sys.argv)>3 else 10, int(sys.argv[4]) if len(sys.argv)>4 else 20
W=max(len(r) for r in rows)
im=Image.new("RGB",(W*CW,len(rows)*CH),VGA[0]); dr=ImageDraw.Draw(im)
font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",int(CH*0.78))
def mix(a,b,t): return tuple(round(a[i]*(1-t)+b[i]*t) for i in range(3))
SHADE={"\u2591":0.25,"\u2592":0.5,"\u2593":0.75}
for y,row in enumerate(rows):
    for x,ch in enumerate(row):
        fg,bg=VGA[F[y][x]],VGA[B[y][x]]; x0,y0=x*CW,y*CH; box=[x0,y0,x0+CW-1,y0+CH-1]
        if ch=="\u2588": dr.rectangle(box,fill=fg)
        elif ch in SHADE: dr.rectangle(box,fill=mix(bg,fg,SHADE[ch]))
        elif ch=="\u2580": dr.rectangle(box,fill=bg); dr.rectangle([x0,y0,x0+CW-1,y0+CH//2-1],fill=fg)
        elif ch=="\u2584": dr.rectangle(box,fill=bg); dr.rectangle([x0,y0+CH//2,x0+CW-1,y0+CH-1],fill=fg)
        else:
            dr.rectangle(box,fill=bg)
            if ch!=" ": dr.text((x0,y0),ch,font=font,fill=fg)
im.save(sys.argv[2]); print(sys.argv[2],im.size)
