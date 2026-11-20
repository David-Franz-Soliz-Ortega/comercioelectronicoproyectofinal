import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Lecturas contra el despliegue real: no intercepta solicitudes ni crea cuentas o elecciones.
const base = process.env.URL_BASE ?? 'http://127.0.0.1:8890';
const carpeta = process.env.EVIDENCIA_FRONTEND ?? `/tmp/tuvoto-conexion-real-${Date.now()}`;
await mkdir(carpeta, { recursive: true });
const navegador = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EJECUTABLE ? { executablePath: process.env.CHROMIUM_EJECUTABLE } : {}), args: ['--no-sandbox'] });
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'es-BO' });
pagina.setDefaultTimeout(20000);
const errores = [], verificaciones = [];
pagina.on('pageerror', error => errores.push(error.message));
function correcto(mensaje) { verificaciones.push(mensaje); console.log('OK:', mensaje); }
try {
  const consulta = pagina.waitForResponse(respuesta => respuesta.url().endsWith('/graphql') && respuesta.request().postDataJSON()?.query.includes('query Eventos'));
  const documento = await pagina.goto(base);
  assert.equal(documento.status(), 200);
  const respuesta = await consulta;
  assert.equal(respuesta.status(), 200);
  const contenido = await respuesta.json();
  assert.ok(!contenido.errors?.length, 'El catálogo debe responder sin errores GraphQL');
  assert.ok(Array.isArray(contenido.data?.eventos), 'La respuesta debe contener el catálogo de eventos');
  const publicados = contenido.data.eventos.length;
  if (publicados) {
    await pagina.getByRole('region', { name: 'Votos por candidatura' }).waitFor();
    correcto('El catálogo y los resultados publicados se cargan desde los servicios');
    const cargos = contenido.data.eventos[0].procesos;
    if (cargos.length > 1) {
      // Se recorren los cargos del evento real y se vuelve a su primera selección.
      for (const cargo of [...cargos.slice(1), cargos[0]]) {
        const [respuestaCargo] = await Promise.all([
          pagina.waitForResponse(respuesta => {
            if (!respuesta.url().endsWith('/graphql')) return false;
            const entrada = respuesta.request().postDataJSON();
            return entrada?.query.includes('query Portal') && entrada.variables.idProceso === cargo.id;
          }),
          pagina.getByRole('navigation', { name: 'Cargos del evento' }).getByRole('button').nth(cargos.indexOf(cargo)).click(),
        ]);
        const datos = await respuestaCargo.json();
        assert.ok(!datos.errors?.length);
        assert.equal(datos.data.portal.proceso.id, cargo.id);
        await pagina.getByRole('heading', { name: cargo.cargo, exact: true }).waitFor();
        assert.equal(await pagina.locator('.tarjeta-candidatura').count(), datos.data.portal.resultados.candidatos.length);
      }
      correcto('Todos los cargos del evento cargan sus propias candidaturas desde la API real');
      await pagina.evaluate(() => { document.activeElement?.blur(); scrollTo({ top: 0, behavior: 'instant' }); });
    }
  } else {
    await pagina.getByRole('heading', { name: 'Todavía no hay un evento publicado' }).waitFor();
    assert.equal(await pagina.locator('.tarjeta-candidatura').count(), 0);
    correcto('El catálogo vacío produce un estado vacío, sin candidatos inventados');
  }
  assert.equal(await pagina.getByRole('alert').count(), 0);
  await pagina.screenshot({ path: `${carpeta}/escritorio.png`, fullPage: true, animations: 'disabled' });
  await pagina.setViewportSize({ width: 390, height: 844 });
  assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await pagina.screenshot({ path: `${carpeta}/movil.png`, fullPage: true, animations: 'disabled' });
  correcto('La portada real carga sin avisos de error ni desbordamiento en móvil');
  await pagina.getByRole('link', { name: /Acceso al personal/ }).click();
  await pagina.getByLabel('Usuario', { exact: true }).waitFor();
  await pagina.getByLabel('Contraseña', { exact: true }).waitFor();
  const sesion = await pagina.request.get(`${base}/api/v1/autenticacion/yo`);
  assert.equal(sesion.status(), 401, 'Sin una cuenta autenticada no debe concederse acceso');
  correcto('El formulario privado carga y la API conserva la restricción de sesión');
  assert.deepEqual(errores, []);
  await writeFile(`${carpeta}/evidencia.json`, JSON.stringify({ tipo: 'Navegador con servicios reales; solo lectura y sin interceptaciones', base, eventosPublicados: publicados, verificaciones, errores }, null, 2));
  console.log('Evidencia:', carpeta);
} catch (error) {
  await pagina.screenshot({ path: `${carpeta}/fallo.png`, fullPage: true, animations: 'disabled' });
  console.error('Captura:', carpeta); throw error;
} finally { await navegador.close(); }
