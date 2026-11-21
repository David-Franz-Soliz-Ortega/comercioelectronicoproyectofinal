import ConfirmarEliminacion from '../componentes/ConfirmarEliminacion.jsx';
import MesasCompartidas from '../componentes/MesasCompartidas.jsx';
import { agruparMesasFisicas } from '../api/mesasCompartidas.js';
import AsignacionesOperadores from '../componentes/AsignacionesOperadores.jsx';
import { mesasPorUnidad } from '../api/mesasPorUnidad.js';
import '../privado.css';
import '../administracion.css';
import SeleccionAdministracion from '../componentes/SeleccionAdministracion.jsx';
import TipoCargoUniversitario from '../componentes/TipoCargoUniversitario.jsx';
import CandidatosAdministracion from '../componentes/CandidatosAdministracion.jsx';
import FotoCandidatoAdministracion from '../componentes/FotoCandidatoAdministracion.jsx';
import { completarNombreEleccion } from '../api/seleccionAdministracion.js';
import InstitucionesAdministracion from '../componentes/InstitucionesAdministracion.jsx';
import React, { useEffect, useState } from 'react';
import Sesion, { ControlesSesion } from '../componentes/Sesion.jsx';
import AdministrarCuentas from '../componentes/AdministrarCuentas.jsx';
import PasosEleccion from '../componentes/PasosEleccion.jsx';
import { pasosDeEleccion } from '../api/pasosEleccion.js';
import ResumenAdministracion from '../componentes/ResumenAdministracion.jsx';
import { prepararEleccion } from '../api/preparacionEleccion.js';
import { consultarGraphql } from '../api/clienteGraphql.js';
import { solicitarRest } from '../api/clienteRest.js';
import { crearIdentificador } from '../api/identificadores.js';
import { establecerOrganizacion } from '../api/clienteSesion.js';
import {
  IconoTuvoto,
  IconoUrna,
  IconoRelojArena,
  IconoAlerta,
  IconoUsuarios,
  IconoBarras,
  IconoEdificio,
  IconoReloj,
  IconoCheck,
  IconoCamara,
  IconoSubir,
  IconoCasa,
  IconoEngranaje,
  IconoFoto,
  IconoHistorial,
  IconoUsuario,
  IconoSalir,
} from '../componentes/Iconos.jsx';

import EstadoEleccion, { nombresEstado } from '../componentes/EstadoEleccion.jsx';
import OpcionesEleccion from '../componentes/OpcionesEleccion.jsx';
import ImportarExcel from '../componentes/ImportarExcel.jsx';
const datosEleccionVacia=()=>({nombre:'',cargo:'',tipo:'universidad',unidad:'Facultad',ambito:'',facultad:'',grupoCarreras:'',carreras:[],vuelta:1,idPrimeraVuelta:null,sectores:[],ponderacion:false,reglaSegundaVuelta:null});

const archivoComoTexto = archivo => new Promise((aceptar, rechazar) => {
  const lector = new FileReader();
  lector.onload = () => aceptar(lector.result);
  lector.onerror = () => rechazar(new Error('No se pudo leer la imagen'));
  lector.readAsDataURL(archivo);
});
const datosDeEvento=base=>({...datosEleccionVacia(),...(base?{nombre:base.nombre,tipo:base.tipo,unidad:base.unidad,ambito:base.ambito??'',facultad:base.facultad??'',grupoCarreras:base.grupoCarreras??'',carreras:base.carreras??[],sectores:base.sectores??[],ponderacion:base.ponderacion??false,reglaSegundaVuelta:base.reglaSegundaVuelta??null}:{})});

function Aviso({ error, mensaje }) {
  return (
    <>
      {error && <div className="aviso" role="alert">{error}</div>}
      {mensaje && <div className="confirmacion" role="status">{mensaje}</div>}
    </>
  );
}

export default function AccesoPrivado() {
  return <Sesion>{estado => <PanelPrivado key={`${estado.sesion.idUsuario}-${estado.sesion.idOrganizacion ?? ''}`} {...estado} />}</Sesion>;
}

function PanelPrivado(estado) {
  const { sesion } = estado;
  const admin = sesion.roles.some(
    r => r.rol === 'ADMINISTRADOR' && (r.idOrganizacion === null || r.idOrganizacion === sesion.idOrganizacion)
  );
  const auditor = sesion.roles.some(r => r.rol === 'AUDITOR' && r.idOrganizacion === sesion.idOrganizacion);
  const operador = sesion.roles.some(r => r.rol === 'OPERADOR' && r.idOrganizacion === sesion.idOrganizacion);

  return (
    <div className={`aplicacion-privada administracion-tuvoto ${admin?'panel-administrador':operador?'panel-operador':'panel-auditor'}`}>
      <Aviso error={estado.error} />
      {admin ? (
        <PanelAdministrador sesion={sesion} {...estado} />
      ) : operador ? (
        <PanelOperador sesion={sesion} {...estado} />
      ) : auditor ? (
        <PanelAuditor sesion={sesion} {...estado} />
      ) : (
        <main className="zona-principal-privada" style={{ padding: 40 }}>
          <div className="panel-admin" style={{ padding: 32 }}>
            <h2>Acceso sin funciones asignadas</h2>
            <p>Solicita al administrador un rol y una organización autorizados.</p>
            <ControlesSesion {...estado} />
          </div>
        </main>
      )}
    </div>
  );
}

/* =========================================================================
   2 · ADMINISTRADOR (Panel con barra lateral, métricas y gestión completa)
   ========================================================================= */
