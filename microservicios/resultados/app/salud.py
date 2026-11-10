import json
import os
from pathlib import Path
import sys
import time
from urllib.request import urlopen

try:
    if os.getenv("CONSUMIDOR"):
        instante = json.loads(Path("/tmp/consumidor-salud.json").read_text())["instante"]
        sys.exit(0 if 0 <= time.time() - instante < 15 else 1)
    with urlopen("http://127.0.0.1:8000/api/v1/salud", timeout=4) as respuesta:
        sys.exit(0 if respuesta.status == 200 else 1)
except Exception:
    sys.exit(1)
