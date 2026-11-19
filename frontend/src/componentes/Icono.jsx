import React from 'react';

const trazos = {
  urna: <><path d="m8 8 4-5 5 4-4 5-5-4Z" /><path d="M5 12H3v9h18v-9h-4M8 15h8" /></>,
  resultados: <><path d="M4 20h16M7 16v-5m5 5V4m5 12V8" /></>,
  personas: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 4v2" /></>,
  lista: <><rect x="5" y="4" width="15" height="17" rx="2" /><path d="M9 4V2h7v2M9 10h7M9 14h7M9 18h4" /></>,
  edificio: <><path d="m3 8 9-5 9 5H3Zm1 13h16M6 11v7m6-7v7m6-7v7" /></>,
  carrera: <><path d="m2 8 10-5 10 5-10 5L2 8Zm4 3v6c4 3 8 3 12 0v-6m4-3v8" /></>,
  buscar: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
  filtros: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="currentColor" /><circle cx="15" cy="17" r="2" fill="currentColor" /></>,
  actualizar: <><path d="M20 8a8 8 0 1 0 0 9M20 3v5h-5" /></>,
  mas: <path d="M12 5v14M5 12h14" />,
  flecha: <path d="m9 6 6 6-6 6" />,
  marca: <path d="m5 12 4 4L19 6" />,
  reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  escudo: <><path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  informacion: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></>,
  cerrar: <path d="m6 6 12 12M6 18 18 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  documento: <><path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8m-8 4h5" /></>,
  enlace: <><path d="M14 3h7v7m0-7L11 13M10 3H3v18h18v-7" /></>,
};

export default function Icono({ nombre, ...propiedades }) {
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...propiedades}>{trazos[nombre] ?? trazos.urna}</svg>;
}
