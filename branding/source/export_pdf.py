from pathlib import Path
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF
from reportlab.pdfgen import canvas
import fitz

root=Path(__file__).resolve().parents[1]

def draw_svg(c,path,w,h):
    # PNG render contains the exact approved raster artwork and outlined support type.
    c.drawImage(str(path.with_suffix('.png')),0,0,width=w,height=h,mask='auto')

out=root/'brand-sheet.pdf'
c=canvas.Canvas(str(out),pagesize=(1000,725))
c.setTitle("Dwight's Gutters - refined brand sheet")
draw_svg(c,root/'brand-sheet.svg',1000,725)
c.showPage(); c.save()

out=root/'print/business-cards.pdf'
c=canvas.Canvas(str(out),pagesize=(270,162))
c.setTitle("Dwight's Gutters - business card front and back")
for face in ['front','back']:
    c.setTrimBox((9,9,261,153))
    c.setBleedBox((0,0,270,162))
    draw_svg(c,root/f'print/business-card-{face}-bleed.svg',270,162)
    c.showPage()
c.save()

qa=root/'source/qa'; qa.mkdir(exist_ok=True)
for name in ['brand-sheet.pdf','print/business-cards.pdf']:
    doc=fitz.open(root/name)
    for i,p in enumerate(doc):
        p.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(str(qa/f'{Path(name).stem}-{i+1}.png'))
        assert p.get_images(), 'Expected approved raster artwork'
    print(name, len(doc), 'pages; approved raster master; rendered for review')
