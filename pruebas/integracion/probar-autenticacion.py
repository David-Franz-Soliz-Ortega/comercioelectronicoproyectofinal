#!/usr/bin/env python3
"""Suite de integración para autenticación, autorización y multitenancy en SIGAPE.

Verifica:
1. Comprobación estática de puertos (solo NGINX publicado en el host).
2. Rutas públicas (salud, openapi, graphql/esquema, csrf).
3. Bloqueo estricto de rutas internas y prevención de suplantación de cabeceras.
4. Rechazo anónimo (401) en los seis microservicios y GraphQL.
5. Validación de CSRF, cookies HttpOnly y SameSite.
6. Login de SUPERADMIN y verificación de sesión en /autenticacion/yo.
7. Creación de organizaciones y usuarios con roles asignados.
8. Prevención de escalamiento de privilegios (usuarios no pueden crear SUPERADMIN).
9. Aislamiento multitenancy entre organizaciones (403 cruzado en recursos).
10. Restricción de permisos para rol ELECTOR (lectura limitada).
11. Logout e invalidación inmediata de sesión (401 en reuso).
"""
import argparse
import hashlib
import secrets
import stat
from datetime import datetime, timezone
import http.cookiejar
from http.cookies import CookieError, SimpleCookie
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from uuid import uuid4

RAIZ = Path(__file__).resolve().parents[2]


class ConfiguracionInsegura(ValueError):
    """No se permite continuar sin evidencia de aislamiento y confirmación."""


def exigir(condicion, mensaje):
    if not condicion:
        raise ConfiguracionInsegura(mensaje)


def se_superponen(a: Path, b: Path) -> bool:
    return a == b or a in b.parents or b in a.parents


def normalizar_destino(valor: str) -> str:
    try:
        url = urllib.parse.urlsplit(valor)
        puerto = url.port
        valido = (url.scheme in ('http', 'https') and url.hostname == '127.0.0.1'
                  and puerto is not None and 1024 <= puerto <= 65535 and puerto != 8080
                  and not url.username and not url.password and not url.query
                  and not url.fragment and url.path in ('', '/'))
    except (ValueError, TypeError):
        valido = False
    exigir(valido, 'Destino rechazado: use loopback literal y puerto aislado explícito distinto de 8080.')
    return f'{url.scheme}://127.0.0.1:{puerto}'


