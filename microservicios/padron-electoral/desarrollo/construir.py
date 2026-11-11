"""Construye con un contexto mínimo incluso usando Docker sin BuildKit."""
import argparse
from pathlib import Path
import subprocess
import tarfile
import tempfile

argumentos = argparse.ArgumentParser(description=__doc__)
argumentos.add_argument("servicio", choices=("padron-electoral", "candidaturas"))
servicio = argumentos.parse_args().servicio
raiz = Path(__file__).resolve().parents[3]
carpeta = raiz / "microservicios" / servicio
archivos = [carpeta / "Dockerfile", raiz / "compartido/contratos/openapi" / f"{servicio}.yaml"]
if servicio == "padron-electoral":
    archivos += [carpeta / nombre for nombre in ("package.json", "package-lock.json", "tsconfig.json")]
    archivos += sorted((carpeta / "src").glob("*.ts"))
    archivos += sorted((carpeta / "pruebas").glob("*.mjs"))
    archivos += [raiz / "compartido/contratos/grpc/padron-v1.proto"]
    imagen = "sigape-integrante2-padron-padron-electoral"
else:
    archivos += [carpeta / "requirements.txt", *sorted((carpeta / "app").glob("*.py"))]
    imagen = "sigape-integrante2-candidaturas-candidaturas"

# Lista explícita: nunca envía .env, Git, dependencias locales ni archivos ajenos.
with tempfile.TemporaryFile() as contexto:
    with tarfile.open(fileobj=contexto, mode="w:gz") as archivo_tar:
        for archivo in archivos:
            archivo_tar.add(archivo, arcname=str(archivo.relative_to(raiz)), recursive=False)
    print(f"Construyendo {servicio}: {len(archivos)} archivos, contexto {contexto.tell()} bytes.", flush=True)
    contexto.seek(0)
    subprocess.run([
        "docker", "build", "--tag", imagen,
        "--file", f"microservicios/{servicio}/Dockerfile", "-",
    ], stdin=contexto, check=True)
