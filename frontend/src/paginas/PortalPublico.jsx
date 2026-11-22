import ResumenResultadosCargos from '../componentes/ResumenResultadosCargos.jsx';
import CargosDestacados from '../componentes/CargosDestacados.jsx';
import { procesoDesdeEnlace } from '../api/enlacesResultados.js';
import ResultadosSectores from '../componentes/ResultadosSectores.jsx';
import { nombresEstado } from '../api/catalogos.js';
import { puntuacionCandidatura, ordenarCandidaturas } from '../api/presentacionResultados.js';
import React, { useEffect, useRef, useState } from 'react';
import UrnaAnimada from '../componentes/UrnaAnimada.jsx';
import { IconoUrna, IconoEdificio, IconoUsuario, IconoReloj, IconoBarras, IconoInfo } from '../componentes/Iconos.jsx';
import { usarConsultaPublica } from '../api/usarConsultaPublica.js';
import { comprobarPortal, comprobarEventos } from '../api/datosPortal.js';

const consultaEventos = `query Eventos { eventos { id nombre tipo destacado procesos { id nombre cargo ambito vuelta estado destacadoPortada candidatos { id nombre foto } } } }`;
const consultaPortal = `query Portal($idProceso:ID!, $unidad:String) { portal(idProceso:$idProceso, unidad:$unidad) {
 proceso { id nombre cargo tipo unidad unidades estado ambito vuelta ponderacion sectores {codigo nombre pesoBps} candidatos {id nombre foto} }
 resultados {esperadas contabilizadas pendientes observadas avance blancos nulos total validos actualizadoEn ponderacionAplicada requierenRevision
 candidatos {id nombre foto votos porcentaje porcentajePonderado} unidades {unidad esperadas contabilizadas pendientes}
 sectores {codigo nombre pesoBps esperadas contabilizadas pendientes observadas validos blancos nulos total candidatos {id nombre votos porcentaje}}
 regla {estado descripcion candidatos provisional}}
} }`;

const validarPortal = datos => comprobarPortal(datos.portal);
const validarEventos = datos => comprobarEventos(datos.eventos);
const formato = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 });
const numero = valor => formato.format(valor);

function FotoCandidatura({ candidato, primera }) {
  const [fallida, cambiarFallida] = useState(false);
  return <div className="retrato-candidatura">
    {candidato.foto && !fallida ? <img src={candidato.foto} alt={`Fotografía de ${candidato.nombre}`} loading={primera ? 'eager' : 'lazy'} decoding="async" width="560" height="400" onError={() => cambiarFallida(true)} /> : <div className="retrato-pendiente"><span aria-hidden="true">{candidato.nombre.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toLocaleUpperCase('es')}</span><small>Fotografía no disponible</small></div>}
  </div>;
}

function TarjetaCandidatura({ candidato, indice, candidatos, resultados, proceso, unidad }) {
  const primero = candidatos[0];
  const valor=puntuacionCandidatura(candidato,resultados),valorPrimero=puntuacionCandidatura(primero,resultados);
  const empate = candidatos.length > 1 && valorPrimero!==null && valorPrimero === puntuacionCandidatura(candidatos[1],resultados);
  const lider = indice === 0 && valor!==null && valor>0 && !empate;
  const referencia = indice === 0 ? candidatos[1] : primero;
  const diferencia = referencia && valor!==null && puntuacionCandidatura(referencia,resultados)!==null
    ? Math.abs(valor-puntuacionCandidatura(referencia,resultados)) : null;
  const estado = valor===null?'Ponderación pendiente':!resultados.validos ? 'Conteo pendiente' : valor === valorPrimero
    ? empate ? 'Empate en el primer lugar' : 'Lidera el conteo' : 'En competencia';
  return <article className={`tarjeta-candidatura ${lider ? 'candidatura-lider' : ''}`}>
    <div className="cabecera-candidatura"><span className="cargo-candidatura">{proceso.cargo}</span><span className="posicion-candidatura">{lider && <IconoBarras tamano={16} />}{estado}</span></div>
    <div className="perfil-candidatura">
      <FotoCandidatura candidato={candidato} primera={indice < 2} />
      <div className="identidad-candidatura">
        <p className="etiqueta-candidatura">Candidatura publicada</p>
        <h3>{candidato.nombre}</h3>
        <p className="ambito-candidatura">{unidad || 'Todas las unidades'}</p>
        <div className="resultado-destacado"><div className="porcentaje-candidatura">{valor===null?'—':numero(valor)}<span>%</span></div><span className="base-porcentaje">{resultados.ponderacionAplicada?'ponderado':'de votos válidos'}</span></div>
        <p className={`distancia-candidatura ${lider ? 'distancia-favorable' : ''}`}>{diferencia === null ? resultados.validos ? 'Porcentaje sobre los votos válidos' : 'Esperando el avance del conteo' : diferencia === 0 ? 'Sin diferencia con el primer lugar' : lider ? `+${numero(diferencia)} puntos sobre el segundo lugar` : `A ${numero(diferencia)} puntos del primer lugar`}</p>
      </div>
    </div>
    <div className="indicador-votos" aria-hidden="true"><span style={{ width: `${valor??0}%` }} /></div>
    <dl className="detalle-candidatura">
      <div><dt>Votos recibidos <IconoUrna tamano={14} /></dt><dd>{numero(candidato.votos)}</dd><span>para esta candidatura</span></div>
      <div><dt>Base de cálculo <IconoBarras tamano={14} /></dt><dd>{numero(resultados.validos)}</dd><span>votos válidos en esta selección</span></div>
    </dl>
    <footer className="pie-candidatura"><span>Resultado preliminar</span><span>{numero(resultados.contabilizadas)} de {numero(resultados.esperadas)} actas contabilizadas</span></footer>
  </article>;
}

