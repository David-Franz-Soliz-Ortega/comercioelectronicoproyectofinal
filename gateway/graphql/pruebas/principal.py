"""Pruebas HTTP reales por localhost:8080; conserva todos los datos sintéticos."""
import json
from pathlib import Path
import subprocess
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

BASE = 'http://localhost:8080'
PREFIJO = 'Prueba sintética BFF ' + str(uuid4())
EVIDENCIA = {'prefijo': PREFIJO, 'comprobaciones': []}


def solicitar(ruta, cuerpo=None, correlacion=None):
    cabeceras = {'Content-Type': 'application/json'}
    if correlacion:
        cabeceras['X-Correlation-ID'] = correlacion
    solicitud = Request(BASE + ruta, data=None if cuerpo is None else json.dumps(cuerpo).encode(), headers=cabeceras)
    try:
        respuesta = urlopen(solicitud, timeout=25)
    except HTTPError as error:
        respuesta = error
    with respuesta:
        return respuesta.status, json.loads(respuesta.read())


def graphql(consulta, variables=None, correlacion=None):
    codigo, cuerpo = solicitar('/graphql', {'query': consulta, 'variables': variables or {}}, correlacion)
    assert codigo == 200 and 'errors' not in cuerpo, (codigo, cuerpo)
    return cuerpo['data']


def comprobar(descripcion):
    EVIDENCIA['comprobaciones'].append(descripcion)
    print('OK:', descripcion, flush=True)


def metricas(correlacion):
    for _ in range(15):
        salida = subprocess.run(['docker', 'compose', 'logs', '--no-color', '--since', '10m', 'gateway-graphql'],
                                check=True, capture_output=True, text=True).stdout
        for linea in salida.splitlines():
            if '{' not in linea:
                continue
            try:
                registro = json.loads(linea[linea.index('{'):])
            except json.JSONDecodeError:
                continue
            if registro.get('evento') == 'operacion_graphql' and registro.get('idCorrelacion') == correlacion:
                return registro['llamadas']
        time.sleep(0.2)
    raise AssertionError('No se encontró evidencia de llamadas REST correlacionadas')


