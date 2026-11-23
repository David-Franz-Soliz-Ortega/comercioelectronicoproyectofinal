import React, { useRef, useState } from 'react';
import ModalFormulario from './ModalFormulario.jsx';
import { solicitarRest } from '../api/clienteRest.js';
import { asignarMesasOperador, mesasAsignables } from '../api/operadores.js';
import { agruparMesasFisicas, agruparMesasPorFacultad } from '../api/mesasCompartidas.js';
import { notificarExito } from '../api/confirmaciones.js';

export default function EditarOperador({ cuenta, organizacion, nombreOrganizacion, procesos, asignaciones, alGuardar, alCerrar }) {
 const [usuario,setUsuario]=useState(''),[clave,setClave]=useState(''),[visible,setVisible]=useState(false),[seleccion,setSeleccion]=useState([]),[seleccionIndividual,setSeleccionIndividual]=useState([]),[desasignar,setDesasignar]=useState(new Set()),[confirmando,setConfirmando]=useState(false),[ocupado,setOcupado]=useState(false),[error,setError]=useState('');
 const creada=useRef(null), completadas=useRef(new Set(asignaciones.filter(a=>a.idUsuario===cuenta?.idUsuario).map(a=>a.idMesa)));
 const [cuentaCreada,setCuentaCreada]=useState(false);
 const grupos=agruparMesasFisicas(mesasAsignables(procesos));
 const porGrupo=new Map(grupos.map(g=>[g.id,g]));
 const gruposPorFacultad=agruparMesasPorFacultad(grupos.map(g=>({...g,facultad:g.cargos?.[0]?.facultad||'',unidad:g.unidad})));
 const mesasElegidas=[...new Set([...seleccion.flatMap(id=>(porGrupo.get(id)?.cargos??[]).map(c=>c.id)),...seleccionIndividual])];
 const desasignadas=[...desasignar];
 async function guardar(e){
  if(e) e.preventDefault();
  if(ocupado||!organizacion) return;
  if(desasignadas.length){ setConfirmando(true); return; }
  await ejecutarGuardado();
 }
 async function ejecutarGuardado(){
  setOcupado(true);setError('');
  try {
   if(!cuenta && !creada.current){
    const contrasena=clave;setClave('');setVisible(false);
    creada.current=await solicitarRest('/usuarios',{metodo:'POST',datos:{usuario,contrasena,idOrganizacion:organizacion,rol:'OPERADOR'}});
    setCuentaCreada(true);
   }
   const idUsuario=cuenta?.idUsuario??creada.current?.idUsuario;
   if(!idUsuario)throw Error('No se pudo confirmar la cuenta creada. Consulta Usuarios antes de volver a crearla.');
   for(const idFisica of desasignadas){const grupo=porGrupo.get(idFisica);for(const c of (grupo?.cargos??[])) await solicitarRest('/configuracion/mesas/'+encodeURIComponent(c.id)+'/asignar',{metodo:'DELETE',organizacion});}
   await asignarMesasOperador({pedir:solicitarRest,organizacion,idUsuario,mesas:mesasElegidas,completadas:completadas.current});
   setConfirmando(false);alCerrar();alGuardar();
   notificarExito(mesasElegidas.length?'Operador guardado con sus mesas asignadas.':cuenta?'Asignaciones conservadas.':'Operador creado. Asignación de mesa pendiente.');
  }catch(e){
   setError((creada.current?'La cuenta ya fue creada; las asignaciones pendientes pueden reintentarse sin crear otra cuenta. ':'')+e.message);
   if(creada.current)alGuardar();
  }finally{setOcupado(false);}
 }
 return <><ModalFormulario abierto titulo={cuenta?'Editar mesas de '+cuenta.usuario:'Crear operador'} ocupado={ocupado} alCerrar={alCerrar} cerrarAbajo>
  <p>Institución: <strong>{nombreOrganizacion}</strong></p>
  <form className="formulario-simple formulario-operador" onSubmit={guardar}>
   {!cuenta&&!cuentaCreada&&<><label>Nombre de usuario<input required minLength={3} maxLength={80} autoComplete="off" value={usuario} disabled={ocupado} onChange={e=>setUsuario(e.target.value)}/></label>
    <label>Contraseña privada (12 a 72 bytes UTF-8)<div className="entrada-clave-admin"><input required minLength={12} type={visible?'text':'password'} autoComplete="new-password" value={clave} disabled={ocupado} onChange={e=>setClave(e.target.value)}/><button type="button" className="boton secundario" disabled={ocupado} aria-label={visible?'Ocultar contraseña':'Mostrar contraseña'} onClick={()=>setVisible(v=>!v)}>{visible?'Ocultar':'Mostrar'}</button></div></label></>}
   {cuentaCreada&&<p role="status">Cuenta creada. Completa o deja pendientes las mesas restantes.</p>}
   <fieldset disabled={ocupado}><legend>Asignar mesas (opcional)</legend><p>Marca una mesa y el operador recibirá todas sus actas. Las asignaciones existentes se conservan.</p>
    <div className="opciones-mesas-operador">{gruposPorFacultad.map(fac=>{const seleccionables=fac.mesas.filter(g=>!g.cargos.every(c=>completadas.current.has(c.id))).map(g=>g.id);const todasSeleccionadas=seleccionables.length>0 && seleccionables.every(id=>seleccion.includes(id));return <details key={fac.id} className="grupo-facultad-operador" open={gruposPorFacultad.length===1 || fac.mesas.some(g=>g.cargos.some(c=>completadas.current.has(c.id)))}><summary><span className="nombre-grupo-operador">{fac.nombre}</span> <span className="cantidad-total-mesas">{fac.mesas.length}</span><label className="seleccionar-todo-grupo" onClick={e=>e.stopPropagation()}><input type="checkbox" checked={todasSeleccionadas} disabled={!seleccionables.length} onChange={e=>{const completadasGrupo=fac.mesas.filter(g=>g.cargos.every(c=>completadas.current.has(c.id))).map(g=>g.id); if(e.target.checked){ setSeleccion(prev=>[...new Set([...prev,...seleccionables])]); setDesasignar(prev=>{const n=new Set(prev); completadasGrupo.forEach(id=>n.delete(id)); return n;}); } else { setSeleccion(prev=>prev.filter(id=>!seleccionables.includes(id))); setDesasignar(prev=>{const n=new Set(prev); completadasGrupo.forEach(id=>n.add(id)); return n;}); } }}/><span>Seleccionar grupo</span></label></summary>{fac.mesas.map(g=>{const completaInicial=g.cargos.some(c=>completadas.current.has(c.id));const asignada=completaInicial && !desasignar.has(g.id);const parcial=!completaInicial&&g.cargos.some(c=>completadas.current.has(c.id));return <label key={g.id}><input type="checkbox" checked={asignada||seleccion.includes(g.id)} onChange={e=>{
 if(completaInicial){
   setDesasignar(prev=>{const n=new Set(prev); if(e.target.checked)n.delete(g.id); else n.add(g.id); return n;});
 } else {
   setSeleccion(prev=>e.target.checked?[...prev,g.id]:prev.filter(id=>id!==g.id));
 }
}}/><span><strong>{g.codigo}</strong> · {g.sector||'General'} · {g.cargos.length} {g.cargos.length===1?'acta':'actas'}{parcial?' · parcial':''}<small>{g.unidad} · {g.cargos.map(c=>c.cargo).join(', ')}</small></span></label>;})}</details>;})}</div>
    {!grupos.length&&<p>No hay mesas en cargos en borrador. Puedes crear la cuenta y asignarlas después.</p>}

   </fieldset>
   {error&&<p className="aviso" role="alert">{error}</p>}
   <div className="acciones-formulario">
    <button type="button" className="boton secundario" disabled={ocupado} onClick={alCerrar}>Cancelar</button>
    <button className="boton primario" disabled={ocupado}>{ocupado?'Guardando…':cuenta||cuentaCreada?'Guardar asignaciones':'Crear operador'}</button>
   </div>
  </form>
 </ModalFormulario>
  {confirmando && <ModalFormulario abierto titulo="Quitar asignaciones" ocupado={ocupado} alCerrar={()=>setConfirmando(false)} cerrarAbajo>
   <p>¿Quitar {desasignadas.length} mesa(s) asignada(s) a este operador?</p>
   <div className="acciones-formulario">
    <button type="button" className="boton secundario" disabled={ocupado} onClick={()=>setConfirmando(false)}>Cancelar</button>
    <button type="button" className="boton primario" disabled={ocupado} onClick={ejecutarGuardado}>{ocupado?'Guardando…':'Quitar mesas'}</button>
   </div>
  </ModalFormulario>}
 </>;
}
