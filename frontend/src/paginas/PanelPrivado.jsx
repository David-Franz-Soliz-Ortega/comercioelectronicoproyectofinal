import ConteoInstitucion from '../componentes/ConteoInstitucion.jsx';
import { notificarExito } from '../api/confirmaciones.js';
import ConfirmarEliminacion from '../componentes/ConfirmarEliminacion.jsx';
import MesasCompartidas from '../componentes/MesasCompartidas.jsx';
import { agruparMesasFisicas } from '../api/mesasCompartidas.js';
import AsignacionesOperadores from '../componentes/AsignacionesOperadores.jsx';
import '../privado.css';
import '../administracion.css';
import '../tema-claro.css';
import SeleccionAdministracion from '../componentes/SeleccionAdministracion.jsx';
import CamposCargo from '../componentes/CamposCargo.jsx';
import ModalFormulario from '../componentes/ModalFormulario.jsx';
import CandidatosAdministracion from '../componentes/CandidatosAdministracion.jsx';
import FotoCandidatoAdministracion from '../componentes/FotoCandidatoAdministracion.jsx';
import { completarNombreEleccion, datosEleccionVacia, datosDeProceso } from '../api/seleccionAdministracion.js';
import InstitucionesAdministracion from '../componentes/InstitucionesAdministracion.jsx';
import React, { useEffect, useState } from 'react';
import Sesion, { ControlesSesion } from '../componentes/Sesion.jsx';
import AdministrarCuentas from '../componentes/AdministrarCuentas.jsx';
import ListadoCuentas from '../componentes/ListadoCuentas.jsx';
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

import EstadoEleccion from '../componentes/EstadoEleccion.jsx';
import {nombresEstado} from '../api/catalogos.js';
import ImportarExcel from '../componentes/ImportarExcel.jsx';

const archivoComoTexto = archivo => new Promise((aceptar, rechazar) => {
  const lector = new FileReader();
  lector.onload = () => aceptar(lector.result);
  lector.onerror = () => rechazar(new Error('No se pudo leer la imagen'));
  lector.readAsDataURL(archivo);
});
const datosDeEvento=base=>({...datosEleccionVacia(),...(base?{nombre:base.nombre,tipo:base.tipo,unidad:base.unidad,ambito:base.ambito??'',facultad:base.facultad??'',grupoCarreras:base.grupoCarreras??'',carreras:base.carreras??[],sectores:base.sectores??[],ponderacion:base.ponderacion??false,reglaSegundaVuelta:base.reglaSegundaVuelta??null}:{})});

