"""Comparación de lectura de los registros originales del Compose principal."""
from datetime import datetime, timezone
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.request import urlopen


def fotografia():
    datos = {}
    for recurso, clave in [('identidades','idIdentidad'),('elecciones','idEleccion'),('candidaturas','idCandidatura'),('inscripciones','idInscripcion')]:
        filas=[]; numero=1
        while True:
            with urlopen(f'http://localhost:8080/api/v1/{recurso}?limite=100&pagina={numero}',timeout=10) as r:
                pagina=json.load(r)
            filas.extend(pagina['elementos'])
            if numero*100 >= pagina['total']: break
            numero+=1
        # Comparar instantes UTC con precisión BSON; las fechas antiguas de Mongo eran naive.
        for fila in filas:
            for campo in ('creadoEn','actualizadoEn'):
                if campo in fila:
                    instante=datetime.fromisoformat(fila[campo].replace('Z','+00:00'))
                    if instante.tzinfo is None: instante=instante.replace(tzinfo=timezone.utc)
                    fila[campo]=instante.astimezone(timezone.utc).isoformat(timespec='milliseconds')
        filas.sort(key=lambda f:f[clave])
        datos[recurso]={'total':len(filas),'sha256':hashlib.sha256(json.dumps(filas,sort_keys=True,ensure_ascii=False).encode()).hexdigest()}
    nombres=['base-postgres','base-mongodb','cache-redis','mensajeria-rabbitmq']
    salida=subprocess.check_output(['docker','inspect','--format','{{.Name}} {{.Id}} {{range .Mounts}}{{if eq .Type "volume"}}{{.Name}} {{end}}{{end}}', *['sigape-'+n+'-1' for n in nombres]],text=True)
    datos['almacenes_y_volumenes']=salida.strip().splitlines()
    return datos


def principal():
    parser=argparse.ArgumentParser(); parser.add_argument('accion',choices=['capturar','comparar']); parser.add_argument('archivo'); args=parser.parse_args()
    actual=fotografia(); destino=Path(args.archivo)
    if args.accion=='capturar': destino.write_text(json.dumps(actual,ensure_ascii=False,indent=2))
    else:
        anterior=json.loads(destino.read_text())
        assert actual==anterior,'Los registros o almacenes originales cambiaron; revisar antes de continuar.'
    print(json.dumps({'accion':args.accion,'conservados':True,'totales':{k:v['total'] for k,v in actual.items() if isinstance(v,dict)}},ensure_ascii=False))
if __name__=='__main__': principal()