function TablaUnidades({ resultados, unidad, etiqueta, alElegir }) {
  const [busqueda, cambiarBusqueda] = useState('');
  const normalizar = valor => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const unidades = resultados.unidades.filter(u => (!unidad || u.unidad === unidad) && normalizar(u.unidad).includes(normalizar(busqueda.trim())));
  return <section className="panel-unidades" id="por-unidades" aria-labelledby="titulo-unidades">
    <div className="cabecera-unidades"><div><p className="sobre-titulo">EL DETALLE DE TU COMUNIDAD</p><h2 id="titulo-unidades">Conteo por {etiqueta.toLowerCase()}</h2><p>Consulta el avance de actas y abre los votos de cada unidad.</p></div>
      <label className="busqueda-unidades"><IconoEdificio tamano={16} /><input type="search" aria-label={`Buscar ${etiqueta.toLowerCase()}`} placeholder={`Buscar ${etiqueta.toLowerCase()}…`} value={busqueda} onChange={e => cambiarBusqueda(e.target.value)} /></label>
    </div>
    <p className="ayuda-tabla-movil">Desliza la tabla para ver todas las columnas <span aria-hidden="true">↔</span></p>
    <div className="tabla-unidades-scroll" role="region" aria-label="Detalle de actas por unidad" tabIndex="0">
      <table className="tabla-unidades"><caption className="solo-lectores">Actas contabilizadas, avance y pendientes por {etiqueta.toLowerCase()}.</caption>
        <thead><tr><th scope="col">{etiqueta} / unidad</th><th scope="col">Actas</th><th scope="col">Avance del conteo</th><th scope="col">Pendientes</th><th scope="col">Resultados</th></tr></thead>
        <tbody>{unidades.map(u => {
          const avance = u.esperadas ? u.contabilizadas / u.esperadas * 100 : 0;
          return <tr key={u.unidad}><th scope="row">{u.unidad}</th><td className="cifra-tabla">{numero(u.contabilizadas)} <span>/ {numero(u.esperadas)}</span></td><td><div className="avance-tabla"><span>{numero(avance)}%</span><span className="barra-unidad" aria-hidden="true"><span style={{ width: `${avance}%` }} /></span></div></td><td className="cifra-tabla">{numero(u.pendientes)}</td><td><button type="button" className="enlace-votos" onClick={() => alElegir(u.unidad)} aria-label={`Ver votos de ${u.unidad}`}>Ver votos</button></td></tr>;
        })}</tbody>
      </table>
    </div>
    {!unidades.length && <div className="sin-unidades"><p>{busqueda ? 'No encontramos unidades con ese nombre.' : 'Todavía no hay mesas registradas.'}</p>{busqueda && <button type="button" onClick={() => cambiarBusqueda('')}>Limpiar búsqueda</button>}</div>}
    <div className="pie-tabla"><span>{numero(unidades.length)} {unidades.length === 1 ? 'unidad visible' : 'unidades visibles'} · Una acta vigente por mesa</span>{unidad ? <button type="button" onClick={() => alElegir('')}>Ver todas las unidades</button> : <a href="#como-leer">Cómo se calcula el avance</a>}</div>
  </section>;
}

