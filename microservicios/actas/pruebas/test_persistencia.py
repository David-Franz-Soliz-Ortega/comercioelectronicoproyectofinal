"""Pruebas SQL reales exclusivamente sobre el PostgreSQL efímero del ejecutor."""
import os
import sys
import unittest
import base64
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

HABILITADO = os.getenv('TUVOTO_PRUEBA_CONFIRMACION') == 'SOLO_DATOS_EFIMEROS'
if HABILITADO:
    import psycopg
    from psycopg.rows import dict_row
    from fastapi import HTTPException
    sys.path.insert(0, str(Path(__file__).parents[1]))
    from app import servidor as s


@unittest.skipUnless(HABILITADO, 'Requiere el ejecutor PostgreSQL efímero')
class Persistencia(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        port = int(os.environ['TUVOTO_PRUEBA_PG_PUERTO'])
        if not 1024 <= port <= 65535 or port in (5432, 5433): raise RuntimeError('Puerto de prueba no aislado')
        def conectar():
            db = psycopg.connect(host='127.0.0.1', port=port, dbname='tuvoto_pruebas', user='postgres', row_factory=dict_row)
            if db.execute('SELECT current_database() AS nombre').fetchone()['nombre'] != 'tuvoto_pruebas':
                db.close(); raise RuntimeError('Base de prueba incorrecta')
            db.commit(); return db
        cls.conectar = staticmethod(conectar); s.conectar = conectar
        cls.org, cls.usuario, cls.mesa, cls.proceso, cls.a, cls.b = map(str, [uuid4() for _ in range(6)])
        s.autorizar = lambda *_: {'idUsuario': cls.usuario, 'idOrganizacion': cls.org}
        s.consultar_mesa = lambda *_: {'id': cls.mesa, 'idProceso': cls.proceso, 'unidad': 'Unidad sintética', 'candidatos': [{'id': cls.a}, {'id': cls.b}]}
        from contextlib import contextmanager
        @contextmanager
        def registro_mesa(*argumentos):
            yield s.consultar_mesa(*argumentos)
        s.registro_mesa=registro_mesa
        os.environ['ELECCIONES_URL'] = 'http://doble-sin-red'
        with conectar() as db: db.execute(s.ESQUEMA)

    def setUp(self):
        with self.conectar() as db: db.execute('TRUNCATE versiones_actas,bandeja_actas')

    def entrada(self, **cambios):
        foto = b'\x89PNG\r\n\x1a\n' + str(uuid4()).encode()
        valores = dict(idMesa=self.mesa, idSolicitud=str(uuid4()), versionAnterior=0,
            foto='data:image/png;base64,'+base64.b64encode(foto).decode(),
            votos=[{'idCandidato':self.a,'cantidad':3},{'idCandidato':self.b,'cantidad':2}], blancos=1,nulos=0,total=6,confirmado=True)
        valores.update(cambios); return s.NuevaActa(**valores)

    def registrar(self, d): return s.registrar(d, SimpleNamespace(headers={}))

    def test_anulacion_conserva_original_y_reintento(self):
        dato=self.entrada();self.registrar(dato)
        anulacion=s.Anulacion(idSolicitud=uuid4(),versionAnterior=1,motivo='Anulación sintética de prueba')
        req=SimpleNamespace(headers={})
        self.assertEqual(s.anular_acta(dato.idMesa,anulacion,req).status_code,204)
        self.assertEqual(s.anular_acta(dato.idMesa,anulacion,req).status_code,204)
        with self.conectar() as db:
            filas=db.execute('SELECT version,estado,foto FROM versiones_actas ORDER BY version').fetchall()
            self.assertEqual([f['estado'] for f in filas],['publicada','anulada'])
            self.assertEqual(bytes(filas[0]['foto']),bytes(filas[1]['foto']))
            evento=db.execute("SELECT evento FROM bandeja_actas WHERE (evento->'datos'->>'versionActa')::int=2").fetchone()['evento']
            self.assertIsNone(evento['datos']['conteo'])

    def test_diez_mil_registros_filtros_paginacion_y_aislamiento(self):
        with self.conectar() as db:
            db.execute("""INSERT INTO versiones_actas(id,id_proceso,id_mesa,id_organizacion,id_operador,version,id_solicitud,huella,foto,mime,foto_hash,estado,conteo)
                SELECT gen_random_uuid(),%s,gen_random_uuid(),%s,%s,1,gen_random_uuid(),repeat('a',64),convert_to('sintetico','UTF8'),'image/png',repeat('b',64),CASE WHEN n%%2=0 THEN 'publicada' ELSE 'observada' END,'{}'::jsonb FROM generate_series(1,10000) n""",(self.proceso,self.org,self.usuario))
        req=SimpleNamespace(headers={})
        primera=s.listar_actas(req,1,100,None);segunda=s.listar_actas(req,2,100,None)
        self.assertEqual(primera['total'],10000)
        self.assertFalse({r['id'] for r in primera['elementos']} & {r['id'] for r in segunda['elementos']})
        self.assertEqual(s.listar_actas(req,1,100,'observada')['total'],5000)
        with self.assertRaises(HTTPException) as error:s.listar_actas(req,1,20,'inventado')
        self.assertEqual(error.exception.status_code,422)
        anterior=s.autorizar
        try:
            s.autorizar=lambda *_:{'idUsuario':self.usuario,'idOrganizacion':str(uuid4())}
            self.assertEqual(s.listar_actas(req,1,20,None)['total'],0)
        finally:s.autorizar=anterior

    def test_publicacion_reintento_y_segundo_registro(self):
        d=self.entrada(); primero=self.registrar(d); repetido=self.registrar(d)
        self.assertEqual(str(primero['id']),str(repetido['id']))
        with self.assertRaises(HTTPException) as error:self.registrar(self.entrada())
        self.assertEqual(error.exception.status_code,409)
        with self.conectar() as db:
            self.assertEqual(db.execute('SELECT count(*) AS n FROM versiones_actas').fetchone()['n'],1)
            self.assertEqual(db.execute('SELECT count(*) AS n FROM bandeja_actas').fetchone()['n'],1)

    def test_solicitudes_simultaneas_una_sola_version(self):
        def intentar(d):
            try:return self.registrar(d)['estado']
            except HTTPException as e:return e.status_code
        with ThreadPoolExecutor(max_workers=2) as ejecutor: estados=list(ejecutor.map(intentar,[self.entrada(),self.entrada()]))
        self.assertEqual(estados.count('publicada'),1);self.assertEqual(estados.count(409),1)

    def test_reintentos_simultaneos_misma_solicitud(self):
        d=self.entrada()
        with ThreadPoolExecutor(max_workers=2) as ejecutor: resultados=list(ejecutor.map(self.registrar,[d,d]))
        self.assertEqual(str(resultados[0]['id']),str(resultados[1]['id']))
        with self.conectar() as db:self.assertEqual(db.execute('SELECT count(*) AS n FROM bandeja_actas').fetchone()['n'],1)

    def test_observada_y_correccion_versionada(self):
        r=self.registrar(self.entrada(total=7));self.assertEqual(r['estado'],'observada')
        corregida=self.registrar(self.entrada(versionAnterior=1));self.assertEqual(corregida['version'],2)
        with self.conectar() as db:
            estados=db.execute('SELECT estado FROM versiones_actas ORDER BY version').fetchall()
            self.assertEqual([e['estado'] for e in estados],['observada','publicada'])

    def test_fallo_bandeja_revierte_acta_y_permita_reintento(self):
        d=self.entrada()
        with self.conectar() as db:
            db.execute("CREATE OR REPLACE FUNCTION fallar_prueba() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo sintético'; END $$")
            db.execute('CREATE TRIGGER fallo_bandeja BEFORE INSERT ON bandeja_actas FOR EACH ROW EXECUTE FUNCTION fallar_prueba()')
        try:
            with self.assertRaises(psycopg.Error):self.registrar(d)
            with self.conectar() as db:self.assertEqual(db.execute('SELECT count(*) AS n FROM versiones_actas').fetchone()['n'],0)
        finally:
            with self.conectar() as db:db.execute('DROP TRIGGER fallo_bandeja ON bandeja_actas');db.execute('DROP FUNCTION fallar_prueba()')
        self.assertEqual(self.registrar(d)['estado'],'publicada')

if __name__ == '__main__': unittest.main()
