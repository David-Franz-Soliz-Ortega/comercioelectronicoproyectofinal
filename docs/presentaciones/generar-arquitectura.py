"""Genera un PDF reproducible de ocho páginas. Requiere reportlab==4.4.1."""
from pathlib import Path
from html import escape
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Preformatted

CARPETA=Path(__file__).resolve().parent
texto=(CARPETA/'arquitectura-p1.md').read_text()
secciones=texto.split('\n## ')[1:]
estilos=getSampleStyleSheet();estilos['Normal'].fontSize=10;estilos['Normal'].leading=14
historia=[]
for indice,seccion in enumerate(secciones):
    if indice:historia.append(PageBreak())
    titulo,contenido=seccion.split('\n',1)
    historia.extend([Paragraph('TUVOTO · Arquitectura P1',estilos['Title']),Paragraph(escape(titulo),estilos['Heading2'])])
    if '```mermaid' in contenido:
        antes,resto=contenido.split('```mermaid',1);diagrama,despues=resto.split('```',1)
        # La representación PDF conserva explícitamente los nodos y relaciones C4.
        for bloque in [antes,despues]:
            if bloque.strip():historia.extend([Paragraph(escape(bloque.strip()),estilos['Normal']),Spacer(1,10)])
        dibujo=Drawing(510,390 if indice==1 else 210)
        nodos=([('Navegador React',175,350),('NGINX',175,295),('Frontend',15,240),('GraphQL',175,240),('Identidad',15,170),('Elecciones',135,170),('Actas',255,170),('Resultados',375,170),('PG identidad',15,100),('PG elecciones',135,100),('PG actas/outbox',255,100),('MongoDB/Redis',375,100),('RabbitMQ',255,35),('Conteo / auditoría',375,35)] if indice==1 else [('Administrador',5,160),('Operador',135,160),('Auditor',265,160),('Público',395,160),('TUVOTO',200,60)])
        for nombre,x,y in nodos:
            dibujo.add(Rect(x,y,105,35,rx=4,fillColor=colors.HexColor('#DBEAFE'),strokeColor=colors.HexColor('#123B70')))
            dibujo.add(String(x+52,y+14,nombre,textAnchor='middle',fontSize=8,fillColor=colors.HexColor('#123B70')))
        enlaces=([(0,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),(3,5),(3,6),(3,7),(4,8),(5,9),(6,10),(7,11),(6,5),(6,12),(12,13),(13,11)] if indice==1 else [(0,4),(1,4),(2,4),(3,4)])
        for origen,destino in enlaces:
            _,x,y=nodos[origen];_,xx,yy=nodos[destino]
            if abs(x-xx)>abs(y-yy)*1.3:
                origen_x=x+(105 if xx>x else 0);destino_x=xx+(0 if xx>x else 105)
                dibujo.add(Line(origen_x,y+17,destino_x,yy+17,strokeColor=colors.HexColor('#2563EB'),strokeWidth=.7))
                signo=1 if xx>x else -1
                dibujo.add(Polygon([destino_x,yy+17,destino_x-signo*5,yy+14,destino_x-signo*5,yy+20],fillColor=colors.HexColor('#2563EB'),strokeColor=None))
            else:
                origen_y=y if yy<y else y+35;destino_y=yy+35 if yy<y else yy
                dibujo.add(Line(x+52,origen_y,xx+52,destino_y,strokeColor=colors.HexColor('#2563EB'),strokeWidth=.7))
                signo=1 if yy<y else -1
                dibujo.add(Polygon([xx+52,destino_y,xx+49,destino_y+signo*5,xx+55,destino_y+signo*5],fillColor=colors.HexColor('#2563EB'),strokeColor=None))
        historia.append(dibujo)
    else:
        for parrafo in contenido.strip().split('\n\n'):
            historia.extend([Paragraph(escape(parrafo),estilos['Normal']),Spacer(1,10)])
def pie(lienzo,_doc):
    lienzo.setFont('Helvetica',8);lienzo.setFillColor(colors.HexColor('#123B70'))
    lienzo.drawString(40,25,'Diseño académico · demostración local · verificar evidencias en requisitos.md')
    lienzo.drawRightString(A4[0]-40,25,str(lienzo.getPageNumber()))
SimpleDocTemplate(str(CARPETA/'arquitectura-p1.pdf'),pagesize=A4,leftMargin=40,rightMargin=40,topMargin=35,bottomMargin=40).build(historia,onFirstPage=pie,onLaterPages=pie)
