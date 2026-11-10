"""Integración aditiva gRPC; conserva registros, bases y volúmenes existentes."""
import json
from pathlib import Path
import subprocess
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

RAIZ = Path(__file__).resolve().parents[3]
BASE = 'http://localhost:8080'
PREFIJO = 'Prueba sintética gRPC ' + str(uuid4())


def pedir(ruta, datos=None, cabeceras=None):
    solicitud = Request(BASE + ruta, data=None if datos is None else json.dumps(datos).encode(),
                        headers={'Content-Type': 'application/json', **(cabeceras or {})})
    try:
        respuesta = urlopen(solicitud, timeout=10)
    except HTTPError as error:
        respuesta = error
    with respuesta:
        return respuesta.status, json.loads(respuesta.read())


def ejecutar(argumentos, **opciones):
    return subprocess.run(argumentos, cwd=RAIZ, check=True, text=True, **opciones)


def esperar(condicion, descripcion):
    limite = time.monotonic() + 90
    while time.monotonic() < limite:
        if condicion():
            print('OK:', descripcion, flush=True)
            return
        time.sleep(1)
    raise AssertionError('Plazo agotado: ' + descripcion)


def comprobar_salud():
    for servicio in ('identidad', 'elecciones', 'candidaturas', 'padron-electoral', 'votacion', 'resultados', 'graphql'):
        assert pedir('/api/v1/salud/' + servicio)[0] == 200, servicio


def registros_grpc(servicio, correlacion):
    resultado = ejecutar(['docker', 'compose', 'logs', '--no-color', '--since', '10m', servicio], capture_output=True)
    encontrados = []
    for linea in resultado.stdout.splitlines():
        if '{' not in linea:
            continue
        try:
            dato = json.loads(linea[linea.index('{'):])
        except json.JSONDecodeError:
            continue
        if dato.get('idCorrelacion') == correlacion:
            encontrados.append(dato)
    return encontrados


def principal():
    comprobar_salud()
    recursos = ('elecciones', 'inscripciones', 'identidades', 'candidaturas')
    antes = {recurso: pedir('/api/v1/' + recurso + '?limite=1')[1]['total'] for recurso in recursos}
    ids_eleccion = []
    for sufijo in (' A', ' B'):
        codigo, fila = pedir('/api/v1/elecciones', {'nombre': PREFIJO + sufijo, 'estado': 'borrador'})
        assert codigo == 201
        ids_eleccion.append(fila['idEleccion'])
    inscripciones = []
    for elegible in (True, False):
        codigo, fila = pedir('/api/v1/inscripciones', {'idEleccion': ids_eleccion[0], 'elegible': elegible})
        assert codigo == 201
        inscripciones.append(fila['idInscripcion'])
    ruta = '/api/v1/elecciones/' + ids_eleccion[0] + '/inscripciones/'
    correlacion = 'prueba-grpc-' + str(uuid4())
    for indice, id_inscripcion in enumerate(inscripciones):
        codigo, fila = pedir(ruta + id_inscripcion + '/elegibilidad', cabeceras={'X-Correlation-ID': correlacion})
        assert codigo == 200 and fila['elegible'] == (indice == 0)
        assert fila['idCorrelacion'] == correlacion
    esperar(lambda: any(r.get('codigoGrpc') == 0 for r in registros_grpc('elecciones', correlacion)) and
            any(r.get('codigoGrpc') == 0 for r in registros_grpc('padron-electoral', correlacion)),
            'NGINX → elecciones → gRPC padrón → PostgreSQL propio; elegible y no elegible con correlación')
    codigo, error = pedir(ruta + str(uuid4()) + '/elegibilidad')
    assert codigo == 404 and error['codigoGrpc'] == 5 and error['estadoGrpc'] == 'NOT_FOUND'
    codigo, error = pedir('/api/v1/elecciones/' + ids_eleccion[1] + '/inscripciones/' + inscripciones[0] + '/elegibilidad')
    assert codigo == 409 and error['codigoGrpc'] == 9 and error['estadoGrpc'] == 'FAILED_PRECONDITION'
    assert pedir(ruta + 'invalido/elegibilidad')[0] == 400
    print('OK: NOT_FOUND → HTTP 404, FAILED_PRECONDITION → HTTP 409 y validación REST 400', flush=True)

    composicion = ['docker', 'compose', '-f', str(RAIZ / 'docker-compose.yml'), '-f',
                   str(RAIZ / 'microservicios/elecciones/pruebas/compose.grpc.yml'), '--profile', 'pruebas-grpc']
    try:
        ejecutar(composicion + ['up', '-d', '--no-deps', 'padron-grpc-pruebas'])
        programa = (RAIZ / 'microservicios/elecciones/pruebas/entre-contenedores.mjs').read_text()
        ejecutar(['docker', 'compose', 'exec', '-T', '-e', 'PRUEBA_ELECCION=' + ids_eleccion[0], '-e',
                  'PRUEBA_INSCRIPCION=' + inscripciones[0], 'elecciones', 'node', '--input-type=module'], input=programa)
    finally:
        # Solo se detiene el doble de pruebas; no se elimina ningún contenedor/volumen.
        ejecutar(composicion + ['stop', 'padron-grpc-pruebas'])

    codigo, consulta = pedir('/graphql', {'query': 'query($nombre:String!){elecciones(nombre:$nombre){total elementos{idEleccion inscripciones{total} candidaturas{total}}}}', 'variables': {'nombre': PREFIJO}})
    assert codigo == 200 and 'errors' not in consulta and consulta['data']['elecciones']['total'] == 2
    assert sum(fila['inscripciones']['total'] for fila in consulta['data']['elecciones']['elementos']) == 2
    print('OK: GraphQL y DataLoader continúan agregando elecciones, padrón y candidaturas reales', flush=True)

    codigo, evento = pedir('/api/v1/votos', {'idEleccion': ids_eleccion[0]}, {'Idempotency-Key': str(uuid4())})
    assert codigo == 201
    def verificar_resultados():
        a, conteo = pedir('/api/v1/resultados/' + ids_eleccion[0])
        b, auditoria = pedir('/api/v1/resultados/' + ids_eleccion[0] + '/auditoria')
        return a == b == 200 and conteo['totalRegistros'] == auditoria['totalEventosAuditados'] == 1
    esperar(verificar_resultados, 'REST votación → RabbitMQ → conteo y auditoría independientes conservados')
    despues = {recurso: pedir('/api/v1/' + recurso + '?limite=1')[1]['total'] for recurso in recursos}
    assert despues['elecciones'] >= antes['elecciones'] + 2
    assert despues['inscripciones'] >= antes['inscripciones'] + 2
    assert all(despues[r] >= antes[r] for r in recursos)
    comprobar_salud()
    evidencia = {'prefijo': PREFIJO, 'eleccionesSinteticas': ids_eleccion, 'inscripcionesSinteticas': inscripciones,
                 'eventoSintetico': evento['idEvento'], 'correlacionGrpc': correlacion, 'totalesAntes': antes, 'totalesDespues': despues}
    destino = Path('/tmp/sigape-evidencia-grpc-' + str(uuid4()) + '.json')
    destino.write_text(json.dumps(evidencia, ensure_ascii=False, indent=2))
    print('OK: salud final y datos anteriores conservados; evidencia:', destino, flush=True)
    print(json.dumps(evidencia, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    principal()
