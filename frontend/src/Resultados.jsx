import React, { useMemo, useRef, useState } from 'react';
import Icono from './componentes/Icono.jsx';
import UrnaAnimada from './componentes/UrnaAnimada.jsx';
import { calcularResultado, formatearNumero, formatearPorcentaje, normalizar, resultadosDemostracion } from './datos/demostracion.js';

const cargos = ['Todos los cargos', 'Rectorado', 'Vicerrectorado', 'Decanato', 'Dirección de carrera'];
const facultades = [...new Set(resultadosDemostracion.map(resultado => resultado.facultad).filter(Boolean))];

function BarrasCandidaturas({ candidaturas }) {
  return <ol className="lista-candidaturas">{candidaturas.map((candidatura, indice) => <li key={candidatura.id} className={`candidatura candidatura-${candidatura.color}`}>
    <span className="avatar-candidatura" aria-hidden="true">{candidatura.sigla}</span>
    <div className="candidatura-datos"><div className="candidatura-nombre"><span>{candidatura.nombre}</span><strong>{formatearPorcentaje(candidatura.porcentaje)}</strong></div>
      <div className="barra-porcentaje" aria-hidden="true"><span style={{ '--porcentaje': `${candidatura.porcentaje}%` }} /></div>
      <div className="candidatura-pie"><span>{formatearNumero(candidatura.votos)} votos</span>{indice === 0 && candidatura.votos > (candidaturas[1]?.votos ?? 0) && <span>Mayor porcentaje</span>}</div>
    </div>
  </li>)}</ol>;
}

function TarjetaResultado({ resultado, estamento, abrirDetalle, indice }) {
  const { candidaturas, avance } = calcularResultado(resultado, estamento);
  return <article className="tarjeta-resultado aparicion" style={{ '--orden': indice }}>
    <div className="cabecera-resultado"><span className="tipo-cargo"><Icono nombre={resultado.cargo === 'Dirección de carrera' ? 'carrera' : 'edificio'} width="17" height="17" />{resultado.cargo}</span><span className="estado-computo">Cómputo parcial</span></div>
    <h3>{resultado.carrera || resultado.facultad || resultado.cargo}</h3>
    <p className="subtitulo-resultado">{resultado.carrera ? `Facultad de ${resultado.facultad}` : resultado.facultad ? 'Elección de autoridad facultativa' : 'Elección de autoridad universitaria'}</p>
    <BarrasCandidaturas candidaturas={candidaturas} />
    <div className="pie-resultado"><span><Icono nombre="documento" width="16" height="16" />{resultado.actas}/{resultado.actasEsperadas} actas · {Math.round(avance)} %</span><button onClick={() => abrirDetalle(resultado)} aria-label={`Ver detalle de ${resultado.carrera || resultado.facultad || resultado.cargo}`}>Ver detalle</button></div>
  </article>;
}