def principal():
    for servicio in ('identidad', 'elecciones', 'candidaturas', 'padron-electoral', 'votacion', 'resultados', 'graphql'):
        assert solicitar('/api/v1/salud/' + servicio)[0] == 200
    comprobar('siete endpoints de salud responden 200 por localhost:8080')
    with urlopen(BASE + '/graphql/esquema.graphql', timeout=8) as respuesta:
        assert b'type Mutation' in respuesta.read()

    resultado = graphql('''mutation($uno:NuevaEleccion!, $dos:NuevaEleccion!) {
      uno: crearEleccion(entrada:$uno) {idEleccion nombre estado}
      dos: crearEleccion(entrada:$dos) {idEleccion nombre estado}
    }''', {'uno': {'nombre': PREFIJO + ' A', 'estado': 'borrador'},
           'dos': {'nombre': PREFIJO + ' B', 'estado': 'borrador'}})
    ids = [resultado['uno']['idEleccion'], resultado['dos']['idEleccion']]
    EVIDENCIA['elecciones'] = ids
    comprobar('mutation crearEleccion persiste dos elecciones sintéticas mediante su API real')
    relacionadas = graphql('''mutation($a:NuevaCandidatura!, $b:NuevaCandidatura!, $i:NuevaInscripcion!, $j:NuevaInscripcion!) {
      a: crearCandidatura(entrada:$a) {idCandidatura idEleccion nombre}
      b: crearCandidatura(entrada:$b) {idCandidatura idEleccion nombre}
      i: crearInscripcion(entrada:$i) {idInscripcion idEleccion elegible}
      j: crearInscripcion(entrada:$j) {idInscripcion idEleccion elegible}
    }''', {'a': {'idEleccion': ids[0], 'nombre': PREFIJO + ' A', 'tipo': 'individual', 'estado': 'borrador'},
           'b': {'idEleccion': ids[1], 'nombre': PREFIJO + ' B', 'tipo': 'lista', 'estado': 'borrador'},
           'i': {'idEleccion': ids[0], 'elegible': True}, 'j': {'idEleccion': ids[1], 'elegible': False}})
    EVIDENCIA['relacionadas'] = relacionadas
    for id_eleccion in ids:
        assert solicitar('/api/v1/elecciones/' + id_eleccion)[0] == 200
    for clave in ('a', 'b'):
        assert solicitar('/api/v1/candidaturas/' + relacionadas[clave]['idCandidatura'])[0] == 200
    for clave in ('i', 'j'):
        assert solicitar('/api/v1/inscripciones/' + relacionadas[clave]['idInscripcion'])[0] == 200
    comprobar('mutations candidaturas/padrón verificadas también por REST; sin datos personales')

    correlacion = 'prueba-bff-' + str(uuid4())
    agregado = graphql('''query($nombre:String!){ elecciones(nombre:$nombre,limite:2) {
      total elementos { idEleccion nombre
        candidaturas { total elementos { nombre eleccion { idEleccion } } }
        repetidas:candidaturas { total }
        inscripciones { total elementos { elegible eleccion { idEleccion } } }
      }
    }}''', {'nombre': PREFIJO}, correlacion)
    assert agregado['elecciones']['total'] == 2
    for fila in agregado['elecciones']['elementos']:
        assert fila['candidaturas']['total'] == fila['inscripciones']['total'] == fila['repetidas']['total'] == 1
        assert fila['candidaturas']['elementos'][0]['eleccion']['idEleccion'] == fila['idEleccion']
        assert fila['inscripciones']['elementos'][0]['eleccion']['idEleccion'] == fila['idEleccion']
    llamadas = metricas(correlacion)
    # La cantidad depende de páginas del contrato REST, no de los padres GraphQL.
    _, candidaturas = solicitar('/api/v1/candidaturas?limite=100')
    _, inscripciones = solicitar('/api/v1/inscripciones?limite=100')
    esperadas = {'elecciones': 1, 'candidaturas': max(1, (candidaturas['total'] + 99) // 100),
                 'padron': max(1, (inscripciones['total'] + 99) // 100)}
    assert llamadas == esperadas, (llamadas, esperadas)
    EVIDENCIA['llamadasConsultaAgregada'] = llamadas
    comprobar('query agrega tres microservicios; DataLoader agrupa relaciones y evita lecturas por cada padre/alias')

    correlacion_ids = 'prueba-bff-' + str(uuid4())
    por_ids = graphql('''query($ids:[ID!]!){eleccionesPorIds(ids:$ids){idEleccion
      candidaturas{total} inscripciones{total}}}''', {'ids': [ids[1], ids[0], ids[1]]}, correlacion_ids)
    assert [fila['idEleccion'] for fila in por_ids['eleccionesPorIds']] == [ids[1], ids[0], ids[1]]
    assert metricas(correlacion_ids) == esperadas
    comprobar('lote por UUID conserva orden y duplicados sin llamadas REST adicionales')

    candidatura = graphql('''query($id:ID!){candidaturas(idEleccion:$id){elementos{
      idEleccion eleccion {nombre inscripciones{total}}
    }} inscripciones(idEleccion:$id){elementos{elegible eleccion{idEleccion}}}}''', {'id': ids[0]})
    assert candidatura['candidaturas']['elementos'][0]['eleccion']['nombre'] == PREFIJO + ' A'
    assert graphql('query($id:ID!){eleccion(idEleccion:$id){idEleccion}}', {'id': str(uuid4())})['eleccion'] is None
    assert solicitar('/graphql')[0] == 405
    assert solicitar('/graphql', {'query': '{campoInexistente}'})[0] == 400
    codigo, error = solicitar('/graphql', {'query': '{eleccion(idEleccion:"invalido"){nombre}}'})
    assert codigo == 200 and error['errors'][0]['extensions']['code'] == 'ENTRADA_INVALIDA'
    comprobar('queries directas, referencias, UUID inexistente y errores de entrada verificados')

    destino = Path('/tmp/sigape-evidencia-graphql-' + str(uuid4()) + '.json')
    destino.write_text(json.dumps(EVIDENCIA, ensure_ascii=False, indent=2))
    print('Evidencia:', destino, flush=True)
    print(json.dumps({'eleccionesSinteticasConservadas': ids, 'llamadasConsultaAgregada': llamadas}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    principal()
