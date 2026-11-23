import React, { useEffect, useId, useRef } from 'react';

export default function ModalFormulario({ abierto = true, titulo, ocupado = false, alCerrar, cerrarAbajo = false, children }) {
 const dialogo = useRef(null), id = useId(), cerrar = useRef(alCerrar);
 cerrar.current = alCerrar;
 useEffect(() => {
  if (!abierto) return;
  const elemento = dialogo.current, foco = document.activeElement;
  if (elemento && !elemento.open) {
   try { elemento.showModal(); } catch (_) {}
  }
  return () => {
   if (elemento?.open) {
    try { elemento.close(); } catch (_) {}
   }
   if (foco?.isConnected) foco.focus({ preventScroll: true });
  };
 }, [abierto]);
 if (!abierto) return null;
 return <dialog ref={dialogo} className="modal-formulario" aria-labelledby={id} aria-modal="true"
  onCancel={e => { e.preventDefault(); if (!ocupado) cerrar.current(); }}
  onClick={e => { if (e.target !== e.currentTarget || ocupado) return; const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) cerrar.current(); }}>
  <header className="cabecera-modal-formulario"><h2 id={id}>{titulo}</h2>{!cerrarAbajo&&<button type="button" className="boton secundario" aria-label="Cerrar formulario" disabled={ocupado} onClick={alCerrar}>Cerrar</button>}</header>
  {children}
 </dialog>;
}
