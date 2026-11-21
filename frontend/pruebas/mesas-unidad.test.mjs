import test from 'node:test';
import assert from 'node:assert/strict';
import {mesasPorUnidad} from '../src/api/mesasPorUnidad.js';
test('las mesas de distintas facultades se muestran separadas sin perder sector ni ID',()=>{const mesas=[{id:'a',codigo:'TEC-001',unidad:'Tecnología',sector:'docentes'},{id:'b',codigo:'SAL-001',unidad:'Salud',sector:'estudiantes'},{id:'c',codigo:'TEC-002',unidad:'Tecnología',sector:'estudiantes'}];const g=mesasPorUnidad(mesas);assert.deepEqual(g.map(x=>[x.unidad,x.mesas.map(m=>m.id)]),[['Tecnología',['a','c']],['Salud',['b']]]);assert.equal(g[0].mesas[0].sector,'docentes');assert.equal(mesas.length,3);assert.deepEqual(mesasPorUnidad([]),[]);});
