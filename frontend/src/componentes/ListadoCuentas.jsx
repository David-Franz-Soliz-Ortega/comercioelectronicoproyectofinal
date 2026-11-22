import React from 'react';

import {nombresRol} from '../api/catalogos.js';

export default function ListadoCuentas({ cuentas, organizaciones, idActual, cargando, error, ocupado, alReintentar, alRevocar }) {
  const administradores=cuentas.filter(c=>c.roles?.some(r=>r.rol==='ADMINISTRADOR'));
  if (cargando) return <p role="status">Cargando administradores…</p>;
  if (error) return <div role="alert" className="aviso">{error} <button type="button" className="boton secundario" onClick={alReintentar}>Reintentar listado</button></div>;
  if (!administradores.length) return <p>No hay administradores disponibles con tus permisos actuales.</p>;
  return <div className="tabla-preparacion-scroll"><table className="tabla-admin">
    <thead><tr><th>Usuario</th><th>Tipo de administración</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>{administradores.map(c => <tr key={c.idUsuario}>
      <td><strong>{c.usuario}</strong></td>
      <td>{c.roles?.some(r => r.rol === 'ADMINISTRADOR' && r.idOrganizacion === null) ? 'Administrador global · Todo el sistema' : 'Administrador'}</td>
      <td><span className={`insignia-estado ${c.activo ? 'activo' : 'inactivo'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>{c.idUsuario === idActual ? <span>Cuenta actual</span> : c.roles?.some(r => r.rol === 'ADMINISTRADOR') ? <button type="button" className="boton secundario" disabled={ocupado} onClick={() => alRevocar(c)}>Revocar administrador</button> : '—'}</td>
    </tr>)}</tbody>
  </table></div>;
}
