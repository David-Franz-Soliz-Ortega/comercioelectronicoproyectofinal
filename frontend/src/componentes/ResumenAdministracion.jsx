import PortadaAdministracion from './PortadaAdministracion.jsx';
import React from 'react';
import { resumirInstitucion } from '../api/resumenInstitucion.js';
import { IconoUsuarios, IconoUrna, IconoUsuario } from './Iconos.jsx';
export default function ResumenAdministracion({institucion,procesos,cuentas,cargando,disponible,ocupado,alIr,alReintentar,alGuardarPortada,alCargo}){
 if(cargando)return <section className="panel-admin resumen-institucion" role="status">Consultando el resumen de {institucion.nombre}…</section>;
 if(!disponible)return <section className="panel-admin resumen-institucion"><p role="alert">No se pudo consultar el resumen de esta institución.</p><button type="button" className="boton secundario" disabled={ocupado} onClick={alReintentar}>Volver a consultar</button></section>;
 const r=resumirInstitucion(procesos,cuentas,institucion.idOrganizacion);
 const indicadores=[['candidatos','Candidatos registrados',r.candidatos,IconoUsuarios],['mesas','Mesas físicas configuradas',r.mesas,IconoUrna],['operadores','Operadores activos',r.operadores,IconoUsuario]];
 return <section className="resumen-institucion" aria-labelledby="titulo-resumen-institucion">
  <header className="cabecera-resumen-institucion"><div><p className="etiqueta-panel">VISTA GENERAL DE LA INSTITUCIÓN</p><h2 id="titulo-resumen-institucion">{institucion.nombre}</h2><p>Candidatos, mesas y operadores de esta institución. Los candidatos y las mesas se cuentan por cargo no archivado.</p></div><button type="button" className="boton primario" disabled={ocupado} onClick={()=>alIr('configuracion')}>Ir a Elección</button></header>
  <div className="indicadores-institucion">{indicadores.map(([id,titulo,valor,Icono])=><article key={id} data-indicador={id}><span className="icono-admin-metrica"><Icono tamano={22}/></span><strong>{valor}</strong><span>{titulo}</span></article>)}</div>
  <p className="nota-resumen-institucion">{r.mesas} mesas físicas · {r.actasEsperadas} actas esperadas por cargo · {r.cargos} cargos no archivados · {r.archivados} cargos archivados conservados en el historial.</p>
  <PortadaAdministracion procesos={procesos} organizacion={institucion.idOrganizacion} ocupado={ocupado} alGuardar={alGuardarPortada} alCandidatos={id=>alCargo(id,'candidatos')} alPublicacion={id=>alCargo(id,'publicacion')}/>
 </section>;
}
