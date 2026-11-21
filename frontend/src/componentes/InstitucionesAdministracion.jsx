import React, { useState } from 'react';
import { solicitarRest } from '../api/clienteRest.js';
import { IconoEdificio, IconoCheck } from './Iconos.jsx';
export default function InstitucionesAdministracion({organizaciones,organizacion,ocupado,cargando,puedeCrear,alSeleccionar,alCreada}){
 const [creando,setCreando]=useState(false),[nombre,setNombre]=useState(''),[enviando,setEnviando]=useState(false),[error,setError]=useState('');
 const seleccionada=organizaciones.find(o=>o.idOrganizacion===organizacion&&o.activa);
 const bloqueado=ocupado||enviando||cargando;
 async function crear(e){
  e.preventDefault();if(bloqueado||!puedeCrear)return;const valor=nombre.trim();
  if(!valor){setError('Escribe el nombre de la institución.');return;}
  setEnviando(true);setError('');
  try{const creada=await solicitarRest('/organizaciones',{metodo:'POST',datos:{nombre:valor}});alCreada({...creada,activa:true});setNombre('');setCreando(false);}
  catch(fallo){setError(fallo.message);}finally{setEnviando(false);}
 }
 return <section className="panel-admin espacio-instituciones" aria-labelledby="titulo-instituciones">
  <header className="cabecera-seleccion"><p className="etiqueta-panel">TU ESPACIO DE TRABAJO</p><h2 id="titulo-instituciones">Tus instituciones</h2><p>Elige una institución para ver sus eventos y cargos.</p></header>
  <div className="distribucion-instituciones">
   <nav className="lista-instituciones" aria-label="Instituciones disponibles">
    {cargando&&<p role="status" className="instituciones-vacias">Cargando tus instituciones…</p>}
    {!cargando&&organizaciones.length===0&&<p className="instituciones-vacias">No hay instituciones disponibles para mostrar.</p>}
    {organizaciones.map(o=><button type="button" className={`tarjeta-institucion ${seleccionada?.idOrganizacion===o.idOrganizacion?'institucion-seleccionada':''}`} key={o.idOrganizacion} data-institucion={o.idOrganizacion} aria-pressed={seleccionada?.idOrganizacion===o.idOrganizacion} disabled={bloqueado||!o.activa} onClick={()=>{setCreando(false);setError('');alSeleccionar(o.idOrganizacion);}}><span className="icono-institucion"><IconoEdificio tamano={20}/></span><span><strong>{o.nombre}</strong><small>{!o.activa?'Inactiva':seleccionada?.idOrganizacion===o.idOrganizacion?'Seleccionada':'Ver sus eventos'}</small></span>{seleccionada?.idOrganizacion===o.idOrganizacion&&<IconoCheck tamano={18}/>}</button>)}
    {puedeCrear&&<button type="button" className="tarjeta-institucion crear-institucion" disabled={bloqueado} aria-expanded={creando} aria-controls="formulario-nueva-institucion" onClick={()=>{alSeleccionar('');setCreando(true);setError('');}}><span className="icono-institucion" aria-hidden="true">+</span><span><strong>Crear nueva institución</strong><small>Universidad, municipio u organización</small></span></button>}
   </nav>
   <div className="detalle-institucion">
    {creando&&puedeCrear?<form id="formulario-nueva-institucion" className="formulario-nueva-institucion" onSubmit={crear}>
     <p className="etiqueta-panel">NUEVA INSTITUCIÓN</p><h3>¿Cómo se llama la institución?</h3><p>Después podrás crear sus eventos, cargos y asignar a sus operadores.</p>
     <label htmlFor="nombre-nueva-institucion">Nombre de la institución<input id="nombre-nueva-institucion" required maxLength={120} autoComplete="off" value={nombre} disabled={bloqueado} onChange={e=>setNombre(e.target.value)} placeholder="Ej.: Universidad, municipio u organización"/></label>
     {error&&<p className="aviso" role="alert">{error}</p>}
     <div className="acciones-institucion"><button type="submit" className="boton primario" disabled={bloqueado||!nombre.trim()}>{enviando?'Creando…':'Crear institución'}</button><button type="button" className="boton secundario" disabled={bloqueado} onClick={()=>{setCreando(false);setError('');}}>Cancelar</button></div>
    </form>:seleccionada?<div className="ficha-institucion" aria-live="polite">
     <span className="icono-ficha-institucion"><IconoEdificio tamano={30}/></span><p className="etiqueta-panel">INSTITUCIÓN SELECCIONADA</p><h3>{seleccionada.nombre}</h3><span className="institucion-activa">Activa</span><p>Estás administrando esta institución. Sus eventos electorales y cargos aparecen debajo.</p>
     <button type="button" className="boton secundario" disabled={bloqueado} onClick={()=>alSeleccionar('')}>Volver a elegir institución</button>
    </div>:<div className="ficha-institucion institucion-por-elegir"><span className="icono-ficha-institucion"><IconoEdificio tamano={30}/></span><h3>Selecciona una institución</h3><p>Elige una tarjeta de la lista para consultar sus eventos y cargos.{puedeCrear?' También puedes crear una nueva institución.':''}</p></div>}
   </div>
  </div>
 </section>;
}
