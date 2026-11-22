import React, { useState } from 'react';
import { solicitarRest } from '../api/clienteRest.js';
import { notificarExito } from '../api/confirmaciones.js';

export default function EditarNombreCandidato({ candidato, organizacion, ocupado, alGuardar }) {
 const [abierto, setAbierto] = useState(false), [nombre, setNombre] = useState(candidato.nombre);
 const [guardando, setGuardando] = useState(false), [error, setError] = useState('');
 async function guardar(e) {
  e.preventDefault();
  if (ocupado || guardando || !nombre.trim() || nombre.trim() === candidato.nombre) return;
  setGuardando(true); setError('');
  try {
   await solicitarRest(`/configuracion/candidatos/${encodeURIComponent(candidato.id)}`, { metodo: 'PUT', organizacion, datos: { nombre: nombre.trim() }, mostrarDetalleValidacion: true });
   notificarExito('Nombre del candidato actualizado correctamente.');
   setAbierto(false); alGuardar();
  } catch (e) { setError(e.message); }
  finally { setGuardando(false); }
 }
 return <div className="editar-nombre-candidato">
  <button type="button" className="boton secundario" disabled={ocupado || guardando} aria-expanded={abierto} onClick={() => { setNombre(candidato.nombre); setError(''); setAbierto(!abierto); }}>Editar</button>
  {abierto && <form onSubmit={guardar}>
   <label>Nombre del candidato<input autoFocus required maxLength={120} value={nombre} disabled={ocupado || guardando} onChange={e => setNombre(e.target.value)} /></label>
   {error && <p className="aviso" role="alert">{error}</p>}
   <div><button className="boton primario" disabled={ocupado || guardando || !nombre.trim() || nombre.trim() === candidato.nombre}>{guardando ? 'Guardando…' : 'Guardar nombre'}</button><button type="button" className="boton secundario" disabled={guardando} onClick={() => setAbierto(false)}>Cancelar</button></div>
  </form>}
 </div>;
}
