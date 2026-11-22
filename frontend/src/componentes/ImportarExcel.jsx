import { resolverMesaOperador, completarImportacionOperadores } from '../api/operadores.js';
import ModalFormulario from './ModalFormulario.jsx';
import { notificarExito } from '../api/confirmaciones.js';
import React, { useId, useRef, useState } from 'react';
import { solicitarRest } from '../api/clienteRest.js';
import { cargosParaReferencia, columnasImportacion, mensajeImportacion, motivoBloqueoImportacion, presentacionImportacion } from '../api/importacionGeneral.js';
export default function ImportarExcel({ ruta, organizacion, titulo, alImportar, operadores = false, deshabilitado = false, abierto = false, datosAdicionales = {}, general = false, cargos = [], gestionarExistentes = false }) {
 const [modal,setModal]=useState(false),[resultadoOperadores,setResultadoOperadores]=useState(null);
 const [archivo,setArchivo]=useState(''),[vista,setVista]=useState(null),[ocupado,setOcupado]=useState(false),[confirmar,setConfirmar]=useState(false),[error,setError]=useState('');
 const [asociaciones,setAsociaciones]=useState({}),[revisar,setRevisar]=useState(false);
 const [resoluciones,setResoluciones]=useState({});
 const listaErrores=useRef(null),raizImportacion=useRef(null),idConfirmacion=useId();
 const presentacion=presentacionImportacion({titulo,ruta,general});
 const columnas=columnasImportacion({titulo,ruta,general,operadores});
 const maxFilas=general||titulo.startsWith('mesas')||titulo==='asignaciones'?2000:100;
 const motivoBloqueo=motivoBloqueoImportacion({vista,ocupado,revisar});
 const datos=()=>({...datosAdicionales,...operadores?{idOrganizacion:organizacion}:{},...general?{asociaciones}:{},...gestionarExistentes?{resoluciones}:{},archivo});
 async function leerCatalogo(){const r=await solicitarRest('/configuracion/procesos',{organizacion});return r.elementos;}
 async function previsualizar(){setOcupado(true);setError('');setConfirmar(false);try{
  const catalogo=operadores?await leerCatalogo():null;
  const r=await solicitarRest(ruta+'/previsualizar',{metodo:'POST',organizacion,datos:datos(),espera:120000,mostrarDetalleValidacion:true});
  setVista(operadores?{...r,filas:r.filas.map(f=>{const destino=resolverMesaOperador(f.mesa,catalogo);return {...f,asignacion:destino.aviso||destino.ids.length+' cargos'};})}:r);setRevisar(false);
 }catch(e){setError(e.message);setVista(null);}finally{setOcupado(false);}}
 async function guardar(){if(!vista||vista.errores.length||!confirmar||revisar)return;setOcupado(true);setError('');try{
  const catalogo=operadores?await leerCatalogo():null;
  const r=await solicitarRest(ruta+'/confirmar',{metodo:'POST',organizacion,datos:{...datos(),huella:vista.huella,confirmar:true},espera:120000,mostrarDetalleValidacion:true});
  setArchivo('');setVista(null);setConfirmar(false);setAsociaciones({});setResoluciones({});
  if(operadores){
   if(!Array.isArray(r.operadores)){setResultadoOperadores([]);setError('Las cuentas se importaron, pero el servicio necesita actualizarse para asignar mesas. Revisa el listado; no repitas la importación.');alImportar();return;}
   const resultados=await completarImportacionOperadores({operadores:r.operadores,procesos:catalogo,organizacion,pedir:solicitarRest});
   setResultadoOperadores(resultados);alImportar();
   const pendientes=resultados.filter(f=>f.estado!=='Asignado').length;
   notificarExito(r.importados+' operadores creados · '+pendientes+' con asignación pendiente.');
  }else{setModal(false);notificarExito(mensajeImportacion(r));alImportar();}
 }catch(e){setError(e.message);setVista(null);setConfirmar(false);}finally{setOcupado(false);}}
 function irImportacionGeneral(){
  const destino=raizImportacion.current?.closest('.contenido-seccion-privada')?.querySelector(`[data-importacion="${titulo}-general"]`);
  if(!destino)return;
  cerrarImportacion();
  destino.querySelector('[data-abrir-importacion]')?.click();
  destino.scrollIntoView({block:'start',behavior:'smooth'});
  destino.querySelector('input[type=file]')?.focus({preventScroll:true});
 }
 if(deshabilitado)return abierto?<section className="panel-importacion" data-importacion={titulo}><h3>Importar {titulo} desde Excel</h3><p className="aviso">Importación bloqueada: este cargo ya salió de borrador. Para cargar mesas, prepara un cargo en borrador desde Elección. No se modifican las mesas de un cargo abierto o cerrado.</p></section>:<p className="aviso">Importación bloqueada: la elección ya salió de borrador.</p>;
 function cerrarImportacion(){if(ocupado)return;setModal(false);setResultadoOperadores(null);setArchivo('');setVista(null);setConfirmar(false);setError('');setAsociaciones({});setResoluciones({});setRevisar(false);}
 return <div ref={raizImportacion} className="entrada-importacion" data-importacion={general?titulo+'-general':titulo}>
  <button type="button" className="boton secundario boton-importar-excel" data-abrir-importacion onClick={()=>setModal(true)}><IconoHojaExcel/>{presentacion.encabezado}</button>
  <ModalFormulario abierto={modal} titulo={presentacion.encabezado} ocupado={ocupado} alCerrar={cerrarImportacion}>
  {resultadoOperadores!==null?<div className="resultado-importacion-operadores"><h3>Operadores creados</h3>{error&&<p className="aviso" role="alert">{error}</p>}<div className="tabla-preparacion-scroll"><table className="tabla-admin"><thead><tr><th>Usuario</th><th>Mesa indicada</th><th>Cargos asignados</th><th>Estado</th></tr></thead><tbody>{resultadoOperadores.map((r,i)=><tr key={i}><td>{r.usuario}</td><td>{r.mesa}</td><td>{r.asignadas}</td><td>{r.estado}</td></tr>)}</tbody></table></div><button type="button" className="boton primario" onClick={cerrarImportacion}>Ver operadores</button></div>:<div className="panel-importacion"><header className="cabecera-importacion"><IconoHojaExcel/><p>XLSX · Hasta {maxFilas} filas · 2 MB</p></header>
  <section className="columnas-importacion" aria-label="Columnas del Excel"><h3>Columnas</h3><ul>{columnas.map(columna=><li key={columna.nombre}>{columna.nombre}</li>)}</ul></section>
  <div className="acciones-importacion">
   <label className="campo-archivo-importacion">Archivo XLSX<input type="file" accept=".xlsx" disabled={ocupado} onChange={async e=>{setArchivo('');setVista(null);setConfirmar(false);setAsociaciones({});setResoluciones({});setRevisar(false);setError('');const f=e.target.files[0];if(!f)return;if(f.size>2000000){setError('Máximo 2 MB');return;}try{const valor=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(Error('No se pudo leer'));r.readAsDataURL(f);});setArchivo(String(valor).split(',')[1]);}catch(err){setError(err.message);}}}/></label>
   <button type="button" className="boton primario accion-revisar" disabled={ocupado||!archivo} onClick={previsualizar}>{ocupado?'Procesando…':'Revisar archivo'}</button>
  </div>
  {error&&<div className="aviso" role="alert"><p>{error}</p>{presentacion.porCargo&&<button type="button" className="boton secundario" onClick={irImportacionGeneral}>Usar importación de todos los cargos</button>}</div>}
  {vista&&<><p>{vista.total} filas · {vista.errores.length} errores.</p>
   {gestionarExistentes&&vista.coincidencias?.length>0&&<fieldset className="destinos-importacion" data-conflictos-cargos><legend>Cargos que ya existen</legend><p>Mantener conserva los datos; reemplazar actualiza solo la configuración.</p>{vista.coincidencias.map(c=><label key={c.fila}>Fila {c.fila}: {c.cargo} · {c.ambito||'Toda la institución'} · {c.estado}<select aria-label={'Acción para fila '+c.fila} value={resoluciones[c.fila]??c.accion} disabled={ocupado} onChange={e=>{setResoluciones(prev=>({...prev,[c.fila]:e.target.value}));setRevisar(true);setConfirmar(false);}}><option value="mantener">Mantener existente, sin cambios</option><option value="reemplazar" disabled={!c.puedeReemplazar}>Reemplazar configuración con el Excel</option></select>{c.motivo&&<span>{c.motivo}.</span>}</label>)}{revisar&&<p className="aviso" role="status">Pulsa «Revisar archivo» para validar las decisiones antes de confirmar.</p>}</fieldset>}
   {gestionarExistentes&&vista.resumen&&<p>Previsto: {vista.resumen.creados} nuevos · {vista.resumen.actualizados} por actualizar · {vista.resumen.mantenidos} por mantener.</p>}
   {general&&vista.referencias?.length>0&&<fieldset className="destinos-importacion"><legend>Destino de cada grupo del archivo</legend><p>Selecciona el cargo de cada grupo.</p>{vista.referencias.map(r=><label key={r.referencia}>{r.cargo} · {r.ambito||'Sin ámbito'} · Vuelta {r.vuelta}<select aria-label={'Destino: '+r.cargo+' · '+r.ambito} value={asociaciones[r.referencia]??r.idProceso??''} disabled={ocupado} onChange={e=>{setAsociaciones(prev=>({...prev,[r.referencia]:e.target.value}));setConfirmar(false);setRevisar(true);}}><option value="" disabled>Selecciona el cargo de destino</option>{cargosParaReferencia(cargos,r).map(p=><option key={p.id} value={p.id}>{p.cargo} · {p.ambito||'Sin ámbito'} · {p.nombre} · Vuelta {p.vuelta??1}</option>)}</select></label>)}{revisar&&<p className="aviso" role="status">Pulsa «Revisar archivo» para validar los destinos elegidos antes de confirmar.</p>}</fieldset>}
   {vista.errores.length>0&&<ul ref={listaErrores} className="aviso errores-importacion" tabIndex={-1} aria-label="Errores del archivo">{vista.errores.slice(0,100).map((e,i)=><li key={i}>Fila {e.fila}: {e.mensaje}</li>)}</ul>}
   <div className="tabla-preparacion-scroll"><table className="tabla-admin"><thead><tr>{Object.keys(vista.filas[0]??{}).map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{vista.filas.slice(0,100).map((f,i)=><tr key={i}>{Object.values(f).map((v,j)=><td key={j}>{String(v??'')}</td>)}</tr>)}</tbody></table></div>
   <div id={idConfirmacion} className={motivoBloqueo?'aviso estado-confirmacion-importacion':'confirmacion estado-confirmacion-importacion'} role="status" data-estado-confirmacion={motivoBloqueo?'bloqueada':'lista'}>
    <strong>{motivoBloqueo?'La confirmación está bloqueada':'Archivo listo para confirmar'}</strong>
    <p>{motivoBloqueo??'Marca la casilla para continuar.'}</p>
    {!ocupado&&(revisar?<button type="button" className="boton secundario" onClick={previsualizar}>Revisar cambios</button>:vista.errores.length>0?<button type="button" className="boton secundario" onClick={()=>{listaErrores.current?.focus();listaErrores.current?.scrollIntoView({block:'center',behavior:'smooth'});}}>Ver errores del archivo ({vista.errores.length})</button>:null)}
   </div>
   <label className="confirmacion-preparacion"><input type="checkbox" checked={confirmar} disabled={!!motivoBloqueo} aria-describedby={idConfirmacion} onChange={e=>setConfirmar(e.target.checked)}/><span>Revisé los datos y confirmo.</span></label>
    <button type="button" className="boton primario accion-confirmar" disabled={!!motivoBloqueo||!confirmar} aria-describedby={idConfirmacion} onClick={guardar}>Confirmar importación</button>
  </>}
 </div>}</ModalFormulario></div>;
}

function IconoHojaExcel({tamano=22}){
 return <svg className="icono-hoja-excel" width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M13 2v7h7M8 13l4 6m0-6-4 6m7-6v6m0-6h2m-2 3h2m-2 3h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
