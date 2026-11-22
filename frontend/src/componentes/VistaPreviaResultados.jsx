import React from 'react';
import FotoCandidatoAdministracion from './FotoCandidatoAdministracion.jsx';
import { enlaceResultados } from '../api/enlacesResultados.js';
import { IconoPuntosVerticales } from './Iconos.jsx';

export default function VistaPreviaResultados({
  proceso,
  organizacion,
  ocupado,
  alCandidatos,
  alPublicacion,
  alQuitar
}) {
  if (!proceso) return null;
  const enlace = enlaceResultados(proceso);
  const publicado = Boolean(enlace);
  const candidatos = proceso.candidatos || [];

  return (
    <article
      className="vista-previa-resultados grupo-vista-previa tarjeta-cargo-destacado-cuadro"
      data-proceso-previa={proceso.id}
      aria-labelledby={"titulo-vista-previa-" + proceso.id}
    >
      <header className="cabecera-tarjeta-destacado-cuadro">
        <div>
          <h3 id={"titulo-vista-previa-" + proceso.id}>{proceso.cargo}</h3>
          <p>{proceso.ambito || proceso.facultad || 'Toda la universidad'}{proceso.vuelta === 2 ? ' · Segunda vuelta' : ''}</p>
        </div>
        <div className="estado-menu-destacado-cuadro">
          <span className={publicado ? 'insignia-destacado-publicado' : 'insignia-destacado-no-publicado'}>
            {publicado ? 'Visible al público' : 'No publicado'}
          </span>
          <button
            type="button"
            className="boton secundario quitar-destacado boton-puntos-destacado"
            disabled={ocupado}
            onClick={alQuitar}
            title={`Quitar ${proceso.cargo} de destacados`}
            aria-label={`Quitar ${proceso.cargo} de destacados`}
          >
            <IconoPuntosVerticales tamano={18} />
            Quitar de destacados
          </button>
        </div>
      </header>

      {candidatos.length ? (
        <ul className="candidatos-vista-previa lista-candidatos-destacados-cuadro">
          {candidatos.slice(0, 6).map(c => (
            <li key={c.id}>
              <FotoCandidatoAdministracion
                key={c.id}
                candidato={c}
                organizacion={organizacion}
                claseIniciales="iniciales-candidato-resumen iniciales-candidato-destacado-circulo"
              />
              <span className="nombre-candidato-destacado-cuadro">
                <strong>{c.nombre}</strong>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sin-candidatos-previa">Todavía no hay candidatos registrados para este cargo.</p>
      )}

      {candidatos.length > 6 && (
        <p style={{ fontSize: 12, color: 'var(--secundario)', margin: '8px 0 0' }}>
          Mostrando 6 de {candidatos.length} candidatos. Puedes consultar todos en su apartado.
        </p>
      )}

      <div className="acciones-previa-resultados pie-destacado-cuadro">
        <button type="button" className="enlace-accion-destacado" disabled={ocupado} onClick={alCandidatos}>
          Candidatos →
        </button>
        <span className="separador-pie-destacado">|</span>
        <button type="button" className="enlace-accion-destacado" disabled={ocupado} onClick={alPublicacion}>
          Revisar publicación →
        </button>
        {publicado && (
          <>
            <span className="separador-pie-destacado">|</span>
            <a
              className="enlace-accion-destacado enlace-resultados-cargo"
              href={enlace}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver resultados públicos ↗
            </a>
          </>
        )}
      </div>
    </article>
  );
}
