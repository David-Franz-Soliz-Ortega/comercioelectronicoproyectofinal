// Página imprimible: lee la configuración PÚBLICA de la elección y arma las hojas.
import { generarHojas } from './actas-practica-datos.js';

const $ = id => document.getElementById(id);
const procesos = new Map();

function elemento(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
}

async function pedir(ruta) {
  const r = await fetch(ruta, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

function dibujarHoja(h) {
  const hoja = elemento('article', 'hoja');
  const encabezado = elemento('header', 'encabezado');
  const titulo = elemento('div');
  titulo.append(elemento('h2', '', 'UNIVERSIDAD DE DEMOSTRACIÓN'), elemento('p', '', 'Comisión Electoral de Prueba · Acta de escrutinio'));
  encabezado.append(titulo, elemento('div', 'marca-agua', 'DOCUMENTO DE PRUEBA — SIN VALIDEZ'));
  hoja.appendChild(encabezado);
  if (h.practica) hoja.appendChild(elemento('div', 'etiqueta-practica', h.practica));
  const datos = elemento('section', 'datos');
  for (const [etiqueta, valor] of [['Mesa', h.codigo], ['Cargo', h.cargo], ['Sector', h.sector], ['Unidad', h.unidad]]) {
    const fila = elemento('div');
    fila.append(elemento('b', '', etiqueta + ': '), document.createTextNode(valor));
    datos.appendChild(fila);
  }
  hoja.appendChild(datos);
  const tabla = elemento('table');
  const cuerpo = elemento('tbody');
  const filas = [...h.votos.map(v => [v.nombre, v.cantidad]), ['Votos blancos', h.blancos], ['Votos nulos', h.nulos], ['Total votos', h.total]];
  filas.forEach(([nombre, cantidad], i) => {
    const tr = elemento('tr', i === filas.length - 1 ? 'total' : '');
    tr.append(elemento('td', '', nombre), elemento('td', '', String(cantidad)));
    cuerpo.appendChild(tr);
  });
  tabla.appendChild(cuerpo);
  hoja.appendChild(tabla);
  const firmas = elemento('div', 'firmas');
  for (const rol of ['Presidente', 'Secretario', 'Vocal', 'Vocal']) firmas.appendChild(elemento('span', '', rol));
  hoja.append(firmas, elemento('p', 'pie', 'Material de práctica TUVOTO · cifras ficticias · no publicar como resultado'));
  return hoja;
}

async function generar() {
  const elegidos = [...document.querySelectorAll('#cargos input:checked')].map(c => c.value);
  $('generar').disabled = true;
  $('resumen').textContent = 'Preparando hojas…';
  try {
    const detalles = await Promise.all(elegidos.map(async id => procesos.get(id) ?? procesos.set(id, await pedir('/api/v1/publico/procesos/' + encodeURIComponent(id))).get(id)));
    const hojas = generarHojas(detalles, { semilla: Number($('semilla').value) || 1, erronea: $('erronea').checked, correccion: $('correccion').checked });
    $('hojas').replaceChildren(...hojas.map(dibujarHoja));
    $('imprimir').disabled = !hojas.length;
    $('resumen').textContent = hojas.length ? `${hojas.length} ${hojas.length === 1 ? 'hoja lista' : 'hojas listas'}.` : 'Los cargos elegidos no tienen mesas o candidaturas.';
  } catch {
    $('resumen').textContent = 'No se pudo leer la configuración pública. Recarga para reintentar.';
  } finally {
    $('generar').disabled = false;
  }
}

async function iniciar() {
  try {
    const { elementos } = await pedir('/api/v1/publico/elecciones');
    if (!elementos.length) {
      $('cargos').replaceChildren(elemento('span', '', 'No hay elecciones publicadas. Inicia el conteo de la elección de prueba o usa el formato editable de /ejemplos/acta-escrutinio-prueba.html.'));
      return;
    }
    $('cargos').replaceChildren(...elementos.map(p => {
      const etiqueta = elemento('label');
      const casilla = elemento('input');
      casilla.type = 'checkbox';
      casilla.value = p.id;
      casilla.checked = true;
      etiqueta.append(casilla, document.createTextNode(p.nombre));
      return etiqueta;
    }));
    $('generar').disabled = false;
    await generar();
  } catch {
    $('cargos').replaceChildren(elemento('span', '', 'No se pudo consultar la elección publicada. Abre esta página desde el portal de TUVOTO.'));
  }
}

$('generar').addEventListener('click', generar);
$('imprimir').addEventListener('click', () => window.print());
iniciar();