class AislamientoAutorizado:
    """Valida evidencia local explícita; no descubre ni modifica recursos Docker."""

    def __init__(self, archivo: str, entorno: str, destino: str, confirmacion: str):
        exigir(bool(re.fullmatch(r'(?:sigape-auth-test|sigape-auth-pruebas-[a-z0-9]{8,32})', entorno)),
               'Identificador aislado inválido; no se acepta el proyecto principal.')
        exigir(confirmacion == 'AUTORIZO-ESCRITURAS-EN:' + entorno,
               'Se requiere confirmación explícita vinculada al entorno aislado.')
        self.archivo = Path(archivo).resolve(strict=True)
        estado = self.archivo.stat()
        exigir(stat.S_ISREG(estado.st_mode) and estado.st_uid == os.getuid()
               and estado.st_mode & 0o077 == 0,
               'La configuración debe ser un archivo privado del usuario (permisos 0600).')
        bruto = self.archivo.read_bytes()
        exigir(len(bruto) <= 2_000_000, 'Configuración de aislamiento demasiado grande.')
        self.huella = hashlib.sha256(bruto).digest()
        datos = json.loads(bruto)
        exigir(isinstance(datos, dict) and datos.get('version') == 1,
               'Falta una configuración de aislamiento válida.')
        self.base = normalizar_destino(destino)
        exigir(datos.get('idEntorno') == entorno and datos.get('urlBase') == self.base,
               'La configuración no autoriza exactamente ese entorno y URL.')
        self.entorno = entorno
        self.confirmacion = confirmacion
        self.creado = datetime.fromisoformat(datos['capturadoEn'].replace('Z', '+00:00'))
        raiz = Path(datos['directorioAislado']).resolve(strict=True)
        exigir(raiz.is_dir() and not se_superponen(raiz, RAIZ),
               'La copia aislada debe estar fuera del repositorio principal.')
        composicion = datos['composicion']
        exigir(isinstance(composicion, dict) and composicion.get('name') == entorno,
               'La composición resuelta no corresponde al proyecto aislado.')
        servicios = composicion['services']
        exigir(isinstance(servicios, dict) and {'entrada-nginx', 'identidad', 'elecciones',
               'candidaturas', 'padron-electoral', 'votacion', 'resultados'}.issubset(servicios),
               'La composición resuelta no cubre los servicios de la suite.')
        # Campo no sensible de la configuración efectiva de identidad; no inferirlo
        # del esquema de la URL ni adoptar un valor predeterminado silencioso.
        entorno_identidad = servicios['identidad'].get('environment', {})
        exigir(isinstance(entorno_identidad, dict), 'Falta la política efectiva de cookies de identidad.')
        politica_cookie = entorno_identidad.get('COOKIE_SEGURA')
        exigir(isinstance(politica_cookie, bool) or politica_cookie in ('true', 'false'),
               'La evidencia de identidad debe incluir COOKIE_SEGURA explícito (true/false).')
        self.cookie_segura = politica_cookie is True or politica_cookie == 'true'
        exigir(not self.cookie_segura or urllib.parse.urlsplit(self.base).scheme == 'https',
               'La política Secure requiere un destino aislado HTTPS.')
        volumenes = composicion.get('volumes', {})
        redes = composicion.get('networks', {})
        for grupo in (volumenes, redes):
            exigir(isinstance(grupo, dict), 'Inventario de redes/volúmenes inválido.')
            for configuracion in grupo.values():
                exigir(isinstance(configuracion, dict) and not configuracion.get('external')
                       and str(configuracion.get('name', '')).startswith(entorno + '_'),
                       'Se rechazan recursos externos, nombres fijos ajenos o sin resolver.')
        exigir(bool(redes), 'Falta el inventario de redes aisladas.')
        principal = datos['principal']
        candidato = datos['candidato']
        exigir(isinstance(principal, list) and bool(principal)
               and isinstance(candidato, list) and bool(candidato),
               'Faltan inspecciones del principal o del candidato.')
        ids = set()
        montajes_principales = set()
        enlaces_principales = []
        redes_principales = set()
        servicios_principales = set()
        puertos_principales = set()
        for contenedor in principal:
            etiquetas = contenedor['Config']['Labels']
            exigir(etiquetas.get('com.docker.compose.project') == 'sigape',
                   'La inspección principal debe identificar el proyecto sigape.')
            identificador = contenedor['Id']
            exigir(bool(re.fullmatch(r'[0-9a-f]{64}', identificador)) and identificador not in ids,
                   'Identificadores de contenedores principales inválidos.')
            ids.add(identificador)
            servicios_principales.add(etiquetas['com.docker.compose.service'])
            for montaje in contenedor['Mounts']:
                if montaje['Type'] == 'volume':
                    exigir(bool(montaje.get('Name')), 'Volumen principal sin identidad.')
                    montajes_principales.add(montaje['Name'])
                elif montaje['Type'] == 'bind':
                    enlaces_principales.append(Path(montaje['Source']).resolve())
                else:
                    exigir(montaje['Type'] == 'tmpfs', 'Montaje principal no reconocido.')
            red = contenedor['NetworkSettings']
            redes_principales.update(red['Networks'])
            for enlaces in red['Ports'].values():
                for enlace in enlaces or []:
                    puertos_principales.add(int(enlace['HostPort']))
        exigir({'entrada-nginx', 'base-postgres', 'base-mongodb', 'cache-redis',
                'mensajeria-rabbitmq'}.issubset(servicios_principales),
               'La inspección principal está incompleta.')
        vistos = set()
        servicios_vistos = set()
        publicaciones = []
        nombres_redes = {r['name'] for r in redes.values()}
        exigir(not redes_principales.intersection(nombres_redes), 'Red compartida con el principal.')
        for nombre, servicio in servicios.items():
            exigir(not any(k in servicio for k in ('container_name', 'volumes_from',
                   'network_mode', 'pid', 'ipc', 'extends')) and not servicio.get('privileged'),
                   'La composición contiene nombres/namespaces compartidos o privilegios no admitidos.')
            for montaje in servicio.get('volumes', []):
                exigir(isinstance(montaje, dict) and montaje.get('type') in ('volume', 'bind', 'tmpfs'),
                       'Los montajes deben estar resueltos en sintaxis larga.')
                if montaje['type'] == 'volume':
                    exigir(montaje.get('source') in volumenes,
                           'Volumen sin nombre resuelto explícito.')
                if montaje['type'] == 'bind':
                    fuente = Path(montaje['source']).resolve(strict=True)
                    exigir(raiz in fuente.parents and not any(se_superponen(fuente, p) for p in enlaces_principales),
                           'Montaje bind ajeno a la copia aislada o compartido con el principal.')
            for puerto in servicio.get('ports', []):
                exigir(isinstance(puerto, dict) and nombre == 'entrada-nginx'
                       and puerto.get('host_ip') == '127.0.0.1'
                       and str(puerto.get('published')) == str(urllib.parse.urlsplit(self.base).port)
                       and puerto.get('protocol', 'tcp') == 'tcp',
                       'Publicación de puertos no autorizada.')
        for contenedor in candidato:
            identificador = contenedor['Id']
            etiquetas = contenedor['Config']['Labels']
            nombre = etiquetas['com.docker.compose.service']
            exigir(bool(re.fullmatch(r'[0-9a-f]{64}', identificador)) and identificador not in ids
                   and identificador not in vistos and nombre not in servicios_vistos
                   and etiquetas.get('com.docker.compose.project') == entorno and nombre in servicios,
                   'El candidato comparte contenedor o no coincide con la composición.')
            vistos.add(identificador)
            servicios_vistos.add(nombre)
            exigir(contenedor['State']['Status'] == 'running' or
                   (nombre == 'configurar-mensajeria' and contenedor['State']['Status'] == 'exited'
                    and contenedor['State']['ExitCode'] == 0), 'El candidato no está listo.')
            declarados = {m['target']: m for m in servicios[nombre].get('volumes', [])}
            for montaje in contenedor['Mounts']:
                tipo = montaje['Type']
                if tipo == 'volume':
                    nombre_volumen = montaje.get('Name', '')
                    exigir(bool(nombre_volumen) and nombre_volumen not in montajes_principales,
                           'Volumen candidato compartido con el principal.')
                    declarado = declarados.get(montaje['Destination'])
                    if declarado:
                        exigir(declarado['type'] == 'volume' and nombre_volumen == volumenes[declarado['source']]['name'],
                               'El volumen efectivo no coincide con la composición.')
                    else:
                        exigir(bool(re.fullmatch(r'[0-9a-f]{64}', nombre_volumen)),
                               'Montaje nombrado no declarado en la composición.')
                elif tipo == 'bind':
                    fuente = Path(montaje['Source']).resolve(strict=True)
                    declarado = declarados.get(montaje['Destination'], {})
                    exigir(raiz in fuente.parents and not any(se_superponen(fuente, p) for p in enlaces_principales)
                           and declarado.get('type') == 'bind'
                           and Path(declarado['source']).resolve() == fuente,
                           'Montaje efectivo compartido, ajeno o no declarado.')
                else:
                    exigir(tipo == 'tmpfs', 'Montaje candidato no reconocido.')
            red = contenedor['NetworkSettings']
            exigir(set(red['Networks']).issubset(nombres_redes)
                   and not set(red['Networks']).intersection(redes_principales), 'Red efectiva compartida o no autorizada.')
            for puerto, enlaces in red['Ports'].items():
                for enlace in enlaces or []:
                    exigir(nombre == 'entrada-nginx' and enlace['HostIp'] == '127.0.0.1'
                           and int(enlace['HostPort']) == urllib.parse.urlsplit(self.base).port,
                           'Destino HTTP no corresponde al puerto aislado efectivo.')
                    publicaciones.append((puerto, enlace))
        exigir(servicios_vistos == set(servicios) and len(publicaciones) == 1,
               'Inspección candidata incompleta o publicación ambigua.')
        exigir(urllib.parse.urlsplit(self.base).port not in puertos_principales,
               'El puerto autorizado pertenece al principal.')
        self.comprobar(self.base, True)

    def comprobar(self, destino: str, escritura: bool = False):
        exigir(normalizar_destino(destino) == self.base, 'Destino fuera de la autorización.')
        exigir(self.creado.tzinfo is not None, 'La captura requiere zona horaria.')
        edad = (datetime.now(timezone.utc) - self.creado).total_seconds()
        exigir(0 <= edad <= 600, 'La evidencia de aislamiento caducó (máximo diez minutos).')
        exigir(hashlib.sha256(self.archivo.read_bytes()).digest() == self.huella,
               'La configuración cambió; se requiere revisión y confirmación nuevas.')
        if escritura:
            exigir(self.confirmacion == 'AUTORIZO-ESCRITURAS-EN:' + self.entorno,
                   'Operación de escritura sin confirmación explícita.')


