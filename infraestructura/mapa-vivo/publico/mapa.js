// Pantalla del mapa vivo. Solo dibuja lo que llega por /api/flujo: sin datos,
// los nodos quedan en "sin datos" y no se inventa actividad.
import { NODOS, ARISTAS, medidas, trazo, clave, recorrido, existeArista } from './disposicion.js';

const SVG = 'http://www.w3.org/2000/svg';
const PASO_MS = 560;
const MAX_PARTICULAS = 180;
const CONSUMIDORES = ['conteo', 'auditoria'];
const COLOR = {
  operadores: '#7dd3fc', publico: '#5eead4', denegado: '#fb7185', caido: '#fb7185', error: '#fb7185',
  conflicto: '#fbbf24', rechazado: '#fbbf24', ocupado: '#fbbf24', 'no-encontrado': '#94a3b8',
  nueva: '#fcd34d', correccion: '#c4b5fd', observada: '#fbbf24', anulacion: '#94a3b8',
  rafaga: '#93c5fd', grpc: '#c084fc', recuperado: '#34d399', ataque: '#fb7185',
};
const ICONOS = {
  acta: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h4"/>',
  correccion: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  alerta: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  caida: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  escudo: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  rayo: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
};

const lienzo = document.getElementById('lienzo');
const aristas = new Map();
const nodos = {};
const particulas = new Set();
let capaParticulas;
let capaEtiquetas;
let estado = null;
let reiniciosEnCaida = {};
let llegadaActas = 0;
let resultadosPrevios = {};

function svg(nombre, atributos = {}, padre = null) {
  const e = document.createElementNS(SVG, nombre);
  for (const [k, v] of Object.entries(atributos)) e.setAttribute(k, v);
  if (padre) padre.appendChild(e);
  return e;
}

function html(nombre, clase = '', texto = '') {
  const e = document.createElement(nombre);
  if (clase) e.className = clase;
  if (texto) e.textContent = texto;
  return e;
}

const numero = new Intl.NumberFormat('es-BO');
const duracion = ms => ms == null ? '—' : ms < 1000 ? `${numero.format(ms)} ms` : `${(ms / 1000).toLocaleString('es-BO', { maximumFractionDigits: 1 })} s`;

