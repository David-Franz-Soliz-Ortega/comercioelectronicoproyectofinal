import React from 'react';
export default function Icono({ nombre, ...propiedades }) {
  const trazos = {
    inicio: <><path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/></>,
    resultados: <><path d="M4 21h17M7 17v-6M12 17V5M17 17V9"/></>,
    urna: <><path d="m8 9 4-6 5 4-4 6-5-4Z"/><path d="M5 12H3v8h18v-8h-4M8 15h8"/></>,
    personas: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 4v2"/></>,
    lista: <><rect x="5" y="4" width="15" height="17" rx="2"/><path d="M9 4V2h7v2M9 10h7M9 14h7M9 18h4"/></>,
    actualizar: <><path d="M20 8a8 8 0 1 0 0 9M20 3v5h-5"/></>,
    mas: <path d="M12 5v14M5 12h14"/>,
    flecha: <path d="m9 6 6 6-6 6"/>,
    buscar: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
    marca: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...propiedades}>{trazos[nombre]}</svg>;
}