_aislamiento = None


def comprobar_aislamiento(destino: str, escritura: bool = False):
    exigir(_aislamiento is not None, 'No se cargó una configuración de aislamiento autorizada.')
    _aislamiento.comprobar(destino, escritura)


class SinRedirecciones(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ConfiguracionInsegura('Redirección rechazada; no se permite cambiar de destino.')


class SesionCliente:
    """Cliente HTTP con gestión de cookies, CSRF y cabeceras de contexto."""

    def __init__(self, base_url: str):
        comprobar_aislamiento(base_url)
        self.base_url = normalizar_destino(base_url)
        self.origen = self.base_url
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({}),
            urllib.request.HTTPCookieProcessor(self.cookies),
            SinRedirecciones(),
        )
        self.token_csrf = ""
        self.ultimas_cookies_emitidas = []

    def obtener_cookie(self, nombre_parcial: str) -> str:
        for cookie in self.cookies:
            if nombre_parcial in cookie.name:
                return cookie.value
        return ""

    def nombre_cookie_sesion(self) -> str:
        comprobar_aislamiento(self.base_url)
        return '__Host-sigape-sesion' if _aislamiento.cookie_segura else 'sigape-sesion'

    def comprobar_cookie_sesion(self) -> None:
        """Inspecciona todas las cabeceras Set-Cookie sin revelar valores."""
        nombre = self.nombre_cookie_sesion()
        sesiones = []
        for cabecera in self.ultimas_cookies_emitidas:
            atributos = SimpleCookie()
            try:
                atributos.load(cabecera)
            except CookieError:
                raise AssertionError('Cabecera de cookie de sesión inválida.') from None
            for candidato in ('sigape-sesion', '__Host-sigape-sesion'):
                if candidato in atributos:
                    sesiones.append(atributos[candidato])
        if len(sesiones) != 1 or sesiones[0].key != nombre:
            raise AssertionError('Se requiere una única cookie de sesión acorde con la política del entorno.')
        cookie = sesiones[0]
        if not cookie.value:
            raise AssertionError('El login no emitió una cookie de sesión utilizable.')
        if not bool(cookie['httponly']):
            raise AssertionError('La cookie de sesión debe incluir HttpOnly.')
        if str(cookie['samesite']).lower() != 'strict':
            raise AssertionError('La cookie de sesión debe incluir SameSite=Strict.')
        if bool(cookie['secure']) != _aislamiento.cookie_segura:
            raise AssertionError('El atributo Secure no coincide con COOKIE_SEGURA del entorno.')
        # También exigir que el cliente haya aceptado esa cookie; una cookie Secure
        # descartada por transporte no puede probar revocación posteriormente.
        almacenadas = [c for c in self.cookies if c.name == nombre]
        if len(almacenadas) != 1 or almacenadas[0].value != cookie.value:
            raise AssertionError('La cookie de sesión emitida no quedó disponible en el cliente.')

    def capturar_cookie_sesion(self) -> str:
        """Captura privada antes de logout; no imprimir ni guardar en evidencias."""
        nombre = self.nombre_cookie_sesion()
        almacenadas = [c for c in self.cookies if c.name == nombre and c.value]
        if len(almacenadas) != 1:
            raise AssertionError('No existe una cookie anterior inequívoca para probar revocación.')
        return nombre + '=' + almacenadas[0].value

    def solicitar(
        self,
        metodo: str,
        ruta: str,
        datos: dict | None = None,
        cabeceras: dict | None = None,
        esperado: int | None = None,
    ) -> tuple[int, dict | str, dict]:
        comprobar_aislamiento(self.base_url, metodo.upper() not in ('GET', 'HEAD', 'OPTIONS'))
        exigir(ruta.startswith('/') and not ruta.startswith('//'), 'Ruta fuera del destino autorizado.')
        url = self.base_url + ruta if ruta.startswith("/") else f"{self.base_url}/{ruta}"
        headers = {
            "Accept": "application/json",
            "X-Correlation-ID": f"prueba-auth-{uuid4().hex[:8]}",
        }
        if cabeceras:
            headers.update(cabeceras)

        cuerpo_bytes = None
        if datos is not None:
            headers["Content-Type"] = "application/json"
            cuerpo_bytes = json.dumps(datos).encode("utf-8")

        peticion = urllib.request.Request(
            url=url, data=cuerpo_bytes, headers=headers, method=metodo
        )

        try:
            with self.opener.open(peticion, timeout=10) as respuesta:
                codigo = respuesta.status
                headers_resp = dict(respuesta.headers)
                self.ultimas_cookies_emitidas = respuesta.headers.get_all("Set-Cookie", [])
                contenido_raw = respuesta.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            codigo = error.code
            headers_resp = dict(error.headers)
            self.ultimas_cookies_emitidas = error.headers.get_all("Set-Cookie", [])
            contenido_raw = error.read().decode("utf-8")

        # Actualizar token CSRF si se recibe cookie o respuesta con csrf
        csrf_cookie = self.obtener_cookie("sigape-csrf")
        if csrf_cookie:
            self.token_csrf = csrf_cookie

        try:
            cuerpo_json = json.loads(contenido_raw) if contenido_raw else {}
        except json.JSONDecodeError:
            cuerpo_json = contenido_raw

        if isinstance(cuerpo_json, dict) and "csrf" in cuerpo_json:
            self.token_csrf = cuerpo_json["csrf"]

        if esperado is not None and codigo != esperado:
            raise AssertionError(
                f"Fallo en {metodo} {ruta}: esperado HTTP {esperado}, recibido {codigo}."
            )

        return codigo, cuerpo_json, headers_resp

    def obtener_csrf(self) -> str:
        codigo, datos, _ = self.solicitar(
            "GET", "/api/v1/autenticacion/csrf", esperado=200
        )
        assert isinstance(datos, dict) and "csrf" in datos
        self.token_csrf = datos["csrf"]
        return self.token_csrf

    def login(
        self, usuario: str, contrasena: str, id_organizacion: str | None = None
    ) -> dict:
        if not self.token_csrf:
            self.obtener_csrf()

        cuerpo = {"usuario": usuario, "contrasena": contrasena}
        if id_organizacion:
            cuerpo["idOrganizacion"] = id_organizacion

        cabeceras = {
            "Origin": self.origen,
            "X-CSRF-Token": self.token_csrf,
        }
        codigo, respuesta, _ = self.solicitar(
            "POST",
            "/api/v1/autenticacion/login",
            datos=cuerpo,
            cabeceras=cabeceras,
            esperado=200,
        )
        self.comprobar_cookie_sesion()
        return respuesta

    def logout(self) -> None:
        cabeceras = {
            "Origin": self.origen,
            "X-CSRF-Token": self.token_csrf,
        }
        self.solicitar(
            "POST", "/api/v1/autenticacion/logout", cabeceras=cabeceras, esperado=204
        )


