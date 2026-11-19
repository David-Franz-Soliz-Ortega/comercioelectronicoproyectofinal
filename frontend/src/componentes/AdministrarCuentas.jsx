import React, { useState } from 'react';
import { solicitarRest } from '../api/clienteRest.js';
import { IconoUsuario } from './Iconos.jsx';

const rolesAsignables = ['ADMINISTRADOR', 'OPERADOR', 'AUDITOR'];

export default function AdministrarCuentas({ organizaciones, cuentas, idActual, alGuardar, esGlobal = true, organizacionInicial = '', accionInicial, rolInicial = 'OPERADOR', alCrearOrganizacion }) {
  const [accion, cambiarAccion] = useState(accionInicial ?? (organizacionInicial ? 'usuario' : esGlobal ? 'organizacion' : 'usuario'));
  const [nombre, cambiarNombre] = useState('');
  const [organizacion, cambiarOrganizacion] = useState(organizacionInicial);
  const [usuario, cambiarUsuario] = useState('');
  const [clave, cambiarClave] = useState('');
  const [mostrarClave, cambiarMostrarClave] = useState(false);
  const [rol, cambiarRol] = useState(rolInicial);
  const [cuenta, cambiarCuenta] = useState('');
  const [activa, cambiarActiva] = useState(true);
  const [ocupado, cambiarOcupado] = useState(false);
  const [error, cambiarError] = useState('');
  const [mensaje, cambiarMensaje] = useState('');

  async function guardar(evento) {
    evento.preventDefault();
    if (ocupado) return;
    cambiarOcupado(true);
    cambiarError('');
    cambiarMensaje('');
    const contrasena = clave;
    cambiarClave('');
    cambiarMostrarClave(false);
    try {
      if (accion === 'organizacion') {
        const creada = await solicitarRest('/organizaciones', { metodo: 'POST', datos: { nombre: nombre.trim() } });
        alCrearOrganizacion?.(creada);
      } else if (accion === 'editar-organizacion') {
        await solicitarRest('/organizaciones/' + encodeURIComponent(organizacion), { metodo: 'PUT', datos: { nombre: nombre.trim(), activa } });
      } else if (accion === 'usuario') {
        await solicitarRest('/usuarios', { metodo: 'POST', datos: { usuario, contrasena, idOrganizacion: organizacion, rol } });
      } else {
        await solicitarRest('/usuarios/' + encodeURIComponent(cuenta) + '/roles', { metodo: 'POST', datos: { idOrganizacion: organizacion, rol, revocar: accion === 'revocar' } });
      }
      cambiarMensaje(accion === 'usuario' ? 'Cuenta creada. Si es operador, continúa asignándole sus mesas.' : accion === 'revocar' ? 'Rol revocado correctamente.' : 'Cambios guardados correctamente.');
      cambiarNombre('');
      cambiarUsuario('');
      alGuardar();
    } catch (fallo) {
      cambiarError(fallo.message);
    } finally {
      cambiarOcupado(false);
    }
  }

  return (
    <section className="panel-admin" aria-labelledby="titulo-administracion">
      <div className="cabecera-panel-admin">
        <h3 id="titulo-administracion">
          <IconoUsuario tamano={18} color="var(--azul-principal)" />
          <span>Administración de cuentas y organizaciones</span>
        </h3>
      </div>

      <div style={{ padding: 24 }}>
        <p style={{ margin: '0 0 20px', color: 'var(--secundario)', fontSize: 13 }}>
          Crea una cuenta por persona. Elige Operador de actas para quienes registrarán las mesas; Auditor permite consultar sin modificar.
        </p>

        <form className="formulario-simple" onSubmit={guardar}>
          <label htmlFor="accion-admin">
            Operación a realizar
            <select
              id="accion-admin"
              disabled={ocupado}
              value={accion}
              onChange={e => {
                cambiarAccion(e.target.value);
                cambiarError('');
                cambiarMensaje('');
                cambiarClave('');
                cambiarMostrarClave(false);
                cambiarOrganizacion(organizacionInicial);
                cambiarCuenta('');
                cambiarNombre('');
              }}
            >
              {esGlobal && (
                <>
                  <option value="organizacion">Crear organización</option>
                  <option value="editar-organizacion">Editar organización</option>
                </>
              )}
              <option value="usuario">Crear cuenta</option>
              <option value="asignar">Asignar rol</option>
              <option value="revocar">Revocar rol</option>
            </select>
          </label>

          {accion !== 'organizacion' && (
            <label htmlFor="organizacion-admin">
              Organización autorizada
              <select
                id="organizacion-admin"
                required
                value={organizacion}
                disabled={ocupado}
                onChange={e => {
                  cambiarOrganizacion(e.target.value);
                  const org = organizaciones.find(o => o.idOrganizacion === e.target.value);
                  if (accion === 'editar-organizacion' && org) {
                    cambiarNombre(org.nombre);
                    cambiarActiva(org.activa);
                  }
                }}
              >
                <option value="">Selecciona organización autorizada</option>
                {organizaciones
                  .filter(org => accion === 'editar-organizacion' || org.activa)
                  .map(org => (
                    <option key={org.idOrganizacion} value={org.idOrganizacion}>{org.nombre}</option>
                  ))}
              </select>
            </label>
          )}

          {(accion === 'organizacion' || accion === 'editar-organizacion') && (
            <>
              <label htmlFor="nombre-organizacion">
                Nombre de la organización
                <input
                  id="nombre-organizacion"
                  required
                  maxLength="120"
                  value={nombre}
                  disabled={ocupado}
                  onChange={e => cambiarNombre(e.target.value)}
                />
              </label>
              {accion === 'editar-organizacion' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={activa}
                    disabled={ocupado}
                    onChange={e => cambiarActiva(e.target.checked)}
                  />
                  <span>Organización activa</span>
                </label>
              )}
            </>
          )}

          {accion === 'usuario' && (
            <>
              <label htmlFor="usuario-admin">
                Nombre de usuario
                <input
                  id="usuario-admin"
                  required
                  minLength="3"
                  maxLength="80"
                  autoComplete="off"
                  value={usuario}
                  disabled={ocupado}
                  onChange={e => cambiarUsuario(e.target.value)}
                />
              </label>
              <div className="campo-clave-admin">
                <label htmlFor="clave-admin">Contraseña privada (12 a 72 bytes UTF-8)</label>
                <div className="entrada-clave-admin">
                  <input
                    id="clave-admin"
                    type={mostrarClave ? 'text' : 'password'}
                    required
                    minLength="12"
                    autoComplete="new-password"
                    value={clave}
                    disabled={ocupado}
                    onChange={e => cambiarClave(e.target.value)}
                  />
                  <button
                    type="button"
                    className="boton secundario"
                    aria-label={mostrarClave ? 'Ocultar contraseña de la nueva cuenta' : 'Mostrar contraseña de la nueva cuenta'}
                    aria-controls="clave-admin"
                    aria-pressed={mostrarClave}
                    disabled={ocupado}
                    onClick={() => cambiarMostrarClave(anterior => !anterior)}
                  >
                    {mostrarClave ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>
            </>
          )}

          {(accion === 'asignar' || accion === 'revocar') && (
            <>
              <label htmlFor="cuenta-admin">
                Cuenta (máximo 100 devueltas por identidad)
                <select
                  id="cuenta-admin"
                  required
                  value={cuenta}
                  disabled={ocupado}
                  onChange={e => cambiarCuenta(e.target.value)}
                >
                  <option value="">Selecciona cuenta</option>
                  {cuentas
                    .filter(c => c.idUsuario !== idActual && c.activo)
                    .map(c => (
                      <option key={c.idUsuario} value={c.idUsuario}>{c.usuario}</option>
                    ))}
                </select>
              </label>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--secundario)' }}>
                La asignación o revocación se valida en identidad. No se permite modificar los roles de tu propia cuenta.
              </p>
            </>
          )}

          {['usuario', 'asignar', 'revocar'].includes(accion) && (
            <label htmlFor="rol-admin">
              Rol en la organización
              <select
                id="rol-admin"
                value={rol}
                disabled={ocupado}
                onChange={e => cambiarRol(e.target.value)}
              >
                {rolesAsignables
                  .filter(r => esGlobal || r !== 'ADMINISTRADOR')
                  .map(r => (
                    <option key={r} value={r}>
                      {{ ADMINISTRADOR: 'Administrador', OPERADOR: 'Operador de actas', AUDITOR: 'Auditor' }[r]}
                    </option>
                  ))}
              </select>
            </label>
          )}

          {error && <div className="aviso" role="alert">{error}</div>}
          {mensaje && <div className="confirmacion" role="status">{mensaje}</div>}

          <button className="boton primario" disabled={ocupado} style={{ width: 'fit-content', marginTop: 12 }}>
            {ocupado ? 'Procesando…' : accion === 'revocar' ? 'Confirmar revocación' : 'Guardar'}
          </button>
        </form>
      </div>
    </section>
  );
}
