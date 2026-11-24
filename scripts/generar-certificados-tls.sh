#!/usr/bin/env bash
set -eo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$RAIZ/infraestructura/tuvoto/certificados"

mkdir -p "$CERT_DIR"
cd "$CERT_DIR"

echo "=========================================================="
echo "  TUVOTO — Generación de Certificados TLS / HTTPS         "
echo "=========================================================="

if [ -f "server.crt" ] && [ -f "server.key" ]; then
  echo "Los certificados ya existen en $CERT_DIR"
  openssl x509 -in server.crt -text -noout | grep -E "Subject:|Not After" || true
  exit 0
fi

cat > openssl.cnf << 'EOF'
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext

[dn]
C = BO
ST = Chuquisaca
L = Sucre
O = USFX
OU = Facultad de Tecnologia - COM-600 Microservicios
CN = tuvoto.local

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = tuvoto.local
IP.1 = 127.0.0.1
IP.2 = 192.168.100.36
EOF

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key \
  -out server.crt \
  -config openssl.cnf

chmod 600 server.key
chmod 644 server.crt
rm -f openssl.cnf

echo "[OK] Certificados TLS generados exitosamente en $CERT_DIR:"
ls -lh "$CERT_DIR"
