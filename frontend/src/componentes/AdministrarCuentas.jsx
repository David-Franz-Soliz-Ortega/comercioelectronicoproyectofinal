import React, { useState } from 'react';
import { solicitarRest } from '../api/clienteRest.js';

const rolesAsignables = ['ADMINISTRADOR', 'OPERADOR', 'AUDITOR'];
export default function AdministrarCuentas({ organizaciones, cuentas, idActual, alGuardar, esGlobal = true }) {
  const [accion, cambiarAccion] = useState(esGlobal ? 'organizacion' : 'usuario');
  const [nombre, cambiarNombre] = useState(''); const [organizacion, cambiarOrganizacion] = useState('');
  const [usuario, cambiarUsuario] = useState(''); const [clave, cambiarClave] = useState('');
  const [rol, cambiarRol] = useState(esGlobal ? 'ADMINISTRADOR' : 'OPERADOR'); const [cuenta, cambiarCuenta] = useState('');
  const [activa, cambiarActiva] = useState(true); const [ocupado, cambiarOcupado] = useState(false);
  const [error, cambiarError] = useState(''); const [mensaje, cambiarMensaje] = useState('');
  async function guardar(evento) {
    evento.preventDefault(); if (ocupado) return;
    cambiarOcupado(true); cambiarError(''); cambiarMensaje('');
    const contrasena = clave; cambiarClave('');
    try {
      if (accion === 'organizacion') await solicitarRest('/organizaciones', { metodo: 'POST', datos: { nombre: nombre.trim() } });
      else if (accion === 'editar-organizacion') await solicitarRest('/organizaciones/' + encodeURIComponent(organizacion), { metodo: 'PUT', datos: { nombre: nombre.trim(), activa } });
      else if (accion === 'usuario') await solicitarRest('/usuarios', { metodo: 'POST', datos: { usuario, contrasena, idOrganizacion: organizacion, rol } });
      else await solicitarRest('/usuarios/' + encodeURIComponent(cuenta) + '/roles', { metodo: 'POST', datos: { idOrganizacion: organizacion, rol, revocar: accion === 'revocar' } });
      cambiarMensaje('Operación confirmada por identidad.'); cambiarNombre(''); cambiarUsuario(''); alGuardar();
    } catch (fallo) { cambiarError(fallo.message); }
    finally { cambiarOcupado(false); }
  }
  return <section className="panel" aria-labelledby="titulo-administracion"><div className="titulo-panel"><div><h2 id="titulo-administracion">Administración de cuentas y organizaciones</h2><p>Administración autorizada. Cada operación se valida en identidad; no concede permisos electorales al administrador global.</p></div></div>
    <form className="formulario-creacion" onSubmit={guardar}>
      <label htmlFor="accion-admin">Operación</label><select id="accion-admin" disabled={ocupado} value={accion} onChange={e => { cambiarAccion(e.target.value); cambiarError(''); cambiarMensaje(''); cambiarClave(''); cambiarOrganizacion(''); cambiarCuenta(''); cambiarNombre(''); }}>{esGlobal && <><option value="organizacion">Crear organización</option><option value="editar-organizacion">Editar organización</option></>}<option value="usuario">Crear cuenta</option><option value="asignar">Asignar rol</option><option value="revocar">Revocar rol</option></select>
      {accion !== 'organizacion' && <><label htmlFor="organizacion-admin">Organización</label><select id="organizacion-admin" required value={organizacion} disabled={ocupado} onChange={e => { cambiarOrganizacion(e.target.value); const org = organizaciones.find(o => o.idOrganizacion === e.target.value); if (accion === 'editar-organizacion' && org) { cambiarNombre(org.nombre); cambiarActiva(org.activa); } }}><option value="">Selecciona organización autorizada</option>{organizaciones.filter(org => accion === 'editar-organizacion' || org.activa).map(org => <option key={org.idOrganizacion} value={org.idOrganizacion}>{org.nombre}</option>)}</select></>}
      {(accion === 'organizacion' || accion === 'editar-organizacion') && <><label htmlFor="nombre-organizacion">Nombre de organización</label><input id="nombre-organizacion" required maxLength="120" value={nombre} disabled={ocupado} onChange={e => cambiarNombre(e.target.value)} />{accion === 'editar-organizacion' && <label><input type="checkbox" checked={activa} disabled={ocupado} onChange={e => cambiarActiva(e.target.checked)} />Organización activa</label>}</>}
      {accion === 'usuario' && <><label htmlFor="usuario-admin">Nuevo usuario</label><input id="usuario-admin" required minLength="3" maxLength="80" autoComplete="off" value={usuario} disabled={ocupado} onChange={e => cambiarUsuario(e.target.value)} /><label htmlFor="clave-admin">Contraseña privada (12 a 72 bytes UTF-8)</label><input id="clave-admin" type="password" required minLength="12" autoComplete="new-password" value={clave} disabled={ocupado} onChange={e => cambiarClave(e.target.value)} /></>}
      {(accion === 'asignar' || accion === 'revocar') && <><label htmlFor="cuenta-admin">Cuenta (máximo 100 devueltas por identidad)</label><select id="cuenta-admin" required value={cuenta} disabled={ocupado} onChange={e => cambiarCuenta(e.target.value)}><option value="">Selecciona cuenta</option>{cuentas.filter(c => c.idUsuario !== idActual && c.activo).map(c => <option key={c.idUsuario} value={c.idUsuario}>{c.usuario}</option>)}</select><p className="nota-alcance">La asignación o revocación se valida en identidad. No se permite modificar los roles de tu propia cuenta.</p></>}
      {['usuario', 'asignar', 'revocar'].includes(accion) && <><label htmlFor="rol-admin">Rol solicitado en la organización</label><select id="rol-admin" value={rol} disabled={ocupado} onChange={e => cambiarRol(e.target.value)}>{rolesAsignables.filter(r => esGlobal || r !== 'ADMINISTRADOR').map(r => <option key={r} value={r}>{{ADMINISTRADOR:'Administrador',OPERADOR:'Operador de actas',AUDITOR:'Auditor'}[r]}</option>)}</select></>}
      {error && <p className="aviso" role="alert">{error}</p>}{mensaje && <p className="confirmacion" role="status">{mensaje}</p>}
      <button className="boton primario" disabled={ocupado}>{ocupado ? 'Procesando…' : accion === 'revocar' ? 'Confirmar revocación' : 'Guardar'}</button>
    </form>
  </section>;
}
