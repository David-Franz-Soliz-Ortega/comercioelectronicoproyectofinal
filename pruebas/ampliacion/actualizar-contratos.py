"""Coordina OpenAPI con los campos y endpoints nuevos. No conecta a bases de datos."""
import json
from pathlib import Path
raiz=Path(__file__).resolve().parents[2]
uuid={'type':'string','format':'uuid'}
sector={'type':'object','additionalProperties':False,'required':['codigo','nombre','pesoBps'],'properties':{'codigo':{'type':'string','pattern':'^[a-z][a-z0-9-]{0,31}$'},'nombre':{'type':'string','maxLength':80},'pesoBps':{'type':'integer','minimum':0,'maximum':10000,'description':'Centésimas de porcentaje; con ponderación la suma debe ser 10000'}}}
regla={'type':['object','null'],'additionalProperties':False,'required':['modo','umbral','estricto'],'properties':{'modo':{'enum':['porcentaje','por_sector']},'umbral':{'type':'number','exclusiveMinimum':0,'exclusiveMaximum':100},'estricto':{'type':'boolean'}}}
proceso={'type':'object','additionalProperties':False,'required':['nombre','cargo','tipo','unidad'],'properties':{'nombre':{'type':'string','minLength':1,'maxLength':120},'cargo':{'type':'string','minLength':1,'maxLength':100},'tipo':{'enum':['universidad','municipio','otra']},'unidad':{'type':'string','minLength':1,'maxLength':80},'ambito':{'type':'string','maxLength':160,'default':''},'vuelta':{'type':'integer','enum':[1,2],'default':1},'idPrimeraVuelta':{'type':['string','null'],'format':'uuid'},'sectores':{'type':'array','maxItems':10,'items':sector,'default':[]},'ponderacion':{'type':'boolean','default':False},'reglaSegundaVuelta':regla}}
mesa={'type':'object','additionalProperties':False,'required':['codigo','unidad'],'properties':{'codigo':{'type':'string','minLength':1,'maxLength':60},'unidad':{'type':'string','minLength':1,'maxLength':120},'sector':{'type':'string','maxLength':32,'default':'general'}}}
def cuerpo(esquema):return {'required':True,'content':{'application/json':{'schema':esquema}}}
def operacion(resumen,parametros=[],esquema=None,publica=False,binaria=False):
 o={'summary':resumen,'parameters':parametros,'responses':{str(c):{'description':d} for c,d in [(200,'Operación o vista previa completada'),(201,'Lote importado íntegramente'),(401,'Sesión requerida'),(403,'Rol u organización no autorizados'),(404,'No disponible'),(409,'Conflicto; no se sobrescriben datos ni se importa parcialmente'),(422,'Archivo, campos o reglas inválidos')]}}
 if not publica:o['security']=[{'sesion':[]}]
 if esquema is not None:o['requestBody']=cuerpo(esquema)
 if binaria:o['responses']['200']={'description':'Plantilla XLSX, una hoja, máximo 2 MB al importar','content':{'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':{'schema':{'type':'string','format':'binary'}}}}
 return o
