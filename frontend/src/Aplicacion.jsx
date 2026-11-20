import React, { lazy, Suspense, useEffect, useState } from 'react';
import PortalPublico from './paginas/PortalPublico.jsx';
const AccesoPrivado = lazy(() => import('./paginas/PanelPrivado.jsx'));

export default function Aplicacion() {
  const [panel, cambiarPanel] = useState(location.hash === '#panel');
  useEffect(() => {
    const escuchar = () => cambiarPanel(location.hash === '#panel');
    window.addEventListener('hashchange', escuchar);
    return () => window.removeEventListener('hashchange', escuchar);
  }, []);
  return panel ? <Suspense fallback={<main className="acceso" role="status">Cargando acceso del personal…</main>}><AccesoPrivado /></Suspense> : <PortalPublico />;
}