function PanelAdministrador({ sesion, salir, seleccionar, ocupado: ocupadoSesion }) {
  const [pestana, setPestana] = useState('resumen');
  const [mostrarPasos,setMostrarPasos]=useState(()=>{try{return window.localStorage.getItem('tuvoto:guia-pasos')==='activada';}catch{return false;}});
  useEffect(()=>{try{window.localStorage.setItem('tuvoto:guia-pasos',mostrarPasos?'activada':'desactivada');}catch{/* La navegación sigue disponible si el navegador bloquea preferencias. */}},[mostrarPasos]);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [datosInstitucionListos,setDatosInstitucionListos]=useState(false);
  const [creandoProceso, setCreandoProceso] = useState(false);
  const [revisandoCargo, setRevisandoCargo] = useState(false);
  const [editandoProceso,setEditandoProceso]=useState(false);
  const [asignacionesGuardadas,setAsignacionesGuardadas]=useState([]);
  const [modoCuenta, setModoCuenta] = useState('usuario');
  const [mostrarCrearAdmin, setMostrarCrearAdmin] = useState(false);
  const [asignacionesConfirmadas, setAsignacionesConfirmadas] = useState(0);
  const [publicacionConfirmada, setPublicacionConfirmada] = useState(false);
  const [organizaciones, setOrganizaciones] = useState([]);
  const [consultandoInstituciones,setConsultandoInstituciones]=useState(true);
  const [cuentas, setCuentas] = useState([]);
  const [org, setOrg] = useState(sesion.idOrganizacion ?? '');
  const [procesos, setProcesos] = useState([]);
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [version, setVersion] = useState(0);

  const [datos, setDatos] = useState(datosEleccionVacia);
  const [eventoBase, setEventoBase] = useState('');
  const [candidato, setCandidato] = useState({ nombre: '', foto: '' });
  const [mesa, setMesa] = useState({ codigo: '', unidad: '',sector:'general' });
  const [asignacion, setAsignacion] = useState({ idMesa: '', idUsuario: '' });

  const institucionSeleccionada=organizaciones.find(o=>o.idOrganizacion===org&&o.activa);
  const actual = procesos.find(p => p.id === id);
  const configuracionCerrada = actual?.estado !== 'borrador';
  const mostrarAccionesCargo = institucionSeleccionada && datosInstitucionListos && !creandoProceso && !editandoProceso && (pestana !== 'configuracion' || revisandoCargo);
  const bloqueado = ocupado || ocupadoSesion || cargandoDatos;
  const administradorGlobal = sesion.roles.some(r => r.rol === 'ADMINISTRADOR' && r.idOrganizacion === null);
  const preparacion = prepararEleccion({ organizacion: org, proceso: actual, cuentas, asignacionesConfirmadas });
  const pasos = pasosDeEleccion({ proceso: creandoProceso ? null : actual, operadores: preparacion.operadores, asignaciones: asignacionesGuardadas });
  function mostrarCargos() {
    setCreandoProceso(false);setEditandoProceso(false);setRevisandoCargo(false);setPestana('configuracion');setError('');
  }
  function cambiarPaso(destino) {
    if (destino === 'configuracion') setRevisandoCargo(true);
    if (destino === 'usuarios') setModoCuenta('usuario');
    setError(''); setPestana(destino);
  }
  function cambiarInstitucion(valor){
    setPestana('resumen');setError('');setMensaje('');
    setRevisandoCargo(false);
    if(valor===org)return;
    setDatosInstitucionListos(false);setCargandoDatos(Boolean(valor));setOrg(valor);setProcesos([]);setCuentas([]);setId('');setCreandoProceso(false);setEditandoProceso(false);
  }
  function prepararNuevoCargo(base) {
    setRevisandoCargo(true);
    setEventoBase(base?.nombre ?? '');
    setDatos(datosDeEvento(base));
    setEditandoProceso(false);setCreandoProceso(true); setPestana('configuracion'); setError(''); setMensaje('');
  }
  function irPaso(paso) {
    if (paso.id === 'organizacion') { setPestana('resumen');setError('');return; }
    if (!org) { setError('Selecciona una institución en Resumen para continuar.');setPestana('resumen');return; }
    if (!actual && !['eleccion', 'operadores'].includes(paso.id)) { mostrarCargos();setError('Agrega un cargo para continuar su preparación.');return; }
    if (paso.id === 'operadores') setModoCuenta('usuario');
    if (paso.id === 'eleccion') { mostrarCargos();return; }
    setError(''); setPestana(paso.destino);
  }
  useEffect(() => {
    setEditandoProceso(false);
    setAsignacion({ idMesa: '', idUsuario: '' }); setAsignacionesConfirmadas(0);
    setPublicacionConfirmada(false);
    setCandidato({ nombre: '', foto: '' }); setMesa({ codigo: '', unidad: '',sector:actual?.sectores?.[0]?.codigo??'general' });
  }, [org, id]);
  useEffect(() => { setDatos(datosEleccionVacia()); setEventoBase(''); }, [org]);

  const pedir = (ruta, op = {}) => solicitarRest(ruta, { ...op, organizacion: org });
  async function cargarCuentas(){const elementos=[];for(let pagina=1;pagina<=100;pagina++){const r=await solicitarRest('/usuarios?pagina='+pagina+'&limite=100',{organizacion:org||undefined});elementos.push(...r.elementos);if(elementos.length>=(r.total??elementos.length))return {elementos};}throw Error('Demasiadas cuentas para este panel.');}
  useEffect(()=>{let vigente=true;setAsignacionesGuardadas([]);if(id&&org)pedir('/configuracion/procesos/'+id+'/asignaciones').then(r=>{if(vigente)setAsignacionesGuardadas(r.elementos);}).catch(e=>{if(vigente)setError(e.message);});return()=>{vigente=false};},[id,org,version]);

  useEffect(() => {
    let v = true;
    setConsultandoInstituciones(true);
    solicitarRest('/organizaciones')
      .then(d => { if (v) { setOrganizaciones(d.elementos);
        const activas = d.elementos.filter(o => o.activa);
        setOrg(anterior=>activas.some(o=>o.idOrganizacion===anterior)?anterior:'');
      } })
      .catch(e => { if (v) setError(e.message); }).finally(()=>{if(v)setConsultandoInstituciones(false);});
    return () => { v = false; };
  }, [version]);

  useEffect(() => {
    let v = true;
    setCargandoDatos(true);
    if (org) establecerOrganizacion(org);
    else establecerOrganizacion('');
    Promise.all([
      org ? pedir('/configuracion/procesos') : Promise.resolve({ elementos: [] }),
      cargarCuentas()
    ])
      .then(([p, c]) => {
        if (v) {
          setProcesos(p.elementos);
          setCuentas(c.elementos);
          setDatosInstitucionListos(Boolean(org));
          if (p.elementos.length > 0) {
            setId(anterior => p.elementos.some(item => item.id === anterior)
              ? anterior : (p.elementos.find(item => item.actual) || p.elementos[0])?.id ?? '');
          }
        }
      })
      .catch(e => { if (v) setError(e.message); })
      .finally(() => { if (v) setCargandoDatos(false); });
    return () => { v = false; };
  }, [org, version]);

  async function guardar(operacion, confirmacion = 'Cambios guardados correctamente.') {
    if (bloqueado) return;
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      await operacion();
      setMensaje(confirmacion);
      setVersion(v => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }


  return (
    <>
      {/* Barra Lateral Administrador */}
      <aside className="barra-lateral-privada">
        <div className="cabecera-lateral-marca">
          <IconoTuvoto tamano={28} />
          <span style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF', letterSpacing: 0.5 }}>TUVOTO</span>
        </div>

        <nav className="navegacion-lateral">
          <button type="button" className="control-pasos-preparacion" aria-label={mostrarPasos?'Desactivar guía de pasos':'Activar guía de pasos'} aria-pressed={mostrarPasos} onClick={()=>setMostrarPasos(v=>!v)}><span>Guía de pasos</span><small>{mostrarPasos?'Activada':'Desactivada'}</small></button>
          <button
            disabled={bloqueado}
            className={`item-menu-lateral ${pestana === 'resumen' ? 'activo' : ''}`}
            onClick={() => setPestana('resumen')}
          >
            <IconoCasa tamano={18} />
            <span>Resumen</span>
          </button>
          <button
            disabled={bloqueado}
            className={`item-menu-lateral ${pestana === 'configuracion' ? 'activo' : ''}`}
            onClick={() => irPaso({ id: 'eleccion', destino: 'configuracion' })}
          >
            <IconoEngranaje tamano={18} />
            <span>Elección</span>
          </button>
          <button
            disabled={bloqueado}
            className={`item-menu-lateral ${pestana === 'candidatos' ? 'activo' : ''}`}
            onClick={() => irPaso({ id: 'candidatos', destino: 'candidatos' })}
          >
            <IconoUsuarios tamano={18} />
            <span>Candidatos</span>
          </button>
          <button
            disabled={bloqueado}
            className={`item-menu-lateral ${pestana === 'mesas' ? 'activo' : ''}`}
            onClick={() => irPaso({ id: 'mesas', destino: 'mesas' })}
          >
            <IconoUrna tamano={18} />
            <span>Mesas</span>
          </button>
          <button disabled={bloqueado} className={`item-menu-lateral ${pestana === 'asignaciones' ? 'activo' : ''}`} onClick={() => irPaso({ id: 'asignaciones', destino: 'asignaciones' })}><IconoUsuario tamano={18}/><span>Asignar operadores</span></button>
          <button disabled={bloqueado} className={`item-menu-lateral ${pestana === 'publicacion' ? 'activo' : ''}`} onClick={() => irPaso({ id: 'publicacion', destino: 'publicacion' })}><IconoCheck tamano={18}/><span>Estado y publicación</span></button>
          <button
            disabled={bloqueado}
            className={`item-menu-lateral ${pestana === 'usuarios' ? 'activo' : ''}`}
            onClick={() => { setModoCuenta('usuario'); setPestana('usuarios'); }}
          >
            <IconoUsuario tamano={18} />
            <span>Usuarios</span>
          </button>
        </nav>

        <div className="pie-lateral-privado">
          <a href="#resultados" style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>← Ver resultados públicos</span>
          </a>
        </div>
      </aside>

      {/* Zona Principal Administrador */}
      <main className="zona-principal-privada">
        {/* Barra Superior */}
        <header className="cabecera-superior-privada">
          <div className="titulo-seccion-privada">
            <p className="etiqueta-panel">TUVOTO · Administración</p>
            <h1>{{resumen:'Tu centro de administración',configuracion:'Elección y cargos',candidatos:'Candidatos',mesas:'Mesas de recepción',usuarios:'Usuarios y organizaciones',asignaciones:'Asignar operadores',publicacion:'Estado y publicación'}[pestana]??'Administración'}</h1>
            <div className="subtitulo-seccion-privada">
              Elección seleccionada: <strong>{actual?.nombre ?? 'Selecciona una organización y proceso'}</strong>
            </div>
          </div>

          <ControlesSesion
            sesion={sesion}
            ocupado={ocupado || ocupadoSesion}
            salir={salir}
            seleccionar={seleccionar}
            subtituloRol="Administrador"
          />
        </header>

        {/* Contenido según pestaña */}
        <div className="contenido-seccion-privada">
          <Aviso error={error} mensaje={mensaje} />

          {cargandoDatos && <p role="status">Cargando la configuración de tu organización…</p>}

          {pestana==='resumen'&&<>
          <InstitucionesAdministracion organizaciones={organizaciones} organizacion={org} ocupado={bloqueado} cargando={consultandoInstituciones} puedeCrear={administradorGlobal}
            alSeleccionar={cambiarInstitucion}
            alCreada={creada=>{setDatosInstitucionListos(false);setCargandoDatos(true);setOrganizaciones(prev=>[...prev,creada]);setOrg(creada.idOrganizacion);setProcesos([]);setCuentas([]);setId('');setCreandoProceso(false);setEditandoProceso(false);setPestana('resumen');setMensaje('Institución creada. Ya puedes preparar su primera elección.');}}/>
          {institucionSeleccionada&&<ResumenAdministracion institucion={institucionSeleccionada} procesos={procesos} cuentas={cuentas} proceso={actual} cargando={cargandoDatos} disponible={datosInstitucionListos} ocupado={bloqueado} alReintentar={()=>setVersion(v=>v+1)} alIr={destino=>{
            if(destino==='configuracion'){mostrarCargos();}
            else if(destino==='usuarios'){setModoCuenta('usuario');setPestana('usuarios');}
            else irPaso({id:destino,destino});
          }}/>}


          </>}
          {!['resumen', 'usuarios'].includes(pestana) && <div className="contexto-modulo-admin" data-contexto-institucion={org} data-contexto-proceso={id}>
            <div>{institucionSeleccionada?<><strong>{institucionSeleccionada.nombre}</strong>{creandoProceso?<span>Nuevo cargo</span>:actual&&<span>Cargo seleccionado: {actual.cargo}{actual.ambito?' · '+actual.ambito:''}</span>}</>:<span>Selecciona una institución en Resumen para continuar.</span>}</div>
            <div className="acciones-contexto-cargo">
              <button type="button" className="boton secundario" disabled={bloqueado} onClick={()=>setPestana('resumen')}>Cambiar institución</button>
              {mostrarAccionesCargo&&<><button type="button" className="boton secundario elegir-cargo-existente" disabled={bloqueado} onClick={mostrarCargos}>Elegir cargo existente</button><button type="button" className="boton primario crear-cargo-directo" disabled={bloqueado} onClick={()=>prepararNuevoCargo()}>+ Crear nuevo cargo</button></>}
            </div>
          </div>}
          {mostrarPasos && institucionSeleccionada && pestana !== 'resumen' && (creandoProceso || actual?.estado === 'borrador') && (pestana!=='configuracion'||revisandoCargo||creandoProceso||editandoProceso) && <PasosEleccion pasos={pasos} actual={pestana} ocupado={bloqueado} guardado={!!actual && !creandoProceso} alIr={cambiarPaso} alSalir={()=>{setCreandoProceso(false);setEditandoProceso(false);setPestana('resumen');}}/>}
          {pestana==='configuracion' && institucionSeleccionada && !creandoProceso && !editandoProceso && !revisandoCargo && <SeleccionAdministracion organizacion={org} procesos={procesos} idProceso={id} ocupado={bloqueado} cargando={cargandoDatos} disponible={datosInstitucionListos}
            alProceso={valor=>{setId(valor);setRevisandoCargo(true);setError('');setMensaje('');}}
            alEliminar={p=>guardar(async()=>{await pedir(`/configuracion/procesos/${p.id}`,{metodo:'DELETE',mostrarDetalleValidacion:true});if(id===p.id)setId('');setRevisandoCargo(false);},'Cargo retirado del catálogo.')} alAgregar={()=>prepararNuevoCargo()} alReintentar={()=>setVersion(v=>v+1)}/>}
          {pestana==='configuracion'&&institucionSeleccionada&&datosInstitucionListos&&!creandoProceso&&!editandoProceso&&!revisandoCargo&&<ImportarExcel key={'cargos-'+org} ruta="/configuracion/importaciones/cargos" organizacion={org} titulo="cargos" gestionarExistentes datosAdicionales={{nombre:institucionSeleccionada.nombre.slice(0,120)}} alImportar={()=>{setMensaje('Archivo de cargos procesado. Revisa el resumen de creados, actualizados y mantenidos.');setVersion(v=>v+1);}} ayuda={<><p>Una fila por cargo universitario. Solo <strong>Rector, Vicerrector, Decano o Director</strong>. Se crean en borrador, sin candidatos ni actas.</p><p>Columnas: <strong>cargo, facultad, grupoCarreras, carreras</strong>. Rector y Vicerrector abarcan toda la universidad. Decano requiere facultad; cada Director requiere facultad, un grupo distinto y sus carreras separadas por <strong>;</strong>.</p><p>Ejemplo: <strong>Director | Tecnología | Grupo A | Sistemas; Civil; Eléctrica</strong>. Otra fila puede ser Director de Tecnología, Grupo B, con otras carreras. Los cargos existentes se mantienen salvo que elijas reemplazar su configuración en borrador.</p></>}/>}

          {pestana === 'configuracion' && org && (creandoProceso || editandoProceso || (revisandoCargo && actual)) && (
            <div className="panel-admin" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 18, color: 'var(--azul-oscuro)', marginBottom: 16 }}>{editandoProceso?'Editar opciones del cargo':creandoProceso ? 'Crear nuevo cargo' : 'Configuración del cargo'}</h2>
              {actual&&!creandoProceso&&!editandoProceso&&<div className="detalle-configuracion-eleccion"><h3>{actual.cargo}</h3><dl><dt>Elección</dt><dd>{actual.nombre}</dd><dt>Facultad</dt><dd>{actual.facultad||'Toda la institución'}</dd><dt>Carreras</dt><dd>{actual.carreras?.join(', ')||'Sin lista de carreras configurada'}</dd><dt>Ámbito</dt><dd>{actual.ambito||'Sin ámbito adicional'}</dd><dt>Vuelta</dt><dd>{actual.vuelta===2?'Segunda vuelta':'Primera vuelta'}</dd><dt>Conteo</dt><dd>{actual.ponderacion?'Ponderación por sectores activada':actual.sectores?.length?'Sectores separados; todos los votos valen igual':'Normal: todos los votos valen igual'}</dd></dl>{actual.sectores?.length>0&&<ul>{actual.sectores.map(s=><li key={s.codigo}>{s.nombre}{actual.ponderacion?` · ${s.pesoBps/100} %`:''}</li>)}</ul>}<p>{configuracionCerrada?'La configuración está bloqueada porque este cargo ya salió de borrador.':'Puedes editar las opciones mientras el cargo esté en borrador.'}</p><button type="button" className="boton secundario" disabled={bloqueado} onClick={()=>setPestana('publicacion')}>Ver estado y publicación</button></div>}
              {!creandoProceso && !editandoProceso && <button type="button" className="boton secundario volver-cargos" disabled={bloqueado} onClick={mostrarCargos}>← Volver a cargos</button>}

              {actual&&!creandoProceso&&!editandoProceso&&<button type="button" className="boton secundario" disabled={bloqueado||configuracionCerrada} onClick={()=>{const d=datosEleccionVacia();for(const k of Object.keys(d))if(actual[k]!==undefined)d[k]=actual[k];setEventoBase('');setDatos(d);setEditandoProceso(true);}}>Editar elección en borrador</button>}
              {(creandoProceso || editandoProceso) && (
              <form
                className="formulario-simple"
                onSubmit={e => {
                  e.preventDefault();
                  guardar(async () => {
                    const p = await pedir('/configuracion/procesos'+(editandoProceso?'/'+id:''), { metodo: editandoProceso?'PUT':'POST', datos: completarNombreEleccion(datos, institucionSeleccionada) });
                    setId(p.id);
                    setDatos(datosEleccionVacia());setEventoBase(''); setCreandoProceso(false);setEditandoProceso(false); setPestana('candidatos');
                  });
                }}
              >
                <p>{creandoProceso?'Crearás un cargo nuevo; el cargo que tenías seleccionado se conserva.':'Edita únicamente las opciones de este cargo.'} Después podrás registrar sus candidatos, mesas y operadores.</p>
                {creandoProceso&&<button type="button" className="boton secundario elegir-existente-desde-formulario" disabled={bloqueado} onClick={mostrarCargos}>Cancelar y elegir un cargo existente</button>}
                {datos.tipo==='universidad'?<TipoCargoUniversitario key={org+':'+(editandoProceso?id:'nuevo')+':'+(datos.idPrimeraVuelta??'')} cargo={datos.cargo} procesos={procesos} bloqueado={bloqueado}
                  alEscribir={cargo=>setDatos({...datos,cargo})}
                  alSeleccionar={cargo=>setDatos({...datos,cargo,unidad:['Decano','Director'].includes(cargo)?'Carrera':'Facultad',facultad:'',grupoCarreras:'',carreras:[],ambito:['Rector','Vicerrector'].includes(cargo)?'Toda la universidad':''})}/>:<label>Tipo de cargo<input required maxLength="100" placeholder="Ej.: Alcalde, Concejal…" value={datos.cargo} onChange={e=>setDatos({...datos,cargo:e.target.value})}/></label>}
                <label>
                  Tipo de organización
                  <select aria-label="Tipo de organización" value={datos.tipo} disabled={!!eventoBase || bloqueado} onChange={e => setDatos({ ...datos, tipo: e.target.value,cargo:'',facultad:'',grupoCarreras:'',carreras:[] })}>
                    <option value="universidad">Universidad</option>
                    <option value="municipio">Municipio</option>
                    <option value="otra">Otra organización</option>
                  </select>
                </label>
                <label>
                  ¿Cómo se agrupan las mesas? (Facultad, Comunidad, Distrito…)
                  <input required maxLength="80" placeholder="Ej: Facultad, Parroquia, etc." value={datos.unidad} onChange={e => setDatos({ ...datos, unidad: e.target.value })} />
                </label>
                <OpcionesEleccion datos={datos} cambiar={setDatos} procesos={procesos} bloqueado={bloqueado} identidadFija={editandoProceso}/>
                <button className="boton primario" disabled={bloqueado||(editandoProceso&&configuracionCerrada)||(datos.ponderacion&&datos.sectores.reduce((a,s)=>a+s.pesoBps,0)!==10000)} style={{ width: 'fit-content', marginTop: 10 }}>
                  {ocupado ? 'Guardando…' : editandoProceso?'Guardar cambios':'Guardar cargo y continuar'}
                </button>
                <button type="button" className="boton secundario cancelar-cargo" disabled={bloqueado} onClick={mostrarCargos}>Cancelar y volver a cargos</button>
              </form>
              )}

            </div>
          )}

          {pestana==='mesas'&&institucionSeleccionada&&datosInstitucionListos&&<MesasCompartidas key={org} organizacion={org} procesos={procesos} cuentas={cuentas} idProceso={id} version={version} ocupado={bloqueado} guardar={guardar} alCargo={valor=>{setId(valor);setPestana('mesas');}} alImportar={()=>{setMensaje('Mesas físicas y cargos importados correctamente.');setVersion(v=>v+1);}}/>}

          {['mesas','asignaciones'].includes(pestana)&&institucionSeleccionada&&datosInstitucionListos&&<ImportarExcel key={'general-'+pestana+'-'+org} general cargos={procesos} ruta={'/configuracion/importaciones-generales/'+pestana} organizacion={org} titulo={pestana} alImportar={()=>{setError('');setMensaje('Archivo completo importado. Cada registro quedó en su cargo de destino.');setVersion(v=>v+1);}}/>}

          {pestana === 'candidatos' && institucionSeleccionada && <>
          <CandidatosAdministracion key={org} organizacion={org} procesos={procesos} idProceso={id} ocupado={bloqueado} cargando={cargandoDatos} disponible={datosInstitucionListos} revision={version}
            alEliminar={c=>guardar(()=>pedir(`/configuracion/candidatos/${c.id}`,{metodo:'DELETE',datos:{confirmar:true},mostrarDetalleValidacion:true}),'Candidato retirado del catálogo.')} alProceso={valor=>{setId(valor);setError('');setMensaje('');}} alAgregarCargo={()=>prepararNuevoCargo()} alReintentar={()=>setVersion(v=>v+1)}>
            {actual && <div className="editor-candidatos" data-editor-candidatos={id}>
              <h3>Candidatos de {actual.cargo} · {actual.ambito || actual.facultad || 'Toda la institución'}</h3>
              <p style={{ color: 'var(--secundario)', fontSize: 12, marginBottom: 20 }}>
                {configuracionCerrada ? 'Este cargo ya salió de borrador. Sus candidatos y fotografías están bloqueados.' : 'Puedes agregar candidatos y cambiar fotografías mientras el cargo esté en borrador. Al iniciar el conteo se bloquearán los cambios.'}
              </p>

              {!configuracionCerrada && <form
                key={id}
                className="formulario-simple"
                onSubmit={e => {
                  e.preventDefault();
                  guardar(async () => {
                    await pedir(`/configuracion/procesos/${id}/candidatos`, { metodo: 'POST', datos: candidato });
                    setCandidato({ nombre: '', foto: '' });
                    if (e.nativeEvent.submitter?.value === 'continuar') setPestana('mesas');
                  });
                }}
              >
                {actual.vuelta===2?<label>Candidato de la primera vuelta<select required value={candidato.idCandidatoOrigen??''} onChange={e=>setCandidato({idCandidatoOrigen:e.target.value})}><option value="">Selecciona participante</option>{(procesos.find(p=>p.id===actual.idPrimeraVuelta)?.candidatos??[]).filter(c=>!actual.candidatos.some(v=>v.idCandidatoOrigen===c.id)).map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>:<>
                <label>
                  Nombre del candidato
                  <input required maxLength="120" disabled={bloqueado} value={candidato.nombre} onChange={e => setCandidato({ ...candidato, nombre: e.target.value })} />
                </label>
                <label>
                  Fotografía (JPEG/PNG, máx 2 MB)
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    disabled={bloqueado}
                    onChange={async e => {
                      try {
                        const f = e.target.files[0];
                        if (f) {
                          if (f.size > 2000000) throw Error('Máximo 2 MB');
                          setCandidato({ ...candidato, foto: await archivoComoTexto(f) });
                        }
                      } catch (err) {
                        setError(err.message);
                      }
                    }}
                  />
                </label>
                </>}
                <button className="boton primario" disabled={configuracionCerrada || bloqueado} style={{ width: 'fit-content' }}>
                  {ocupado ? 'Registrando…' : 'Guardar y agregar otro candidato'}
                </button>
                <button className="boton secundario" name="accion" value="continuar" disabled={configuracionCerrada || bloqueado}>Guardar candidato y continuar</button>
              </form>}

              {actual.candidatos.length > 0 && <button type="button" className="boton secundario" disabled={configuracionCerrada || bloqueado} onClick={() => setPestana('mesas')}>Ya registré los candidatos: continuar con las mesas</button>}
              <h3 className="titulo-fotografias-candidatos">Candidatos registrados · {actual.candidatos.length}</h3>
              {actual.candidatos.some(c=>c.tieneFoto||c.foto)&&!(actual.actual||actual.publicado)&&<p className="nota-fotos-candidatos">Estas fotografías aún no son públicas. Se mostrarán en Resultados al publicar este cargo.</p>}
              <div className="grid-candidatos-fotos" style={{ marginTop: 24 }}>
                {actual.candidatos.map(c => (
                  <article key={c.id} className="tarjeta-candidato-foto" data-candidato-foto={c.id}>
                    <FotoCandidatoAdministracion candidato={c} organizacion={org} revision={version}/>
                    <strong>{c.nombre}</strong>
                    <small>{c.tieneFoto || c.foto ? 'Fotografía cargada' : 'Sin fotografía'}</small>
                    {!configuracionCerrada && <label className="boton-cambiar-foto">
                      <IconoCamara tamano={14} />
                      <span>{c.tieneFoto || c.foto ? 'Cambiar fotografía' : 'Agregar fotografía'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        aria-label={`Fotografía de ${c.nombre}`}
                        disabled={configuracionCerrada || bloqueado}
                        onChange={e => {
                          const f = e.target.files[0];
                          e.target.value = '';
                          if (f) {
                            guardar(async () => {
                              if (f.size > 2000000) throw Error('Máximo 2 MB');
                              await pedir(`/configuracion/candidatos/${c.id}/foto`, { metodo: 'PUT', datos: { foto: await archivoComoTexto(f) } });
                            }, 'Fotografía guardada correctamente.');
                          }
                        }}
                      />
                    </label>}
                    {!configuracionCerrada&&<ConfirmarEliminacion nombre={c.nombre} ocupado={bloqueado} alConfirmar={()=>guardar(()=>pedir(`/configuracion/candidatos/${c.id}`,{metodo:'DELETE',datos:{confirmar:true},mostrarDetalleValidacion:true}),'Candidato retirado del catálogo.')}/>}
                  </article>
                ))}
              </div>
              {!actual.candidatos.length&&<p className="vacio-candidatos-cargo">Todavía no hay candidatos en este cargo. Agrégalos con el formulario o utiliza el Excel de todos los cargos.</p>}
            </div>}
          </CandidatosAdministracion>
          {datosInstitucionListos&&<ImportarExcel key={'general-candidatos-'+org} general cargos={procesos} ruta="/configuracion/importaciones-generales/candidatos" organizacion={org} titulo="candidatos" alImportar={()=>{setError('');setMensaje('Archivo completo importado. Cada candidato quedó en su cargo de destino.');setVersion(v=>v+1);}}/>}
          </>}

          {['mesas', 'asignaciones'].includes(pestana) && actual && (
            <div className="panel-admin" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 18, color: 'var(--azul-oscuro)', marginBottom: 16 }}>
                {pestana === 'mesas' ? 'Registrar mesas' : 'Asignar responsables'} · {actual.mesas.length} mesas esperadas
              </h2>

              <div className="formularios-preparacion-mesas">
                {pestana === 'mesas' && <>
                <div className="ayuda-mesas-unidad"><h3>Mesas por {actual.unidad.toLowerCase()} o unidad</h3><p>Cada fila del Excel representa una mesa. En <strong>unidad</strong> indica la facultad, carrera o comunidad a la que pertenece. Usa un <strong>codigo</strong> único dentro de este cargo.</p></div>
                <ImportarExcel abierto deshabilitado={configuracionCerrada} key={`mesas-${id}`} ruta={`/configuracion/procesos/${id}/importaciones/mesas`} organizacion={org} titulo="mesas" alImportar={()=>{setError('');setMensaje('Mesas importadas correctamente. Se muestran agrupadas por facultad o unidad.');setVersion(v=>v+1);}} ayuda={<><p>Columnas de la plantilla: <strong>codigo</strong>, <strong>unidad</strong> y <strong>sector</strong>.</p><p>{actual.sectores?.length?`Sectores disponibles: ${actual.sectores.map(s=>s.nombre+' ('+s.codigo+')').join(', ')}.`:'Si no separas sectores, deja sector vacío para usar General.'} Puedes incluir mesas de varias facultades en el mismo archivo, indicando su unidad en cada fila.</p></>}/>

                <form
                  className="formulario-simple"
                  onSubmit={e => {
                    e.preventDefault();
                    guardar(async () => {
                      await pedir(`/configuracion/procesos/${id}/mesas`, { metodo: 'POST', datos: mesa });
                      setMesa({ codigo: '', unidad: '',sector:actual?.sectores?.[0]?.codigo??'general' });
                      if (e.nativeEvent.submitter?.value === 'continuar') cambiarPaso('usuarios');
                    });
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 15, color: 'var(--azul-oscuro)' }}>Agregar mesa</h3>
                  {actual.sectores?.length>0&&<label>Sector<select required value={mesa.sector??'general'} onChange={e=>setMesa({...mesa,sector:e.target.value})}><option value="general" disabled>Selecciona sector</option>{actual.sectores.map(s=><option key={s.codigo} value={s.codigo}>{s.nombre}</option>)}</select></label>}
                  <label>
                    Código de mesa
                    <input required placeholder="Ej: Mesa 081" value={mesa.codigo} onChange={e => setMesa({ ...mesa, codigo: e.target.value })} />
                  </label>
                  <label>
                    {actual.unidad}
                    {actual.carreras?.length?<select required aria-label="Carrera de la mesa" value={mesa.unidad} onChange={e=>setMesa({...mesa,unidad:e.target.value})}><option value="">Selecciona una carrera o grupo</option>{actual.grupoCarreras&&actual.facultad&&<option value={actual.facultad+' · '+actual.grupoCarreras}>{actual.facultad} · {actual.grupoCarreras} (todas sus carreras)</option>}{actual.carreras.map(c=><option key={c} value={c}>{c}</option>)}</select>:<input required placeholder={`Ej: ${actual.unidad}`} value={mesa.unidad} onChange={e => setMesa({ ...mesa, unidad: e.target.value })} />}

                  </label>
                  <button className="boton primario" disabled={configuracionCerrada || bloqueado} style={{ width: 'fit-content' }}>
                    Guardar y agregar otra mesa
                  </button>
                  <button className="boton secundario" name="accion" value="continuar" disabled={configuracionCerrada || bloqueado}>Guardar mesa y continuar</button>
                </form>

                {actual.sectores?.length>0&&<p>En Excel puedes indicar el nombre o el código del sector: {actual.sectores.map(s=>`${s.nombre} (${s.codigo})`).join(', ')}.</p>}
                <p>Registra todas las mesas esperadas. Después asigna un responsable a cada una.</p>
                <div className="lista-mesas-por-unidad">{mesasPorUnidad(actual.mesas).map(grupo=><section className="grupo-mesas-unidad" key={grupo.unidad}><h3>{grupo.unidad} · {grupo.mesas.length} mesas</h3><ul>{grupo.mesas.map(m=><li key={m.id} data-mesa-cargo={m.id}><span><strong>{m.codigo}</strong> · {m.sector??'general'}</span><button type="button" className="boton secundario" disabled={configuracionCerrada||bloqueado} onClick={()=>{setAsignacion({idMesa:m.id,idUsuario:''});setPestana('asignaciones');}}>Asignar operador</button>{!configuracionCerrada&&<ConfirmarEliminacion nombre={'Mesa '+m.codigo+' · '+actual.cargo} ocupado={bloqueado} etiqueta="Quitar de este cargo" descripcion="Se retirará la mesa de este cargo. Sus otros cargos y su historial se conservan." alConfirmar={()=>guardar(()=>pedir(`/configuracion/mesas/${m.id}`,{metodo:'DELETE',datos:{confirmar:true},mostrarDetalleValidacion:true}),'Mesa retirada de este cargo.')}/>}</li>)}</ul></section>)}</div>
                <button type="button" className="boton primario" disabled={configuracionCerrada || bloqueado || !actual.mesas.length} onClick={() => cambiarPaso('usuarios')}>Continuar con los operadores</button>
                </>}
                {pestana === 'asignaciones' && <>
                {!preparacion.operadores.length && <div className="aviso">Todavía no hay operadores disponibles en esta organización. <button type="button" className="boton secundario" onClick={() => { setModoCuenta('usuario'); setPestana('usuarios'); }}>Crear operador</button></div>}
                <p>Asigna una mesa de este cargo a un operador. Puedes seguir agregando candidatos, mesas y asignaciones mientras el cargo esté en borrador. Al iniciar el conteo se bloquea su configuración.</p><p>Un operador puede atender varias mesas y cargos: guarda cada asignación por separado.</p>
                <form
                  className="formulario-simple"
                  onSubmit={e => {
                    e.preventDefault();
                    guardar(async () => { await pedir(`/configuracion/mesas/${asignacion.idMesa}/asignar`, { metodo: 'POST', datos: { idUsuario: asignacion.idUsuario } }); setAsignacionesConfirmadas(n => n + 1); setAsignacion({ idMesa: '', idUsuario: '' }); if (e.nativeEvent.submitter?.value === 'continuar') setPestana('publicacion'); }, 'Asignación guardada. Puedes asignar otra mesa o revisar la publicación.');
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 15, color: 'var(--azul-oscuro)' }}>Asignar operador a mesa</h3>
                  <label>
                    Mesa
                    <select required value={asignacion.idMesa} onChange={e => setAsignacion({ ...asignacion, idMesa: e.target.value })}>
                      <option value="">Selecciona mesa</option>
                      {actual.mesas.map(m => (
                        <option value={m.id} key={m.id}>{m.codigo} · {m.unidad}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Cuenta de operador
                    <select required value={asignacion.idUsuario} onChange={e => setAsignacion({ ...asignacion, idUsuario: e.target.value })}>
                      <option value="">Selecciona cuenta</option>
                      {cuentas
                        .filter(c => c.activo && c.roles?.some(r => r.rol === 'OPERADOR' && r.idOrganizacion === org) && !c.roles.some(r => r.rol === 'ADMINISTRADOR' && (r.idOrganizacion === null || r.idOrganizacion === org)))
                        .map(c => (
                          <option key={c.idUsuario} value={c.idUsuario}>{c.usuario}</option>
                        ))}
                    </select>
                  </label>
                  <button className="boton primario" disabled={configuracionCerrada || bloqueado || !asignacion.idMesa || !asignacion.idUsuario} style={{ width: 'fit-content' }}>
                    Guardar asignación
                  </button>
                  <button className="boton secundario" name="accion" value="continuar" disabled={configuracionCerrada || bloqueado || !asignacion.idMesa || !asignacion.idUsuario}>Guardar asignación y continuar</button>
                </form>
                <ImportarExcel deshabilitado={configuracionCerrada} key={`asignaciones-${id}`} ruta={`/configuracion/procesos/${id}/importaciones/asignaciones`} organizacion={org} titulo="asignaciones" alImportar={()=>setVersion(v=>v+1)}/>
                <h3>Asignaciones guardadas</h3><ul>{asignacionesGuardadas.map(a=><li key={a.idMesa+'-'+a.idUsuario}>{a.codigo} · {a.sector} → {cuentas.find(c=>c.idUsuario===a.idUsuario)?.usuario??'Operador asignado'}</li>)}</ul>
                {asignacionesConfirmadas > 0 && <p role="status">{asignacionesConfirmadas} operaciones de asignación guardadas en esta sesión.</p>}
                <button type="button" className="boton secundario" disabled={bloqueado} onClick={() => setPestana('publicacion')}>Revisar publicación</button>
                </>}

              </div>
            </div>
          )}

          {(pestana==='publicacion'||(pestana==='configuracion'&&revisandoCargo&&actual?.estado!=='borrador')) && actual && !creandoProceso && !editandoProceso && <section className="panel-admin revision-publicacion">
            <h2>Estado y publicación del cargo</h2><p>Los cargos con el mismo nombre de evento y organización aparecen juntos en la portada, conservando sus propios resultados.</p>
            <p>Controla cuándo se reciben actas y cuándo se conservan solo para consulta.</p>
            <dl><dt>Organización</dt><dd>{organizaciones.find(o => o.idOrganizacion === org)?.nombre ?? 'Organización seleccionada'}</dd><dt>Elección</dt><dd>{actual.nombre}</dd><dt>Cargo</dt><dd>{actual.cargo}</dd><dt>Candidatos</dt><dd>{actual.candidatos.length}</dd><dt>Mesas esperadas</dt><dd>{actual.mesas.length}</dd><dt>Operadores disponibles</dt><dd>{preparacion.operadores.length}</dd></dl>
            <p>Comprueba que todas las mesas tengan un operador. La publicación no asigna responsables ni registra actas automáticamente.</p>
            <EstadoEleccion key={actual.id+'-'+actual.estado} proceso={actual} ocupado={bloqueado} puedeAbrir={preparacion.puedePublicar&&actual.mesas.every(m=>asignacionesGuardadas.some(a=>a.idMesa===m.id))} alCambiar={accion=>guardar(async()=>{
              if(accion==='reiniciar'){const nuevo=await pedir(`/configuracion/procesos/${id}/reiniciar`,{metodo:'POST',datos:{confirmar:true}});setId(nuevo.id);setRevisandoCargo(true);setPestana('configuracion');setMensaje('Nuevo borrador sin actas. Revisa la configuración y pulsa Iniciar conteo.');}
              else if(accion==='eliminar'){await pedir(`/configuracion/procesos/${id}`,{metodo:'DELETE'});setId('');setRevisandoCargo(false);}
              else if(accion==='abrir'||accion==='destacar')await pedir(`/configuracion/procesos/${id}/actual`,{metodo:'POST',datos:{confirmar:true}});
              else await pedir(`/configuracion/procesos/${id}/estado`,{metodo:'POST',datos:{estado:accion,confirmar:true}});
            },accion==='reiniciar'?'Nuevo borrador preparado sin actas. Revisa la configuración antes de iniciar.':'Estado actualizado correctamente.')}/>

          </section>}

          {pestana === 'asignaciones' && org && datosInstitucionListos && <AsignacionesOperadores key={org} organizacion={org} cuentas={cuentas} version={version} alCargo={valor=>{setId(valor);setRevisandoCargo(true);setCreandoProceso(false);setEditandoProceso(false);setPestana('configuracion');}}/>}
          {pestana === 'asignaciones' && org && datosInstitucionListos && (<>
            <ImportarExcel key={`operadores-${org}`} ruta="/importaciones/operadores" organizacion={org} titulo="operadores" operadores alImportar={()=>setVersion(v=>v+1)}/>
            <AdministrarCuentas
              key={`operador-form-${org}`}
              organizacionInicial={org}
              accionInicial="usuario"
              rolInicial="OPERADOR"
              rolesPermitidos={['OPERADOR']}
              titulo="Crear o asignar operador"
              descripcion="Crea cuentas de operadores para registrar actas en esta elección."
              esGlobal={false}
              organizaciones={organizaciones}
              cuentas={cuentas}
              idActual={sesion.idUsuario}
              alGuardar={() => setVersion(v => v + 1)}
            />
            <section className="panel-admin cuentas-preparacion">
              <h2>Operadores de esta institución</h2>
              <p>Operadores autorizados para registrar actas en esta elección.</p>
              <div className="tabla-preparacion-scroll"><table className="tabla-admin"><thead><tr><th>Usuario</th><th>Mesas asignadas</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
                {cuentas.filter(c => c.roles?.some(r => r.rol === 'OPERADOR' && r.idOrganizacion === org)).map(c => {
                  const mesasOp = asignacionesGuardadas.filter(a => a.idUsuario === c.idUsuario);
                  return <tr key={c.idUsuario}><td><strong>{c.usuario}</strong></td><td>{mesasOp.length} mesas asignadas</td><td><span className={`insignia-estado ${c.activo ? 'activo' : 'inactivo'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span></td><td><button type="button" className="boton secundario" disabled={bloqueado} onClick={() => guardar(() => pedir(`/usuarios/${encodeURIComponent(c.idUsuario)}/roles`, { metodo: 'POST', datos: { idOrganizacion: org, rol: 'OPERADOR', revocar: true } }), 'Rol de operador revocado.')}>Revocar operador</button></td></tr>;
                })}
              </tbody></table></div>
              {preparacion.operadores.length === 0 && <p>Todavía no hay cuentas de operador habilitadas para esta organización.</p>}
            </section>
          </>)}

          {pestana === 'usuarios' && (<>
            <section className="panel-admin cuentas-preparacion">
              <div className="cabecera-panel-admin" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0 }}>Administradores del sistema</h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--secundario)', fontSize: 13 }}>Usuarios con permisos de administración general en la plataforma.</p>
                </div>
              </div>
              <div className="tabla-preparacion-scroll"><table className="tabla-admin"><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
                {cuentas.filter(c => c.roles?.some(r => r.rol === 'ADMINISTRADOR')).map(c => <tr key={c.idUsuario}>
                  <td><strong>{c.usuario}</strong></td>
                  <td><span className="insignia-rol" style={{ padding: '3px 8px', borderRadius: 4, background: '#eef3f9', color: 'var(--azul-principal)', fontWeight: 600, fontSize: 12 }}>Administrador</span></td>
                  <td><span className={`insignia-estado ${c.activo ? 'activo' : 'inactivo'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td>{c.idUsuario !== sesion.idUsuario ? <button type="button" className="boton secundario" disabled={bloqueado} onClick={() => guardar(() => solicitarRest(`/usuarios/${encodeURIComponent(c.idUsuario)}/roles`, { metodo: 'POST', datos: { idOrganizacion: c.roles?.find(r => r.rol === 'ADMINISTRADOR')?.idOrganizacion ?? null, rol: 'ADMINISTRADOR', revocar: true } }), 'Rol de administrador revocado.')}>Revocar administrador</button> : <span style={{ color: 'var(--secundario)', fontSize: 12 }}>Cuenta actual</span>}</td>
                </tr>)}
              </tbody></table></div>
              {!mostrarCrearAdmin && (
                <div style={{ marginTop: 20 }}>
                  <button type="button" className="boton primario" onClick={() => setMostrarCrearAdmin(true)}>
                    + Crear nuevo usuario
                  </button>
                </div>
              )}
            </section>

            {mostrarCrearAdmin && (
              <div style={{ marginTop: 24 }}>
                <AdministrarCuentas
                  key={`admin-form-${org}-${modoCuenta}`}
                  organizacionInicial={org || organizaciones[0]?.idOrganizacion}
                  accionInicial="usuario"
                  rolInicial="ADMINISTRADOR"
                  rolesPermitidos={['ADMINISTRADOR']}
                  titulo="Crear nuevo usuario administrador"
                  descripcion="Crea una cuenta con permisos administrativos totales para gestionar el sistema."
                  esGlobal={false}
                  ocultarOrganizacion={true}
                  organizaciones={organizaciones}
                  cuentas={cuentas.filter(c => c.roles?.some(r => r.rol === 'ADMINISTRADOR'))}
                  idActual={sesion.idUsuario}
                  alGuardar={() => { setVersion(v => v + 1); setMostrarCrearAdmin(false); }}
                />
                <div style={{ marginTop: 12 }}>
                  <button type="button" className="boton secundario" onClick={() => setMostrarCrearAdmin(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
          )}
        </div>
      </main>
    </>
  );
}

/* =========================================================================
   3 · OPERADOR DE ACTAS (Registro con fotografía, verificación y validación)
   ========================================================================= */
function PanelOperador({ sesion, salir, seleccionar, ocupado: ocupadoSesion }) {
  const [mesas, setMesas] = useState([]);
  const [id, setId] = useState('');
  const [contexto, setContexto] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [foto, setFoto] = useState('');
  const [actaOrigen,setActaOrigen]=useState('');
  const [actasDisponibles,setActasDisponibles]=useState([]);
  const [votos, setVotos] = useState({});
  const [blancos, setBlancos] = useState(0);
  const [nulos, setNulos] = useState(0);
  const [total, setTotal] = useState(0);
  const [confirmado, setConfirmado] = useState(false);
  const [solicitud, setSolicitud] = useState(crearIdentificador);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(()=>{let v=true;solicitarRest('/actas?pagina=1&limite=100').then(r=>{if(v)setActasDisponibles(r.elementos);}).catch(e=>{if(v)setError(e.message);});return()=>{v=false};},[version]);

  useEffect(() => {
    solicitarRest('/mis-mesas')
      .then(d => {
        setMesas(d.elementos);
        if (d.elementos.length > 0 && !id) {
          setId(d.elementos[0].id);
        }
      })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    let v = true;
    setContexto(null);
    setHistorial(null);
    setFoto('');setActaOrigen('');
    setConfirmado(false);
    setError('');
    if (!id) return;
    Promise.all([solicitarRest(`/mesas/${id}/contexto`), solicitarRest(`/actas/mesa/${id}`)])
      .then(([c, h]) => {
        if (v) {
          setContexto(c);
          setHistorial(h);
          setVotos(Object.fromEntries(c.candidatos.map(cand => [cand.id, 0])));
          setBlancos(0);
          setNulos(0);
          setTotal(0);
          setSolicitud(crearIdentificador());
        }
      })
      .catch(e => { if (v) setError(e.message); });
    return () => { v = false; };
  }, [id, version]);

  const cambiar = (setter, valor) => {
    setter(valor);
    setConfirmado(false);
    setSolicitud(crearIdentificador());
  };

  const sumaCalculada = Object.values(votos).reduce((a, b) => a + b, 0) + blancos + nulos;
  const sumaCoincide = sumaCalculada === total;

  async function publicar(e) {
    e.preventDefault();
    if (ocupado || !historial) return;
    setOcupado(true);
    setError('');
    try {
      const datos = {
        idMesa: id,
        idSolicitud: solicitud,
        versionAnterior: historial.versionAnterior,
        ...(actaOrigen?{idActaOrigen:actaOrigen}:{foto}),
        votos: Object.entries(votos).map(([idCandidato, cantidad]) => ({ idCandidato, cantidad })),
        blancos,
        nulos,
        total,
        confirmado,
      };
      const r = historial.versionAnterior > 0
        ? await solicitarRest('/actas/mesas/' + id, { metodo: 'PUT', datos })
        : (await consultarGraphql('mutation Registrar($entrada:NuevaActa!){registrarActa(entrada:$entrada){id version estado}}', { entrada: datos })).datos.registrarActa;

      setMensaje(
        r.estado === 'publicada'
          ? 'Acta confirmada. La publicación de resultados se procesa en segundo plano.'
          : 'Acta observada: las sumas no coinciden. No se incorpora un aporte nuevo.'
      );
      setVersion(v => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      {/* Barra Lateral Operador */}
      <aside className="barra-lateral-privada">
        <div className="cabecera-lateral-marca">
          <IconoTuvoto tamano={28} />
          <span style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>TUVOTO</span>
        </div>

        <nav className="navegacion-lateral">
          <button className="item-menu-lateral activo">
            <IconoCamara tamano={18} />
            <span>Registro de actas</span>
          </button>
        </nav>

        <div className="pie-lateral-privado">
          <a href="#resultados" style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>← Ver resultados públicos</span>
          </a>
        </div>
      </aside>

      {/* Zona Principal Operador */}
      <main className="zona-principal-privada">
        {/* Cabecera Superior */}
        <header className="cabecera-superior-privada">
          <div className="titulo-seccion-privada">
            <h1>Registro de actas</h1>
            <div className="subtitulo-seccion-privada">
              {contexto ? `${contexto.cargo} · ${contexto.unidad}` : 'Selecciona una mesa asignada'}
            </div>
          </div>

          <div className="controles-cabecera-operador">
            {mesas.length > 0 && (
              <select
                aria-label="Mesa asignada"
                value={id}
                onChange={e => setId(e.target.value)}
                className="selector-mesa-topbar"
              >
                {agruparMesasFisicas(mesas).map(g=><optgroup key={g.id} label={`Mesa ${g.codigo} · ${g.unidad} · ${g.sector} · ${g.cargos.length} cargos`}>{g.cargos.map(m=><option key={m.id} value={m.id}>{m.cargo} · Mesa {m.codigo} · {m.unidad}</option>)}</optgroup>)}
              </select>
            )}

            <ControlesSesion
              sesion={sesion}
              ocupado={ocupado || ocupadoSesion}
              salir={salir}
              seleccionar={seleccionar}
              subtituloRol={`Operador · ${contexto?.unidad ?? 'Mesa'}`}
            />
          </div>
        </header>

        {/* Contenido Operador */}
        <div className="contenido-seccion-privada">
          <Aviso error={error} mensaje={mensaje} />

          {mesas.length === 0 ? (
            <div className="panel-admin" style={{ padding: 32, textAlign: 'center' }}>
              <p style={{ color: 'var(--secundario)' }}>No hay mesas asignadas para la elección actual. Solicita la asignación al administrador.</p>
            </div>
          ) : !contexto || !historial ? (
            <p style={{ color: 'var(--secundario)' }}>Cargando información de la mesa…</p>
          ) : (
            <>
              {contexto.estado!=='recepcion'&&<p className="aviso" role="status">La recepción está cerrada. Puedes consultar el historial, pero no registrar cambios.</p>}
              <form onSubmit={publicar}>
                <div className="grid-operador-registro">
                  {/* Columna Izquierda: Fotografía del acta */}
                  <section className="panel-foto-acta">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 style={{ margin: 0, fontSize: 16, color: 'var(--azul-oscuro)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconoFoto tamano={18} color="var(--azul-principal)" />
                        <span>Fotografía del acta</span>
                      </h3>
                      <span className="insignia-suave">Copia digital respaldada</span>
                    </div>

                    <p>Sector de la mesa: <strong>{contexto.sectorNombre??contexto.sector??'General'}</strong>. No se mezcla con otros sectores.</p>
                    <label>O reutilizar una foto ya registrada para otro cargo del mismo sector<select value={actaOrigen} disabled={ocupado} onChange={e=>{setFoto('');cambiar(setActaOrigen,e.target.value);}}><option value="">Usar una fotografía nueva</option>{actasDisponibles.filter(a=>a.idProceso!==contexto.idProceso&&a.estado!=='anulada'&&(a.sector??'general')===(contexto.sector??'general')&&mesas.some(m=>m.id===a.idMesa)).map(a=><option key={a.id} value={a.id}>{mesas.find(m=>m.id===a.idMesa)?.cargo} · {mesas.find(m=>m.id===a.idMesa)?.codigo} · versión {a.version}</option>)}</select></label>
                    <div className="visor-foto-acta">
                      {foto || actaOrigen ? (
                        <img src={actaOrigen?`/api/v1/actas/${actaOrigen}/foto`:foto} alt="Fotografía del acta a comparar con el conteo" className="imagen-acta-cargada" />
                      ) : (
                        <div className="visor-placeholder">
                          <IconoCamara tamano={48} color="#94A3B8" />
                          <p style={{ marginTop: 12, fontSize: 13 }}>Fotografía pendiente de capturar o subir</p>
                          <small style={{ color: '#94A3B8' }}>Formatos aceptados: JPEG o PNG (máximo 10 MB)</small>
                        </div>
                      )}
                    </div>

                    <div className="acciones-foto-acta">
                      <label className="boton-camara">
                        <IconoCamara tamano={16} />
                        <span>Tomar fotografía</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          capture="environment"
                          required={!foto&&!actaOrigen}
                          disabled={ocupado}
                          onChange={async e => {
                            try {
                              const f = e.target.files[0];
                              if (f) {
                                if (f.size > 10000000) throw Error('Máximo 10 MB');
                                setActaOrigen('');cambiar(setFoto, await archivoComoTexto(f));
                              }
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        />
                      </label>

                      <label className="boton-camara">
                        <IconoSubir tamano={16} />
                        <span>Subir imagen</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          disabled={ocupado}
                          onChange={async e => {
                            try {
                              const f = e.target.files[0];
                              if (f) {
                                if (f.size > 10000000) throw Error('Máximo 10 MB');
                                setActaOrigen('');cambiar(setFoto, await archivoComoTexto(f));
                              }
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        />
                      </label>

                      <span className="insignia-original-conservado">
                        <IconoCheck tamano={14} color="#059669" />
                        <span>El original se conserva al confirmar</span>
                      </span>
                    </div>
                  </section>

                  {/* Columna Derecha: Transcribe y verifica los datos */}
                  <section className="panel-verificacion-acta">
                    <h3 style={{ margin: 0, fontSize: 16, color: 'var(--azul-oscuro)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <IconoCheck tamano={18} color="var(--azul-principal)" />
                      <span>Transcribe y verifica los datos</span>
                    </h3>
                    <p style={{ margin: '4px 0 14px', fontSize: 12, color: 'var(--secundario)' }}>
                      Compara cada número con la fotografía.
                    </p>

                    <div className="aviso-ocr-humano">
                      <strong>Reconocimiento OCR: propuesta que requiere confirmación humana.</strong>
                      <div>Transcripción manual respaldada por fotografía; no se generan cifras automáticamente.</div>
                    </div>

                    <table className="tabla-conteo-acta">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', fontSize: 12, color: 'var(--secundario)', paddingBottom: 8 }}>Candidatura</th>
                          <th style={{ textAlign: 'right', fontSize: 12, color: 'var(--secundario)', paddingBottom: 8 }}>Votos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contexto.candidatos.map(c => (
                          <tr key={c.id}>
                            <td><strong>{c.nombre}</strong></td>
                            <td style={{ textAlign: 'right' }}>
                              <input
                                type="number"
                                min="0"
                                max="1000000"
                                step="1"
                                required
                                disabled={ocupado}
                                value={votos[c.id] ?? 0}
                                onChange={e => cambiar(setVotos, { ...votos, [c.id]: Number(e.target.value) })}
                              />
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td>Blancos</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              min="0"
                              max="1000000"
                              step="1"
                              required
                              disabled={ocupado}
                              value={blancos}
                              onChange={e => cambiar(setBlancos, Number(e.target.value))}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>Nulos</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              min="0"
                              max="1000000"
                              step="1"
                              required
                              disabled={ocupado}
                              value={nulos}
                              onChange={e => cambiar(setNulos, Number(e.target.value))}
                            />
                          </td>
                        </tr>
                        <tr style={{ background: '#F8FAFC' }}>
                          <td><strong>Total del acta</strong></td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              min="0"
                              max="1000000"
                              step="1"
                              required
                              disabled={ocupado}
                              value={total}
                              onChange={e => cambiar(setTotal, Number(e.target.value))}
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Validación de sumas */}
                    <div className={`tarjeta-validacion-sumas ${sumaCoincide ? 'correcta' : 'discrepancia'}`}>
                      {sumaCoincide ? (
                        <>
                          <IconoCheck tamano={18} color="#059669" />
                          <span>Suma correcta: {total}</span>
                        </>
                      ) : (
                        <>
                          <IconoAlerta tamano={18} color="#9F1239" />
                          <span>
                            {total === 0
                              ? `Suma actual: ${sumaCalculada}`
                              : `Suma calculada (${sumaCalculada}) ≠ Total declarado (${total})`}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="tarjeta-estado-confirmacion">
                      <IconoReloj tamano={16} />
                      <span>{confirmado ? 'Listo para publicar' : 'Pendiente de confirmación'}</span>
                    </div>

                    <label className="casilla-confirmacion-acta">
                      <input
                        type="checkbox"
                        required
                        checked={confirmado}
                        disabled={ocupado}
                        onChange={e => setConfirmado(e.target.checked)}
                      />
                      <span>He comparado los datos con el acta.</span>
                    </label>

                    <button
                      type="submit"
                      className="boton-publicar-acta"
                      disabled={contexto.estado!=='recepcion' || ocupado || (!foto&&!actaOrigen) || !confirmado || contexto.candidatos.length === 0}
                    >
                      <IconoCheck tamano={18} />
                      <span>{ocupado ? 'Confirmando…' : 'Confirmar y publicar'}</span>
                    </button>

                    <p style={{ fontSize: 11, color: 'var(--secundario)', margin: '14px 0 0', textAlign: 'center' }}>
                      Si hay inconsistencias, el acta queda observada y no suma.
                    </p>
                  </section>
                </div>
              </form>

              {/* Historial inmutable de la mesa */}
              <section className="panel-admin" style={{ padding: 20 }}>
                <div className="cabecera-panel-admin" style={{ background: 'none', padding: 0, marginBottom: 14 }}>
                  <h3>
                    <IconoHistorial tamano={18} color="var(--azul-principal)" />
                    <span>Historial inmutable de la mesa</span>
                  </h3>
                </div>

                <ul className="lista-historial-actas">
                  {historial.elementos.length === 0 ? (
                    <li style={{ color: 'var(--secundario)', fontSize: 13 }}>No hay versiones previas para esta mesa.</li>
                  ) : (
                    historial.elementos.map(a => (
                      <li key={a.id} className="item-historial-acta">
                        <div>
                          <strong>Versión {a.version}</strong> ·{' '}
                          <span className="estado-activo-pill" style={{ background: a.estado === 'publicada' ? '#DCFCE7' : '#FEE2E2', color: a.estado === 'publicada' ? '#166534' : '#9F1239' }}>
                            {a.estado}
                          </span>{' '}
                          · <small style={{ color: 'var(--secundario)' }}>{new Date(a.creado_en).toLocaleString('es-BO')}</small>
                        </div>
                        <a href={`/api/v1/actas/${a.id}/foto`} target="_blank" rel="noreferrer" className="enlace-ver-original">
                          Ver original ↗
                        </a>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}

/* =========================================================================
   4 · AUDITOR (Panel de solo lectura)
   ========================================================================= */
function PanelAuditor({ sesion, salir, seleccionar, ocupado: ocupadoSesion }) {
  const [mesas, setMesas] = useState([]);
  const [id, setId] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    solicitarRest('/mis-mesas')
      .then(d => {
        setMesas(d.elementos);
        if (d.elementos.length > 0 && !id) setId(d.elementos[0].id);
      })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    let vigente = true;
    setDatos(null);
    setError('');
    if (id) {
      solicitarRest(`/actas/mesa/${id}`)
        .then(d => { if (vigente) setDatos(d); })
        .catch(e => { if (vigente) setError(e.message); });
    }
    return () => { vigente = false; };
  }, [id]);

  return (
    <>
      <aside className="barra-lateral-privada">
        <div className="cabecera-lateral-marca">
          <IconoTuvoto tamano={28} />
          <span style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>TUVOTO</span>
        </div>
        <nav className="navegacion-lateral">
          <button className="item-menu-lateral activo">
            <IconoHistorial tamano={18} />
            <span>Consulta de auditoría</span>
          </button>
        </nav>
        <div className="pie-lateral-privado">
          <a href="#resultados" style={{ color: '#94A3B8' }}>← Ver resultados públicos</a>
        </div>
      </aside>

      <main className="zona-principal-privada">
        <header className="cabecera-superior-privada">
          <div className="titulo-seccion-privada">
            <h1>Consulta de auditoría</h1>
            <div className="subtitulo-seccion-privada">
              Acceso de solo lectura · Integridad de actas y versiones
            </div>
          </div>
          <ControlesSesion
            sesion={sesion}
            ocupado={ocupadoSesion}
            salir={salir}
            seleccionar={seleccionar}
            subtituloRol="Auditor"
          />
        </header>

        <div className="contenido-seccion-privada">
          <Aviso error={error} />
          <div className="panel-admin" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 16, color: 'var(--azul-oscuro)', marginBottom: 8 }}>
              Actas de la organización · Solo lectura
            </h2>
            <p style={{ color: 'var(--secundario)', fontSize: 13, marginBottom: 18 }}>
              El auditor puede consultar originales y versiones; no registra ni corrige cifras.
            </p>

            <label style={{ display: 'block', marginBottom: 20, fontWeight: 600, fontSize: 13, color: 'var(--azul-oscuro)' }}>
              Mesa asignada a la organización:
              <select
                value={id}
                onChange={e => setId(e.target.value)}
                className="selector-unidades-publico"
                style={{ display: 'block', marginTop: 6, minWidth: 260 }}
              >
                <option value="">Selecciona mesa</option>
                {mesas.map(m => (
                  <option key={m.id} value={m.id}>Mesa {m.codigo} · {m.unidad}</option>
                ))}
              </select>
            </label>

            {datos && (
              <ul className="lista-historial-actas">
                {datos.elementos.length === 0 ? (
                  <li style={{ color: 'var(--secundario)' }}>No hay actas registradas para esta mesa.</li>
                ) : (
                  datos.elementos.map(a => (
                    <li key={a.id} className="item-historial-acta">
                      <div>
                        <strong>Versión {a.version}</strong> · {a.estado} · {new Date(a.creado_en).toLocaleString('es-BO')}
                      </div>
                      <a href={`/api/v1/actas/${a.id}/foto`} target="_blank" rel="noreferrer" className="enlace-ver-original">
                        Ver original ↗
                      </a>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
