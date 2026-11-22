import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const raiz=fileURLToPath(new URL('../src/',import.meta.url));
// Incluye importaciones estáticas, reexportaciones y lazy import con ruta literal.
test('los módulos del frontend tienen una ruta de uso desde principal.jsx',()=>{
 const vistos=new Set();
 function visitar(ruta){
  if(vistos.has(ruta))return;
  vistos.add(ruta);
  const texto=readFileSync(ruta,'utf8');
  for(const m of texto.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)){
   if(m[1].startsWith('.')&&/\.jsx?$/.test(m[1]))visitar(resolve(dirname(ruta),m[1]));
  }
 }
 visitar(resolve(raiz,'principal.jsx'));
 const modulos=readdirSync(raiz,{recursive:true}).filter(f=>/\.jsx?$/.test(f));
 assert.deepEqual(modulos.filter(f=>!vistos.has(resolve(raiz,f))),[],'Eliminar o conectar módulos huérfanos; no contar referencias de pruebas como uso operativo');
});
