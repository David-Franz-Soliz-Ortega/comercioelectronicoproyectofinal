import React, { useEffect, useRef, useState } from 'react';
import { crearEleccion } from '../api/operaciones.js';
import { consultarGraphql } from '../api/clienteGraphql.js';
import { seccionesRegistros as secciones } from '../navegacion/secciones.js';
import { etiquetas } from './formato.js';
import Icono from './Icono.jsx';
export default function FormularioEleccion({ alGuardar, alCerrar }) {
  const [nombreNuevo, cambiarNombreNuevo] = useState('');
  const [estadoNuevo, cambiarEstadoNuevo] = useState('borrador');
  const [errorFormulario, cambiarErrorFormulario] = useState('');
  const [guardando, cambiarGuardando] = useState(false);
  const dialogo = useRef(null);
  const bloqueoGuardado = useRef(false);
  useEffect(() => { dialogo.current.showModal(); }, []);
  async function guardar(evento) {
    evento.preventDefault();
    if (bloqueoGuardado.current) return;
    if (!nombreNuevo.trim()) { cambiarErrorFormulario('Escribe un nombre para la elección.'); return; }
    bloqueoGuardado.current = true; cambiarGuardando(true); cambiarErrorFormulario('');
    try {
      const { datos } = await consultarGraphql(crearEleccion, { entrada: { nombre: nombreNuevo.trim(), estado: estadoNuevo } });
      const creada = datos.crearEleccion;
      if (!creada?.idEleccion) throw new Error('No se pudo confirmar el registro.');
      alGuardar(creada);
    } catch (fallo) {
      if (fallo.estado === 401 || fallo.estado === 403) { cambiarErrorFormulario(fallo.message); return; }
      cambiarErrorFormulario('No se pudo confirmar el guardado. Actualiza el listado antes de volver a intentarlo; el registro podría haberse guardado.');
    } finally { bloqueoGuardado.current = false; cambiarGuardando(false); }
  }
  return (
    <dialog ref={dialogo} aria-labelledby="titulo-formulario" onCancel={evento => { evento.preventDefault(); if (!guardando) alCerrar(); }}>
      <form onSubmit={guardar} className="formulario-creacion"><div className="cabecera-dialogo"><span className="icono-dialogo"><Icono nombre="urna" /></span><button type="button" className="cerrar" aria-label="Cerrar formulario" disabled={guardando} onClick={alCerrar}>×</button></div><p className="sobretitulo">PROCESOS ELECTORALES</p><h2 id="titulo-formulario">Nueva elección</h2><p className="descripcion">Define el nombre y el estado inicial del proceso.</p><label htmlFor="nombre-eleccion">Nombre de la elección</label><input id="nombre-eleccion" name="nombre" autoFocus required maxLength="120" value={nombreNuevo} disabled={guardando} onChange={evento => cambiarNombreNuevo(evento.target.value)} placeholder="Escribe el nombre del proceso" /><label htmlFor="estado-eleccion">Estado inicial</label><select id="estado-eleccion" value={estadoNuevo} disabled={guardando} onChange={evento => cambiarEstadoNuevo(evento.target.value)}>{secciones.elecciones.estados.map(valor => <option value={valor} key={valor}>{etiquetas[valor]}</option>)}</select>{errorFormulario && <p className="aviso error-formulario" role="alert">{errorFormulario}</p>}<div className="acciones-dialogo"><button type="button" className="boton secundario" disabled={guardando} onClick={alCerrar}>Cancelar</button><button type="submit" className="boton primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar elección'}</button></div></form>
    </dialog>
  );
}
