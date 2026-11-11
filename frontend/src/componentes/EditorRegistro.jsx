import React, { useEffect, useRef, useState } from 'react';
import { recursosP1, datosEditables } from '../api/recursosP1.js';
import { solicitarRest } from '../api/clienteRest.js';
import { etiquetas } from './formato.js';
export default function EditorRegistro({ recurso, fila, eliminar = false, organizacion, alCerrar, alGuardar }) {
  const configuracion = recursosP1[recurso];
  const [datos, cambiarDatos] = useState(() => datosEditables(recurso, fila));
  const [error, cambiarError] = useState(''); const [ocupado, cambiarOcupado] = useState(false);
  const dialogo = useRef(null); const bloqueo = useRef(false);
  useEffect(() => { dialogo.current.showModal(); }, []);
  const titulo = `${eliminar ? 'Eliminar' : fila ? 'Editar' : 'Registrar'} ${configuracion.singular}`;
  async function guardar(evento) {
    evento.preventDefault(); if (bloqueo.current) return;
    bloqueo.current = true; cambiarOcupado(true); cambiarError('');
    try {
      await solicitarRest(`/${configuracion.ruta}${fila ? '/' + encodeURIComponent(fila[configuracion.id]) : ''}`, {
        metodo: eliminar ? 'DELETE' : fila ? 'PUT' : 'POST', datos: eliminar ? undefined : datosEditables(recurso, datos), organizacion,
      });
      alGuardar();
    } catch (fallo) { cambiarError(fallo.message); }
    finally { bloqueo.current = false; cambiarOcupado(false); }
  }
  return <dialog ref={dialogo} aria-labelledby="titulo-editor" onCancel={e => { e.preventDefault(); if (!ocupado) alCerrar(); }}><form className="formulario-creacion" onSubmit={guardar}>
    <p className="sobretitulo">GESTIÓN P1 · API REST</p><h2 id="titulo-editor">{titulo}</h2>
    {eliminar ? <p className="aviso">Se eliminará el registro «{fila.nombre ?? fila[configuracion.id]}». Esta operación requiere confirmación y no se puede deshacer.</p> : configuracion.campos.map(campo => <React.Fragment key={campo}>
      <label htmlFor={`editar-${campo}`}>{{ nombre: 'Nombre', estado: 'Estado', tipo: 'Tipo', idEleccion: 'Identificador de elección', elegible: 'Elegibilidad' }[campo]}</label>
      {campo === 'elegible' ? <select id={`editar-${campo}`} disabled={ocupado} value={String(datos[campo])} onChange={e => cambiarDatos({ ...datos, [campo]: e.target.value === 'true' })}><option value="false">No elegible</option><option value="true">Elegible</option></select> : campo === 'estado' || campo === 'tipo' ? <select id={`editar-${campo}`} disabled={ocupado} value={datos[campo]} onChange={e => cambiarDatos({ ...datos, [campo]: e.target.value })}>{(campo === 'tipo' ? ['individual', 'lista'] : configuracion.estados).map(valor => <option key={valor} value={valor}>{etiquetas[valor] ?? valor}</option>)}</select> : <input id={`editar-${campo}`} disabled={ocupado} value={datos[campo]} required maxLength={campo === 'nombre' ? 120 : 36} pattern={campo === 'idEleccion' ? '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' : '.*\\S.*'} onChange={e => cambiarDatos({ ...datos, [campo]: e.target.value })} />}
    </React.Fragment>)}
    {!eliminar && configuracion.campos.includes('idEleccion') && <p className="nota-alcance">Utiliza el identificador de una elección accesible en tu organización. La API valida la referencia.</p>}
    {error && <p className="aviso" role="alert">{error}</p>}
    <div className="acciones-dialogo"><button type="button" className="boton secundario" onClick={alCerrar} disabled={ocupado}>Cancelar</button><button className={`boton ${eliminar ? 'peligro' : 'primario'}`} disabled={ocupado}>{ocupado ? 'Procesando…' : eliminar ? 'Confirmar eliminación' : 'Guardar'}</button></div>
  </form></dialog>;
}
