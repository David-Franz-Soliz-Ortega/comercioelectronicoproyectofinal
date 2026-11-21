import VistaPreviaResultados from './VistaPreviaResultados.jsx';
import React from 'react';
import { resumirInstitucion } from '../api/resumenInstitucion.js';
import { nombresEstado } from './EstadoEleccion.jsx';
import { IconoUsuarios, IconoUrna, IconoUsuario } from './Iconos.jsx';
export default function ResumenAdministracion({institucion,procesos,cuentas,proceso,cargando,disponible,ocupado,alIr,alReintentar}){
 if(cargando)return <section className="panel-admin resumen-institucion" role="status">Consultando el resumen de {institucion.nombre}…</section>;
 if(!disponible)return <section className="panel-admin resumen-institucion"><p role="alert">No se pudo consultar el resumen de esta institución.</p><button type="button" className="boton secundario" disabled={ocupado} onClick={alReintentar}>Volver a consultar</button></section>;
 const r=resumirInstitucion(procesos,cuentas,institucion.idOrganizacion);
 const indicadores=[['candidatos','Candidatos registrados',r.candidatos,IconoUsuarios],['mesas','Mesas físicas configuradas',r.mesas,IconoUrna],['operadores','Operadores activos',r.operadores,IconoUsuario]];
 return <section className="resumen-institucion" aria-labelledby="titulo-resumen-institucion">
  <header className="cabecera-resumen-institucion"><div><p className="etiqueta-panel">VISTA GENERAL DE LA INSTITUCIÓN</p><h2 id="titulo-resumen-institucion">{institucion.nombre}</h2><p>Candidatos, mesas y operadores de esta institución. Los candidatos y las mesas se cuentan por cargo no archivado.</p></div><button type="button" className="boton primario" disabled={ocupado} onClick={()=>alIr('configuracion')}>Ir a Elección</button></header>
  <div className="indicadores-institucion">{indicadores.map(([id,titulo,valor,Icono])=><article key={id} data-indicador={id}><span className="icono-admin-metrica"><Icono tamano={22}/></span><strong>{valor}</strong><span>{titulo}</span></article>)}</div>
  <p className="nota-resumen-institucion">{r.mesas} mesas físicas · {r.actasEsperadas} actas esperadas por cargo · {r.cargos} cargos no archivados · {r.archivados} cargos archivados conservados en el historial.</p>
  <div className="panel-admin accesos-resumen"><h3>¿Qué necesitas hacer?</h3><p>Abre el apartado correspondiente para realizar cambios.</p>
   <div className="lista-accesos-resumen"><button type="button" disabled={ocupado} onClick={()=>alIr('configuracion')}><strong>Elección y cargos</strong><span>Crear cargos y configurar ámbitos, sectores y ponderación.</span></button><button type="button" disabled={ocupado} onClick={()=>alIr('candidatos')}><strong>Candidatos</strong><span>Registrar candidatos, fotografías e importar Excel.</span></button><button type="button" disabled={ocupado} onClick={()=>alIr('mesas')}><strong>Mesas y asignaciones</strong><span>Registrar mesas y asignar sus responsables.</span></button><button type="button" disabled={ocupado} onClick={()=>alIr('usuarios')}><strong>Usuarios y operadores</strong><span>Crear cuentas y administrar sus roles.</span></button></div>
   {proceso?<p className="cargo-activo-resumen">Cargo activo: <strong>{proceso.cargo}</strong> · {proceso.nombre} · {nombresEstado[proceso.estado]??proceso.estado}. Los apartados Candidatos y Mesas abrirán este cargo. Puedes cambiarlo en Elección.</p>:<p className="cargo-activo-resumen">Todavía no hay un cargo seleccionado. Empieza en Elección.</p>}
  </div>
  <VistaPreviaResultados organizacion={institucion.idOrganizacion} proceso={proceso} ocupado={ocupado} alCandidatos={()=>alIr('candidatos')} alPublicacion={()=>alIr('publicacion')}/>
 </section>;
}