// ---------- Construcción del mapa ----------
function construir() {
  const defs = svg('defs', {}, lienzo);
  const filtro = svg('filter', { id: 'brillo', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  svg('feGaussianBlur', { stdDeviation: '3.2', result: 'difuso' }, filtro);
  const mezcla = svg('feMerge', {}, filtro);
  svg('feMergeNode', { in: 'difuso' }, mezcla);
  svg('feMergeNode', { in: 'SourceGraphic' }, mezcla);
  const rayado = svg('pattern', { id: 'rayado', width: '10', height: '10', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  svg('rect', { width: '4', height: '10', fill: 'rgba(251,113,133,0.22)' }, rayado);

  // Recorrido de un acta, para quien llega sin saber qué mirar.
  const pasos = svg('g', { class: 'pasos' }, lienzo);
  ['Foto y lectura OCR', 'Registro autorizado', 'Evento en RabbitMQ', 'Conteo en MongoDB', 'Resultado público'].forEach((texto, i) => {
    const g = svg('g', { transform: `translate(${40 + i * 206} -62)` }, pasos);
    svg('circle', { cx: 13, cy: 0, r: 13 }, g);
    svg('text', { class: 'paso-numero', x: 13, y: 4.5, 'text-anchor': 'middle' }, g).textContent = String(i + 1);
    const etiqueta = svg('text', { class: 'paso-texto', x: 34, y: 5 }, g);
    etiqueta.textContent = texto;
    const fin = 34 + etiqueta.getComputedTextLength();
    if (i < 4) svg('path', { class: 'paso-flecha', d: `M${fin + 8} 0H${Math.max(fin + 20, 196)}m-4 -4 4 4-4 4` }, g);
  });

  const capaAristas = svg('g', { class: 'capa-aristas' }, lienzo);
  for (const [desde, hasta, tipo, curva] of ARISTAS) {
    const camino = svg('path', { d: trazo(desde, hasta, curva), class: `arista ${tipo}` }, capaAristas);
    aristas.set(clave(desde, hasta), { camino, desde, hasta, tipo, muestras: null, inversas: null });
    if (tipo === 'grpc') {
      const medio = camino.getPointAtLength(camino.getTotalLength() / 2);
      svg('text', { x: medio.x - 40, y: medio.y + 4, class: 'arista-etiqueta' }, capaAristas).textContent = 'gRPC';
    }
  }
  capaParticulas = svg('g', { class: 'capa-particulas', filter: 'url(#brillo)' }, lienzo);
  const capaNodos = svg('g', { class: 'capa-nodos' }, lienzo);
  for (const [id, nodo] of Object.entries(NODOS)) nodos[id] = construirNodo(id, nodo, capaNodos);
  capaEtiquetas = svg('g', { class: 'capa-etiquetas' }, lienzo);
}

function construirNodo(id, nodo, padre) {
  const [w, h] = medidas(id);
  const g = svg('g', { class: 'nodo', 'data-id': id, 'data-tipo': nodo.tipo, 'data-estado': nodo.tipo === 'persona' ? 'ok' : 'sin-datos', transform: `translate(${nodo.x - w / 2} ${nodo.y - h / 2})` }, padre);
  svg('rect', { class: 'halo', x: -4, y: -4, width: w + 8, height: h + 8, rx: 18 }, g);
  svg('rect', { class: 'tarjeta-nodo', width: w, height: h, rx: 14 }, g);
  svg('rect', { class: 'rayado', width: w, height: h, rx: 14 }, g);
  const partes = { g, w, h };
  if (nodo.tipo === 'persona') {
    dibujarPersonas(g, id, w);
    svg('text', { class: 'nombre', x: w / 2, y: h - 26, 'text-anchor': 'middle' }, g).textContent = nodo.nombre;
    svg('text', { class: 'detalle', x: w / 2, y: h - 11, 'text-anchor': 'middle' }, g).textContent = nodo.detalle;
    return partes;
  }
  svg('rect', { class: 'franja', x: 0, y: 12, width: 4, height: h - 24, rx: 2 }, g);
  svg('circle', { class: 'punto-estado', cx: w - 15, cy: 15, r: 5 }, g);
  svg('text', { class: 'nombre', x: 16, y: 26 }, g).textContent = nodo.nombre;
  svg('text', { class: 'detalle', x: 16, y: 43 }, g).textContent = nodo.detalle;
  partes.metrica = svg('text', { class: 'metrica', x: 16, y: 59 }, g);
  partes.metrica.textContent = 'Sin datos';
  partes.insignia = svg('g', { class: 'insignia', visibility: 'hidden' }, g);
  svg('rect', { x: w - 52, y: h - 22, width: 44, height: 16, rx: 8 }, partes.insignia);
  partes.insigniaTexto = svg('text', { x: w - 30, y: h - 10.5, 'text-anchor': 'middle' }, partes.insignia);
  return partes;
}

function dibujarPersonas(g, id, w) {
  if (id === 'operadores') {
    for (const [i, dx] of [-26, 0, 26].entries()) {
      const x = w / 2 + dx - 8;
      const y = 12 + (i === 1 ? 0 : 5);
      svg('rect', { class: 'persona-icono', x, y, width: 16, height: 27, rx: 3.5 }, g);
      svg('line', { class: 'persona-icono', x1: x + 6, y1: y + 23, x2: x + 10, y2: y + 23 }, g);
    }
  } else {
    svg('rect', { class: 'persona-icono', x: w / 2 - 22, y: 12, width: 44, height: 28, rx: 4 }, g);
    svg('line', { class: 'persona-icono', x1: w / 2 - 9, y1: 46, x2: w / 2 + 9, y2: 46 }, g);
    svg('path', { class: 'persona-icono', d: `M${w / 2 - 12} 32l7-7 6 5 9-10` }, g);
  }
}

// ---------- Partículas ----------
function muestras(desde, hasta) {
  const arista = aristas.get(clave(desde, hasta));
  if (!arista) return null;
  if (!arista.muestras) {
    const largo = arista.camino.getTotalLength();
    arista.muestras = Array.from({ length: 49 }, (_, i) => {
      const p = arista.camino.getPointAtLength((largo * i) / 48);
      return { x: p.x, y: p.y };
    });
    arista.inversas = [...arista.muestras].reverse();
  }
  return arista.desde === desde ? arista.muestras : arista.inversas;
}

function suavizar(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function lanzar({ ruta, color, radio = 6, paso = PASO_MS, alSalto = golpear, alLlegar = null, retraso = 0 }) {
  const segmentos = [];
  for (let i = 0; i < ruta.length - 1; i += 1) {
    const tramo = muestras(ruta[i], ruta[i + 1]);
    if (!tramo) return 0;
    segmentos.push(tramo);
  }
  if (!segmentos.length) return 0;
  const circulo = svg('circle', { class: 'particula', r: radio, fill: color, cx: NODOS[ruta[0]].x, cy: NODOS[ruta[0]].y, opacity: retraso ? 0 : 1 }, capaParticulas);
  particulas.add({ ruta, segmentos, circulo, paso, alSalto, alLlegar, inicio: performance.now() + retraso, ultimo: -1 });
  return retraso + paso * segmentos.length;
}

function activarArista(desde, hasta) {
  const arista = aristas.get(clave(desde, hasta));
  if (!arista) return;
  arista.camino.classList.add('activa');
  clearTimeout(arista.temporizador);
  arista.temporizador = setTimeout(() => arista.camino.classList.remove('activa'), PASO_MS * 1.4);
}

function cuadro(ahora) {
  for (const p of particulas) {
    const avance = (ahora - p.inicio) / p.paso;
    if (avance < 0) continue;
    if (avance >= p.segmentos.length) {
      particulas.delete(p);
      p.circulo.remove();
      p.alSalto?.(p.ruta[p.ruta.length - 1]);
      p.alLlegar?.();
      continue;
    }
    const i = Math.floor(avance);
    if (i > p.ultimo) {
      if (p.ultimo >= 0) p.alSalto?.(p.ruta[i]);
      activarArista(p.ruta[i], p.ruta[i + 1]);
      p.ultimo = i;
      p.circulo.setAttribute('opacity', '1');
    }
    const tramo = p.segmentos[i];
    const posicion = suavizar(avance - i) * (tramo.length - 1);
    const a = tramo[Math.floor(posicion)];
    const b = tramo[Math.min(tramo.length - 1, Math.floor(posicion) + 1)];
    const f = posicion - Math.floor(posicion);
    p.circulo.setAttribute('cx', a.x + (b.x - a.x) * f);
    p.circulo.setAttribute('cy', a.y + (b.y - a.y) * f);
  }
  requestAnimationFrame(cuadro);
}

function golpear(id, rechazo = false) {
  const nodo = nodos[id];
  if (!nodo) return;
  const clase = rechazo ? 'golpe-rechazo' : 'golpe';
  nodo.g.classList.add(clase);
  clearTimeout(nodo[clase]);
  nodo[clase] = setTimeout(() => nodo.g.classList.remove(clase), rechazo ? 900 : 420);
}

function etiquetar(id, texto, color) {
  const nodo = NODOS[id];
  if (!nodo) return;
  const [, h] = medidas(id);
  const t = svg('text', { class: 'etiqueta-flotante', x: nodo.x, y: nodo.y - h / 2 - 10, 'text-anchor': 'middle', fill: color }, capaEtiquetas);
  t.textContent = texto;
  setTimeout(() => t.remove(), 1750);
}

function sacudir(id) {
  const nodo = nodos[id];
  if (!nodo) return;
  nodo.g.classList.remove('sacudida');
  void nodo.g.getBBox();
  nodo.g.classList.add('sacudida');
  setTimeout(() => nodo.g.classList.remove('sacudida'), 1100);
}

const estadoDe = id => estado?.nodos?.[id]?.estado ?? 'sin-datos';

// ---------- Anuncios y línea de tiempo ----------
const anuncios = document.getElementById('anuncios');
const pendientes = [];

// Un anuncio a la vez en la franja superior. Si se acumulan, se descartan
// primero las actas: caídas, recuperaciones y ataques tienen prioridad.
function anunciar({ color, icono, titulo, detalle, prioridad = false }) {
  const anuncio = { color, icono, titulo, detalle, prioridad };
  const posicion = prioridad ? pendientes.findIndex(p => !p.prioridad) : -1;
  if (posicion >= 0) pendientes.splice(posicion, 0, anuncio);
  else pendientes.push(anuncio);
  while (pendientes.length > 3) {
    const descartable = pendientes.findIndex(p => !p.prioridad);
    pendientes.splice(descartable >= 0 ? descartable : 0, 1);
  }
  mostrarAnuncios();
}

function mostrarAnuncios() {
  if (!pendientes.length || anuncios.querySelector('.anuncio')) return;
  const { color, icono, titulo, detalle } = pendientes.shift();
  const caja = html('div', 'anuncio');
  caja.style.setProperty('--color', color);
  const circulo = html('div', 'icono');
  circulo.appendChild(svgIcono(icono));
  caja.append(circulo, html('strong', '', titulo), html('span', '', detalle ?? ''));
  anuncios.appendChild(caja);
  setTimeout(() => {
    caja.classList.add('saliendo');
    setTimeout(() => { caja.remove(); mostrarAnuncios(); }, 400);
  }, pendientes.length ? 3200 : 4800);
}

function svgIcono(nombre) {
  const icono = document.createElementNS(SVG, 'svg');
  icono.setAttribute('viewBox', '0 0 24 24');
  icono.setAttribute('aria-hidden', 'true');
  // Contenido fijo del módulo, nunca datos recibidos.
  icono.innerHTML = ICONOS[nombre] ?? ICONOS.ok;
  return icono;
}

const linea = document.getElementById('linea');

function agregarLinea(color, partes, t = Date.now()) {
  linea.querySelector('.vacio')?.remove();
  const li = html('li');
  li.style.setProperty('--color', color);
  const hora = html('time', '', new Date(t).toLocaleTimeString('es-BO', { hour12: false }));
  const texto = html('span', 'texto');
  for (const [contenido, negrita] of partes) texto.appendChild(negrita ? html('b', '', contenido) : document.createTextNode(contenido));
  li.append(hora, html('span', 'marca-tipo'), texto);
  linea.prepend(li);
  while (linea.children.length > 9) linea.lastElementChild.remove();
}

// ---------- Eventos del flujo ----------
function alSolicitud(s) {
  const prueba = s.prueba === 'rafaga';
  if (particulas.size > MAX_PARTICULAS && (s.menor || prueba)) return;
  if (particulas.size > MAX_PARTICULAS * 1.5 && s.resultado === 'ok') return;
  const radio = s.menor || prueba ? 3.6 : 6;
  const paso = prueba ? PASO_MS * 0.6 : s.menor ? PASO_MS * 0.8 : PASO_MS;
  const ruta = recorrido(s.origen, s.servicio);

  if (s.resultado === 'ok') {
    const color = prueba ? COLOR.rafaga : COLOR[s.origen];
    const viaje = lanzar({ ruta, color, radio, paso, alLlegar: () => {
      if (s.menor || prueba) return;
      for (const rama of s.ramas) {
        const tipo = aristas.get(clave(s.servicio, rama))?.tipo;
        lanzar({ ruta: [s.servicio, rama, s.servicio], color: tipo === 'grpc' ? COLOR.grpc : color, radio: 4, paso: PASO_MS * 0.7 });
      }
    } });
    if (s.servicio === 'actas' && s.metodo !== 'GET') llegadaActas = Math.max(llegadaActas, performance.now() + viaje + PASO_MS * 1.4);
    if (['Inicio de sesión', 'Lectura OCR del acta'].includes(s.accion)) {
      agregarLinea(color, [[s.accion, true], [s.ms != null ? ` · ${duracion(s.ms)}` : '', false]], s.t);
    }
    return;
  }

  const color = COLOR[s.resultado] ?? COLOR.error;
  const codigo = `${s.estado} · ${s.motivo}`;
  if (s.resultado === 'caido') {
    lanzar({ ruta: [s.origen, 'entrada'], color, radio, paso, alLlegar: () => {
      golpear(s.servicio, true);
      etiquetar(s.servicio, `${s.estado} · sin respuesta`, color);
      lanzar({ ruta: ['entrada', s.origen], color, radio: 4.5, paso: paso * 0.8, alSalto: null });
    } });
  } else {
    const destino = s.rechazoEn ?? s.servicio;
    let ida = ruta;
    if (destino === 'entrada') ida = ruta.slice(0, 2);
    else if (destino !== s.servicio && existeArista(s.servicio, destino)) ida = [...ruta, destino];
    lanzar({ ruta: ida, color, radio, paso, alLlegar: () => {
      golpear(destino, true);
      etiquetar(destino, codigo, color);
      lanzar({ ruta: [...ida].reverse(), color, radio: 4.5, paso: paso * 0.8, alSalto: null });
    } });
  }
  if (!s.menor || s.prueba === 'ataque') agregarLinea(color, [[String(s.estado), true], [` ${s.accion}: ${s.motivo}`, false]], s.t);
}

function textoMesa(a) {
  return a.mesa ? `Mesa ${a.mesa}` : 'Mesa sin código público';
}

function alActa(a, repetido = false) {
  const color = COLOR[a.tipo] ?? COLOR.nueva;
  const contexto = [a.cargo, a.unidad].filter(Boolean).join(' · ');
  const cambios = a.cambios.slice(0, 3).map(c => `${c.nombre} ${numero.format(c.antes)} → ${numero.format(c.despues)}`).join(' · ');
  const textos = {
    nueva: { icono: 'acta', titulo: `Acta registrada · ${textoMesa(a)}`, detalle: `${contexto || 'Cargo no publicado'} · versión ${a.version}${a.total != null ? ` · ${numero.format(a.total)} votos` : ''}` },
    correccion: { icono: 'correccion', titulo: `Corrección v${a.version}: reemplaza, no suma`, detalle: cambios || `${textoMesa(a)}: la versión anterior deja de contar.` },
    observada: { icono: 'alerta', titulo: `Acta observada · ${textoMesa(a)}`, detalle: 'La suma no coincide con el total: el cómputo conserva la última versión válida.' },
    anulacion: { icono: 'caida', titulo: `Acta anulada · ${textoMesa(a)}`, detalle: 'Su aporte sale del cómputo; el original se conserva.' },
  }[a.tipo];
  agregarLinea(color, [[textos.titulo, true], [contexto ? ` · ${contexto}` : '', false]]);
  if (repetido) return;
  anunciar({ color, ...textos, prioridad: a.tipo !== 'nueva' });
  const kpi = document.getElementById('kpi-actas').parentElement;
  kpi.classList.remove('destello');
  void kpi.offsetWidth;
  kpi.classList.add('destello');
  const retraso = Math.max(0, llegadaActas - performance.now());
  lanzar({ ruta: ['actas', 'rabbitmq'], color, radio: 7.5, paso: PASO_MS * 1.1, retraso, alLlegar: () => {
    for (const consumidor of CONSUMIDORES) {
      if (estadoDe(consumidor) === 'ok') {
        lanzar({ ruta: ['rabbitmq', consumidor, 'mongodb'], color, radio: 6.5, paso: PASO_MS * 1.1, alLlegar: consumidor === 'conteo' ? () => golpear('resultados') : null });
      } else {
        etiquetar('rabbitmq', `En cola: ${NODOS[consumidor].nombre} no disponible`, COLOR.observada);
      }
    }
  } });
}

function alAviso(a, repetido = false) {
  const nombre = NODOS[a.nodo]?.nombre ?? a.nodo;
  const consumidor = CONSUMIDORES.includes(a.nodo);
  if (a.tipo === 'caida') {
    reiniciosEnCaida[a.nodo] = estado?.nodos?.[a.nodo]?.contenedor?.reinicios ?? null;
    agregarLinea(COLOR.caido, [[`${nombre} se cayó`, true]]);
    if (repetido) return;
    sacudir(a.nodo);
    anunciar({ prioridad: true, color: COLOR.caido, icono: 'caida', titulo: `${nombre} se cayó`, detalle: consumidor ? 'Las actas nuevas esperan en RabbitMQ; no se pierden.' : 'NGINX responde «no disponible» mientras el servicio vuelve.' });
  } else if (a.tipo === 'recuperado') {
    const antes = reiniciosEnCaida[a.nodo];
    const despues = estado?.nodos?.[a.nodo]?.contenedor?.reinicios;
    const reinicioAutomatico = antes != null && despues != null && despues > antes;
    const segundos = (a.duracionMs / 1000).toLocaleString('es-BO', { maximumFractionDigits: 1 });
    agregarLinea(COLOR.recuperado, [[`${nombre} volvió`, true], [` en ${segundos} s`, false]]);
    if (repetido) return;
    anunciar({ prioridad: true, color: COLOR.recuperado, icono: 'ok', titulo: `${nombre} volvió en ${segundos} s`, detalle: reinicioAutomatico ? 'Docker lo reinició automáticamente, sin intervención.' : 'El servicio responde otra vez.' });
  } else if (a.tipo === 'cola-vacia') {
    const texto = `${numero.format(a.procesadas)} ${a.procesadas === 1 ? 'acta en espera procesada' : 'actas en espera procesadas'}`;
    agregarLinea(COLOR.recuperado, [[texto, true]]);
    if (repetido) return;
    for (let i = 0; i < Math.min(a.procesadas, 14); i += 1) {
      lanzar({ ruta: ['rabbitmq', a.nodo, 'mongodb'], color: COLOR.nueva, radio: 5, paso: PASO_MS * 0.9, retraso: i * 160 });
    }
    anunciar({ prioridad: true, color: COLOR.recuperado, icono: 'ok', titulo: texto, detalle: a.errores ? `${a.errores} pasaron a la cola de errores para revisión.` : 'Ninguna se perdió: esperaron en la cola hasta que el consumidor volvió.' });
  }
}

function alPresentador(r) {
  if (r.tipo === 'rafaga') {
    const s = (r.duracionMs / 1000).toLocaleString('es-BO', { maximumFractionDigits: 1 });
    anunciar({ prioridad: true, color: COLOR.rafaga, icono: 'rayo', titulo: `Ráfaga: ${numero.format(r.cantidad)} consultas en ${s} s`, detalle: `p95 ${r.p95Ms} ms · ${numero.format(r.fallidas)} fallidas · ${r.ruta === 'resultados' ? 'resultados con caché Redis' : 'portada pública'}` });
    agregarLinea(COLOR.rafaga, [[`Ráfaga de ${r.cantidad} consultas`, true], [` · p95 ${r.p95Ms} ms`, false]]);
  } else if (r.tipo === 'ataque-sesion' || r.tipo === 'ataque-interno') {
    const bloqueado = r.estado === 401 || r.estado === 403;
    const que = r.tipo === 'ataque-sesion' ? 'Sesión falsificada' : 'Ruta interna desde fuera';
    anunciar({
      prioridad: true,
      color: bloqueado ? COLOR.recuperado : COLOR.observada,
      icono: bloqueado ? 'escudo' : 'alerta',
      titulo: bloqueado ? `${que}: bloqueado (${r.estado})` : `${que}: respuesta ${r.estado}`,
      detalle: r.tipo === 'ataque-sesion' ? 'Identidad no reconoce la cookie: no se registra ningún acta.' : 'NGINX no publica /api/v1/interno; solo los servicios lo usan entre sí, con clave.',
    });
  } else if (r.accion) {
    const verbos = { derribar: 'Derribando', apagar: 'Apagando', encender: 'Encendiendo' };
    agregarLinea(COLOR.observada, [[`${verbos[r.accion]} ${r.servicio}`, true], [' (presentador)', false]]);
  }
}

// ---------- Estado periódico ----------
function textoMetrica(id, n) {
  const e = n.estado;
  if (e === 'caido') return 'CAÍDO';
  if (e === 'reiniciando') return 'Reiniciando…';
  if (e === 'iniciando') return 'Iniciando…';
  if (e === 'sin-datos') return 'Sin datos';
  if (id === 'rabbitmq') {
    const c = estado.colas?.conteo;
    return c ? `En cola: ${numero.format(c.mensajes)}` : 'Puerto accesible';
  }
  if (CONSUMIDORES.includes(id)) {
    const c = estado.colas?.[id];
    return c ? `${c.consumidores} ${c.consumidores === 1 ? 'consumidor' : 'consumidores'}` : 'Activo';
  }
  if (e === 'degradado') return id === 'resultados' ? 'Sin consumidores' : 'Degradado';
  if (['postgres', 'mongodb', 'redis'].includes(id)) return 'Puerto accesible';
  return `${numero.format(n.solicitudesMinuto)} sol/min`;
}

function alEstado(e) {
  estado = e;
  for (const [id, n] of Object.entries(e.nodos)) {
    const nodo = nodos[id];
    if (!nodo) continue;
    nodo.g.dataset.estado = n.estado;
    if (nodo.metrica) nodo.metrica.textContent = textoMetrica(id, n);
    const reinicios = n.contenedor?.reinicios ?? 0;
    if (nodo.insignia) {
      nodo.insignia.setAttribute('visibility', reinicios > 0 ? 'visible' : 'hidden');
      nodo.insigniaTexto.textContent = `↻ ${reinicios}`;
    }
  }
  const k = e.kpis;
  document.getElementById('kpi-actas').textContent = numero.format(k.actasSesion);
  document.getElementById('kpi-dispositivos').textContent = numero.format(k.dispositivos);
  document.getElementById('kpi-solicitudes').textContent = numero.format(k.solicitudesMinuto);
  document.getElementById('kpi-latencia').textContent = duracion(k.p95Ms);
  const registro = document.getElementById('registro-entrada');
  registro.dataset.activo = String(e.registroEntrada);
  registro.textContent = e.registroEntrada ? 'Registro de entrada: activo' : 'Registro de entrada: sin señal';
  pintarColas(e);
  actualizarControles(e.controles);
}

function pintarColas(e) {
  document.getElementById('estado-mensajeria').textContent = e.mensajeria ? 'Conectado' : 'Sin conexión';
  const contenedor = document.getElementById('colas');
  contenedor.replaceChildren();
  if (!e.mensajeria) {
    contenedor.appendChild(html('p', 'vacio', 'El mapa no recibe datos de RabbitMQ en este momento.'));
    return;
  }
  for (const id of CONSUMIDORES) {
    const c = e.colas[id];
    const fila = html('div', 'cola');
    const nombre = html('div', 'cola-nombre', NODOS[id].nombre);
    nombre.appendChild(html('small', '', c ? `${c.consumidores} ${c.consumidores === 1 ? 'consumidor' : 'consumidores'}` : 'cola sin declarar'));
    const fichas = html('div', 'fichas');
    if (c?.mensajes) for (let i = 0; i < Math.min(c.mensajes, 40); i += 1) fichas.appendChild(html('i', 'ficha'));
    else fichas.appendChild(html('span', 'vacia', 'Sin actas en espera'));
    const cifra = html('div', 'cola-cifra', c ? numero.format(c.mensajes) : '—');
    cifra.appendChild(html('small', '', c?.errores ? `${c.errores} con error` : 'en espera'));
    fila.dataset.sinConsumidor = String(Boolean(c) && c.consumidores === 0);
    fila.append(nombre, fichas, cifra);
    contenedor.appendChild(fila);
  }
}

function pintarResultados(r) {
  const contenedor = document.getElementById('resultados');
  const cargo = document.getElementById('cargo-resultados');
  if (!r) {
    cargo.textContent = '';
    contenedor.replaceChildren(html('p', 'vacio', 'Sin resultados publicados todavía.'));
    return;
  }
  cargo.textContent = [r.cargo, r.nombre].filter(Boolean).join(' · ');
  const avance = html('div', 'avance');
  const textoAvance = html('div', 'avance-texto');
  textoAvance.append(html('span', '', `Actas contabilizadas: ${numero.format(r.contabilizadas)} de ${numero.format(r.esperadas)}`), html('b', '', `${numero.format(r.avance)} %`));
  const barra = html('div', 'barra');
  const relleno = html('i');
  relleno.style.width = `${Math.min(100, Math.max(0, r.avance))}%`;
  barra.appendChild(relleno);
  avance.append(textoAvance, barra);
  const lista = html('ol', 'candidatos');
  if (!r.candidatos.length) lista.appendChild(html('li', 'vacio', 'Sin candidaturas publicadas.'));
  for (const c of r.candidatos) {
    const li = html('li', 'candidato');
    if (resultadosPrevios[c.id] != null && resultadosPrevios[c.id] !== c.votos) li.classList.add('cambio');
    const cifra = html('span', 'cifra', numero.format(c.votos));
    cifra.appendChild(html('small', '', `${numero.format(c.porcentaje)} %`));
    const b = html('div', 'barra');
    const i = html('i');
    i.style.width = `${Math.min(100, Math.max(0, c.porcentaje))}%`;
    b.appendChild(i);
    li.append(html('span', 'nombre', c.nombre), cifra, b);
    lista.appendChild(li);
  }
  resultadosPrevios = Object.fromEntries(r.candidatos.map(c => [c.id, c.votos]));
  const resumen = html('p', 'resumen-votos', `Válidos ${numero.format(r.validos)} · Blancos ${numero.format(r.blancos)} · Nulos ${numero.format(r.nulos)}${r.observadas ? ` · ${numero.format(r.observadas)} observadas` : ''}${r.ponderacionAplicada ? ' · el portal aplica ponderación' : ''}`);
  contenedor.replaceChildren(avance, lista, resumen);
}

// ---------- Controles del presentador ----------
const panelPresentador = document.getElementById('presentador');
const abrirPresentador = document.getElementById('abrir-presentador');
const avisoPresentador = document.getElementById('aviso-presentador');
const enMarco = window.top !== window.self;

function alternarPresentador(abrir = panelPresentador.hidden) {
  if (enMarco) return;
  panelPresentador.hidden = !abrir;
  abrirPresentador.setAttribute('aria-expanded', String(abrir));
}

function actualizarControles(controles) {
  if (enMarco || !controles) return;
  abrirPresentador.hidden = false;
  const derribar = document.getElementById('botones-derribar');
  if (!derribar.children.length) {
    for (const servicio of ['actas', 'resultados', 'resultados-conteo', 'resultados-auditoria']) {
      const b = html('button', '', servicio.replace('resultados-', ''));
      b.type = 'button';
      b.dataset.accion = 'derribar';
      b.dataset.servicio = servicio;
      b.dataset.docker = '';
      derribar.appendChild(b);
    }
  }
  for (const b of panelPresentador.querySelectorAll('button[data-accion]')) {
    b.disabled = b.hasAttribute('data-docker') ? !controles.docker || !controles.servicios.includes(b.dataset.servicio) : !controles.pruebas;
  }
  if (!controles.docker && !avisoPresentador.textContent) avisoPresentador.textContent = 'Control de contenedores deshabilitado: inicia con la capa de caos para derribar servicios.';
}

panelPresentador.addEventListener('click', async evento => {
  const boton = evento.target.closest('button[data-accion]');
  if (!boton || boton.disabled) return;
  boton.disabled = true;
  avisoPresentador.textContent = 'Ejecutando…';
  try {
    const respuesta = await fetch('/api/presentador', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Mapa-Vivo': 'presentador' },
      body: JSON.stringify({ accion: boton.dataset.accion, servicio: boton.dataset.servicio ?? '' }),
    });
    const datos = await respuesta.json().catch(() => ({}));
    avisoPresentador.textContent = respuesta.ok ? 'Listo. Mira el mapa.' : `No se pudo: ${datos.detalle ?? respuesta.status}`;
  } catch {
    avisoPresentador.textContent = 'No se pudo contactar al observador.';
  } finally {
    setTimeout(() => { boton.disabled = false; if (estado) actualizarControles(estado.controles); }, 1200);
  }
});
abrirPresentador.addEventListener('click', () => alternarPresentador());
document.getElementById('cerrar-presentador').addEventListener('click', () => alternarPresentador(false));
document.addEventListener('keydown', evento => {
  if (evento.key.toLowerCase() === 'p' && !evento.ctrlKey && !evento.metaKey && !evento.altKey) alternarPresentador();
  if (evento.key === 'Escape') alternarPresentador(false);
});

// ---------- Invitación con QR ----------
function mostrarQr() {
  if (lienzo.querySelector('.invitacion-qr')) return;
  const g = svg('g', { class: 'invitacion-qr', transform: 'translate(926 392)' }, lienzo);
  svg('rect', { class: 'marco', width: 148, height: 196, rx: 16 }, g);
  svg('rect', { class: 'fondo-qr', x: 14, y: 14, width: 120, height: 120, rx: 8 }, g);
  svg('image', { href: '/qr.svg', x: 18, y: 18, width: 112, height: 112 }, g);
  svg('text', { x: 74, y: 158, 'text-anchor': 'middle' }, g).textContent = 'Escanea y sé operador';
  svg('text', { class: 'suave', x: 74, y: 176, 'text-anchor': 'middle' }, g).textContent = 'Fotografía un acta de prueba';
}

// ---------- Conexión ----------
function conectar() {
  const conexion = document.getElementById('conexion');
  const texto = document.getElementById('texto-conexion');
  const fuente = new EventSource('/api/flujo');
  const escuchar = (tipo, manejador) => fuente.addEventListener(tipo, m => {
    try { manejador(JSON.parse(m.data)); } catch (error) { console.error(error); }
  });
  fuente.onopen = () => { conexion.dataset.estado = 'vivo'; texto.textContent = 'En vivo'; };
  fuente.onerror = () => { conexion.dataset.estado = 'reconectando'; texto.textContent = 'Reconectando…'; };
  escuchar('inicio', datos => {
    linea.replaceChildren(html('li', 'vacio', 'Esperando actividad: fotografía un acta con el celular del operador.'));
    for (const { tipo, datos: d, t } of datos.historial) {
      if (tipo === 'acta') alActa(d, true);
      if (tipo === 'aviso') alAviso(d, true);
      linea.firstElementChild?.querySelector('time')?.replaceChildren(new Date(t).toLocaleTimeString('es-BO', { hour12: false }));
    }
    alEstado(datos.estado);
    pintarResultados(datos.resultados);
    if (datos.estado.qr) mostrarQr();
  });
  escuchar('estado', alEstado);
  escuchar('solicitud', alSolicitud);
  escuchar('acta', a => alActa(a));
  escuchar('aviso', a => alAviso(a));
  escuchar('resultados', pintarResultados);
  escuchar('presentador', alPresentador);
}

function reloj() {
  document.getElementById('reloj').textContent = new Date().toLocaleTimeString('es-BO', { hour12: false });
}

construir();
reloj();
setInterval(reloj, 1000);
requestAnimationFrame(cuadro);
conectar();
