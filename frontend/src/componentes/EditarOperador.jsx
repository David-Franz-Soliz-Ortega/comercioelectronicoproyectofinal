import React, { useEffect, useRef, useState } from 'react';
import ModalFormulario from './ModalFormulario.jsx';
import { solicitarRest } from '../api/clienteRest.js';
import { asignarMesasOperador, estadoAsignacionMesa, mesasAsignables } from '../api/operadores.js';
import { agruparMesasFisicas, agruparMesasPorFacultad } from '../api/mesasCompartidas.js';
import { notificarExito } from '../api/confirmaciones.js';

export default function EditarOperador({ cuenta, organizacion, nombreOrganizacion, procesos, asignaciones, alGuardar, alCerrar }) {
 const [usuario,setUsuario]=useState(''),[clave,setClave]=useState(''),[visible,setVisible]=useState(false);
 const [seleccion,setSeleccion]=useState([]),[desasignar,setDesasignar]=useState(new Set());
 const [confirmando,setConfirmando]=useState(false),[ocupado,setOcupado]=useState(false),[error,setError]=useState('');
 const [vigentes,setVigentes]=useState(asignaciones??[]),[cuentaCreada,setCuentaCreada]=useState(false);
 const creada=useRef(null),completadas=useRef(new Set((asignaciones??[]).filter(a=>a.idUsuario===cuenta?.idUsuario).map(a=>a.idMesa)));
 useEffect(()=>{if(asignaciones!==null)setVigentes(asignaciones??[]);},[asignaciones]);
 const idUsuario=cuenta?.idUsuario??creada.current?.idUsuario;
 const grupos=agruparMesasFisicas(mesasAsignables(procesos));
 const porGrupo=new Map(grupos.map(g=>[g.id,g]));
 const estados=new Map(grupos.map(g=>[g.id,estadoAsignacionMesa(g,vigentes,idUsuario)]));
 const gruposPorFacultad=agruparMesasPorFacultad(grupos.map(g=>({...g,facultad:g.cargos?.[0]?.facultad||''})));
 const marcada=g=>(estados.get(g.id).propias.size>0&&!desasignar.has(g.id))||seleccion.includes(g.id);
 const mesasElegidas=[...new Set(seleccion.flatMap(id=>(porGrupo.get(id)?.cargos??[]).map(c=>c.id)))];
 const desasignadas=[...desasignar];
 function elegir(grupo,valor){
  const estado=estados.get(grupo.id);
  if(ocupado||estado.ocupada)return;
  setSeleccion(prev=>valor?[...new Set([...prev,grupo.id])]:prev.filter(id=>id!==grupo.id));
  setDesasignar(prev=>{const n=new Set(prev);if(valor)n.delete(grupo.id);else if(estado.propias.size)n.add(grupo.id);return n;});
 }
 async function guardar(e){
  e.preventDefault();
  if(ocupado||!organizacion)return;
  if(desasignadas.length){setConfirmando(true);return;}
  await ejecutarGuardado();
 }
 async function ejecutarGuardado(){
  if(ocupado)return;
  setOcupado(true);setError('');
  try {
   // Releer antes de guardar detecta asignaciones hechas mientras el formulario estaba abierto.
   const respuesta=await solicitarRest('/configuracion/asignaciones',{organizacion});
   const actuales=respuesta.elementos;setVigentes(actuales);
   const afectadas=[...new Set([...seleccion,...desasignadas])];
   const conflictos=afectadas.filter(id=>!porGrupo.has(id)||estadoAsignacionMesa(porGrupo.get(id),actuales,idUsuario).ocupada);
   if(conflictos.length){
    setSeleccion(prev=>prev.filter(id=>!conflictos.includes(id)));
    setDesasignar(prev=>new Set([...prev].filter(id=>!conflictos.includes(id))));
    setConfirmando(false);
    throw Error('Cambió la disponibilidad: una mesa seleccionada ya tiene otro operador. Revisa las mesas marcadas como ocupadas.');
   }
   if(!cuenta&&!creada.current){
    const contrasena=clave;setClave('');setVisible(false);
    creada.current=await solicitarRest('/usuarios',{metodo:'POST',datos:{usuario,contrasena,idOrganizacion:organizacion,rol:'OPERADOR'}});
    setCuentaCreada(true);
   }
   const destino=cuenta?.idUsuario??creada.current?.idUsuario;
   if(!destino)throw Error('No se pudo confirmar la cuenta creada. Consulta Usuarios antes de volver a crearla.');
   // El DELETE existente quita la asignación de la mesa: nunca usarlo sobre cuentas ajenas.
   for(const idFisica of desasignadas){
    for(const c of porGrupo.get(idFisica).cargos){
     if(!actuales.some(a=>a.idMesa===c.id&&a.idUsuario===destino))continue;
     await solicitarRest('/configuracion/mesas/'+encodeURIComponent(c.id)+'/asignar',{metodo:'DELETE',organizacion});
     completadas.current.delete(c.id);
     setVigentes(prev=>prev.filter(a=>a.idMesa!==c.id));
    }
   }
   completadas.current=new Set(actuales.filter(a=>a.idUsuario===destino&&!desasignadas.some(id=>porGrupo.get(id).cargos.some(c=>c.id===a.idMesa))).map(a=>a.idMesa));
   await asignarMesasOperador({pedir:solicitarRest,organizacion,idUsuario:destino,mesas:mesasElegidas,completadas:completadas.current,alCompletar:idMesa=>setVigentes(prev=>[...prev,{idMesa,idUsuario:destino}])});
   setConfirmando(false);alCerrar();alGuardar();
   notificarExito(desasignadas.length||mesasElegidas.length?'Asignaciones del operador actualizadas.':cuenta?'Asignaciones conservadas.':'Operador creado. Asignación de mesa pendiente.');
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
   <fieldset disabled={ocupado}><legend>Asignar mesas (opcional)</legend><p>Las mesas de otros operadores aparecen bloqueadas. Puedes conservar o quitar las propias y añadir mesas libres; cada cargo tiene su acta separada.</p>
    <div className="opciones-mesas-operador">{gruposPorFacultad.map(fac=>{
     const disponibles=fac.mesas.filter(g=>!estados.get(g.id).ocupada);
     const marcadas=disponibles.filter(marcada).length;
     return <details key={fac.id} className="grupo-facultad-operador" open={gruposPorFacultad.length===1||fac.mesas.some(g=>estados.get(g.id).propias.size>0)}>
      <summary><span className="nombre-grupo-operador">{fac.nombre}</span> <span className="cantidad-total-mesas">{fac.mesas.length}</span>
       <label className="seleccionar-todo-grupo" onClick={e=>e.stopPropagation()}><input type="checkbox" aria-label={'Seleccionar mesas disponibles de '+fac.nombre} checked={disponibles.length>0&&marcadas===disponibles.length} ref={n=>{if(n)n.indeterminate=marcadas>0&&marcadas<disponibles.length;}} disabled={!disponibles.length} onChange={e=>disponibles.forEach(g=>elegir(g,e.target.checked))}/><span>Seleccionar grupo</span></label>
      </summary>
      {fac.mesas.map(g=>{const estado=estados.get(g.id);return <label key={g.id} className={estado.ocupada?'mesa-operador-ocupada':undefined}>
       <input type="checkbox" aria-label={'Mesa '+g.codigo+' · '+g.sector} checked={marcada(g)} disabled={estado.ocupada} onChange={e=>elegir(g,e.target.checked)}/>
       <span><strong>{g.codigo}</strong> · {g.sector||'General'} · {g.cargos.length} {g.cargos.length===1?'acta':'actas'}{estado.parcial?' · asignación parcial':''}<small>{g.unidad} · {g.cargos.map(c=>c.cargo).join(', ')}</small>{estado.ocupada&&<small className="estado-mesa-ocupada">Ocupada por otro operador</small>}</span>
      </label>;})}
     </details>;
    })}</div>
    {!grupos.length&&<p>No hay mesas en cargos en borrador. Puedes crear la cuenta y asignarlas después.</p>}
   </fieldset>
   {error&&<p className="aviso" role="alert">{error}</p>}
   <div className="acciones-formulario">
    <button type="button" className="boton secundario" disabled={ocupado} onClick={alCerrar}>Cancelar</button>
    <button className="boton primario" disabled={ocupado}>{ocupado?'Guardando…':cuenta||cuentaCreada?'Guardar asignaciones':'Crear operador'}</button>
   </div>
  </form>
 </ModalFormulario>
  {confirmando&&<ModalFormulario abierto titulo="Quitar asignaciones" ocupado={ocupado} alCerrar={()=>setConfirmando(false)} cerrarAbajo>
   <p>¿Quitar {desasignadas.length} mesa(s) asignada(s) a este operador?</p>
   <div className="acciones-formulario">
    <button type="button" className="boton secundario" disabled={ocupado} onClick={()=>setConfirmando(false)}>Cancelar</button>
    <button type="button" className="boton primario" disabled={ocupado} onClick={ejecutarGuardado}>{ocupado?'Guardando…':'Quitar mesas'}</button>
   </div>
  </ModalFormulario>}
 </>;
}