export default function PortalPublico() {
  const enfocarAlCargar = useRef(false);
  const encabezadoResultados = useRef(null);
  const [seleccion, cambiarSeleccion] = useState(()=>({evento:'',proceso:procesoDesdeEnlace(location.hash),unidad:''}));
  const [pausadas, cambiarPausadas] = useState(() => { try { return localStorage.getItem('tuvoto:pausar-animaciones') === 'si'; } catch { return false; } });
  const catalogo = usarConsultaPublica(consultaEventos, {}, validarEventos, 60000);
  const eventos = catalogo.datos ?? [];
  const evento = seleccion.evento?eventos.find(e=>e.id===seleccion.evento):seleccion.proceso?eventos.find(e=>e.procesos.some(p=>p.id===seleccion.proceso)):eventos[0];
  const proceso = seleccion.proceso?evento?.procesos.find(p=>p.id===seleccion.proceso):evento?.procesos[0];
  const seleccionRetirada=!!(seleccion.proceso||seleccion.evento)&&!proceso;
  const unidad = seleccion.proceso === proceso?.id ? seleccion.unidad : '';
  const conteo = usarConsultaPublica(consultaPortal, { idProceso: proceso?.id ?? '', unidad: unidad || null }, validarPortal, 10000, !!proceso);
  const portal = proceso ? conteo.datos : null;
  const r = portal?.resultados;
  const candidatos = r ? ordenarCandidaturas(r) : [];
  const fecha = r?.actualizadoEn ? new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/La_Paz' }).format(new Date(r.actualizadoEn)) : null;
  const cargando = catalogo.cargando || (!!proceso && conteo.cargando);
  const error = catalogo.error || (proceso && conteo.error);

  useEffect(()=>{const alEnlace=()=>{if(location.hash.startsWith('#resultados?'))cambiarSeleccion({evento:'',proceso:procesoDesdeEnlace(location.hash),unidad:''});};window.addEventListener('hashchange',alEnlace);return()=>window.removeEventListener('hashchange',alEnlace);},[]);

  function mostrarResultados() {
    encabezadoResultados.current?.focus({ preventScroll: true });
    encabezadoResultados.current?.scrollIntoView({ behavior: pausadas || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }

  useEffect(() => {
    if (!portal || !enfocarAlCargar.current) return;
    enfocarAlCargar.current = false;
    mostrarResultados();
  }, [portal, pausadas]);

  function elegirProceso(id) {
    if (id === proceso?.id && !unidad && portal) { mostrarResultados(); return; }
    enfocarAlCargar.current = true;
    cambiarSeleccion({ evento: evento.id, proceso: id, unidad: '' });
  }
  function elegirUnidad(valor) {
    if (valor === unidad && portal) { mostrarResultados(); return; }
    enfocarAlCargar.current = true;
    cambiarSeleccion({ evento: evento.id, proceso: proceso.id, unidad: valor });
  }
  function alternarAnimaciones() { cambiarPausadas(valor => { try { localStorage.setItem('tuvoto:pausar-animaciones', !valor ? 'si' : 'no'); } catch { /* El control funciona también sin almacenamiento. */ } return !valor; }); }
  function reintentar() { catalogo.reintentar(); conteo.reintentar(); }

  return <div data-proceso-publico={proceso?.id??''} className={`observatorio-publico ${pausadas ? 'animaciones-pausadas' : ''}`}>
    <a className="saltar-contenido" href="#resultados-electorales">Ir a resultados</a>
    <header className="cabecera-observatorio">
      <a href="#resultados" className="marca-observatorio" aria-label="TUVOTO, inicio"><span className="simbolo-marca"><IconoUrna tamano={21} /></span>TUVOTO<span className="punto-marca">.</span></a>
      <span className="descripcion-marca">La elección, a la vista.</span>
      <nav className="enlaces-cabecera" aria-label="Navegación pública"><a className="enlace-observatorio" href="#resultados-electorales">Observatorio electoral</a><a href="#como-leer">Cómo leer los resultados</a>{portal && <a href="#por-unidades">Por unidades</a>}<a href="#panel" className="acceso-observatorio"><IconoUsuario tamano={14} /> Acceso al personal</a></nav>
    </header>
    <main className="contenido-observatorio" id="resultados-electorales" tabIndex="-1">
      <div className="franja-eventos"><span className="etiqueta-directorio">OBSERVATORIO ELECTORAL <span className="separador-etiqueta">/</span> RESULTADOS PRELIMINARES</span>
        {eventos.length > 0 && <label className="selector-evento">Evento electoral <select aria-label="Evento electoral" value={evento?.id??''} onChange={e => cambiarSeleccion({ evento: e.target.value, proceso: '', unidad: '' })}>{!evento&&<option value="" disabled>Selecciona un evento disponible</option>}{eventos.map(e => <option key={e.id} value={e.id}>{e.nombre}{e.destacado ? ' · Destacado' : ''}</option>)}</select></label>}
      </div>
      <section className="portada-evento" aria-labelledby="titulo-evento">
        <div className="presentacion-evento"><p className="sobre-titulo">{evento?.destacado ? 'EVENTO DESTACADO' : evento ? 'EVENTO ELECTORAL' : 'CADA ELECCIÓN CUENTA'}</p><h1 id="titulo-evento">{evento?.nombre ?? 'Tu comunidad.\nTu próxima elección.'}</h1><p className="bajada-evento">Candidaturas, votos y actas. Sigue el conteo de tu comunidad,<br className="salto-escritorio" /> conoce a sus candidatos y consulta los resultados por unidad.</p>
          {r ? <div className="avance-portada" aria-label="Avance de actas"><div className="detalle-avance-portada"><span><IconoUrna tamano={15} /><strong>{numero(r.avance)}%</strong> de actas contabilizadas</span><span>{numero(r.contabilizadas)} de {numero(r.esperadas)} actas</span></div><div className="barra-avance-portada" role="progressbar" aria-label="Porcentaje de mesas contabilizadas" aria-valuenow={r.avance} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${r.avance}%` }} /></div><p>{unidad || portal.proceso.cargo} · {error ? 'Última respuesta recibida; actualización pendiente.' : 'Una contribución vigente por mesa.'}</p></div> : <div className="espera-portada"><IconoReloj tamano={15} /><span>{cargando ? 'Consultando eventos publicados…' : error ? 'La consulta no pudo completarse.' : 'El conteo estará disponible cuando se publique un evento.'}</span></div>}
        </div>
        <div className="urna-portada"><UrnaAnimada compacta /><span className="leyenda-urna">Del acta al resultado.</span><button type="button" className="pausa-urna" aria-pressed={pausadas} onClick={alternarAnimaciones}>{pausadas ? 'Reanudar animaciones' : 'Pausar animaciones'}</button><small>Una comunidad informada.</small></div>
      </section>
      {evento && <CargosDestacados cargos={evento.procesos} alElegir={elegirProceso}/> }
      {evento && <div className="barra-cargos"><nav className="navegacion-cargos" aria-label="Cargos del evento">{evento.procesos.map(p => <button key={p.id} type="button" aria-pressed={p.id === proceso?.id} className={p.id === proceso?.id ? 'cargo-seleccionado' : ''} onClick={() => elegirProceso(p.id)}>{p.cargo}{p.ambito?' · '+p.ambito:''}{p.vuelta===2?' · Segunda vuelta':''}</button>)}</nav><a href="#como-leer" className="nota-base-calculo">{r?.ponderacionAplicada?'% ponderado configurado':'% sobre votos válidos'} <IconoInfo tamano={13} /></a></div>}
      {evento&&<ResumenResultadosCargos key={evento.id} cargos={evento.procesos} alElegir={elegirProceso}/>}
      {error && portal && <div className="aviso-observatorio" role="alert"><div><strong>No pudimos actualizar la información.</strong><p>{error}</p><p>Estás viendo la última respuesta recibida para esta selección.</p></div><button type="button" onClick={reintentar}>Reintentar <span aria-hidden="true">↻</span></button></div>}
      {cargando ? <section className="estado-observatorio" role="status"><UrnaAnimada compacta /><h2>Preparando los resultados…</h2><p>Consultando los eventos y el conteo publicado.</p></section> : !portal ? <section className="estado-observatorio" role={error ? 'alert' : undefined}>
        <IconoUrna tamano={32} />
        <h2>{error ? 'No se pudieron cargar los resultados' : (proceso||seleccionRetirada) ? 'Este cargo ya no está publicado' : 'Todavía no hay un evento publicado'}</h2>
        <p>{error || 'Cuando se publique una elección, podrás consultar aquí sus candidatos y el avance de actas. La página se actualizará automáticamente.'}</p>
        {!error && !proceso && !seleccionRetirada && <div className="informacion-portada-vacia" aria-label="Qué podrás consultar"><div><IconoUsuario tamano={20} /><strong>Candidaturas</strong><span>Fotos, nombres y cargos publicados.</span></div><div><IconoBarras tamano={20} /><strong>Resultados</strong><span>Votos y porcentajes de las actas contabilizadas.</span></div><div><IconoEdificio tamano={20} /><strong>Tu facultad o unidad</strong><span>El detalle del conteo de tu comunidad.</span></div></div>}
        <button type="button" onClick={reintentar}>{error ? 'Reintentar conexión' : 'Volver a consultar'}</button>
        {!error && !proceso && !seleccionRetirada && <p className="acceso-configuracion-vacia">¿Organizas la elección? <a href="#panel">Configurar un evento</a></p>}
      </section> : <>
        <section ref={encabezadoResultados} tabIndex="-1" className="encabezado-conteo" aria-label="Selección de resultados"><div><p className="sobre-titulo">CÓMPUTO PRELIMINAR</p><h2>{portal.proceso.cargo}</h2><span className={`etiqueta-estado estado-${portal.proceso.estado}`}>{nombresEstado[portal.proceso.estado]}</span><p>{unidad ? `Resultados de ${unidad}` : 'Vista general · Todas las unidades'} · {numero(candidatos.length)} candidaturas</p></div><div className="controles-conteo"><label className="filtro-unidad"><IconoEdificio tamano={16} /><select value={unidad} onChange={e => elegirUnidad(e.target.value)} aria-label={`Filtrar por ${portal.proceso.unidad.toLowerCase()}`}><option value="">Todas las unidades</option>{portal.proceso.unidades.map(u => <option key={u} value={u}>{u}</option>)}</select></label><div className="actualizacion-conteo"><IconoReloj tamano={13} /><span>{error ? 'Actualización interrumpida' : fecha ? `Último conteo: ${fecha}` : 'Esperando la primera acta'}</span><button type="button" aria-label="Actualizar resultados" onClick={conteo.reintentar}>↻</button></div></div></section>
        <section className="panel-candidaturas" aria-label="Votos por candidatura"><div className="tarjetas-candidaturas">{candidatos.map((c, indice) => <TarjetaCandidatura key={`${c.id}-${c.foto}`} candidato={c} indice={indice} candidatos={candidatos} resultados={r} proceso={portal.proceso} unidad={unidad} />)}</div>{!candidatos.length && <p className="sin-candidaturas">Todavía no hay candidaturas publicadas para este cargo.</p>}<p className="nota-candidaturas"><IconoInfo tamano={14} /> El orden puede cambiar mientras se contabilizan las actas. Consulta cada 10 s.</p></section>
        <section className="resumen-votos" aria-label="Resumen de votos y actas"><dl>{[['Votos contabilizados', r.total], ['Votos válidos', r.validos], ['Blancos', r.blancos], ['Nulos', r.nulos], ['Actas pendientes', r.pendientes], ['Observadas', r.observadas]].map(([titulo, valor]) => <div key={titulo}><dt>{titulo}</dt><dd>{numero(valor)}</dd></div>)}</dl></section>
        <ResultadosSectores resultados={r} proceso={portal.proceso}/>
        <TablaUnidades key={`${portal.proceso.id}-${unidad}`} resultados={r} unidad={unidad} etiqueta={portal.proceso.unidad} alElegir={elegirUnidad} />
      </>}
      <section className="ayuda-conteo" id="como-leer"><IconoInfo tamano={20} /><div><h2>Una lectura clara del conteo.</h2><p>Los porcentajes se calculan sobre votos válidos; cuando se activa ponderación, se aplican los pesos configurados por sector y se muestra su desglose. El avance indica mesas contabilizadas; las observadas están incluidas en las pendientes. Los resultados son preliminares y no constituyen una proclamación oficial.</p></div><a href="#resultados-electorales">Volver arriba</a></section>
    </main>
    <footer className="pie-observatorio"><span className="marca-pie">TUVOTO.</span><p>Información abierta. Una comunidad informada.</p><small>Proyecto académico independiente · Resultados preliminares no oficiales</small></footer>
  </div>;
}