def probar_puertos_infraestructura():
    """Verifica que docker-compose.yml solo exponga el puerto público de NGINX."""
    archivo_compose = RAIZ / "docker-compose.yml"
    assert archivo_compose.exists(), "No se encontró docker-compose.yml"
    texto = archivo_compose.read_text(encoding="utf-8")

    # Buscar bloques ports: en el compose
    lineas = texto.splitlines()
    servicios_con_puertos = []
    servicio_actual = ""
    for i, linea in enumerate(lineas):
        m_srv = re.match(r"^  ([a-zA-Z0-9_-]+):", linea)
        if m_srv:
            servicio_actual = m_srv.group(1)
        if re.match(r"^    ports:", linea):
            servicios_con_puertos.append((servicio_actual, lineas[i + 1].strip()))

    assert len(servicios_con_puertos) == 1, (
        f"Se esperaba únicamente 1 servicio con puertos publicados, pero se encontraron: {servicios_con_puertos}"
    )
    servicio, puerto = servicios_con_puertos[0]
    assert servicio == "entrada-nginx", f"El servicio con puertos debe ser entrada-nginx, recibido: {servicio}"
    print(f"OK: Inspección de puertos: solo '{servicio}' publica puertos ({puerto}) al anfitrión.")


def probar_rutas_publicas(cliente: SesionCliente):
    """Verifica que endpoints de salud, contratos y obtención de CSRF sean accesibles públicamente."""
    servicios_salud = [
        "identidad",
        "elecciones",
        "candidaturas",
        "padron-electoral",
        "votacion",
        "resultados",
        "graphql",
    ]
    for srv in servicios_salud:
        cliente.solicitar("GET", f"/api/v1/salud/{srv}", esperado=200)

    cliente.solicitar("GET", "/api/v1/identidades/openapi.yaml", esperado=200)
    cliente.solicitar("GET", "/graphql/esquema.graphql", esperado=200)

    codigo, datos, headers = cliente.solicitar(
        "GET", "/api/v1/autenticacion/csrf", esperado=200
    )
    assert "csrf" in datos, "Respuesta de /autenticacion/csrf no contiene campo 'csrf'"
    print("OK: Rutas públicas y salud operativas sin autenticación.")


