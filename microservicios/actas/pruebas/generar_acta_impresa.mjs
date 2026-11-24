// Renderiza el documento sintético local; no lee fotografías ni consulta servicios.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../../../frontend/package.json', import.meta.url));
const {chromium} = require('playwright');
const documento = new URL('../../../frontend/public/ejemplos/acta-escrutinio-prueba.html', import.meta.url);
const navegador = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_EJECUTABLE || '/usr/bin/chromium', args:['--no-sandbox']});
try {
 const pagina = await navegador.newPage({viewport:{width:1000,height:1300},deviceScaleFactor:2});
 await pagina.route('**/*', ruta => ruta.request().url().startsWith('file:') ? ruta.continue() : ruta.abort());
 await pagina.goto(documento.href);
 await pagina.emulateMedia({media:'print'});
 const hoja = pagina.locator('.hoja');
 const medidas = await hoja.boundingBox();
 await hoja.screenshot({path:'/tmp/tuvoto-acta-maquetacion.png'});
 assert.ok(medidas.height <= 1124, 'El acta debe caber en una hoja A4: '+medidas.height+' px');
 const base = fileURLToPath(documento).replace(/\.html$/, '');
 await pagina.pdf({path:base+'.pdf',format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
 await hoja.screenshot({path:base+'.png'});
 console.log('Acta sintética: PDF A4 y PNG generados. Una hoja, un cargo, marca SIN VALIDEZ.');
} finally {await navegador.close();}
