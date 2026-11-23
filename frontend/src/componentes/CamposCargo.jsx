import React from 'react';
import TipoCargoUniversitario from './TipoCargoUniversitario.jsx';
import OpcionesEleccion from './OpcionesEleccion.jsx';

// La agrupación de mesas se deduce del tipo de organización y del cargo.
export function unidadAutomatica(tipo,cargo){
 if(tipo==='universidad')return ['Decano','Director'].includes(cargo)?'Carrera':'Facultad';
 return tipo==='municipio'?'Recinto':'Grupo';
}

// Campos compartidos por alta y edición; los formularios conservan sus propios envíos.
export default function CamposCargo({datos,cambiar,procesos,bloqueado,identidadFija=false,tipoBloqueado=false}){
 return <><fieldset disabled={bloqueado} className="campos-base-cargo">
 {datos.tipo==='universidad'?<TipoCargoUniversitario cargo={datos.cargo} procesos={procesos} bloqueado={bloqueado}
  alEscribir={cargo=>cambiar({...datos,cargo,unidad:unidadAutomatica(datos.tipo,cargo)})} alSeleccionar={cargo=>cambiar({...datos,cargo,unidad:unidadAutomatica(datos.tipo,cargo),facultad:'',grupoCarreras:'',carreras:[],ambito:['Rector','Vicerrector'].includes(cargo)?'Toda la universidad':''})}/>:<label>Tipo de cargo<input required maxLength={100} value={datos.cargo} onChange={e=>cambiar({...datos,cargo:e.target.value})}/></label>}
 <label>Tipo de organización<select aria-label="Tipo de organización" value={datos.tipo} disabled={tipoBloqueado} onChange={e=>cambiar({...datos,tipo:e.target.value,cargo:'',unidad:unidadAutomatica(e.target.value,''),facultad:'',grupoCarreras:'',carreras:[]})}><option value="universidad">Universidad</option><option value="municipio">Municipio</option><option value="otra">Otra organización</option></select></label>
 <p className="ayuda-agrupacion-mesas">Las mesas se agrupan por <strong>{datos.unidad||unidadAutomatica(datos.tipo,datos.cargo)}</strong>.</p>
 </fieldset><OpcionesEleccion datos={datos} cambiar={cambiar} procesos={procesos} bloqueado={bloqueado} identidadFija={identidadFija}/></>;
}