def probar_bloqueo_rutas_internas_y_suplantacion(base_url: str):
    """Verifica que /api/v1/interno esté bloqueado y que no se puedan falsificar cabeceras de servicio."""
    cliente = SesionCliente(base_url)

    # 1. Acceso a /api/v1/interno debe dar 403 por NGINX
    cliente.solicitar(
        "POST",
        "/api/v1/interno/autorizar",
        datos={"accion": "elecciones:leer"},
        esperado=403,
    )
    cliente.solicitar(
        "POST",
        "/interno/autorizar",
        datos={"accion": "elecciones:leer"},
        esperado=403,
    )

    # 2. Intento de inyectar cabeceras internas a ruta interna -> 403
    cliente.solicitar(
        "POST",
        "/api/v1/interno/autorizar",
        datos={"accion": "elecciones:leer"},
        cabeceras={
            "X-Servicio": "elecciones",
            "X-Clave-Servicio": "clave-falsa-para-probar-bloqueo",
        },
        esperado=403,
    )

    # 3. Intento de saltar la autenticación de usuario enviando X-Servicio a endpoints de negocio -> 401
    cliente.solicitar(
        "POST",
        "/api/v1/elecciones",
        datos={"nombre": "Elección suplantada", "estado": "borrador"},
        cabeceras={
            "X-Servicio": "elecciones",
            "X-Clave-Servicio": "clave-falsa",
        },
        esperado=401,
    )
    print("OK: Bloqueo de rutas internas y prevención de suplantación de cabeceras verificado.")


def probar_rechazo_anonimo(base_url: str):
    """Verifica que los seis microservicios y GraphQL rechacen solicitudes sin sesión con 401."""
    cliente = SesionCliente(base_url)
    uuid_prueba = str(uuid4())

    rutas_protegidas = [
        ("GET", "/api/v1/identidades"),
        ("POST", "/api/v1/identidades", {"nombre": "Test", "estado": "activa"}),
        ("GET", "/api/v1/elecciones"),
        ("POST", "/api/v1/elecciones", {"nombre": "Test", "estado": "borrador"}),
        ("GET", "/api/v1/candidaturas"),
        ("POST", "/api/v1/candidaturas", {"idEleccion": uuid_prueba, "nombre": "Test", "tipo": "lista", "estado": "borrador"}),
        ("GET", "/api/v1/inscripciones"),
        ("POST", "/api/v1/inscripciones", {"idEleccion": uuid_prueba, "elegible": True}),
        ("POST", "/api/v1/votos", {"idEleccion": uuid_prueba}),
        ("GET", f"/api/v1/votos/{uuid_prueba}"),
        ("GET", f"/api/v1/resultados/{uuid_prueba}"),
        ("GET", "/api/v1/autenticacion/yo"),
        ("GET", "/api/v1/organizaciones"),
        ("GET", "/api/v1/usuarios"),
    ]

    for item in rutas_protegidas:
        metodo = item[0]
        ruta = item[1]
        cuerpo = item[2] if len(item) > 2 else None
        codigo, _, _ = cliente.solicitar(metodo, ruta, datos=cuerpo)
        assert codigo == 401, f"Fallo en rechazo anónimo {metodo} {ruta}: esperado 401, recibido {codigo}"

    # GraphQL anónimo
    codigo_gql, datos_gql, _ = cliente.solicitar(
        "POST",
        "/graphql",
        datos={"query": "query { resumen { totalElecciones } }"},
    )
    assert codigo_gql in (401, 403), f"GraphQL anónimo debe retornar 401 o 403, recibido: {codigo_gql}"

    print("OK: Rechazo de acceso anónimo (401) comprobado en los seis microservicios y GraphQL.")


def probar_mecanismo_csrf(base_url: str, usuario_superadmin: str, clave_superadmin: str):
    """Verifica la validación rigurosa de origen y token CSRF en operaciones con estado."""
    cliente = SesionCliente(base_url)
    cliente.obtener_csrf()

    # 1. Petición POST sin Origin
    cliente.solicitar(
        "POST",
        "/api/v1/autenticacion/login",
        datos={"usuario": usuario_superadmin, "contrasena": clave_superadmin},
        cabeceras={"X-CSRF-Token": cliente.token_csrf},
        esperado=403,
    )

    # 2. Petición POST con Origin no permitido
    cliente.solicitar(
        "POST",
        "/api/v1/autenticacion/login",
        datos={"usuario": usuario_superadmin, "contrasena": clave_superadmin},
        cabeceras={
            "Origin": "http://origen-malicioso.com",
            "X-CSRF-Token": cliente.token_csrf,
        },
        esperado=403,
    )

    # 3. Petición POST sin cabecera X-CSRF-Token
    cliente.solicitar(
        "POST",
        "/api/v1/autenticacion/login",
        datos={"usuario": usuario_superadmin, "contrasena": clave_superadmin},
        cabeceras={"Origin": cliente.origen},
        esperado=403,
    )

    # 4. Petición POST con X-CSRF-Token manipulado/falso
    cliente.solicitar(
        "POST",
        "/api/v1/autenticacion/login",
        datos={"usuario": usuario_superadmin, "contrasena": clave_superadmin},
        cabeceras={
            "Origin": cliente.origen,
            "X-CSRF-Token": "token-falso-manipulado-00000000000000000000",
        },
        esperado=403,
    )
    print("OK: Validación de CSRF y verificación de Origen confirmada.")


