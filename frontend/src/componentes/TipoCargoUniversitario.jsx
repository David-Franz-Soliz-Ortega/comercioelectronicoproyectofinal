import React, { useState } from 'react';
import { tiposCargoUniversitarios } from '../api/seleccionAdministracion.js';

export default function TipoCargoUniversitario({cargo,procesos,bloqueado,alSeleccionar,alEscribir}){
 const [nuevo,setNuevo]=useState(false);
 const tipos=tiposCargoUniversitarios(procesos,nuevo?'':cargo);
 return <>
  <label>Tipo de cargo
   <select aria-label="Cargo universitario" required disabled={bloqueado} value={nuevo?'__nuevo__':cargo} onChange={e=>{
    const crear=e.target.value==='__nuevo__';setNuevo(crear);
    if(crear)alEscribir('');else alSeleccionar(e.target.value);
   }}>
    <option value="__nuevo__">Nuevo cargo…</option>
    <option value="" disabled hidden>Selecciona el tipo de cargo</option>
    {tipos.map(tipo=><option key={tipo} value={tipo}>{tipo}</option>)}
   </select>
  </label>
  {nuevo&&<label>Nombre del nuevo cargo
   <input aria-label="Nombre del nuevo cargo" required maxLength="100" disabled={bloqueado} placeholder="Ej.: Centro de Estudiantes de Tecnología" value={cargo} onChange={e=>alEscribir(e.target.value)}/>
  </label>}
 </>;
}
