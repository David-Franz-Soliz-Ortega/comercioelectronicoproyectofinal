import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmacionGlobal() {
 const [mensaje, setMensaje] = useState('');
 const dialogo = useRef(null);
 useEffect(() => {
  const recibir = e => { if (typeof e.detail === 'string' && e.detail.trim()) setMensaje(e.detail); };
  window.addEventListener('tuvoto:operacion-confirmada', recibir);
  return () => window.removeEventListener('tuvoto:operacion-confirmada', recibir);
 }, []);
 useEffect(() => {
  if (!mensaje) return;
  const elemento = dialogo.current;
  const anterior = document.body.style.overflow;
  const focoAnterior = document.activeElement;
  document.body.style.overflow = 'hidden';
  if (!elemento.open) elemento.showModal();
  return () => {
   elemento.close();
   document.body.style.overflow = anterior;
   if (focoAnterior?.isConnected && typeof focoAnterior.focus === 'function') focoAnterior.focus({ preventScroll: true });
  };
 }, [mensaje]);
 if (!mensaje) return null;
 const cerrar = () => setMensaje('');
 return createPortal(<dialog ref={dialogo} className="modal-confirmacion-global" aria-modal="true" aria-labelledby="titulo-confirmacion-global" aria-describedby="mensaje-confirmacion-global" onClick={cerrar} onCancel={e => { e.preventDefault(); cerrar(); }}>
  <span className="icono-confirmacion-global" aria-hidden="true">✓</span>
  <h2 id="titulo-confirmacion-global">Operación completada</h2>
  <p id="mensaje-confirmacion-global" className="confirmacion" role="status">{mensaje}</p>
  <button type="button" autoFocus onClick={cerrar}>Entendido</button>
  <small>Toca cualquier parte para cerrar</small>
 </dialog>, document.body);
}