def ejecutar_suite_completa(
    base_url: str,
    usuario_superadmin: str,
    clave_superadmin: str,
):
    """Ejecuta la suite integral de autenticación, multitenancy y autorización."""
    comprobar_aislamiento(base_url, True)
    print("=" * 70)
    print("INICIANDO SUITE DE PRUEBAS DE AUTENTICACIÓN Y AUTORIZACIÓN (FASE M)")
    print(f"URL Objetivo: {base_url}")
    print("=" * 70)

    # 1. Comprobación estática de puertos
    probar_puertos_infraestructura()

    # 2. Rutas públicas y salud
    cliente_anonimo = SesionCliente(base_url)
    probar_rutas_publicas(cliente_anonimo)

    # 3. Bloqueo de rutas internas y suplantación
    probar_bloqueo_rutas_internas_y_suplantacion(base_url)

    # 4. Rechazo anónimo en todas las API
    probar_rechazo_anonimo(base_url)

    # 5. Validación de CSRF
    probar_mecanismo_csrf(base_url, usuario_superadmin, clave_superadmin)

    # 6. Inicio de sesión y verificación de credenciales
    cliente_super = SesionCliente(base_url)
    cliente_super.obtener_csrf()

    # 6.1 Credenciales incorrectas
    cliente_super.solicitar(
        "POST",
        "/api/v1/autenticacion/login",
        datos={"usuario": "no_existe", "contrasena": "ClaveInexistente123!"},
        cabeceras={"Origin": cliente_super.origen, "X-CSRF-Token": cliente_super.token_csrf},
        esperado=401,
    )
    cliente_super.solicitar(
        "POST",
        "/api/v1/autenticacion/login",
        datos={"usuario": usuario_superadmin, "contrasena": "ClaveIncorrecta123!"},
        cabeceras={"Origin": cliente_super.origen, "X-CSRF-Token": cliente_super.token_csrf},
        esperado=401,
    )

    # 6.2 Login exitoso de SUPERADMIN
    datos_login = cliente_super.login(usuario_superadmin, clave_superadmin)
    print(f"OK: Login exitoso de SUPERADMIN ('{datos_login.get('usuario')}').")

    # 6.3 Verificación de sesión en /yo
    _, yo, _ = cliente_super.solicitar("GET", "/api/v1/autenticacion/yo", esperado=200)
    roles = [r.get("rol") for r in yo.get("roles", [])]
    assert "SUPERADMIN" in roles, f"Roles esperados con SUPERADMIN, recibido: {roles}"
    print("OK: /autenticacion/yo confirmó rol SUPERADMIN.")

    # 7. Gestión de organizaciones y usuarios
    nom_org_a = f"Organización Alfa {uuid4().hex[:6]}"
    nom_org_b = f"Organización Beta {uuid4().hex[:6]}"
    cabeceras_write_super = {
        "Origin": cliente_super.origen,
        "X-CSRF-Token": cliente_super.token_csrf,
    }

    _, org_a, _ = cliente_super.solicitar(
        "POST", "/api/v1/organizaciones", datos={"nombre": nom_org_a}, cabeceras=cabeceras_write_super, esperado=201
    )
    id_org_a = org_a["idOrganizacion"]

    _, org_b, _ = cliente_super.solicitar(
        "POST", "/api/v1/organizaciones", datos={"nombre": nom_org_b}, cabeceras=cabeceras_write_super, esperado=201
    )
    id_org_b = org_b["idOrganizacion"]
    print(f"OK: Organizaciones creadas: Alfa ({id_org_a}) y Beta ({id_org_b}).")

    # Crear usuarios de prueba
    clave_comun = secrets.token_urlsafe(24)
    usr_admin_a = f"admin.a.{uuid4().hex[:6]}"
    usr_elector_a = f"elector.a.{uuid4().hex[:6]}"
    usr_admin_b = f"admin.b.{uuid4().hex[:6]}"

    cliente_super.solicitar(
        "POST",
        "/api/v1/usuarios",
        datos={"usuario": usr_admin_a, "contrasena": clave_comun, "idOrganizacion": id_org_a, "rol": "ADMIN_ELECTORAL"},
        cabeceras=cabeceras_write_super,
        esperado=201,
    )
    cliente_super.solicitar(
        "POST",
        "/api/v1/usuarios",
        datos={"usuario": usr_elector_a, "contrasena": clave_comun, "idOrganizacion": id_org_a, "rol": "ELECTOR"},
        cabeceras=cabeceras_write_super,
        esperado=201,
    )
    cliente_super.solicitar(
        "POST",
        "/api/v1/usuarios",
        datos={"usuario": usr_admin_b, "contrasena": clave_comun, "idOrganizacion": id_org_b, "rol": "ADMIN_ELECTORAL"},
        cabeceras=cabeceras_write_super,
        esperado=201,
    )
    print("OK: Usuarios con roles específicos creados en sus respectivas organizaciones.")

    # 8. Prevención de escalamiento de privilegios
    cliente_admin_a = SesionCliente(base_url)
    cliente_admin_a.login(usr_admin_a, clave_comun, id_org_a)
    cabeceras_write_admin_a = {
        "Origin": cliente_admin_a.origen,
        "X-CSRF-Token": cliente_admin_a.token_csrf,
        "X-Organizacion": id_org_a,
    }

    # admin_a intenta crear un SUPERADMIN -> 403
    cliente_admin_a.solicitar(
        "POST",
        "/api/v1/usuarios",
        datos={"usuario": f"fake.super.{uuid4().hex[:6]}", "contrasena": clave_comun, "idOrganizacion": id_org_a, "rol": "SUPERADMIN"},
        cabeceras=cabeceras_write_admin_a,
        esperado=403,
    )
    # admin_a intenta crear un ADMIN_ELECTORAL -> 403 (solo SUPERADMIN puede nombrar administradores electorales)
    cliente_admin_a.solicitar(
        "POST",
        "/api/v1/usuarios",
        datos={"usuario": f"otro.admin.{uuid4().hex[:6]}", "contrasena": clave_comun, "idOrganizacion": id_org_a, "rol": "ADMIN_ELECTORAL"},
        cabeceras=cabeceras_write_admin_a,
        esperado=403,
    )
    # admin_a intenta modificar su organización -> 403 (solo SUPERADMIN)
    cliente_admin_a.solicitar(
        "PUT",
        f"/api/v1/organizaciones/{id_org_a}",
        datos={"nombre": "Nuevo Nombre Ilegal", "activa": True},
        cabeceras=cabeceras_write_admin_a,
        esperado=403,
    )
    # admin_a intenta operar sobre Org Beta -> 403
    cliente_admin_a.solicitar(
        "POST",
        "/api/v1/usuarios",
        datos={"usuario": f"infiltrado.{uuid4().hex[:6]}", "contrasena": clave_comun, "idOrganizacion": id_org_b, "rol": "ELECTOR"},
        cabeceras=cabeceras_write_admin_a,
        esperado=403,
    )
    print("OK: Prevención de escalamiento de privilegios y contención de rol administrativo confirmada.")

    # 9. Aislamiento Multitenancy
    # admin_a crea elección en Org Alfa
    _, eleccion_a, _ = cliente_admin_a.solicitar(
        "POST",
        "/api/v1/elecciones",
        datos={"nombre": f"Elección Alfa {uuid4().hex[:6]}", "estado": "borrador"},
        cabeceras=cabeceras_write_admin_a,
        esperado=201,
    )
    id_eleccion_a = eleccion_a["idEleccion"]

    # admin_a crea candidatura en Elección Alfa
    _, cand_a, _ = cliente_admin_a.solicitar(
        "POST",
        "/api/v1/candidaturas",
        datos={"idEleccion": id_eleccion_a, "nombre": "Frente Alfa", "tipo": "lista", "estado": "borrador"},
        cabeceras=cabeceras_write_admin_a,
        esperado=201,
    )
    id_cand_a = cand_a["idCandidatura"]

    # admin_a crea inscripción en Elección Alfa
    _, insc_a, _ = cliente_admin_a.solicitar(
        "POST",
        "/api/v1/inscripciones",
        datos={"idEleccion": id_eleccion_a, "elegible": True},
        cabeceras=cabeceras_write_admin_a,
        esperado=201,
    )
    id_insc_a = insc_a["idInscripcion"]
    print("OK: Recursos creados en Organización Alfa (elección, candidatura, inscripción).")

    # Iniciar sesión como admin_b (Org Beta) y comprobar aislamiento
    cliente_admin_b = SesionCliente(base_url)
    cliente_admin_b.login(usr_admin_b, clave_comun, id_org_b)
    cabeceras_write_admin_b = {
        "Origin": cliente_admin_b.origen,
        "X-CSRF-Token": cliente_admin_b.token_csrf,
        "X-Organizacion": id_org_b,
    }

    # admin_b intenta leer elección de Org Alfa -> 403
    cliente_admin_b.solicitar(
        "GET",
        f"/api/v1/elecciones/{id_eleccion_a}",
        cabeceras={"X-Organizacion": id_org_b},
        esperado=403,
    )
    # admin_b intenta modificar elección de Org Alfa -> 403
    cliente_admin_b.solicitar(
        "PUT",
        f"/api/v1/elecciones/{id_eleccion_a}",
        datos={"nombre": "Elección Alterada", "estado": "borrador"},
        cabeceras=cabeceras_write_admin_b,
        esperado=403,
    )
    # admin_b intenta leer candidatura de Org Alfa -> 403
    cliente_admin_b.solicitar(
        "GET",
        f"/api/v1/candidaturas/{id_cand_a}",
        cabeceras={"X-Organizacion": id_org_b},
        esperado=403,
    )
    # admin_b intenta leer inscripción de Org Alfa -> 403
    cliente_admin_b.solicitar(
        "GET",
        f"/api/v1/inscripciones/{id_insc_a}",
        cabeceras={"X-Organizacion": id_org_b},
        esperado=403,
    )
    # admin_b lista elecciones -> la elección Alfa no aparece
    _, lista_beta, _ = cliente_admin_b.solicitar(
        "GET", "/api/v1/elecciones", cabeceras={"X-Organizacion": id_org_b}, esperado=200
    )
    ids_en_beta = [el.get("idEleccion") for el in lista_beta.get("elementos", [])]
    assert id_eleccion_a not in ids_en_beta, f"Violación de aislamiento: id {id_eleccion_a} visible para Org Beta"

    print("OK: Aislamiento multitenancy verificado (403 y exclusión de listas en accesos cruzados).")

    # 10. Restricción de permisos para rol ELECTOR
    cliente_elector_a = SesionCliente(base_url)
    cliente_elector_a.login(usr_elector_a, clave_comun, id_org_a)
    cabeceras_elector_a = {
        "Origin": cliente_elector_a.origen,
        "X-CSRF-Token": cliente_elector_a.token_csrf,
        "X-Organizacion": id_org_a,
    }

    # ELECTOR intenta crear elecciones -> 403
    cliente_elector_a.solicitar(
        "POST",
        "/api/v1/elecciones",
        datos={"nombre": "Elección de Elector", "estado": "borrador"},
        cabeceras=cabeceras_elector_a,
        esperado=403,
    )
    # ELECTOR intenta leer elección en estado 'borrador' -> 403 (lectura limitada)
    cliente_elector_a.solicitar(
        "GET",
        f"/api/v1/elecciones/{id_eleccion_a}",
        cabeceras={"X-Organizacion": id_org_a},
        esperado=403,
    )

    # admin_a promueve elección a 'programada'
    cliente_admin_a.solicitar(
        "PUT",
        f"/api/v1/elecciones/{id_eleccion_a}",
        datos={"nombre": "Elección Alfa Oficial", "estado": "programada"},
        cabeceras=cabeceras_write_admin_a,
        esperado=200,
    )

    # ELECTOR ahora puede leer la elección 'programada' -> 200
    cliente_elector_a.solicitar(
        "GET",
        f"/api/v1/elecciones/{id_eleccion_a}",
        cabeceras={"X-Organizacion": id_org_a},
        esperado=200,
    )

    # ELECTOR consulta GraphQL -> 200
    query_gql = """
    query ObtenerElecciones {
      elecciones(pagina: 1, limite: 5) {
        elementos {
          idEleccion
          nombre
          estado
        }
      }
    }
    """
    codigo_gql, resp_gql, _ = cliente_elector_a.solicitar(
        "POST",
        "/graphql",
        datos={"query": query_gql},
        cabeceras={"X-Organizacion": id_org_a},
        esperado=200,
    )
    assert "data" in resp_gql and "elecciones" in resp_gql["data"], f"Respuesta GraphQL inválida: {resp_gql}"
    print("OK: Restricciones de ELECTOR y resolución controlada en GraphQL verificadas.")

    # 11. Cierre de sesión y revocación inmediata
    cookie_anterior = cliente_admin_a.capturar_cookie_sesion()
    cliente_admin_a.logout()
    # Cliente sin cookies nuevas ni login: envía literalmente la cookie anterior.
    # Cookie explícita impide que CookieJar sustituya la sesión borrada por logout.
    cliente_reuso = SesionCliente(base_url)
    cliente_reuso.solicitar(
        "GET", "/api/v1/autenticacion/yo",
        cabeceras={"Cookie": cookie_anterior}, esperado=401,
    )
    cliente_reuso.solicitar(
        "GET",
        f"/api/v1/elecciones/{id_eleccion_a}",
        cabeceras={"Cookie": cookie_anterior, "X-Organizacion": id_org_a},
        esperado=401,
    )
    print("OK: Cierre de sesión y revocación en base de datos verificados (sesión invalidada retorna 401).")

    print("=" * 70)
    print("TODAS LAS PRUEBAS DE LA SUITE DE AUTENTICACIÓN Y AUTORIZACIÓN RESULTARON EXITOSAS.")
    print("=" * 70)


