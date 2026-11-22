import React, { useRef, useState } from 'react';
import ModalFormulario from './ModalFormulario.jsx';
import { solicitarRest } from '../api/clienteRest.js';
import { asignarMesasOperador, mesasAsignables } from '../api/operadores.js';
import { notificarExito } from '../api/confirmaciones.js';

export default function EditarOperador({ cuenta, organizacion, nombreOrganizacion, procesos, asignaciones, alGuardar, alCerrar }) {
 const [usuario,setUsuario]=useState(''),[clave,setClave]=useState(''),[visible,setVisible]=useState(false),[seleccion,setSeleccion]=useState([]),[ocupado,setOcupado]=useState(false),[error,setError]=useState('');
 const creada=useRef(null), completadas=useRef(new Set(asignaciones.filter(a=>a.idUsuario===cuenta?.idUsuario).map(a=>a.idMesa)));
 const [cuentaCreada,setCuentaCreada]=useState(false);
 const opciones=mesasAsignables(procesos);
 async function guardar(e){
  e.preventDefault();if(ocupado||!organizacion)return;
  setOcupado(true);setError('');
  try {
   if(!cuenta && !creada.current){
    const contrasena=clave;setClave('');setVisible(false);
    creada.current=await solicitarRest('/usuarios',{metodo:'POST',datos:{usuario,contrasena,idOrganizacion:organizacion,rol:'OPERADOR'}});
    setCuentaCreada(true);
   }
   const idUsuario=cuenta?.idUsuario??creada.current?.idUsuario;
   if(!idUsuario)throw Error('No se pudo confirmar la cuenta creada. Consulta Usuarios antes de volver a crearla.');
   await asignarMesasOperador({pedir:solicitarRest,organizacion,idUsuario,mesas:seleccion,completadas:completadas.current});
   alCerrar();alGuardar();
   notificarExito(seleccion.length?'Operador guardado con sus mesas asignadas.':cuenta?'Asignaciones conservadas.':'Operador creado. Asignación de mesa pendiente.');
  }catch(e){
   setError((creada.current?'La cuenta ya fue creada; las asignaciones pendientes pueden reintentarse sin crear otra cuenta. ':'')+e.message);
   if(creada.current)alGuardar();
  }finally{setOcupado(false);}
 }
 return <ModalFormulario abierto titulo={cuenta?'Editar mesas de '+cuenta.usuario:'Crear operador'} ocupado={ocupado} alCerrar={alCerrar}>
  <p>Institución: <strong>{nombreOrganizacion}</strong></p>
  <form className="formulario-simple formulario-operador" onSubmit={guardar}>
   {!cuenta&&!cuentaCreada&&<><label>Nombre de usuario<input required minLength={3} maxLength={80} autoComplete="off" value={usuario} disabled={ocupado} onChange={e=>setUsuario(e.target.value)}/></label>
    <label>Contraseña privada (12 a 72 bytes UTF-8)<div className="entrada-clave-admin"><input required minLength={12} type={visible?'text':'password'} autoComplete="new-password" value={clave} disabled={ocupado} onChange={e=>setClave(e.target.value)}/><button type="button" className="boton secundario" disabled={ocupado} aria-label={visible?'Ocultar contraseña':'Mostrar contraseña'} onClick={()=>setVisible(v=>!v)}>{visible?'Ocultar':'Mostrar'}</button></div></label></>}
   {cuentaCreada&&<p role="status">Cuenta creada. Completa o deja pendientes las mesas restantes.</p>}
   <fieldset disabled={ocupado}><legend>Asignar mesas (opcional)</legend><p>Puedes hacerlo después desde Editar. Las asignaciones existentes se conservan.</p>
    <div className="opciones-mesas-operador">{opciones.map(m=><label key={m.id}><input type="checkbox" checked={completadas.current.has(m.id)||seleccion.includes(m.id)} disabled={completadas.current.has(m.id)} onChange={e=>setSeleccion(prev=>e.target.checked?[...prev,m.id]:prev.filter(id=>id!==m.id))}/><span><strong>{m.codigo}</strong> · {m.unidad} · {m.sector}<small>{m.cargo} · {m.ambito||'Toda la institución'}</small></span></label>)}</div>
    {!opciones.length&&<p>No hay mesas en cargos en borrador. Puedes crear la cuenta y asignarlas después.</p>}
   </fieldset>
   {error&&<p className="aviso" role="alert">{error}</p>}
   <button className="boton primario" disabled={ocupado}>{ocupado?'Guardando…':cuenta||cuentaCreada?'Guardar asignaciones':'Crear operador'}</button>
  </form>
 </ModalFormulario>;
}
