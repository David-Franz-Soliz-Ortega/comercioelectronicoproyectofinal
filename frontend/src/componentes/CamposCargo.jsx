import React from 'react';
import TipoCargoUniversitario from './TipoCargoUniversitario.jsx';
import OpcionesEleccion from './OpcionesEleccion.jsx';

// Campos compartidos por alta y edición; los formularios conservan sus propios envíos.
export default function CamposCargo({datos,cambiar,procesos,bloqueado,identidadFija=false,tipoBloqueado=false}){
 return <><fieldset disabled={bloqueado} className="campos-base-cargo">
 {datos.tipo==='universidad'?<TipoCargoUniversitario cargo={datos.cargo} procesos={procesos} bloqueado={bloqueado}
  alEscribir={cargo=>cambiar({...datos,cargo})} alSeleccionar={cargo=>cambiar({...datos,cargo,unidad:['Decano','Director'].includes(cargo)?'Carrera':'Facultad',facultad:'',grupoCarreras:'',carreras:[],ambito:['Rector','Vicerrector'].includes(cargo)?'Toda la universidad':''})}/>:<label>Tipo de cargo<input required maxLength={100} value={datos.cargo} onChange={e=>cambiar({...datos,cargo:e.target.value})}/></label>}
 <label>Tipo de organización<select aria-label="Tipo de organización" value={datos.tipo} disabled={tipoBloqueado} onChange={e=>cambiar({...datos,tipo:e.target.value,cargo:'',facultad:'',grupoCarreras:'',carreras:[]})}><option value="universidad">Universidad</option><option value="municipio">Municipio</option><option value="otra">Otra organización</option></select></label>
 <label>¿Cómo se agrupan las mesas?<input required maxLength={80} value={datos.unidad} onChange={e=>cambiar({...datos,unidad:e.target.value})}/></label>
 </fieldset><OpcionesEleccion datos={datos} cambiar={cambiar} procesos={procesos} bloqueado={bloqueado} identidadFija={identidadFija}/></>;
}
