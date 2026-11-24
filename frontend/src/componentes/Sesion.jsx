import React, { useEffect, useRef, useState } from 'react';
import { obtenerSesion, iniciarSesion, finalizarSesion, seleccionarOrganizacion, establecerOrganizacion } from '../api/clienteSesion.js';
import { IconoTuvoto, IconoUsuario, IconoSalir, IconoOjo, IconoOjoOculto, IconoAlerta } from './Iconos.jsx';

const LATIDO_SESION_MS = 5 * 60 * 1000;
const INACTIVIDAD_MS = 25 * 60 * 1000;

export default function Sesion({ children }) {
  const revision = useRef(0);
  const operando = useRef(false);
  const ultimaActividad = useRef(Date.now());
  const renovarSesion = useRef(() => {});
  const [sesion, cambiarSesion] = useState(null);
  const [cargando, cambiarCargando] = useState(true);
  const [ocupado, cambiarOcupado] = useState(false);
  const [error, cambiarError] = useState('');
  const [usuario, cambiarUsuario] = useState('');
  const [contrasena, cambiarContrasena] = useState('');
  const [mostrarContrasena, cambiarMostrarContrasena] = useState(false);
  const [temblando, cambiarTemblando] = useState(false);

  function aceptar(datos) {
    establecerOrganizacion(datos?.idOrganizacion);
    cambiarSesion(datos);
    cambiarMostrarContrasena(false);
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
    renovarSesion.current = revisar;
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

  useEffect(() => {
    if (!sesion) return;
    const registrar = () => { ultimaActividad.current = Date.now(); };
    const eventos = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    eventos.forEach(evento => window.addEventListener(evento, registrar, { passive: true }));
    const latido = window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - ultimaActividad.current < INACTIVIDAD_MS) renovarSesion.current();
    }, LATIDO_SESION_MS);
    return () => {
      eventos.forEach(evento => window.removeEventListener(evento, registrar));
      window.clearInterval(latido);
    };
  }, [sesion]);

  async function ejecutar(operacion) {
    const actual = ++revision.current; operando.current = true;
    cambiarOcupado(true); cambiarError('');
    try { const datos = await operacion(); if (actual === revision.current) aceptar(datos); }
    catch (fallo) { if (actual === revision.current) cambiarError(fallo.message); }
    finally { operando.current = false; cambiarOcupado(false); }
  }

  useEffect(() => {
    if (!error) { cambiarTemblando(false); return; }
    cambiarTemblando(false);
    const cuadro = window.requestAnimationFrame(() => {
      cambiarTemblando(true);
    });
    const temporizador = window.setTimeout(() => cambiarTemblando(false), 520);
    return () => {
      window.cancelAnimationFrame(cuadro);
      window.clearTimeout(temporizador);
    };
  }, [error]);

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
        <form className={`formulario-acceso-tuvoto${temblando ? ' acceso-con-error' : ''}`} onSubmit={evento => {
          evento.preventDefault(); const clave = contrasena; cambiarContrasena(''); cambiarMostrarContrasena(false);
          ejecutar(() => iniciarSesion(usuario, clave));
        }}>
          <div className="cabecera-login">
            <div className="simbolo-marca" style={{ margin: '0 auto 12px' }}>
              <IconoTuvoto tamano={28} />
            </div>
            <h1>TUVOTO<span className="punto-marca">.</span></h1>
            <p className="sobre-titulo-login">ACCESO DEL PERSONAL</p>
            <p className="subtitulo-login">Gestión electoral, actas y auditoría</p>
          </div>
          <div className="formulario-simple">
            <label htmlFor="usuario">
              Usuario
              <input id="usuario" autoComplete="username" value={usuario} onChange={e => { cambiarUsuario(e.target.value); if (error) cambiarError(''); }} required disabled={ocupado} />
            </label>
            <div className="campo-clave-admin">
              <label htmlFor="contrasena">Contraseña</label>
              <div className="entrada-clave-admin">
                <input id="contrasena" type={mostrarContrasena ? 'text' : 'password'} autoComplete="current-password" value={contrasena} onChange={e => { cambiarContrasena(e.target.value); if (error) cambiarError(''); }} required disabled={ocupado} />
                <button type="button" className="boton secundario" disabled={ocupado}
                  aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-controls="contrasena" aria-pressed={mostrarContrasena}
                  onClick={() => cambiarMostrarContrasena(anterior => !anterior)}>
                  {mostrarContrasena ? <IconoOjoOculto /> : <IconoOjo />}
                </button>
              </div>
            </div>
          </div>
          {error && <p className="aviso" role="alert"><IconoAlerta /> {error}</p>}
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

export function ControlesSesion({ sesion, ocupado, salir, seleccionar, subtituloRol, lateral=false }) {
  if(lateral)return <details className="perfil-lateral-sesion"><summary><span className="avatar-perfil-lateral"><IconoUsuario tamano={20}/></span><span><strong>{subtituloRol||'Cuenta'}</strong><small>{sesion.usuario}</small></span><span aria-hidden="true">⌄</span></summary><div><button className="boton-cerrar-sesion" disabled={ocupado} onClick={salir}><IconoSalir tamano={14}/><span>Cerrar sesión</span></button></div></details>;
  const organizaciones = [...new Set(sesion.roles.map(r => r.idOrganizacion).filter(Boolean))];
  return (
    <div className="perfil-usuario-privado">
      <div className="insignia-usuario-actual">
        <IconoUsuario tamano={16} />
        <span>{subtituloRol ? `${subtituloRol} · ${sesion.usuario}` : sesion.usuario}</span>
      </div>
      {(organizaciones.length > 1 || (organizaciones.length === 1 && !sesion.idOrganizacion)) && (
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
