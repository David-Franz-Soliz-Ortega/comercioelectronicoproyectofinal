// Datos de las actas de práctica: cifras FICTICIAS y reproducibles a partir de
// la configuración pública de la elección. No consulta ni produce resultados.

function semillaDe(texto) {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
}

export function aleatorio(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const entero = (azar, min, max) => min + Math.floor(azar() * (max - min + 1));

export function nombreSector(proceso, codigo) {
  return proceso.sectores?.find(s => s.codigo === codigo)?.nombre ?? (codigo && codigo !== 'general' ? codigo : 'General');
}

function hoja(proceso, mesa, azar) {
  const votos = proceso.candidatos.map(c => ({ nombre: c.nombre, cantidad: entero(azar, 20, 150) }));
  const blancos = entero(azar, 0, 6);
  const nulos = entero(azar, 0, 6);
  const total = votos.reduce((s, v) => s + v.cantidad, 0) + blancos + nulos;
  return { clave: `${proceso.id}:${mesa.id}`, codigo: mesa.codigo, cargo: proceso.nombre, unidad: mesa.unidad, sector: nombreSector(proceso, mesa.sector), votos, blancos, nulos, total, practica: null };
}

// Una hoja por mesa y cargo. Opcionalmente, una copia con la suma errónea
// (practicar un acta observada) y una versión 2 corregida de otra mesa.
export function generarHojas(procesos, { semilla = 1, erronea = false, correccion = false } = {}) {
  const hojas = [];
  for (const proceso of procesos) {
    for (const mesa of [...(proceso.mesas ?? [])].sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))) {
      if (!proceso.candidatos?.length) continue;
      hojas.push(hoja(proceso, mesa, aleatorio(semillaDe(`${semilla}:${proceso.id}:${mesa.id}`))));
    }
  }
  const extras = [];
  if (erronea && hojas.length) {
    const base = hojas[0];
    extras.push({ ...base, clave: base.clave + ':erronea', total: base.total + 3, practica: 'Suma errónea: practica un acta observada' });
  }
  if (correccion && hojas.length) {
    const base = hojas[Math.min(1, hojas.length - 1)];
    const votos = base.votos.map((v, i) => (i === 0 ? { ...v, cantidad: v.cantidad > 25 ? v.cantidad - 5 : v.cantidad + 5 } : v));
    const total = votos.reduce((s, v) => s + v.cantidad, 0) + base.blancos + base.nulos;
    extras.push({ ...base, clave: base.clave + ':v2', votos, total, practica: 'Versión 2: corrige la mesa ya registrada' });
  }
  return [...hojas, ...extras];
}