function Aviso({ error }) {
  return (
    <>
      {error && <div className="aviso" role="alert">{error}</div>}

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
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [datosInstitucionListos,setDatosInstitucionListos]=useState(false);
  const [creandoProceso, setCreandoProceso] = useState(false);
  const [revisandoCargo, setRevisandoCargo] = useState(false);
  const [editandoProceso,setEditandoProceso]=useState(false);
  const [asignacionesGuardadas,setAsignacionesGuardadas]=useState([]);
  const [modoCuenta, setModoCuenta] = useState('usuario');
  const [mostrarCrearAdmin, setMostrarCrearAdmin] = useState(false);
  const [organizaciones, setOrganizaciones] = useState([]);
  const [consultandoInstituciones,setConsultandoInstituciones]=useState(true);
  const [cuentas, setCuentas] = useState([]);
  const [cargandoCuentas, setCargandoCuentas] = useState(true);
  const [errorCuentas, setErrorCuentas] = useState('');
  const [org, setOrg] = useState(sesion.idOrganizacion ?? '');
  const [procesos, setProcesos] = useState([]);
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [version, setVersion] = useState(0);
  const [creandoInstitucionModal, setCreandoInstitucionModal] = useState(false);
  const [nombreNuevaInstitucion, setNombreNuevaInstitucion] = useState('');

  const [datos, setDatos] = useState(datosEleccionVacia);
  const [eventoBase, setEventoBase] = useState('');
  const [candidato, setCandidato] = useState({ nombre: '', foto: '' });

  const institucionSeleccionada=organizaciones.find(o=>o.idOrganizacion===org&&o.activa);
  const actual = procesos.find(p => p.id === id);
  const configuracionCerrada = actual?.estado !== 'borrador';
  const bloqueado = ocupado || ocupadoSesion || cargandoDatos || cargandoCuentas;
  const catalogoEleccion=pestana==='configuracion'&&(creandoProceso||editandoProceso||!revisandoCargo);
  const administradorGlobal = sesion.roles.some(r => r.rol === 'ADMINISTRADOR');
  const puedeCrearInstitucion = sesion.roles.some(r => r.rol === 'ADMINISTRADOR');
  const preparacion = prepararEleccion({ organizacion: org, proceso: actual, cuentas });
  function mostrarCargos() {
    setCreandoProceso(false);setEditandoProceso(false);setRevisandoCargo(false);setPestana('configuracion');setError('');
  }
  function cambiarInstitucion(valor){
    setPestana('resumen');setError('');
    setRevisandoCargo(false);
    if(valor===org)return;
    setDatosInstitucionListos(false);setCargandoDatos(Boolean(valor));setOrg(valor);setProcesos([]);setCuentas([]);setId('');setCreandoProceso(false);setEditandoProceso(false);
  }
  function prepararNuevoCargo(base) {
    setRevisandoCargo(true);
    setEventoBase(base?.nombre ?? '');
    setDatos(datosDeEvento(base));
    setEditandoProceso(false);setCreandoProceso(true); setPestana('configuracion'); setError('');
  }
  function abrirApartado(paso) {
    if (paso.id === 'organizacion') { setPestana('resumen');setError('');return; }
    if (!org) { setError('Selecciona una institución en Resumen para continuar.');setPestana('resumen');return; }
    if (!actual && !['eleccion', 'operadores', 'asignaciones', 'publicacion'].includes(paso.id)) { mostrarCargos();setError('Agrega un cargo para continuar su preparación.');return; }
    if (paso.id === 'operadores') setModoCuenta('usuario');
    if (paso.id === 'eleccion') { mostrarCargos();return; }
    setError(''); setPestana(paso.destino);
  }
  useEffect(() => {
    setEditandoProceso(false);
    setCandidato({ nombre: '', foto: '' });
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
    (org ? pedir('/configuracion/procesos') : Promise.resolve({ elementos: [] }))
      .then(p => {
        if (v) {
          setProcesos(p.elementos);
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

  useEffect(() => {
    let vigente = true;
    setCargandoCuentas(true);
    setErrorCuentas('');
    setCuentas([]);
    cargarCuentas().then(r => { if (vigente) setCuentas(r.elementos); })
      .catch(e => { if (vigente) setErrorCuentas(e.message); })
      .finally(() => { if (vigente) setCargandoCuentas(false); });
    return () => { vigente = false; };
  }, [org, version]);

  async function guardar(operacion, confirmacion = 'Cambios guardados correctamente.') {
    if (bloqueado) return;
    setOcupado(true);
    setError('');

    try {
      await operacion();
      notificarExito(confirmacion);
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
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--texto)', letterSpacing: 0.5 }}>TUVOTO</span>
        </div>

        <p className="rotulo-navegacion">Gestión electoral</p>
        <nav className="navegacion-lateral">
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
            onClick={() => abrirApartado({ id: 'eleccion', destino: 'configuracion' })}
          >
            <IconoEngranaje tamano={18} />
            <span>Elección</span>
          </button>
          <button
            disabled={bloqueado}
            className={`item-menu-lateral ${pestana === 'candidatos' ? 'activo' : ''}`}
            onClick={() => abrirApartado({ id: 'candidatos', destino: 'candidatos' })}
          >
            <IconoUsuarios tamano={18} />
            <span>Candidatos</span>
          </button>
          <button
            disabled={bloqueado}
            className={`item-menu-lateral ${pestana === 'mesas' ? 'activo' : ''}`}
            onClick={() => abrirApartado({ id: 'mesas', destino: 'mesas' })}
          >
            <IconoUrna tamano={18} />
            <span>Mesas</span>
          </button>
          <button disabled={bloqueado} className={`item-menu-lateral ${pestana === 'asignaciones' ? 'activo' : ''}`} onClick={() => abrirApartado({ id: 'asignaciones', destino: 'asignaciones' })}><IconoUsuario tamano={18}/><span>Asignar operadores</span></button>
          <button disabled={bloqueado} className={`item-menu-lateral ${pestana === 'publicacion' ? 'activo' : ''}`} onClick={() => abrirApartado({ id: 'publicacion', destino: 'publicacion' })}><IconoCheck tamano={18}/><span>Estado y publicación</span></button>
          <button
            disabled={bloqueado}
            className={`item-menu-lateral ${pestana === 'usuarios' ? 'activo' : ''}`}
            onClick={() => { setModoCuenta('usuario'); setPestana('usuarios'); }}
          >
            <IconoUsuario tamano={18} />
            <span>Usuarios</span>
          </button>
        </nav>

        <div className="pie-lateral-privado pie-administrador-claro">
          <button type="button" className="institucion-lateral-clara" data-contexto-institucion={org} data-contexto-proceso={id} aria-label="Cambiar institución" disabled={bloqueado} onClick={()=>setPestana('resumen')}><IconoEdificio tamano={22}/><span><strong>{institucionSeleccionada?.nombre||'Seleccionar organización'}</strong><small>Administración</small></span></button>
          <ControlesSesion lateral sesion={sesion} ocupado={ocupado||ocupadoSesion} salir={salir} seleccionar={seleccionar} subtituloRol="Administrador"/>
          <a href="#resultados" className="volver-publico-lateral">Ver resultados públicos →</a>
        </div>
      </aside>

      {/* Zona Principal Administrador */}
      <main className="zona-principal-privada">
        {/* Barra Superior */}
        <header className="cabecera-superior-privada">
          <div className="titulo-seccion-privada">
            <p className="miga-administracion">
              <IconoCasa tamano={16} />
              <span>Administración</span>
              <span aria-hidden="true" style={{ color: '#94A3B8' }}>/</span>
              <strong style={{ color: '#0F172A' }}>
                {{ resumen: 'Resumen', configuracion: 'Elección', candidatos: 'Candidatos', mesas: 'Mesas', usuarios: 'Usuarios', asignaciones: 'Asignar operadores', publicacion: 'Estado y publicación' }[pestana] ?? 'Administración'}
              </strong>
            </p>
          </div>

          <div className="controles-superiores-derecha">
            {organizaciones.length > 0 && (
              <div className="selector-institucion-cabecera-caja">
                <select
                  className="selector-institucion-cabecera"
                  value={org}
                  aria-label="Seleccionar institución"
                  disabled={bloqueado}
                  onChange={e => cambiarInstitucion(e.target.value)}
                >
                  <option value="" disabled>Selecciona una institución</option>
                  {organizaciones.filter(o => o.activa).map(o => (
                    <option key={o.idOrganizacion} value={o.idOrganizacion} data-institucion={o.idOrganizacion}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {puedeCrearInstitucion && (
              <button
                type="button"
                className="boton-nueva-institucion-cabecera"
                disabled={ocupado}
                onClick={() => {
                  setNombreNuevaInstitucion('');
                  setCreandoInstitucionModal(true);
                }}
              >
                + Nueva institución
              </button>
            )}
          </div>
        </header>

        {/* Contenido según pestaña */}
        <div className="contenido-seccion-privada">
          <Aviso error={error} />

          {cargandoDatos && <p role="status">Cargando la configuración de tu organización…</p>}

          {creandoInstitucionModal && (
            <ModalFormulario
              abierto={creandoInstitucionModal}
              titulo="Crear nueva institución"
              ocupado={ocupado}
              alCerrar={() => {
                setCreandoInstitucionModal(false);
                setNombreNuevaInstitucion('');
              }}
            >
              <form
                className="formulario-simple"
                onSubmit={async e => {
                  e.preventDefault();
                  const valor = nombreNuevaInstitucion.trim();
                  if (!valor) return;
                  setOcupado(true);
                  try {
                    const creada = await solicitarRest('/organizaciones', {
                      metodo: 'POST',
                      datos: { nombre: valor }
                    });
                    setDatosInstitucionListos(false);
                    setCargandoDatos(true);
                    setOrganizaciones(prev => [...prev, { ...creada, activa: true }]);
                    setOrg(creada.idOrganizacion);
                    setProcesos([]);
                    setCuentas([]);
                    setId('');
                    setCreandoProceso(false);
                    setEditandoProceso(false);
                    setCreandoInstitucionModal(false);
                    setNombreNuevaInstitucion('');
                    setPestana('resumen');
                    notificarExito('Institución creada. Ya puedes preparar su primera elección.');
                  } catch (err) {
                    setError(err.message);
                  } finally {
                    setOcupado(false);
                  }
                }}
              >
                <p style={{ margin: 0, fontSize: 13, color: 'var(--secundario)' }}>
                  Escribe el nombre de la institución para crear su catálogo electoral, cargos y operadores.
                </p>
                <label htmlFor="nombre-inst-modal">
                  Nombre de la institución
                  <input
                    id="nombre-inst-modal"
                    required
                    maxLength={120}
                    autoComplete="off"
                    value={nombreNuevaInstitucion}
                    disabled={ocupado}
                    onChange={e => setNombreNuevaInstitucion(e.target.value)}
                    placeholder="Ej.: Universidad San Francisco Xavier"
                    autoFocus
                  />
                </label>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button
                    type="submit"
                    className="boton primario"
                    disabled={ocupado || !nombreNuevaInstitucion.trim()}
                  >
                    {ocupado ? 'Creando…' : 'Crear institución'}
                  </button>
                  <button
                    type="button"
                    className="boton secundario"
                    disabled={ocupado}
                    onClick={() => {
                      setCreandoInstitucionModal(false);
                      setNombreNuevaInstitucion('');
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </ModalFormulario>
          )}

          {pestana === 'resumen' && (
            !org ? (
              <InstitucionesAdministracion
                organizaciones={organizaciones}
                organizacion={org}
                ocupado={bloqueado}
                cargando={consultandoInstituciones}
                puedeCrear={administradorGlobal}
                alSeleccionar={cambiarInstitucion}
                alCreada={creada => {
                  setDatosInstitucionListos(false);
                  setCargandoDatos(true);
                  setOrganizaciones(prev => [...prev, creada]);
                  setOrg(creada.idOrganizacion);
                  setProcesos([]);
                  setCuentas([]);
                  setId('');
                  setCreandoProceso(false);
                  setEditandoProceso(false);
                  setPestana('resumen');
                  notificarExito('Institución creada. Ya puedes preparar su primera elección.');
                }}
              />
            ) : (
              institucionSeleccionada && (
                <ResumenAdministracion
                  institucion={institucionSeleccionada}
                  procesos={procesos}
                  cuentas={cuentas}
                  alGuardarPortada={() => setVersion(v => v + 1)}
                  alCargo={(id, destino) => {
                    setId(id);
                    setPestana(destino);
                  }}
                  cargando={cargandoDatos}
                  disponible={datosInstitucionListos}
                  ocupado={bloqueado}
                  alReintentar={() => setVersion(v => v + 1)}
                  alIr={destino => {
                    if (destino === 'configuracion') {
                      mostrarCargos();
                    } else if (destino === 'usuarios') {
                      setModoCuenta('usuario');
                      setPestana('usuarios');
                    } else abrirApartado({ id: destino, destino });
                  }}
                />
              )
            )
          )}
          {!['resumen', 'usuarios', 'candidatos', 'mesas', 'asignaciones'].includes(pestana) && !catalogoEleccion && <div className="contexto-modulo-admin" data-contexto-institucion={org} data-contexto-proceso={id}>
            <div>{institucionSeleccionada?<><strong>{institucionSeleccionada.nombre}</strong>{pestana==='publicacion'?<span>Toda la organización</span>:creandoProceso?<span>Nuevo cargo</span>:actual&&<span>Cargo seleccionado: {actual.cargo}{actual.ambito?' · '+actual.ambito:''}</span>}</>:<span>Selecciona una institución en Resumen para continuar.</span>}</div>

          </div>}
          {pestana==='configuracion' && institucionSeleccionada && (creandoProceso||editandoProceso||!revisandoCargo) && <SeleccionAdministracion nombreInstitucion={institucionSeleccionada.nombre} acciones={datosInstitucionListos?<ImportarExcel key={'cargos-'+org} ruta="/configuracion/importaciones/cargos" organizacion={org} titulo="cargos" textoBoton="Importar Excel" gestionarExistentes datosAdicionales={{nombre:institucionSeleccionada.nombre.slice(0,120)}} alImportar={()=>{notificarExito('Archivo de cargos procesado. Revisa el resumen de creados, actualizados y mantenidos.');setVersion(v=>v+1);}}/>:null} organizacion={org} procesos={procesos} idProceso={id} ocupado={bloqueado} cargando={cargandoDatos} disponible={datosInstitucionListos}
            alProceso={valor=>{setId(valor);setRevisandoCargo(true);setError('');}}
            alEliminar={p=>guardar(async()=>{await pedir(`/configuracion/procesos/${p.id}`,{metodo:'DELETE',mostrarDetalleValidacion:true});if(id===p.id)setId('');setRevisandoCargo(false);},'Cargo retirado del catálogo.')}
            alGuardarEdicion={async (idCargo, datosCargo) => {
              const actualizado = await pedir(`/configuracion/procesos/${idCargo}`, {
                metodo: 'PUT',
                datos: completarNombreEleccion(datosCargo, institucionSeleccionada),
                mostrarDetalleValidacion: true
              });
              setVersion(v => v + 1);
              notificarExito('Cargo actualizado correctamente.');
              return actualizado;
            }}
            alAgregar={()=>prepararNuevoCargo()} alReintentar={()=>setVersion(v=>v+1)}/>}

          {pestana === 'configuracion' && org && (!creandoProceso && !editandoProceso && revisandoCargo && actual) && (
            <div className="panel-admin" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 18, color: 'var(--azul-oscuro)', marginBottom: 16 }}>{editandoProceso?'Editar opciones del cargo':creandoProceso ? 'Crear nuevo cargo' : 'Configuración del cargo'}</h2>
              {actual&&!creandoProceso&&!editandoProceso&&<div className="detalle-configuracion-eleccion"><h3>{actual.cargo}</h3><dl><dt>Elección</dt><dd>{actual.nombre}</dd><dt>Facultad</dt><dd>{actual.facultad||'Toda la institución'}</dd><dt>Carreras</dt><dd>{actual.carreras?.join(', ')||'Sin lista de carreras configurada'}</dd><dt>Ámbito</dt><dd>{actual.ambito||'Sin ámbito adicional'}</dd><dt>Vuelta</dt><dd>{actual.vuelta===2?'Segunda vuelta':'Primera vuelta'}</dd><dt>Conteo</dt><dd>{actual.ponderacion?'Ponderación por sectores activada':actual.sectores?.length?'Sectores separados; todos los votos valen igual':'Normal: todos los votos valen igual'}</dd></dl>{actual.sectores?.length>0&&<ul>{actual.sectores.map(s=><li key={s.codigo}>{s.nombre}{actual.ponderacion?` · ${s.pesoBps/100} %`:''}</li>)}</ul>}<p>{configuracionCerrada?'La configuración está bloqueada porque este cargo ya salió de borrador.':'Puedes editar las opciones mientras el cargo esté en borrador.'}</p><button type="button" className="boton secundario" disabled={bloqueado} onClick={()=>setPestana('publicacion')}>Ver estado y publicación</button></div>}
              {!creandoProceso && !editandoProceso && <button type="button" className="boton secundario volver-cargos" disabled={bloqueado} onClick={mostrarCargos}>← Volver a cargos</button>}

              {actual&&!creandoProceso&&!editandoProceso&&<button type="button" className="boton secundario" disabled={bloqueado||configuracionCerrada} onClick={()=>{const d=datosDeProceso(actual);setEventoBase('');setDatos(d);setEditandoProceso(true);}}>Editar elección en borrador</button>}


            </div>
          )}

          {pestana==='configuracion'&&org&&<ModalFormulario abierto={creandoProceso||editandoProceso} titulo={editandoProceso?'Editar cargo':'Crear nuevo cargo'} ocupado={bloqueado} alCerrar={mostrarCargos}>
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
                <Aviso error={error}/><p>{creandoProceso?'Crearás un cargo nuevo; el cargo que tenías seleccionado se conserva.':'Edita únicamente las opciones de este cargo.'} Después podrás registrar sus candidatos, mesas y operadores.</p>
                {creandoProceso&&<button type="button" className="boton secundario elegir-existente-desde-formulario" disabled={bloqueado} onClick={mostrarCargos}>Cancelar y elegir un cargo existente</button>}
                <CamposCargo datos={datos} cambiar={setDatos} procesos={procesos} bloqueado={bloqueado} identidadFija={editandoProceso} tipoBloqueado={!!eventoBase}/>

                <button className="boton primario" disabled={bloqueado||(editandoProceso&&configuracionCerrada)||(datos.ponderacion&&datos.sectores.reduce((a,s)=>a+s.pesoBps,0)!==10000)} style={{ width: 'fit-content', marginTop: 10 }}>
                  {ocupado ? 'Guardando…' : editandoProceso?'Guardar cambios':'Guardar cargo y continuar'}
                </button>
                <button type="button" className="boton secundario cancelar-cargo" disabled={bloqueado} onClick={mostrarCargos}>Cancelar y volver a cargos</button>
              </form>
          </ModalFormulario>}

          {pestana==='mesas'&&institucionSeleccionada&&datosInstitucionListos&&<MesasCompartidas key={org} nombreInstitucion={institucionSeleccionada.nombre} organizacion={org} procesos={procesos} cuentas={cuentas} idProceso={id} version={version} ocupado={bloqueado} guardar={guardar} alCargo={valor=>{setId(valor);setRevisandoCargo(true);setPestana('configuracion');}} alImportar={()=>{notificarExito('Mesas físicas y cargos importados correctamente.');setVersion(v=>v+1);}}/>}


          {pestana === 'candidatos' && institucionSeleccionada && <>
          <CandidatosAdministracion nombreInstitucion={institucionSeleccionada.nombre} acciones={datosInstitucionListos?<ImportarExcel key={'general-candidatos-'+org} general cargos={procesos} ruta="/configuracion/importaciones-generales/candidatos" organizacion={org} titulo="candidatos" textoBoton="Importar Excel" alImportar={()=>{setError('');notificarExito('Archivo completo importado. Cada candidato quedó en su cargo de destino.');setVersion(v=>v+1);}}/>:null} key={org} organizacion={org} procesos={procesos} idProceso={id} ocupado={bloqueado} cargando={cargandoDatos} disponible={datosInstitucionListos} revision={version} alActualizar={()=>setVersion(v=>v+1)}
            alEliminar={c=>guardar(()=>pedir(`/configuracion/candidatos/${c.id}`,{metodo:'DELETE',datos:{confirmar:true},mostrarDetalleValidacion:true}),'Candidato retirado del catálogo.')} alProceso={valor=>{setId(valor);setError('');}} alAgregarCargo={()=>prepararNuevoCargo()} alReintentar={()=>setVersion(v=>v+1)}>
            {actual && <div className="editor-candidatos" data-editor-candidatos={id}>
              <Aviso error={error}/><h3>Candidatos de {actual.cargo} · {actual.ambito || actual.facultad || 'Toda la institución'}</h3>
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


            </div>}
          </CandidatosAdministracion>
          </>}

          {pestana==='publicacion'&&org&&datosInstitucionListos&&<ConteoInstitucion key={org} organizacion={org} nombre={institucionSeleccionada?.nombre} procesos={procesos} revision={version} ocupado={bloqueado} alOcupado={setOcupado} alGuardar={()=>setVersion(v=>v+1)} alIr={destino=>setPestana(destino)}/>}
          {(pestana==='configuracion'&&revisandoCargo&&actual?.estado!=='borrador') && actual && !creandoProceso && !editandoProceso && (() => {
            const mesasConOperador = actual.mesas.filter(m => asignacionesGuardadas.some(a => a.idMesa === m.id));
            const mesasSinOperador = actual.mesas.filter(m => !asignacionesGuardadas.some(a => a.idMesa === m.id));
            const coberturaOperadores = actual.mesas.length > 0 && mesasConOperador.length === actual.mesas.length;
            const puedeIniciarConteo = preparacion.puedePublicar && coberturaOperadores;
            const nombreOrg = organizaciones.find(o => o.idOrganizacion === org)?.nombre ?? 'Organización seleccionada';

            return (
              <section className="panel-admin revision-publicacion-grid">
                <div className="cabecera-revision-publicacion">
                  <h2>Estado y publicación · {actual.cargo}</h2>
                  <p>{actual.nombre} — {nombreOrg}</p>
                </div>

                <div className="contenedor-columnas-publicacion">
                  {/* COLUMNA 1: Datos configurados del cargo */}
                  <div className="columna-datos-cargo">
                    <div className="tarjeta-resumen-seccion">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 className="titulo-seccion-resumen" style={{ margin: 0 }}>Detalles del cargo</h3>
                        {actual.estado === 'borrador' && (
                          <button type="button" className="boton-enlace" onClick={() => { setEditandoProceso(true); setPestana('configuracion'); }}>
                            Editar cargo →
                          </button>
                        )}
                      </div>
                      <dl className="grid-datos-clave">
                        <div><dt>Institución</dt><dd>{nombreOrg}</dd></div>
                        <div><dt>Elección</dt><dd>{actual.nombre}</dd></div>
                        <div><dt>Cargo</dt><dd><strong>{actual.cargo}</strong></dd></div>
                        <div><dt>Ámbito / Facultad</dt><dd>{actual.facultad || actual.ambito || 'Toda la institución'}</dd></div>
                        {actual.carreras?.length > 0 && (
                          <div style={{ gridColumn: 'span 2' }}>
                            <dt>Carreras incluidas</dt>
                            <dd>{actual.carreras.join('; ')}</dd>
                          </div>
                        )}
                        <div><dt>Vuelta</dt><dd>{actual.vuelta === 2 ? 'Segunda vuelta' : 'Primera vuelta'}</dd></div>
                        <div><dt>Conteo</dt><dd>{actual.ponderacion ? 'Ponderación activada' : actual.sectores?.length ? 'Sectores separados' : 'Voto directo'}</dd></div>
                      </dl>
                    </div>

                    <div className="tarjeta-resumen-seccion">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 className="titulo-seccion-resumen" style={{ margin: 0 }}>Candidatos registrados ({actual.candidatos.length})</h3>
                        {actual.estado === 'borrador' && (
                          <button type="button" className="boton-enlace" onClick={() => setPestana('candidatos')}>
                            Modificar candidatos →
                          </button>
                        )}
                      </div>
                      {actual.candidatos.length === 0 ? (
                        <p style={{ margin: 0, fontSize: 13, color: '#ef4444' }}>Aún no has registrado candidatos para este cargo.</p>
                      ) : (
                        <ul className="lista-candidatos-resumen">
                          {actual.candidatos.map(c => (
                            <li key={c.id}>
                              {c.foto ? (
                                <img src={c.foto} alt="" className="mini-foto-candidato" />
                              ) : (
                                <div className="avatar-placeholder">{c.nombre?.slice(0, 2).toUpperCase()}</div>
                              )}
                              <span><strong>{c.nombre}</strong></span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="tarjeta-resumen-seccion">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 className="titulo-seccion-resumen" style={{ margin: 0 }}>Mesas y operadores ({actual.mesas.length} mesas)</h3>
                        {actual.estado === 'borrador' && (
                          <button type="button" className="boton-enlace" onClick={() => setPestana('asignaciones')}>
                            Asignar operadores →
                          </button>
                        )}
                      </div>
                      <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--secundario)' }}>
                        <strong>{mesasConOperador.length} de {actual.mesas.length}</strong> mesas cuentan con operador asignado ({actual.mesas.length ? Math.round((mesasConOperador.length / actual.mesas.length) * 100) : 0}% de cobertura).
                      </p>
                      <div className="barrita-progreso-cobertura">
                        <div
                          className="progreso-relleno"
                          style={{
                            width: `${actual.mesas.length ? (mesasConOperador.length / actual.mesas.length) * 100 : 0}%`,
                            background: coberturaOperadores ? '#10b981' : '#f59e0b',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* COLUMNA 2: Verificación de requisitos, Control de inicio y Cambios */}
                  <div className="columna-control-publicacion">
                    <div className="tarjeta-checklist-requisitos">
                      <h3 className="titulo-seccion-resumen">Verificación de requisitos para iniciar</h3>
                      <ul className="lista-checklist-requisitos">
                        <li className={actual.candidatos.length > 0 ? 'req-cumplido' : 'req-pendiente'}>
                          <span className="icono-req">{actual.candidatos.length > 0 ? '✔' : '✕'}</span>
                          <div>
                            <strong>Candidatos registrados</strong>
                            <small>{actual.candidatos.length > 0 ? `${actual.candidatos.length} candidato(s) listos para la votación` : 'Falta registrar al menos 1 candidato'}</small>
                          </div>
                        </li>
                        <li className={actual.mesas.length > 0 ? 'req-cumplido' : 'req-pendiente'}>
                          <span className="icono-req">{actual.mesas.length > 0 ? '✔' : '✕'}</span>
                          <div>
                            <strong>Mesas de votación</strong>
                            <small>{actual.mesas.length > 0 ? `${actual.mesas.length} mesa(s) registradas en el sistema` : 'Falta registrar mesas para este cargo'}</small>
                          </div>
                        </li>
                        <li className={coberturaOperadores ? 'req-cumplido' : 'req-pendiente'}>
                          <span className="icono-req">{coberturaOperadores ? '✔' : '✕'}</span>
                          <div>
                            <strong>Operadores asignados</strong>
                            <small>
                              {coberturaOperadores
                                ? `100% de mesas asignadas (${mesasConOperador.length}/${actual.mesas.length})`
                                : actual.mesas.length === 0
                                ? 'Sin mesas creadas para asignar'
                                : `Faltan ${mesasSinOperador.length} mesa(s) por asignar operador`}
                            </small>
                          </div>
                        </li>
                      </ul>

                      {actual.estado === 'borrador' && (
                        puedeIniciarConteo ? (
                          <div className="aviso-listo-para-iniciar">
                            <span className="icono-check-verde">✓</span>
                            <div>
                              <strong>Todo configurado correctamente.</strong>
                              <p>Este cargo está preparado. Inicia toda la institución con el control superior.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="aviso-pendiente-para-iniciar">
                            <span>⚠️</span>
                            <div>
                              <strong>Faltan requisitos para iniciar el conteo.</strong>
                              <p>Revisa los puntos en rojo arriba antes de poder abrir la recepción de actas.</p>
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    <div className="tarjeta-control-estado-accion">
                      <h3 className="titulo-seccion-resumen">Acciones del estado</h3>
                      <EstadoEleccion
                        key={actual.id + '-' + actual.estado}
                        proceso={actual}
                        gestionInstitucional
                        ocupado={bloqueado}
                        puedeAbrir={puedeIniciarConteo}
                        alCambiar={accion => guardar(async () => {
                          if (accion === 'reiniciar') {
                            const nuevo = await pedir(`/configuracion/procesos/${id}/reiniciar`, { metodo: 'POST', datos: { confirmar: true } });
                            setId(nuevo.id); setRevisandoCargo(true); setPestana('configuracion');
                            notificarExito('Nuevo borrador sin actas. Revisa la configuración y pulsa Iniciar conteo.');
                          } else if (accion === 'eliminar') {
                            await pedir(`/configuracion/procesos/${id}`, { metodo: 'DELETE' });
                            setId(''); setRevisandoCargo(false);
                          } else if (accion === 'abrir') {
                            await pedir('/configuracion/institucion/iniciar', { metodo: 'POST', datos: { confirmar: true } });
                          } else {
                            await pedir(`/configuracion/procesos/${id}/estado`, { metodo: 'POST', datos: { estado: accion, confirmar: true } });
                          }
                        }, accion === 'reiniciar' ? 'Nuevo borrador preparado sin actas. Revisa la configuración antes de iniciar.' : 'Estado actualizado correctamente.')}
                      />
                    </div>
                  </div>
                </div>
              </section>
            );
          })()}

          {pestana === 'asignaciones' && org && datosInstitucionListos && <AsignacionesOperadores key={org} ocupado={bloqueado} organizacion={org} nombreOrganizacion={institucionSeleccionada?.nombre} cuentas={cuentas} procesos={procesos} version={version} idActual={sesion.idUsuario} alGuardar={()=>setVersion(v=>v+1)} alRevocar={c=>guardar(()=>pedir(`/usuarios/${encodeURIComponent(c.idUsuario)}/roles`,{metodo:'POST',datos:{idOrganizacion:org,rol:'OPERADOR',revocar:true}}),'Rol de operador revocado.')} alCargo={valor=>{setId(valor);setRevisandoCargo(true);setCreandoProceso(false);setEditandoProceso(false);setPestana('configuracion');}}/>}

          {pestana === 'usuarios' && (<>
            <section className="panel-admin cuentas-preparacion">
              <div className="cabecera-panel-admin" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0 }}>Administradores del sistema</h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--secundario)', fontSize: 13 }}>Cuentas con rol de administrador. Los operadores se gestionan en Asignar operadores.</p>
                </div>
              </div>
              <ListadoCuentas cuentas={cuentas} organizaciones={organizaciones} idActual={sesion.idUsuario}
                cargando={cargandoCuentas} error={errorCuentas} ocupado={bloqueado}
                alReintentar={() => setVersion(v => v + 1)}
                alRevocar={c => guardar(() => solicitarRest(`/usuarios/${encodeURIComponent(c.idUsuario)}/roles`, { metodo: 'POST', datos: { idOrganizacion: c.roles?.find(r => r.rol === 'ADMINISTRADOR')?.idOrganizacion ?? null, rol: 'ADMINISTRADOR', revocar: true } }), 'Rol de administrador revocado.')} />
              {!mostrarCrearAdmin && (
                <div style={{ marginTop: 20 }}>
                  <button type="button" className="boton primario" onClick={() => setMostrarCrearAdmin(true)}>
                    + Crear administrador
                  </button>
                </div>
              )}
            </section>

            <ModalFormulario abierto={mostrarCrearAdmin} titulo="Crear administrador" ocupado={bloqueado} alCerrar={()=>setMostrarCrearAdmin(false)}>
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
                  alOcupado={setOcupado}
                  alGuardar={() => { setVersion(v => v + 1); setMostrarCrearAdmin(false); }}
                />
            </ModalFormulario>

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

      notificarExito(
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
          <Aviso error={error} />

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
