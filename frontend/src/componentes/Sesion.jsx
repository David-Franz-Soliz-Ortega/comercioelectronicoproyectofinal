import React, { useEffect, useState } from 'react';
import { obtenerSesion, iniciarSesion, finalizarSesion, seleccionarOrganizacion, establecerOrganizacion } from '../api/clienteSesion.js';

export default function Sesion({ children }) {
  const [sesion, cambiarSesion] = useState(null);
  const [cargando, cambiarCargando] = useState(true);
  const [ocupado, cambiarOcupado] = useState(false);
  const [error, cambiarError] = useState('');
  const [usuario, cambiarUsuario] = useState('');
  const [contrasena, cambiarContrasena] = useState('');
  function aceptar(datos) { establecerOrganizacion(datos?.idOrganizacion); cambiarSesion(datos); }
  useEffect(() => {
    let vigente = true;
    const caducar = () => { aceptar(null); cambiarError('La sesión terminó. Inicia sesión de nuevo.'); };
    window.addEventListener('sigape:sesion-caducada', caducar);
    obtenerSesion().then(datos => { if (vigente) aceptar(datos); })
      .catch(fallo => { if (vigente) cambiarError(fallo.estado === 401 ? '' : fallo.message); })
      .finally(() => { if (vigente) cambiarCargando(false); });
    return () => { vigente = false; window.removeEventListener('sigape:sesion-caducada', caducar); };
  }, []);
  async function ejecutar(operacion) {
    cambiarOcupado(true); cambiarError('');
    try { aceptar(await operacion()); } catch (fallo) { cambiarError(fallo.message); }
    finally { cambiarOcupado(false); }
  }
  if (cargando) return <main className="acceso" role="status">Restaurando sesión…</main>;
  if (!sesion) return <main className="acceso"><form className="panel formulario-acceso" onSubmit={evento => {
    evento.preventDefault(); const clave = contrasena; cambiarContrasena('');
    ejecutar(() => iniciarSesion(usuario, clave));
  }}><p className="sobretitulo">SIGAPE · ENTORNO ACADÉMICO</p><h1>Iniciar sesión</h1>
    <label htmlFor="usuario">Usuario</label><input id="usuario" autoComplete="username" value={usuario} onChange={e => cambiarUsuario(e.target.value)} required disabled={ocupado} />
    <label htmlFor="contrasena">Contraseña</label><input id="contrasena" type="password" autoComplete="current-password" value={contrasena} onChange={e => cambiarContrasena(e.target.value)} required disabled={ocupado} />
    {error && <p className="aviso" role="alert">{error}</p>}
    <button className="boton primario" disabled={ocupado}>{ocupado ? 'Verificando…' : 'Entrar'}</button>
    <button className="boton secundario" type="button" disabled={ocupado} onClick={() => ejecutar(obtenerSesion)}>Reintentar sesión</button>
  </form></main>;
  return children({ sesion, ocupado, error,
    salir: () => ejecutar(async () => { await finalizarSesion(); return null; }),
    seleccionar: id => ejecutar(() => seleccionarOrganizacion(id)),
  });
}

export function ControlesSesion({ sesion, ocupado, salir, seleccionar }) {
  const organizaciones = [...new Set(sesion.roles.map(r => r.idOrganizacion).filter(Boolean))];
  return <div className="controles-sesion"><span>{sesion.usuario}</span>
    {organizaciones.length > 0 && <label>Organización<select aria-label="Organización" value={sesion.idOrganizacion ?? ''} disabled={ocupado} onChange={e => seleccionar(e.target.value)}>
      <option value="" disabled>Selecciona organización</option>{organizaciones.map(id => <option key={id} value={id}>{id}</option>)}
    </select></label>}
    <button className="boton secundario" disabled={ocupado} onClick={salir}>Cerrar sesión</button>
  </div>;
}
