import React,{useMemo,useState} from 'react';
import { usarConsultaPublica } from '../api/usarConsultaPublica.js';
import { consultaResumenCargos,comprobarResumenCargos } from '../api/resumenCargos.js';
const numero=v=>new Intl.NumberFormat('es-BO').format(v);
export default function ResumenResultadosCargos({cargos,alElegir}){
 const [pagina,setPagina]=useState(0),indice=Math.min(pagina,Math.max(0,Math.ceil(cargos.length/6)-1));
 const clave=cargos.map(p=>p.id).join(',');
 const seleccion=useMemo(()=>cargos.slice(indice*6,indice*6+6),[clave,indice]);
 const consulta=useMemo(()=>consultaResumenCargos(seleccion),[seleccion]);
 const validar=useMemo(()=>datos=>{const r=comprobarResumenCargos(datos);if(r.length!==seleccion.length||r.some((p,i)=>p.proceso.id!==seleccion[i].id))throw Error('Cambió la selección de cargos. Actualiza el resumen.');return r;},[seleccion]);
 const respuesta=usarConsultaPublica(consulta.query,consulta.variables,validar,30000,!!seleccion.length);
 return <section className="resumen-resultados-cargos"><header><h2>Resultados por cargo</h2><span>{cargos.length} cargos</span></header>
 {respuesta.error&&<p role="alert">{respuesta.datos?'Actualización pendiente. ':''}{respuesta.error}<button type="button" onClick={respuesta.reintentar}>Reintentar</button></p>}
 {respuesta.cargando?<p role="status">Consultando conteos…</p>:<div className="rejilla-resumen-resultados">{(respuesta.datos??[]).map(p=>{const cargo=cargos.find(c=>c.id===p.proceso.id);return <article key={p.proceso.id}><h3>{p.proceso.cargo}</h3><p>{cargo?.ambito||'Toda la institución'}</p><ul>{p.resultados.candidatos.map(c=><li key={c.id}><span>{c.nombre}</span><strong>{numero(c.votos)} votos</strong></li>)}</ul><p>{numero(p.resultados.contabilizadas)} / {numero(p.resultados.esperadas)} actas · {numero(p.resultados.total)} votos totales</p><button type="button" onClick={()=>alElegir(p.proceso.id)}>Ver detalle</button></article>;})}</div>}
 {cargos.length>6&&<nav aria-label="Páginas de resultados"><button type="button" disabled={!indice} onClick={()=>setPagina(indice-1)}>Anterior</button><span>{indice+1} / {Math.ceil(cargos.length/6)}</span><button type="button" disabled={(indice+1)*6>=cargos.length} onClick={()=>setPagina(indice+1)}>Siguiente</button></nav>}
 </section>;
}
