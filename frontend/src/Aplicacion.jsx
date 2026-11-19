import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import Icono from './componentes/Icono.jsx';
import UrnaAnimada from './componentes/UrnaAnimada.jsx';

const Resultados = lazy(() => import('./Resultados.jsx'));
const Gestion = lazy(() => import('./Gestion.jsx'));
const Guia = lazy(() => import('./Guia.jsx'));
const secciones = {
  resultados: { titulo: 'Resultados', icono: 'resultados' },
  guia: { titulo: 'Cómo funciona', icono: 'informacion' },
  elecciones: { titulo: 'Elecciones', icono: 'urna' },
  candidaturas: { titulo: 'Candidaturas', icono: 'personas' },
  padron: { titulo: 'Padrón electoral', icono: 'lista' },
};
const obtenerSeccion = () => Object.hasOwn(secciones, location.hash.slice(1)) ? location.hash.slice(1) : 'resultados';

export default function Aplicacion() {
  const [seccion, cambiarSeccion] = useState(obtenerSeccion);
  const [menuAbierto, cambiarMenuAbierto] = useState(false);
  const [animacionesPausadas, cambiarAnimacionesPausadas] = useState(false);
  const [mensajeGestion, cambiarMensajeGestion] = useState('');
  const contenido = useRef(null);
  const botonMenu = useRef(null);
  useEffect(() => {
    const escuchar = () => {
      if (location.hash === '#contenido') return;
      cambiarSeccion(obtenerSeccion()); cambiarMenuAbierto(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
      contenido.current?.focus({ preventScroll: true });
    };
    window.addEventListener('hashchange', escuchar);
    return () => window.removeEventListener('hashchange', escuchar);
  }, []);
  useEffect(() => { document.title = `${secciones[seccion].titulo} · SIGAPE`; }, [seccion]);
  useEffect(() => {
    if (!menuAbierto) return;
    const cerrarConEscape = evento => { if (evento.key === 'Escape') { cambiarMenuAbierto(false); botonMenu.current?.focus(); } };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [menuAbierto]);
  function navegar(destino) { cambiarMenuAbierto(false); if (seccion !== destino) location.hash = destino; }
  function enlace(clave) { return <button key={clave} className={`enlace-menu ${seccion === clave ? 'activo' : ''}`} aria-current={seccion === clave ? 'page' : undefined} onClick={() => navegar(clave)}><Icono nombre={secciones[clave].icono} />{secciones[clave].titulo}{seccion === clave && <span className="indicador-menu" />}</button>; }

  return <div className={`aplicacion ${animacionesPausadas ? 'animaciones-pausadas' : ''}`}>
    <a className="saltar" href="#contenido">Ir al contenido</a>
    <aside className={`barra-lateral ${menuAbierto ? 'menu-abierto' : ''}`}>
      <div className="cabecera-marca"><a className="marca" href="#resultados" aria-label="SIGAPE, inicio"><span className="marca-simbolo"><Icono nombre="urna" width="26" height="26" /></span><span>SIGAPE<small>Observatorio electoral</small></span></a><button ref={botonMenu} className="boton-menu" aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuAbierto} aria-controls="navegacion-principal" onClick={() => cambiarMenuAbierto(valor => !valor)}><Icono nombre={menuAbierto ? 'cerrar' : 'menu'} /></button></div>
      <div className="contenido-lateral" id="navegacion-principal"><div className="contexto-universidad"><span className="monograma-usfx">U</span><div><strong>Comunidad USFX</strong><span>Sucre, Bolivia</span></div></div>
        <nav aria-label="Secciones principales"><p className="etiqueta-menu">OBSERVATORIO</p>{['resultados', 'guia'].map(enlace)}<p className="etiqueta-menu etiqueta-gestion">GESTIÓN ACADÉMICA</p>{['elecciones', 'candidaturas', 'padron'].map(enlace)}</nav>
        <div className="nota-lateral"><span className="icono-nota"><Icono nombre="escudo" width="24" height="24" /></span><strong>Tu comunidad.<br />Tus elecciones.</strong><p>La información nos acerca a nuestra universidad.</p><span className="version-proyecto">PROYECTO ACADÉMICO · COM-600</span></div>
        <div className="pie-lateral"><span className="avatar-comunidad"><Icono nombre="carrera" width="18" height="18" /></span><div>Hecho en la universidad<small>Para nuestra comunidad</small></div></div>
      </div>
    </aside>
    <div className="zona-principal"><header className="cabecera"><span className="migas">Portal universitario <span className="miga">/</span> <strong>{secciones[seccion].titulo}</strong></span><div className="acciones-cabecera"><button className="control-animacion" aria-pressed={animacionesPausadas} onClick={() => cambiarAnimacionesPausadas(valor => !valor)} aria-label={animacionesPausadas ? 'Reanudar animaciones' : 'Pausar animaciones'} title={animacionesPausadas ? 'Reanudar animaciones' : 'Pausar animaciones'}>{animacionesPausadas ? <span aria-hidden="true">▷</span> : <span aria-hidden="true">Ⅱ</span>}<span className="texto-animacion">Animaciones</span></button><span className="insignia-academica">Proyecto académico</span><span className="sello-usfx">USFX</span></div></header>
      <main ref={contenido} id="contenido" tabIndex="-1"><Suspense fallback={<div className="estado-listado carga-pagina" role="status"><UrnaAnimada compacta /><strong>Preparando tu observatorio…</strong></div>}>
        {seccion === 'resultados' ? <Resultados navegar={navegar} /> : seccion === 'guia' ? <Guia navegar={navegar} /> : <Gestion key={seccion} seccion={seccion} navegar={navegar} mensaje={mensajeGestion} cambiarMensaje={cambiarMensajeGestion} />}
      </Suspense><footer className="pie-aplicacion"><span><strong>SIGAPE</strong> <span>·</span> Observatorio electoral universitario</span><span>Proyecto independiente · No es un portal oficial de la USFX</span></footer></main>
    </div>
  </div>;
}
