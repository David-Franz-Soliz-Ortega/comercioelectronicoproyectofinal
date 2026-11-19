import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { validarClave } from './restablecer-superadmin-operacion.js';

const proyecto = 'sigape-auth-test';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function exigir(valor: unknown, mensaje: string): asserts valor { if (!valor) throw new Error(mensaje); }
export function parametros(argumentos: string[]) {
  const opciones = new Map<string, string>();
  for (let i = 0; i < argumentos.length; i++) {
    const clave = argumentos[i];
    exigir(['--simular', '--aplicar', '--entorno', '--id-usuario', '--evidencia', '--confirmar'].includes(clave) && !opciones.has(clave), 'Argumentos desconocidos o repetidos.');
    if (['--simular', '--aplicar'].includes(clave)) opciones.set(clave, 'si');
    else { const valor = argumentos[++i]; exigir(valor && !valor.startsWith('--'), 'Falta un parámetro explícito.'); opciones.set(clave, valor); }
  }
  const simular = opciones.has('--simular');
  exigir(simular !== opciones.has('--aplicar') && opciones.get('--entorno') === proyecto, 'Seleccione modo y entorno aislado explícitos.');
  const id = opciones.get('--id-usuario') ?? ''; exigir(uuid.test(id), 'Se exige UUID explícito.');
  const evidencia = opciones.get('--evidencia'); exigir(evidencia && isAbsolute(evidencia), 'Se exige evidencia privada absoluta.');
  exigir(simular ? !opciones.has('--confirmar') : opciones.get('--confirmar') === `RESTABLECER:${proyecto}:${id}`, 'Confirmación explícita no válida.');
  return { simular, id, evidencia };
}
function docker(...args: string[]) { return execFileSync('docker', args, { encoding: 'utf8', timeout: 15000, maxBuffer: 4_000_000, stdio: ['ignore', 'pipe', 'pipe'] }); }
function dentro(raiz: string, ruta: string) { const distancia = relative(raiz, realpathSync(ruta)); return distancia !== '' && distancia !== '..' && !distancia.startsWith('../') && !isAbsolute(distancia); }
export function verificarAislamiento(evidencia: string) {
  const archivo = realpathSync(evidencia), estado = statSync(archivo);
  exigir(estado.isFile() && estado.uid === process.getuid?.() && (estado.mode & 0o077) === 0 && estado.size <= 2_000_000, 'Evidencia no privada.');
  const manifiesto = JSON.parse(readFileSync(archivo, 'utf8'));
  const edad = Date.now() - Date.parse(manifiesto.capturadoEn);
  exigir(manifiesto.version === 1 && manifiesto.idEntorno === proyecto && manifiesto.urlBase === 'http://127.0.0.1:8888' && edad >= 0 && edad <= 600000, 'Evidencia ausente, caducada o ajena.');
  const raiz = realpathSync(manifiesto.directorioAislado);
  const composicion = manifiesto.composicion;
  exigir(composicion.name === proyecto && composicion.services.identidad.environment.COOKIE_SEGURA === 'false', 'Composición ambigua.');
  for (const grupo of ['volumes', 'networks']) for (const recurso of Object.values(composicion[grupo]) as any[]) {
    exigir(!recurso.external && !recurso.driver_opts && recurso.name.startsWith(proyecto + '_'), 'Recurso externo o compartido.');
  }
  function inspeccionar(nombre: string): any[] {
    const ids = docker('ps', '-aq', '--filter', 'label=com.docker.compose.project=' + nombre).trim().split(/\s+/).filter(Boolean);
    exigir(ids.length > 0, 'Proyecto no inspeccionable.'); return JSON.parse(docker('inspect', ...ids));
  }
  const principal = inspeccionar('sigape'), candidato = inspeccionar(proyecto);
  const idsPrevistos = new Set(manifiesto.candidato.map((c: any) => c.Id));
  exigir(candidato.length === Object.keys(composicion.services).length && candidato.length === idsPrevistos.size && candidato.every(c => idsPrevistos.has(c.Id)), 'Contenedores distintos de la evidencia.');
  const volumenes = new Set(principal.flatMap(c => c.Mounts.filter((m: any) => m.Type === 'volume').map((m: any) => m.Name)));
  const rutas = principal.flatMap(c => c.Mounts.map((m: any) => resolve(m.Source)));
  const redes = new Set(principal.flatMap(c => Object.keys(c.NetworkSettings.Networks)));
  const vistos = new Set(); let publicaciones = 0;
  for (const c of candidato) {
    const nombre = c.Config.Labels['com.docker.compose.service'], servicio = composicion.services[nombre];
    exigir(servicio && !vistos.has(nombre) && c.Config.Labels['com.docker.compose.project'] === proyecto, 'Servicio ambiguo.'); vistos.add(nombre);
    exigir(!servicio.container_name && !servicio.network_mode && !servicio.volumes_from && !c.HostConfig.Privileged && !c.HostConfig.NetworkMode.startsWith('container:') && !['host', 'none'].includes(c.HostConfig.NetworkMode), 'Namespace no aislado.');
    exigir(c.State.Running && c.State.Health?.Status === 'healthy' || nombre === 'configurar-mensajeria' && c.State.Status === 'exited' && c.State.ExitCode === 0, 'Candidato no saludable.');
    for (const red of Object.keys(c.NetworkSettings.Networks)) exigir(red.startsWith(proyecto + '_') && !redes.has(red) && Object.values(composicion.networks).some((r: any) => r.name === red), 'Red compartida.');
    for (const m of c.Mounts) {
      const declaracion = servicio.volumes?.find((v: any) => v.target === m.Destination);
      if (m.Type === 'volume') exigir(!rutas.includes(resolve(m.Source)) && !volumenes.has(m.Name) && (declaracion ? composicion.volumes[declaracion.source]?.name === m.Name : /^[a-f0-9]{64}$/.test(m.Name)), 'Volumen compartido o inesperado.');
      else exigir(m.Type === 'bind' && !m.RW && dentro(raiz, m.Source) && declaracion?.read_only === true && realpathSync(declaracion.source) === realpathSync(m.Source) && !rutas.some((r: string) => r === m.Source || m.Source.startsWith(r + '/') || r.startsWith(m.Source + '/')), 'Montaje compartido o no acreditado.');
    }
    for (const enlaces of Object.values(c.NetworkSettings.Ports ?? {}) as any[]) for (const enlace of enlaces ?? []) {
      exigir(nombre === 'entrada-nginx' && enlace.HostIp === '127.0.0.1' && enlace.HostPort === '8888', 'Puerto no aislado.'); publicaciones++;
    }
  }
  for (const [grupo, tipo] of [['volumes', 'volume'], ['networks', 'network']]) {
    for (const previsto of Object.values(composicion[grupo]) as any[]) {
      const recurso = JSON.parse(docker(tipo, 'inspect', previsto.name))[0];
      exigir(recurso.Labels?.['com.docker.compose.project'] === proyecto &&
        recurso.Driver === (tipo === 'volume' ? 'local' : 'bridge') &&
        Object.keys(recurso.Options ?? {}).length === 0, 'Recurso físico no acreditado.');
    }
  }
  exigir(publicaciones === 1, 'Publicación ambigua.');
  const identidad = candidato.find(c => c.Config.Labels['com.docker.compose.service'] === 'identidad');
  const postgres = candidato.find(c => c.Config.Labels['com.docker.compose.service'] === 'base-postgres');
  exigir(identidad && postgres, 'Falta identidad o PostgreSQL.');
  const direcciones = Object.values(postgres.NetworkSettings.Networks).map((r: any) => r.IPAddress).filter(Boolean);
  exigir(direcciones.length > 0, 'PostgreSQL no tiene dirección acreditada.');
  return { contenedor: identidad.Id as string, direcciones };
}
async function leerPrivada(etiqueta: string): Promise<Buffer> {
  exigir(process.stdin.isTTY && process.stdin.setRawMode, 'La contraseña requiere terminal privado, nunca archivos, argumentos o variables.');
  process.stderr.write(etiqueta + ': '); process.stdin.setRawMode(true); process.stdin.resume();
  try { return await new Promise<Buffer>((aceptar, rechazar) => {
    let bytes: number[] = [];
    const terminar = () => process.stdin.removeListener('data', recibir);
    const recibir = (bloque: Buffer) => {
      for (const valor of bloque) {
        if (valor === 3 || valor === 4) { bytes.fill(0); terminar(); rechazar(new Error('Cancelado.')); return; }
        if (valor === 13 || valor === 10) { const salida = Buffer.from(bytes); bytes.fill(0); terminar(); aceptar(salida); return; }
        if (valor === 127 || valor === 8) bytes.pop(); else bytes.push(valor);
        if (bytes.length > 72) { bytes.fill(0); terminar(); rechazar(new Error('Entrada excesiva.')); return; }
      }
    }; process.stdin.on('data', recibir);
  }); } finally { process.stdin.setRawMode(false); process.stdin.pause(); process.stderr.write('\n'); }
}
let fase = 'parametros';
export function diagnosticoSeguro(error: unknown, etapa: string) {
  const permitidos = ['Contraseña no válida.', 'Las entradas no coinciden.', 'Cancelado.', 'Entrada excesiva.', 'Evidencia ausente, caducada o ajena.', 'El destino cambió.', 'Operación abortada.', 'Resultado no acreditado.'];
  const mensaje = error instanceof Error && permitidos.includes(error.message) ? error.message : 'Validación no acreditada; detalles sensibles omitidos.';
  return `ABORTADO [${etapa}]: ${mensaje}`;
}
export async function principal() {
  const opciones = parametros(process.argv.slice(2)); const antes = (fase = 'aislamiento-inicial', verificarAislamiento(opciones.evidencia));
  let clave: Buffer | undefined, repetida: Buffer | undefined;
  try {
    if (!opciones.simular) {
      fase = 'entrada-privada';
      clave = await leerPrivada('Nueva contraseña (sin eco)'); repetida = await leerPrivada('Repita la contraseña (sin eco)');
      fase = 'confirmacion-privada';
      exigir(clave.length === repetida.length && timingSafeEqual(clave, repetida), 'Las entradas no coinciden.'); fase = 'politica-contrasena'; validarClave(clave.toString('utf8'));
    }
    fase = 'aislamiento-final';
    const ahora = verificarAislamiento(opciones.evidencia);
    exigir(antes.contenedor === ahora.contenedor && JSON.stringify(antes.direcciones) === JSON.stringify(ahora.direcciones), 'El destino cambió.');
    fase = 'programa-compilado';
    const codigo = readFileSync(new URL('./restablecer-superadmin-operacion.js', import.meta.url), 'utf8') + '\nawait ejecutarOperacionPrivada().catch(()=>{console.error("Operación rechazada; no se imprimen detalles sensibles.");process.exitCode=1;});';
    fase = 'transaccion-contenedor';
    const hijo = spawn('docker', ['exec', '-i', ahora.contenedor, 'node', '--input-type=module', '-e', codigo], { stdio: ['pipe', 'pipe', 'pipe'] });
    const entrada = { proyecto, idUsuario: opciones.id, simular: opciones.simular, direcciones: ahora.direcciones, clave: clave?.toString('utf8') };
    hijo.stdin.end(JSON.stringify(entrada)); entrada.clave = undefined;
    let salida = ''; hijo.stdout.on('data', parte => { salida += parte; }); hijo.stderr.resume();
    await new Promise<void>((aceptar, rechazar) => { hijo.on('error', rechazar); hijo.on('close', estado => estado === 0 ? aceptar() : rechazar(new Error('Operación abortada.'))); });
    fase = 'confirmacion-resultado';
    const resultado = JSON.parse(salida); exigir(resultado.idUsuario === opciones.id && resultado.simulacion === opciones.simular && resultado.cambios === !opciones.simular, 'Resultado no acreditado.');
    console.log(JSON.stringify({ idUsuario: opciones.id, simulacion: opciones.simular, cambios: resultado.cambios }));
  } finally { clave?.fill(0); repetida?.fill(0); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  principal().catch(error => { console.error(diagnosticoSeguro(error, fase)); process.exitCode = 1; });
}
