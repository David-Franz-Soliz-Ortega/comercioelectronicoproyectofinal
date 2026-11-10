"""Maquetación SVG local del C4 de contenedores; no consulta servicios ni datos."""
from pathlib import Path
from html import escape

azul='#2171b5'; gris='#82918f'; sql='#32734f'; mongo='#8656a4'; amqp='#b87d17'; grpc='#bc5d31'; redis='#278b92'
piezas=['''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1040 890" role="img" aria-labelledby="titulo descripcion"><title id="titulo">SIGAPE: C4 nivel 2, quince contenedores permanentes</title><desc id="descripcion">Entrada NGINX, frontend, BFF, seis API, dos consumidores y cuatro almacenes o intermediarios. Conexiones REST, gRPC, SQL, MongoDB, Redis y AMQP.</desc><defs>''']
for nombre,color in [('rest',azul),('publico',gris),('sql',sql),('mongo',mongo),('amqp',amqp),('grpc',grpc),('redis',redis)]:
 piezas.append(f'<marker id="{nombre}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7Z" fill="{color}"/></marker>')
piezas.append('</defs><rect width="1040" height="890" fill="white"/><rect x="5" y="29" width="1030" height="851" rx="10" fill="none" stroke="#7c8c86" stroke-dasharray="7 5"/><text x="520" y="22" text-anchor="middle" font-family="Arial" font-size="19" font-weight="bold" fill="#233e35">SIGAPE · C4 nivel 2 · Docker Compose</text>')
def texto(x,y,contenido,tamano=14,color='#243e35',peso='normal'):
 piezas.append(f'<text x="{x}" y="{y}" text-anchor="middle" font-family="Arial" font-size="{tamano}" font-weight="{peso}" fill="{color}">{escape(contenido)}</text>')
def ruta(datos,tipo,final=True):
 color={'rest':azul,'publico':gris,'sql':sql,'mongo':mongo,'amqp':amqp,'grpc':grpc,'redis':redis}[tipo]
 piezas.append(f'<path d="{datos}" fill="none" stroke="{color}" stroke-width="2"'+(f' marker-end="url(#{tipo})"' if final else '')+'/>')
def contenedor(x,y,ancho,nombre,tecnologia,tipo='Container',alto=90):
 fondo='#377fb6' if tipo=='Container' else '#edf4f1' if tipo=='ContainerDb' else '#fbf2df'
 tinta='white' if tipo=='Container' else '#244b3d'
 piezas.append(f'<rect x="{x}" y="{y}" width="{ancho}" height="{alto}" rx="8" fill="{fondo}" stroke="#326747" stroke-width="1"/>')
 texto(x+ancho/2,y+17,'«'+tipo+'»',11,tinta)
 texto(x+ancho/2,y+44,nombre,18,tinta,'bold')
 texto(x+ancho/2,y+69,tecnologia,14,tinta)
# Leyenda de protocolo; las conexiones se trazan antes que los nodos.
for x,titulo,color in [(95,'REST público',gris),(260,'REST BFF',azul),(420,'gRPC',grpc),(550,'SQL',sql),(680,'MongoDB',mongo),(820,'AMQP',amqp),(955,'Redis',redis)]:
 piezas.append(f'<path d="M{x-40} 61 H{x-22}" stroke="{color}" stroke-width="3"/>'); texto(x+20,66,titulo,14,color)
# Presentación y origen único.
ruta('M420 137 H320','publico');texto(370,121,'HTTP',14,gris)
ruta('M600 137 H700','rest');texto(650,121,'/graphql',14,azul)
# Las API públicas comparten la entrada; el BFF agrega solo tres productores.
ruta('M510 175 V260 H85','publico',False);ruta('M510 260 H935','publico',False)
for x in (85,255,425,595,765,935):ruta(f'M{x} 260 V300','publico')
ruta('M790 175 V222 H265','rest',False)
for x in (265,435,605):ruta(f'M{x} 222 V300','rest')
texto(190,248,'REST de seis API',14,gris);texto(495,210,'REST de tres productores',14,azul)
# gRPC entre elecciones y padrón.
ruta('M325 345 H355','grpc');texto(340,412,'gRPC :50051',14,grpc)
# Propiedad de persistencia: cada arista SQL usa la base de su propietario.
ruta('M85 390 V520','sql');ruta('M255 390 V520','sql')
ruta('M425 390 V470 H300 V520','sql')
ruta('M725 390 V453 H344 V565 H320','sql')
texto(170,493,'Cuatro bases propietarias',14,sql)
# MongoDB y caché.
ruta('M595 390 V520','mongo');ruta('M935 390 V430 H680 V565 H665','mongo')
ruta('M765 390 V520','redis');texto(795,489,'TTL 60 s',14,redis)
# Publicación y consumidores independientes.
ruta('M805 390 V491 H945 V520','amqp');texto(916,475,'Evento v1',14,amqp)
ruta('M920 615 V660 H675 V735','amqp');ruta('M980 615 V697 H910 V735','amqp')
texto(780,648,'AMQP · ACK manual',14,amqp)
# Ambas proyecciones pertenecen a resultados_db, colecciones separadas.
ruta('M580 780 H540 V615','mongo');ruta('M910 825 V854 H480 V615','mongo')
texto(275,808,'resultados_db · dos colecciones únicas por idEvento',14,mongo)
# Quince unidades desplegadas, cada una identificada como contenedor C4.
contenedor(420,95,180,'Entrada','NGINX 1.29',alto=80)
contenedor(140,95,180,'Frontend','React / NGINX',alto=80)
contenedor(700,95,180,'BFF','Node.js / GraphQL',alto=80)
for x,nombre,tec in [(15,'Identidad','Node.js / TS'),(185,'Elecciones','Node.js / TS'),(355,'Padrón','Node.js / TS'),(525,'Candidaturas','FastAPI / Python'),(695,'Votación','Go'),(865,'Resultados API','FastAPI / Python')]:
 contenedor(x,300,140,nombre,tec)
contenedor(20,520,300,'PostgreSQL 17','4 bases lógicas','ContainerDb',95)
contenedor(395,520,270,'MongoDB 8','2 bases lógicas','ContainerDb',95)
contenedor(710,520,135,'Redis 7','Caché','ContainerDb',95)
contenedor(880,520,140,'RabbitMQ 4','2 colas + 2 DLQ','ContainerQueue',95)
contenedor(580,735,190,'Conteo','Python / Pika')
contenedor(815,735,190,'Auditoría técnica','Python / Pika')
piezas.append('</svg>')
Path(__file__).with_suffix('.svg').write_text(''.join(piezas),encoding='utf8')
