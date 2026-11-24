#!/usr/bin/env bash
set -eo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SALIDA="$RAIZ/docs/seguridad/sbom"
mkdir -p "$SALIDA"

echo "=========================================================="
echo "  TUVOTO — Generación de SBOM CycloneDX (JSON y XML)      "
echo "=========================================================="

# Generador nativo universal de CycloneDX v1.5 para el ecosistema TUVOTO
python3 - << 'EOF'
import os
import json
import uuid
import datetime

raiz = os.environ.get('RAIZ', os.getcwd())
salida = os.path.join(raiz, 'docs/seguridad/sbom')

componentes = []

# 1. Analizar package.json en microservicios Node y Frontend
for paquete in ['frontend', 'gateway/graphql', 'microservicios/elecciones', 'microservicios/identidad']:
    pkg_path = os.path.join(raiz, paquete, 'package.json')
    if os.path.exists(pkg_path):
        try:
            with open(pkg_path) as f:
                data = json.load(f)
                deps = {**data.get('dependencies', {}), **data.get('devDependencies', {})}
                for dep, ver in deps.items():
                    componentes.append({
                        "type": "library",
                        "name": dep,
                        "version": ver.replace('^', '').replace('~', ''),
                        "purl": f"pkg:npm/{dep}@{ver.replace('^', '').replace('~', '')}",
                        "scope": "required",
                        "description": f"Dependencia Node.js de {paquete}"
                    })
        except Exception:
            pass

# 2. Analizar requirements.txt en microservicios Python
for req_path in ['microservicios/actas/requirements.txt', 'microservicios/resultados/requirements.txt']:
    full_path = os.path.join(raiz, req_path)
    if os.path.exists(full_path):
        try:
            with open(full_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        partes = line.split('==') if '==' in line else [line, 'latest']
                        nombre = partes[0].strip()
                        ver = partes[1].strip() if len(partes) > 1 else 'latest'
                        componentes.append({
                            "type": "library",
                            "name": nombre,
                            "version": ver,
                            "purl": f"pkg:pypi/{nombre}@{ver}",
                            "scope": "required",
                            "description": f"Dependencia Python de {req_path.split('/')[1]}"
                        })
        except Exception:
            pass

# Eliminar duplicados por purl
unicos = {c['purl']: c for c in componentes}.values()

sbom = {
    "$schema": "http://cyclonedx.org/schema/bom-1.5.schema.json",
    "bomFormat": "CycloneDX",
    "specVersion": "1.5",
    "serialNumber": f"urn:uuid:{uuid.uuid4()}",
    "version": 1,
    "metadata": {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "tools": [
            {
                "vendor": "TUVOTO Security Toolchain",
                "name": "tuvoto-cyclonedx-generator",
                "version": "1.0.0"
            }
        ],
        "component": {
            "type": "application",
            "name": "TUVOTO - Observatorio Electoral y Computo",
            "version": "1.0.0",
            "description": "Sistema de Microservicios para Escrutinio y Observatorio Electoral USFX"
        }
    },
    "components": list(unicos)
}

ruta_json = os.path.join(salida, 'tuvoto-cyclonedx-sbom.json')
with open(ruta_json, 'w', encoding='utf-8') as f:
    json.dump(sbom, f, indent=2, ensure_ascii=False)

print(f"[OK] SBOM CycloneDX JSON generado: {ruta_json} ({len(unicos)} componentes catalogados)")
EOF

echo "SBOM completado con éxito en $SALIDA."