id_param={'name':'id','in':'path','required':True,'schema':uuid}
tipo_param={'name':'tipo','in':'path','required':True,'schema':{'enum':['candidatos','mesas','asignaciones']}}
entrada={'type':'object','additionalProperties':False,'required':['archivo'],'properties':{'archivo':{'type':'string','format':'byte','maxLength':2800000,'writeOnly':True},'huella':{'type':'string','pattern':'^[a-f0-9]{64}$'},'confirmar':{'type':'boolean'}}}
for nombre in ('identidad','elecciones'):
 archivo=raiz/'compartido/contratos/openapi'/f'{nombre}.openapi.json';doc=json.loads(archivo.read_text());doc['info']['version']='0.2.0'
 if nombre=='elecciones':
  doc.setdefault('components',{}).setdefault('schemas',{}).update({'ProcesoEntrada':proceso,'MesaEntrada':mesa,'Sector':sector,'ReglaSegundaVuelta':regla})
  doc['paths']['/configuracion/procesos']['post']['requestBody']=cuerpo(proceso)
  doc['paths']['/configuracion/procesos/{id}']['put']['requestBody']=cuerpo(proceso)
  doc['paths']['/configuracion/procesos/{id}/mesas']['post']['requestBody']=cuerpo(mesa)
  doc['paths']['/configuracion/procesos/{id}/candidatos']['post']['requestBody']=cuerpo({'type':'object','additionalProperties':False,'properties':{'nombre':{'type':'string','maxLength':120},'foto':{'type':'string','maxLength':2800000,'description':'Data URL JPEG/PNG, máximo 2 MB'},'idCandidatoOrigen':{**uuid,'description':'Obligatorio en segunda vuelta; participante de la primera'}}})
  doc['paths']['/configuracion/procesos/{id}/asignaciones']={'get':operacion('Consultar asignaciones persistidas de la elección',[id_param])}
  doc['paths']['/publico/eventos']={'get':operacion('Catálogo público de cargos agrupados por evento y organización; excluye borradores y archivados',publica=True)}
  doc['paths']['/publico/elecciones']={'get':operacion('Elecciones publicadas de la organización destacada',publica=True)}
  doc['paths']['/publico/procesos/{id}']={'get':operacion('Configuración pública por elección publicada',[id_param],publica=True)}
  doc['paths']['/configuracion/procesos/{id}/reiniciar']={'post':operacion('Archivar intento cerrado y copiar configuración a un nuevo borrador sin actas; solo administrador',[id_param],{'type':'object','required':['confirmar'],'additionalProperties':False,'properties':{'confirmar':{'const':True}}})}
  doc['paths']['/configuracion/procesos/{id}/estado']={'post':operacion('Cerrar recepción o archivar; sin reapertura, con auditoría y bloqueo de registros en curso',[id_param],{'type':'object','additionalProperties':False,'required':['estado','confirmar'],'properties':{'estado':{'enum':['cerrada','archivada']},'confirmar':{'const':True}}})}
  doc['paths']['/configuracion/procesos/{id}/historial']={'get':operacion('Historial persistente de estados',[id_param])}
  doc['paths']['/configuracion/procesos/{id}/actual']['post']['requestBody']=cuerpo({'type':'object','required':['confirmar'],'properties':{'confirmar':{'const':True}},'additionalProperties':False})
  doc['paths']['/configuracion/procesos/{id}']['delete']['summary']='Retirar exclusivamente un borrador; eliminación lógica, sin borrar registros'
  doc['components']['schemas']['EstadoEleccion']={'type':'string','enum':['borrador','recepcion','cerrada','archivada']}
  base='/configuracion/procesos/{id}/importaciones/{tipo}';parametros=[id_param,tipo_param];schema=entrada
 else:
  base='/importaciones/operadores';parametros=[{'name':'X-Organizacion','in':'header','required':True,'schema':uuid}]
  schema={**entrada,'required':['archivo','idOrganizacion'],'properties':{**entrada['properties'],'idOrganizacion':uuid}}
  doc['paths']['/usuarios']['get']['parameters']=[{'name':n,'in':'query','schema':s} for n,s in [('pagina',{'type':'integer','minimum':1,'default':1}),('limite',{'type':'integer','minimum':1,'maximum':100,'default':100}),('usuario',{'type':'string'}),('idUsuario',uuid)]]
 doc['paths'][base+'/plantilla']={'get':operacion('Descargar plantilla XLSX',parametros,binaria=True)}
 doc['paths'][base+'/previsualizar']={'post':operacion('Validar archivo sin escribir; contraseñas siempre ocultas',parametros,schema)}
 doc['paths'][base+'/confirmar']={'post':operacion('Confirmar mismo archivo y huella; todo o nada, sin sobrescribir',parametros,schema)}
 archivo.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
