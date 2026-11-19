import React, { useEffect, useRef, useState } from 'react';
import { obtenerSesion, iniciarSesion, finalizarSesion, seleccionarOrganizacion, establecerOrganizacion } from '../api/clienteSesion.js';
import { IconoTuvoto, IconoUsuario, IconoSalir } from './Iconos.jsx';

export default function Sesion({ children }) {
  const revision = useRef(0);
  const operando = useRef(false);
  const [sesion, cambiarSesion] = useState(null);
  const [cargando, cambiarCargando] = useState(true);
  const [ocupado, cambiarOcupado] = useState(false);
  const [error, cambiarError] = useState('');
  const [usuario, cambiarUsuario] = useState('');
  const [contrasena, cambiarContrasena] = useState('');

  function aceptar(datos) {
    establecerOrganizacion(datos?.idOrganizacion);
    cambiarSesion(datos);
  }

  useEffect(() => {
    let vigente = true, enCurso = false;
    const caducar = () => { ++revision.current; aceptar(null); cambiarError('La sesión terminó. Inicia sesión de nuevo.'); };
    const revisar = async () => {
      if (enCurso || operando.current) return;
      enCurso = true; const actual = ++revision.current;
      try { const datos = await obtenerSesion(); if (vigente && actual === revision.current) aceptar(datos); }
      catch (fallo) { if (vigente && actual === revision.current) cambiarError(fallo.estado === 401 ? '' : fallo.message); }
      finally { enCurso = false; if (vigente) cambiarCargando(false); }
    };
    const alMostrar = () => { if (document.visibilityState === 'visible') revisar(); };
    window.addEventListener('tuvoto:sesion-caducada', caducar);
    window.addEventListener('tuvoto:comprobar-sesion', revisar);
    window.addEventListener('focus', revisar);
    document.addEventListener('visibilitychange', alMostrar);
    revisar();
    return () => {
      vigente = false;
      window.removeEventListener('tuvoto:sesion-caducada', caducar);
      window.removeEventListener('tuvoto:comprobar-sesion', revisar);
      window.removeEventListener('focus', revisar);
      document.removeEventListener('visibilitychange', alMostrar);
    };
  }, []);

  async function ejecutar(operacion) {
    const actual = ++revision.current; operando.current = true;
    cambiarOcupado(true); cambiarError('');
    try { const datos = await operacion(); if (actual === revision.current) aceptar(datos); }
    catch (fallo) { if (actual === revision.current) cambiarError(fallo.message); }
    finally { operando.current = false; cambiarOcupado(false); }
  }

  if (cargando) {
    return (
      <main className="acceso" role="status">
        <div className="formulario-acceso-tuvoto" style={{ textAlign: 'center' }}>
          <p>Restaurando sesión…</p>
        </div>
      </main>
    );
  }

  if (!sesion) {
    return (
      <main className="acceso">
        <form className="formulario-acceso-tuvoto" onSubmit={evento => {
          evento.preventDefault(); const clave = contrasena; cambiarContrasena('');
          ejecutar(() => iniciarSesion(usuario, clave));
        }}>
          <div className="cabecera-login">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <IconoTuvoto tamano={44} />
            </div>
            <h1>TUVOTO</h1>
            <p>Acceso del personal electoral y auditoría</p>
          </div>
          <div className="formulario-simple">
            <label htmlFor="usuario">
              Usuario
              <input id="usuario" autoComplete="username" value={usuario} onChange={e => cambiarUsuario(e.target.value)} required disabled={ocupado} />
            </label>
            <label htmlFor="contrasena">
              Contraseña
              <input id="contrasena" type="password" autoComplete="current-password" value={contrasena} onChange={e => cambiarContrasena(e.target.value)} required disabled={ocupado} />
            </label>
          </div>
          {error && <p className="aviso" role="alert">{error}</p>}
          <button className="boton primario" disabled={ocupado} style={{ width: '100%', marginTop: 8 }}>
            {ocupado ? 'Verificando…' : 'Entrar al sistema'}
          </button>
          <a href="#resultados" className="enlace-volver-publico">← Volver a resultados públicos</a>
        </form>
      </main>
    );
  }

  return children({
    sesion,
    ocupado,
    error,
    salir: () => ejecutar(async () => { await finalizarSesion(); return null; }),
    seleccionar: id => ejecutar(() => seleccionarOrganizacion(id)),
  });
}

export function ControlesSesion({ sesion, ocupado, salir, seleccionar, subtituloRol }) {
  const organizaciones = [...new Set(sesion.roles.map(r => r.idOrganizacion).filter(Boolean))];
  return (
    <div className="perfil-usuario-privado">
      <div className="insignia-usuario-actual">
        <IconoUsuario tamano={16} />
        <span>{subtituloRol ? `${subtituloRol} · ${sesion.usuario}` : sesion.usuario}</span>
      </div>
      {organizaciones.length > 0 && (
        <select
          aria-label="Organización"
          value={sesion.idOrganizacion ?? ''}
          disabled={ocupado}
          onChange={e => seleccionar(e.target.value)}
          className="selector-unidades-publico"
        >
          <option value="" disabled>Selecciona organización</option>
          {organizaciones.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      )}
      <div className="separador-perfil" />
      <button className="boton-cerrar-sesion" disabled={ocupado} onClick={salir}>
        <IconoSalir tamano={14} />
        <span>Cerrar sesión</span>
      </button>
    </div>
  );
}
