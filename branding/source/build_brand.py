from pathlib import Path
import json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT=Path(__file__).resolve().parents[1]
NAVY='#142D4E'; ORANGE='#F47721'; CREAM='#FFF2E8'; WHITE='#FFFFFF'
fonts={k:TTFont(p) for k,p in {'heavy':'C:/Windows/Fonts/ariblk.ttf','bold':'C:/Windows/Fonts/arialbd.ttf','regular':'C:/Windows/Fonts/arial.ttf'}.items()}

def txt(s,x,y,size,color=NAVY,width=None,font='heavy',tracking=0):
    f=fonts[font]; gs=f.getGlyphSet(); cmap=f.getBestCmap(); units=f['head'].unitsPerEm
    scale=size/units; advance=0; parts=[]
    for c in s:
        name=cmap[ord(c)]; pen=SVGPathPen(gs); gs[name].draw(pen)
        parts.append(f'<path transform="translate({advance},0)" d="{pen.getCommands()}"/>')
        advance+=gs[name].width+tracking/scale
    natural=(advance-tracking/scale)*scale
    sx=scale if width is None else scale*width/natural
    return f'<g fill="{color}" transform="translate({x},{y}) scale({sx},{-scale})">'+''.join(parts)+'</g>'

def raster(name,x,y,w,h,mode='color'):
    import base64
    data=base64.b64encode((ROOT/'source'/'derived'/f'{name}-{mode}.png').read_bytes()).decode()
    return f'<image x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid meet" xlink:href="data:image/png;base64,{data}"/>'

def mark(x=0,y=0,size=300,mode='color'):
    return raster('mark',x,y,size,size,mode)

def primary(mode='color',descriptor=True):
    if descriptor:
        return raster('primary',20,0,1200,360,mode)
    return mark(30,25,270,mode)+raster('wordmark',345,25,865,270,mode)

def svg(w,h,body,bg=None):
    return f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><title>Dwight\'s Gutters</title>'+(f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else '')+body+'</svg>'

assets=[]
def save(name,w,h,body,bg=None,png_width=3600):
    p=ROOT/(name+'.svg'); p.parent.mkdir(parents=True,exist_ok=True); p.write_text(svg(w,h,body,bg),encoding='utf-8')
    assets.append({'svg':name+'.svg','png':name+'.png','width':png_width,'viewBox':[w,h]})

for mode in ['color','navy','white']:
    save('logos/dwights-gutters-primary-'+mode,1240,360,primary(mode),png_width=4960)
    save('logos/dwights-gutters-compact-'+mode,1240,310,primary(mode,False).replace('translate(30,30) scale(1.0)','translate(55,30) scale(0.8333333333333334)'),png_width=3720)
    save('marks/dwights-gutters-mark-'+mode,360,360,mark(30,30,300,mode),png_width=2160)
    a,b=(NAVY,ORANGE) if mode=='color' else ((WHITE,WHITE) if mode=='white' else (NAVY,NAVY))
    stacked=mark(250,35,300,mode)+raster('wordmark',65,365,670,230,mode)+raster('descriptor',80,610,640,40,mode)
    save('logos/dwights-gutters-stacked-'+mode,800,690,stacked,png_width=3200)

save('web/social-avatar-light',1024,1024,mark(192,192,640),CREAM,png_width=2048)
save('web/social-avatar-navy',1024,1024,mark(192,192,640,'white'),NAVY,png_width=2048)
save('web/favicon',64,64,mark(4,4,56),png_width=512)
header='<g transform="translate(30,20) scale(.35)">'+primary()+'</g>'+txt('dwightsgutters.com',1080,92,24,NAVY,font='bold')+f'<rect y="168" width="1500" height="4" fill="{ORANGE}"/>'
save('web/website-header',1500,172,header,WHITE,png_width=3000)

# Business card: 3.75 x 2.25 inches including 0.125 inch bleed.
front='<g transform="translate(56,64) scale(.514)">'+primary()+'</g>'+txt('dwightsgutters.com',0,350,27,NAVY,400,'bold')
# Center the outlined URL independently.
front=front.replace('translate(0,350)','translate(175,350)')+f'<rect x="75" y="394" width="600" height="6" fill="{ORANGE}"/>'
back=mark(295,62,160,'white')+txt('GUTTER CLEANING',145,300,32,WHITE,460,'bold',5)+txt('dwightsgutters.com',175,360,27,WHITE,400,'bold')
save('print/business-card-front-bleed',750,450,front,WHITE,png_width=2250)
save('print/business-card-back-bleed',750,450,back,NAVY,png_width=2250)
save('print/business-card-front',700,400,'<g transform="translate(-25,-25)">'+front+'</g>',WHITE,png_width=2100)
save('print/business-card-back',700,400,'<g transform="translate(-25,-25)">'+back+'</g>',NAVY,png_width=2100)

# Refined brand sheet built from the same exact vector master as all exported assets.
b=txt("DWIGHT'S GUTTERS",65,70,32,NAVY,font='heavy')+txt('CLEAN & PROFESSIONAL / REFINED IDENTITY',65,106,16,NAVY,font='regular',tracking=2)
b+=f'<path d="M65 135H1535" stroke="{NAVY}" stroke-opacity=".15"/>'
b+='<g transform="translate(55,165) scale(.83)">'+primary()+'</g>'
b+=txt('PRIMARY LOGO',75,495,14,NAVY,font='bold',tracking=2)
b+=mark(1230,210,200)+txt('STANDALONE MARK',1190,461,14,NAVY,font='bold',tracking=1)
for i,(name,hexv) in enumerate([('NAVY',NAVY),('SAFETY ORANGE',ORANGE),('CREAM',CREAM),('WHITE',WHITE)]):
    x=65+i*375
    b+=f'<rect x="{x}" y="545" width="345" height="100" rx="8" fill="{hexv}" stroke="#D8E0E8"/>'
    b+=txt(name,x,675,16,NAVY,font='bold')+txt(hexv,x,702,16,NAVY,font='regular')
b+=f'<rect x="65" y="755" width="710" height="245" rx="8" fill="{CREAM}"/><rect x="805" y="755" width="730" height="245" rx="8" fill="{NAVY}"/>'
b+='<g transform="translate(90,780) scale(.53)">'+primary('navy')+'</g>'
b+='<g transform="translate(840,780) scale(.53)">'+primary('white')+'</g>'
b+=txt('ONE COLOR / NAVY',65,1034,14,NAVY,font='bold',tracking=1)+txt('REVERSED / WHITE',805,1034,14,NAVY,font='bold',tracking=1)
b+=txt('dwightsgutters.com',65,1110,23,NAVY,font='bold')+txt('APPROVED ARTWORK  /  OCTOBER 2026',1150,1110,13,NAVY,font='regular',tracking=1)
save('brand-sheet',1600,1160,b,WHITE,png_width=4000)

(ROOT/'source'/'exports.json').write_text(json.dumps(assets,indent=2))
(ROOT/'palette.json').write_text(json.dumps({'name':"Dwight's Gutters",'colors':{'navy':NAVY,'safety_orange':ORANGE,'cream':CREAM,'white':WHITE}},indent=2))
(ROOT/'palette.css').write_text(':root {\n  --dwights-navy: #142D4E;\n  --dwights-orange: #F47721;\n  --dwights-cream: #FFF2E8;\n  --dwights-white: #FFFFFF;\n}\n')
print(f'Created {len(assets)} assets using approved raster artwork.')