class ArgumentosSeguros(argparse.ArgumentParser):
    def error(self, message):
        # argparse no debe repetir argumentos desconocidos que pudieran contener secretos.
        self.print_usage(sys.stderr)
        self.exit(2, 'Parámetros inválidos; consulte --help. No pase contraseñas como argumentos.\n')


def main():
    global _aislamiento
    parser = ArgumentosSeguros(description='Suite de autenticación; requiere aislamiento explícito antes de toda solicitud.')
    parser.add_argument('--solo-estatico', action='store_true', help='Solo inspección estática, sin credenciales ni red')
    parser.add_argument('--url', help='URL aislada explícita; sin valor predeterminado')
    parser.add_argument('--usuario-superadmin', help='Cuenta administrativa de prueba explícita')
    parser.add_argument('--entorno-aislado', help='sigape-auth-test o sigape-auth-pruebas- seguido de 8 a 32 caracteres')
    parser.add_argument('--configuracion-aislamiento', help='JSON privado con composición resuelta e inspecciones recientes')
    parser.add_argument('--confirmar-escrituras', help='AUTORIZO-ESCRITURAS-EN: seguido del identificador exacto')
    modo = parser.add_mutually_exclusive_group()
    modo.add_argument('--clave-por-stdin', action='store_true', help='Leer contraseña de prueba desde stdin, nunca argv')
    modo.add_argument('--clave-por-entorno', action='store_true', help='Consumir SIGAPE_PRUEBA_CLAVE del entorno de este proceso')
    args = parser.parse_args()
    if args.solo_estatico:
        exigir(not any((args.url, args.usuario_superadmin, args.entorno_aislado,
                        args.configuracion_aislamiento, args.confirmar_escrituras,
                        args.clave_por_stdin, args.clave_por_entorno)),
               'El modo estático no acepta parámetros de ejecución ni credenciales.')
        probar_puertos_infraestructura()
        return
    exigir(all((args.url, args.usuario_superadmin, args.entorno_aislado,
                args.configuracion_aislamiento, args.confirmar_escrituras)),
           'Faltan URL, usuario, entorno aislado, evidencia o confirmación explícita.')
    exigir(args.clave_por_stdin or args.clave_por_entorno, 'Seleccione entrada de contraseña explícita.')
    _aislamiento = AislamientoAutorizado(args.configuracion_aislamiento,
                                       args.entorno_aislado, args.url, args.confirmar_escrituras)
    if args.clave_por_stdin:
        exigir(not sys.stdin.isatty(), 'Entregue la contraseña por un canal stdin privado, no como argumento.')
        clave = sys.stdin.read(4097).rstrip('\r\n')
    else:
        clave = os.environ.pop('SIGAPE_PRUEBA_CLAVE', '')
    exigir(bool(clave) and len(clave) <= 4096, 'Contraseña de prueba ausente o demasiado larga.')
    ejecutar_suite_completa(_aislamiento.base, args.usuario_superadmin, clave)


if __name__ == '__main__':
    try:
        main()
    except (ConfiguracionInsegura, KeyError, TypeError, ValueError, OSError):
        # No volcar entradas JSON, cuerpos HTTP, contraseñas, cookies ni tokens.
        print('Suite abortada: configuración de aislamiento o parámetros ausentes, inválidos o caducados.', file=sys.stderr)
        sys.exit(2)
