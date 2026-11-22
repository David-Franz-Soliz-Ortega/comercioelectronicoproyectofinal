import { notificarExito } from '../api/confirmaciones.js';
import React, { useEffect, useState } from 'react';
import { solicitarRest } from '../api/clienteRest.js';
import VistaPreviaResultados from './VistaPreviaResultados.jsx';

export default function PortadaAdministracion({
  procesos,
  organizacion,
  ocupado,
  alGuardar,
  alCandidatos,
  alPublicacion
}) {
  const [seleccion, setSeleccion] = useState(() =>
    procesos.filter(p => p.destacadoPortada && p.estado !== 'archivada').map(p => p.id)
  );
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const disponibles = procesos.filter(p => p.estado !== 'archivada');

  useEffect(() => {
    setSeleccion(
      procesos.filter(p => p.destacadoPortada && p.estado !== 'archivada').map(p => p.id)
    );
    setError('');
  }, [procesos]);

  const seleccionados = disponibles
    .filter(p => p.destacadoPortada)
    .sort(
      (a, b) =>
        a.cargo.localeCompare(b.cargo, 'es') ||
        (a.ambito ?? '').localeCompare(b.ambito ?? '', 'es')
    );
  const actuales = disponibles.filter(p => p.destacadoPortada).map(p => p.id);
  const modificado =
    seleccion.length !== actuales.length ||
    seleccion.some(id => !actuales.includes(id));

  async function guardar(ids) {
    if (ocupado || guardando) return;
    setGuardando(true);
    setError('');
    try {
      await solicitarRest('/configuracion/portada', {
        metodo: 'PUT',
        organizacion,
        datos: { idProcesos: ids, confirmar: true },
        mostrarDetalleValidacion: true
      });
      setEditando(false);
      notificarExito('Selección de portada guardada.');
      alGuardar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section
      className="portada-administracion seccion-cargos-destacados"
      aria-labelledby="titulo-configuracion-portada"
    >
      <div className="cabecera-portada-fila">
        <h2 id="titulo-configuracion-portada" className="titulo-destacados-resumen">
          Cargos destacados
        </h2>
      </div>

      <div className="panel-admin vista-previa-destacados">
        {seleccionados.length ? (
          seleccionados.map(p => (
            <VistaPreviaResultados
              key={p.id}
              proceso={p}
              organizacion={organizacion}
              ocupado={ocupado || guardando}
              alCandidatos={() => alCandidatos(p.id)}
              alPublicacion={() => alPublicacion(p.id)}
              alQuitar={() => guardar(actuales.filter(id => id !== p.id))}
            />
          ))
        ) : (
          <p className="sin-cargos-destacados">
            No hay cargos destacados. Agrega los que quieras mostrar en la portada.
          </p>
        )}
      </div>

      {seleccionados.length > 0 && (
        <small className="nota-previa-destacados subtexto-destacados-resumen">
          Estos son los cargos elegidos para la portada pública de Resultados. Se mostrarán cuando estén publicados; seleccionarlos no inicia el conteo.
        </small>
      )}

      {error && (
        <p className="aviso" role="alert">
          {error}
        </p>
      )}

      <div className="acciones-destacados posicion-boton-destacados">
        <button
          type="button"
          className="boton secundario boton-agregar-destacado-estilizado"
          disabled={ocupado || guardando}
          aria-expanded={editando}
          aria-controls="seleccion-cargos-portada"
          onClick={() => {
            setSeleccion(actuales);
            setEditando(!editando);
            setError('');
          }}
        >
          {editando ? 'Cerrar selección' : '+ Agregar destacados'}
        </button>
      </div>

      {editando && (
        <form
          id="seleccion-cargos-portada"
          className="panel-admin seleccion-portada"
          onSubmit={e => {
            e.preventDefault();
            if (modificado) guardar(seleccion);
          }}
        >
          <fieldset disabled={ocupado || guardando}>
            <legend>Elige los cargos que quieres destacar</legend>
            <div className="opciones-portada">
              {disponibles.map(p => (
                <label key={p.id}>
                  <input
                    type="checkbox"
                    value={p.id}
                    checked={seleccion.includes(p.id)}
                    disabled={!seleccion.includes(p.id) && seleccion.length >= 100}
                    onChange={e => {
                      setSeleccion(ids =>
                        e.target.checked
                          ? [...ids, p.id]
                          : ids.filter(id => id !== p.id)
                      );
                    }}
                  />
                  <span>
                    <strong>{p.cargo}</strong>
                    <small>
                      {p.ambito || p.facultad || p.nombre}
                      {p.vuelta === 2 ? ' · Segunda vuelta' : ''}
                      {!(p.publicado || p.actual) ? ' · Aún no publicado' : ''}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            {!disponibles.length && (
              <p>Todavía no hay cargos. Puedes crearlos en Elección.</p>
            )}
          </fieldset>
          <p>
            Marca para agregar o desmarca para quitar. Los cambios se aplican al
            guardar; no inician el conteo.
          </p>
          <div className="acciones-destacados">
            <button
              className="boton primario"
              disabled={ocupado || guardando || !modificado}
            >
              {guardando ? 'Guardando…' : 'Guardar portada'}
            </button>
            <button
              type="button"
              className="boton secundario"
              disabled={guardando}
              onClick={() => {
                setSeleccion(actuales);
                setEditando(false);
                setError('');
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
