import React, { useState } from 'react';

export default function ConfirmarEliminacion({ nombre, ocupado, alConfirmar, etiqueta = 'Eliminar', descripcion = 'Se retirará del catálogo activo. Se conserva su historial.' }) {
  const [abierto, setAbierto] = useState(false), [confirmado, setConfirmado] = useState(false);
  return <div className="control-eliminacion">
    <button type="button" className="boton boton-peligro" disabled={ocupado} aria-expanded={abierto} onClick={() => { setAbierto(!abierto); setConfirmado(false); }}>{etiqueta}</button>
    {abierto && <div className="confirmar-eliminacion" role="group" aria-label={`Confirmar eliminación: ${nombre}`}>
      <strong>{nombre}</strong><p>{descripcion}</p>
      <label><input type="checkbox" checked={confirmado} disabled={ocupado} onChange={e => setConfirmado(e.target.checked)} />Confirmo que quiero retirarlo.</label>
      <div><button type="button" className="boton boton-peligro confirmar-retirada" disabled={ocupado || !confirmado} onClick={async () => { await alConfirmar(); setAbierto(false); }}>Confirmar eliminación</button><button type="button" className="boton secundario" disabled={ocupado} onClick={() => setAbierto(false)}>Cancelar</button></div>
    </div>}
  </div>;
}