export default function Resultados({ navegar }) {
  const [cargo, cambiarCargo] = useState('Todos los cargos');
  const [facultad, cambiarFacultad] = useState('');
  const [carrera, cambiarCarrera] = useState('');
  const [busqueda, cambiarBusqueda] = useState('');
  const [estamento, cambiarEstamento] = useState('estudiantes');
  const [seleccionado, cambiarSeleccionado] = useState(null);
  const [mostrarTodos, cambiarMostrarTodos] = useState(false);
  const dialogo = useRef(null);
  const carreras = [...new Set(resultadosDemostracion.filter(resultado => !facultad || resultado.facultad === facultad).map(resultado => resultado.carrera).filter(Boolean))];
  const filtrados = useMemo(() => resultadosDemostracion.filter(resultado =>
    (cargo === 'Todos los cargos' || resultado.cargo === cargo) && (!facultad || resultado.facultad === facultad) &&
    (!carrera || resultado.carrera === carrera) && normalizar([resultado.facultad, resultado.carrera, resultado.cargo, ...resultado.candidaturas.map(candidatura => candidatura.nombre)].join(' ')).includes(normalizar(busqueda.trim()))
  ), [cargo, facultad, carrera, busqueda]);
  const visibles = mostrarTodos ? filtrados : filtrados.slice(0, 4);
  const datosDetalle = seleccionado && calcularResultado(seleccionado, estamento);
  const filtrosActivos = cargo !== 'Todos los cargos' || facultad || carrera || busqueda;

  function limpiarFiltros() { cambiarCargo('Todos los cargos'); cambiarFacultad(''); cambiarCarrera(''); cambiarBusqueda(''); cambiarMostrarTodos(false); }
  function abrirDetalle(resultado) { cambiarSeleccionado(resultado); dialogo.current.showModal(); }

  return <>
    <section className="hero-electoral aparicion" aria-labelledby="titulo-portada">
      <div className="hero-texto"><span className="etiqueta-hero"><span />OBSERVATORIO ELECTORAL UNIVERSITARIO</span>
        <h1 id="titulo-portada">Tu universidad.<br /><span>Cada voto, a la vista.</span></h1>
        <p>De tu carrera al rectorado. Un espacio para conocer a las candidaturas y seguir cada resultado.</p>
        <a className="boton boton-hero" href="#explorar" onClick={evento => { evento.preventDefault(); document.getElementById('explorar').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); document.getElementById('titulo-resultados').focus({ preventScroll: true }); }}><Icono nombre="resultados" width="18" height="18" />Explorar resultados</a>
        <span className="hero-ubicacion">San Francisco Xavier de Chuquisaca · Sucre, Bolivia</span>
      </div>
      <div className="hero-ilustracion"><span className="orbita orbita-uno" /><span className="orbita orbita-dos" /><span className="etiqueta-ilustracion"><Icono nombre="escudo" width="16" height="16" />Más información. Más comunidad.</span><UrnaAnimada /><span className="pie-ilustracion">CADA FACULTAD. CADA CARRERA.</span></div>
    </section>

    <div className="aviso-demostracion"><span className="icono-aviso"><Icono nombre="informacion" width="19" height="19" /></span><p><strong>Estás explorando una demostración.</strong> Las candidaturas, los votos y las actas son ficticios. No son resultados oficiales de la USFX.</p><button onClick={() => navegar('elecciones')}>Ver registros conectados</button></div>

    <section className="indicadores-portada" aria-label="Contenido de la demostración">
      {[
        ['edificio', '3', 'Facultades de ejemplo', 'Tu comunidad, más cerca'],
        ['carrera', '2', 'Carreras de ejemplo', 'Más allá del rectorado'],
        ['urna', '6', 'Elecciones de ejemplo', 'Cuatro tipos de autoridad'],
        ['personas', '2', 'Estamentos separados', 'Estudiantes y docentes'],
      ].map(([icono, valor, titulo, nota]) => <div className="indicador-portada" key={titulo}><span className={`icono-indicador icono-${icono}`}><Icono nombre={icono} /></span><div><strong>{valor}<span>{titulo}</span></strong><p>{nota}</p></div></div>)}
    </section>

    <section id="explorar" className="explorador" aria-labelledby="titulo-resultados">
      <div className="titulo-explorador"><div><p className="sobretitulo">EL PANORAMA, A TU ALCANCE</p><h2 id="titulo-resultados" tabIndex="-1">Encuentra tu elección</h2><p>Elige una facultad y descubre cómo avanza el cómputo de ejemplo.</p></div><span className="etiqueta-demo"><span />Vista de demostración</span></div>
      <div className="filtros-resultados">
        <div className="campo-busqueda"><Icono nombre="buscar" /><label htmlFor="busqueda-resultados" className="solo-lectores">Buscar facultad, carrera o candidatura</label><input id="busqueda-resultados" placeholder="Busca tu facultad, carrera o candidatura…" value={busqueda} onChange={evento => cambiarBusqueda(evento.target.value)} /></div>
        <div className="selector-resultados"><Icono nombre="edificio" width="18" height="18" /><label className="solo-lectores" htmlFor="facultad">Facultad</label><select id="facultad" value={facultad} onChange={evento => { cambiarFacultad(evento.target.value); cambiarCarrera(''); }}><option value="">Todas las facultades</option>{facultades.map(nombre => <option key={nombre}>{nombre}</option>)}</select></div>
        <div className="selector-resultados"><Icono nombre="carrera" width="18" height="18" /><label className="solo-lectores" htmlFor="carrera">Carrera</label><select id="carrera" value={carrera} onChange={evento => cambiarCarrera(evento.target.value)}><option value="">Todas las carreras</option>{carreras.map(nombre => <option key={nombre}>{nombre}</option>)}</select></div>
      </div>
      <div className="pestanas-cargos" role="group" aria-label="Filtrar por cargo">{cargos.map(nombre => <button key={nombre} aria-pressed={cargo === nombre} className={cargo === nombre ? 'seleccionado' : ''} onClick={() => { cambiarCargo(nombre); cambiarMostrarTodos(false); }}>{nombre}</button>)}</div>
      <div className="contenido-resultados">
        <div className="columna-resultados">
          <div className="opciones-resultados"><p role="status"><strong>{filtrados.length}</strong> elecciones encontradas{filtrosActivos && <button className="limpiar-filtros" onClick={limpiarFiltros}>Limpiar filtros</button>}</p><div className="selector-estamento" role="group" aria-label="Estamento del resultado"><button aria-pressed={estamento === 'estudiantes'} onClick={() => cambiarEstamento('estudiantes')}>Estudiantes</button><button aria-pressed={estamento === 'docentes'} onClick={() => cambiarEstamento('docentes')}>Docentes</button></div></div>
          <p className="nota-estamento">Porcentaje sobre votos válidos del estamento {estamento === 'estudiantes' ? 'estudiantil' : 'docente'}; no determina una autoridad ganadora.</p>
          <div className="rejilla-resultados" key={estamento}>{visibles.map((resultado, indice) => <TarjetaResultado key={resultado.id} resultado={resultado} estamento={estamento} abrirDetalle={abrirDetalle} indice={indice} />)}</div>
          {!filtrados.length && <div className="sin-resultados"><span className="icono-vacio"><Icono nombre="buscar" width="30" height="30" /></span><h3>No encontramos una elección</h3><p>Prueba otro nombre o cambia los filtros seleccionados.</p><button className="boton secundario" onClick={limpiarFiltros}>Restablecer filtros</button></div>}
          {filtrados.length > 4 && <button className="boton ver-mas" onClick={() => cambiarMostrarTodos(valor => !valor)}>{mostrarTodos ? 'Mostrar menos elecciones' : `Ver las ${filtrados.length} elecciones de ejemplo`}</button>}
        </div>
        <aside className="contexto-resultados" aria-label="Cómo interpretar los resultados">
          <section className="panel-computo"><div className="titulo-computo"><Icono nombre="documento" /><h3>Detrás de cada voto</h3></div><p>Un resultado comienza con un acta.</p>
            <div className="anillo-contenedor"><svg viewBox="0 0 150 150" aria-hidden="true"><circle cx="75" cy="75" r="62" className="anillo-base" /><circle cx="75" cy="75" r="62" className="anillo-avance" /></svg><div><strong>75<span>%</span></strong><span>actas de ejemplo</span></div></div>
            <div className="detalle-computo"><span>Decanato · Ciencias y Tecnología</span><strong>18 de 24 actas computadas</strong></div>
            <div className="leyenda-computo"><span><i />Computadas <strong>18</strong></span><span><i />Pendientes <strong>6</strong></span></div>
            <p className="nota-computo">Ejemplo fijo de una elección. El avance de actas no es el porcentaje de votos.</p><button className="boton secundario" onClick={() => abrirDetalle(resultadosDemostracion[0])}>Consultar el ejemplo</button>
          </section>
          <section className="tarjeta-transparencia"><span className="icono-transparencia"><Icono nombre="escudo" width="26" height="26" /></span><h3>Información que se puede entender.</h3><p>Votos por estamento, avance de actas y una fuente clara. Así se construye un resultado transparente.</p><button onClick={() => navegar('guia')}>Conoce cómo funciona <Icono nombre="informacion" width="16" height="16" /></button></section>
        </aside>
      </div>
    </section>
    <section className="franja-comunidad"><span className="icono-comunidad"><Icono nombre="edificio" width="28" height="28" /></span><div><h2>La información también es parte de la participación.</h2><p>Un proyecto universitario para acercar cada elección a nuestra comunidad.</p></div><span>SIGAPE <span>·</span> COM-600</span></section>

    <dialog ref={dialogo} className="dialogo-detalle" aria-labelledby="titulo-detalle">
      {seleccionado && <div className="contenido-detalle"><div className="cabecera-dialogo"><span className="etiqueta-demo">Datos ficticios · Demostración</span><button className="cerrar" aria-label="Cerrar detalle" onClick={() => dialogo.current.close()}><Icono nombre="cerrar" /></button></div>
        <p className="sobretitulo">{seleccionado.cargo}</p><h2 id="titulo-detalle">{seleccionado.carrera || seleccionado.facultad || seleccionado.cargo}</h2><p className="descripcion">Cómputo parcial de ejemplo · {estamento === 'estudiantes' ? 'Voto estudiantil' : 'Voto docente'}</p>
        <BarrasCandidaturas candidaturas={datosDetalle.candidaturas} />
        <dl className="desglose-votos"><div><dt>Votos válidos</dt><dd>{formatearNumero(datosDetalle.validos)}</dd></div><div><dt>Votos blancos</dt><dd>{formatearNumero(seleccionado.blancos[estamento])}</dd></div><div><dt>Votos nulos</dt><dd>{formatearNumero(seleccionado.nulos[estamento])}</dd></div><div><dt>Total emitido</dt><dd>{formatearNumero(datosDetalle.validos + seleccionado.blancos[estamento] + seleccionado.nulos[estamento])}</dd></div></dl>
        <div className="detalle-actas"><Icono nombre="documento" /><div><strong>{seleccionado.actas} de {seleccionado.actasEsperadas} actas de ejemplo</strong><p>{formatearPorcentaje(datosDetalle.avance)} de avance. No hay documentos oficiales adjuntos a esta demostración.</p></div></div>
        <p className="nota-detalle">Porcentaje = votos de la candidatura ÷ votos válidos de este estamento × 100. Blancos y nulos se muestran aparte. Una ventaja parcial no equivale a una proclamación.</p>
        <button className="boton primario cerrar-detalle" onClick={() => dialogo.current.close()}>Volver a resultados</button>
      </div>}
    </dialog>
  </>;
}
