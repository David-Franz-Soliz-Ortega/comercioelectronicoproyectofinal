import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Respuestas exclusivamente del navegador de pruebas; nunca se insertan en servicios.
const base = process.env.URL_BASE ?? 'http://127.0.0.1:5174';
const carpeta = process.env.EVIDENCIA_FRONTEND ?? `/tmp/tuvoto-observatorio-${Date.now()}`;
await mkdir(carpeta, { recursive: true });
const navegador = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EJECUTABLE ? { executablePath: process.env.CHROMIUM_EJECUTABLE } : {}), args: ['--no-sandbox'] });
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-BO' });
const pagina = await contexto.newPage();
pagina.setDefaultTimeout(10000);
const errores = [];
const verificaciones = [];
pagina.on('pageerror', error => errores.push(error.message));
const candidatos = [{ id: 'candidatura-a', nombre: 'Candidatura sintética A', foto: null, votos: 30, porcentaje: 30 }, { id: 'candidatura-b', nombre: 'Candidatura sintética B', foto: null, votos: 70, porcentaje: 70 }];
const portal = { proceso: { id: 'proceso-sintetico', nombre: 'Elección sintética de prueba', cargo: 'Decanato', tipo: 'universidad', unidad: 'Facultad', unidades: ['Tecnología de prueba'], candidatos }, resultados: { esperadas: 2, contabilizadas: 1, pendientes: 1, observadas: 0, avance: 50, total: 105, validos: 100, blancos: 3, nulos: 2, actualizadoEn: '2026-11-19T12:00:00Z', candidatos, unidades: [{ unidad: 'Tecnología de prueba', esperadas: 2, contabilizadas: 1, pendientes: 1 }] }, recepcion: { idProceso: 'proceso-sintetico', mesasConActa: 1, versiones: 1 } };
let modo = 'datos';
await pagina.route('**/graphql', ruta => modo === 'error' ? ruta.fulfill({ status: 503, body: 'No disponible' }) : ruta.fulfill({ json: { data: { portal: modo === 'vacio' ? null : portal } } }));
await pagina.route('**/api/v1/auth/**', ruta => ruta.fulfill({ status: 401, json: { detalle: 'Sin sesión de prueba' } }));
function correcto(mensaje) { verificaciones.push(mensaje); console.log('OK:', mensaje); }
try {
  await pagina.goto(base);
  await pagina.getByRole('heading', { name: /Tu universidad/ }).waitFor();
  await pagina.getByRole('region', { name: 'Votos por candidatura' }).waitFor();
  assert.match(await pagina.locator('.fila-candidato-publico').first().innerText(), /sintética B/);
  await pagina.getByRole('button', { name: 'Pausar animaciones' }).click();
  assert.equal(await pagina.locator('.papeleta-animada').evaluate(nodo => getComputedStyle(nodo).animationName), 'none');
  await pagina.screenshot({ path: `${carpeta}/escritorio.png`, fullPage: true, animations: 'disabled' });
  await pagina.getByRole('button', { name: 'Reanudar animaciones' }).click();
  correcto('Resultados del contrato existente, candidaturas ordenadas y animación controlable');
  await pagina.getByLabel('Filtrar por facultad').selectOption('Tecnología de prueba');
  await pagina.getByRole('region', { name: 'Votos por candidatura' }).waitFor();
  correcto('Filtro de unidad conserva la consulta GraphQL');
  for (const ancho of [320, 390, 768, 1024, 1440]) {
    await pagina.setViewportSize({ width: ancho, height: 900 });
    assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Sin desbordamiento a ${ancho}px`);
    if (ancho === 390) await pagina.screenshot({ path: `${carpeta}/movil.png`, fullPage: true, animations: 'disabled' });
  }
  await pagina.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await pagina.locator('.papeleta-animada').evaluate(nodo => getComputedStyle(nodo).animationName), 'none');
  correcto('Cinco tamaños de pantalla y movimiento reducido');
  modo = 'vacio'; await pagina.reload();
  await pagina.getByRole('heading', { name: 'Todavía no hay una elección publicada' }).waitFor();
  assert.equal(await pagina.locator('.tarjeta-metrica').count(), 0);
  modo = 'error'; await pagina.reload();
  await pagina.getByRole('heading', { name: 'No se pudo consultar la elección' }).waitFor();
  assert.equal(await pagina.locator('.fila-candidato-publico').count(), 0);
  correcto('Sin elección o sin conexión no aparecen resultados ficticios');
  assert.deepEqual(errores, []);
  await writeFile(`${carpeta}/evidencia.json`, JSON.stringify({ tipo: 'Prueba de interfaz con respuestas controladas, sin escrituras', verificaciones, errores }, null, 2));
  console.log('Evidencia:', carpeta);
} catch (error) {
  console.error('Desbordamientos:', await pagina.locator('body *').evaluateAll(nodos => nodos.filter(n => n.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(n).position !== 'absolute').map(n => ({ etiqueta: n.tagName, clase: n.className, ancho: n.getBoundingClientRect().width }))));
  await pagina.screenshot({ path: `${carpeta}/fallo.png`, fullPage: true, animations: 'disabled' });
  console.error('Captura:', carpeta); throw error;
} finally { await navegador.close(); }
