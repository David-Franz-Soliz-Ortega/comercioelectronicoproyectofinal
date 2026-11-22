import React, { useState, useEffect } from 'react';
import PortadaAdministracion from './PortadaAdministracion.jsx';
import { resumirInstitucion } from '../api/resumenInstitucion.js';
import { solicitarRest } from '../api/clienteRest.js';
import {
  IconoCapas,
  IconoUsuarios,
  IconoUrna,
  IconoUsuario,
  IconoUsuarioMas,
  IconoCalendario,
  IconoFoto,
  IconoMegafono,
  IconoEnlaceExterno
} from './Iconos.jsx';

export default function ResumenAdministracion({
  institucion,
  procesos,
  cuentas,
  cargando,
  disponible,
  ocupado,
  alIr,
  alReintentar,
  alGuardarPortada,
  alCargo
}) {
  const [asignaciones, setAsignaciones] = useState([]);

  useEffect(() => {
    let vigente = true;
    if (institucion?.idOrganizacion) {
      solicitarRest('/configuracion/asignaciones', { organizacion: institucion.idOrganizacion })
        .then(r => {
          if (vigente) setAsignaciones(r.elementos || []);
        })
        .catch(() => {});
    }
    return () => {
      vigente = false;
    };
  }, [institucion?.idOrganizacion, procesos]);

  if (cargando) {
    return (
      <section className="panel-admin resumen-institucion" role="status">
        Consultando el resumen de {institucion.nombre}…
      </section>
    );
  }

  if (!disponible) {
    return (
      <section className="panel-admin resumen-institucion">
        <p role="alert">No se pudo consultar el resumen de esta institución.</p>
        <button type="button" className="boton secundario" disabled={ocupado} onClick={alReintentar}>
          Volver a consultar
        </button>
      </section>
    );
  }

  const r = resumirInstitucion(procesos, cuentas, institucion.idOrganizacion);
  const activos = procesos.filter(p => p.estado !== 'archivada');
  const todasLasMesas = activos.flatMap(p => p.mesas || []);
  const mesasConOperador = new Set(asignaciones.map(a => a.idMesa));
  const actasSinOperador = todasLasMesas.filter(m => !mesasConOperador.has(m.id)).length;

  const todosCandidatos = activos.flatMap(p => p.candidatos || []);
  const fotosPendientes = todosCandidatos.filter(c => !c.foto && !c.tieneFoto).length;

  const destacados = activos.filter(p => p.destacadoPortada);
  const destacadosSinPublicar = destacados.filter(p => !p.publicado && !p.actual);
  const textoSubDestacados = destacadosSinPublicar.length > 0
    ? `${destacadosSinPublicar.map(d => d.cargo).join(' y ')} siguen sin publicar`
    : (destacados.length > 0 ? 'Todos los destacados están publicados' : 'Sin cargos destacados configurados');

  const cargosBorrador = activos.filter(p => p.estado === 'borrador').length;
  const cargosRecepcion = activos.filter(p => p.estado === 'recepcion').length;
  const cargosFinalizados = activos.filter(p => p.estado === 'cerrada' || p.estado === 'finalizado').length;

  return (
    <section className="resumen-institucion" aria-labelledby="titulo-resumen-institucion">
      {/* Cabecera del Resumen */}
      <header className="cabecera-resumen-institucion">
        <div>
          <h1 id="titulo-resumen-institucion" className="titulo-resumen-grande">Resumen de la institución</h1>
          <div className="subtitulo-institucion-fila">
            <span className="nombre-institucion-resumen">{institucion.nombre}</span>
            {institucion.activa && <span className="insignia-institucion-activa">Activa</span>}
          </div>
        </div>
        <button
          type="button"
          className="boton primario boton-ir-eleccion"
          disabled={ocupado}
          onClick={() => alIr('configuracion')}
        >
          Ir a Elección →
        </button>
      </header>

      {/* 4 Tarjetas de Métricas / KPI */}
      <div className="indicadores-institucion grilla-metricas-resumen">
        <article className="tarjeta-metrica-resumen" data-indicador="cargos">
          <div className="cabecera-tarjeta-metrica">
            <span>Cargos activos</span>
            <div className="icono-circulo-metrica"><IconoCapas tamano={20} /></div>
          </div>
          <strong className="cifra-metrica-resumen">{r.cargos}</strong>
        </article>

        <article className="tarjeta-metrica-resumen" data-indicador="candidatos">
          <div className="cabecera-tarjeta-metrica">
            <span>Candidatos</span>
            <div className="icono-circulo-metrica"><IconoUsuarios tamano={20} /></div>
          </div>
          <strong className="cifra-metrica-resumen">{r.candidatos}</strong>
        </article>

        <article className="tarjeta-metrica-resumen" data-indicador="mesas">
          <div className="cabecera-tarjeta-metrica">
            <span>Mesas físicas</span>
            <div className="icono-circulo-metrica"><IconoUrna tamano={20} /></div>
          </div>
          <strong className="cifra-metrica-resumen">{r.mesas}</strong>
        </article>

        <article className="tarjeta-metrica-resumen" data-indicador="operadores">
          <div className="cabecera-tarjeta-metrica">
            <span>Operadores activos</span>
            <div className="icono-circulo-metrica"><IconoUsuario tamano={20} /></div>
          </div>
          <strong className="cifra-metrica-resumen">{r.operadores}</strong>
        </article>
      </div>

      <p className="nota-resumen-institucion subtexto-metricas-resumen">
        {r.actasEsperadas} actas esperadas por cargo · {r.archivados} cargos archivados
      </p>

      {/* Fila con Pendientes y Estado de los cargos */}
      <div className="fila-pendientes-estados-resumen">
        {/* Columna Pendientes */}
        <div className="panel-admin tarjeta-resumen-seccion">
          <h3 className="titulo-bloque-resumen">Pendientes que requieren atención</h3>
          <div className="lista-items-atencion">
            <div className="item-atencion-resumen">
              <div className="icono-atencion-circulo atencion-fotos">
                <IconoFoto tamano={18} />
              </div>
              <div className="texto-atencion-resumen">
                <strong>{fotosPendientes ? `${fotosPendientes} fotografías pendientes` : 'Todas las fotografías cargadas'}</strong>
              </div>
              <button
                type="button"
                className="enlace-accion-atencion"
                disabled={ocupado}
                onClick={() => alIr('candidatos')}
              >
                Completar fotos →
              </button>
            </div>

            <div className="item-atencion-resumen">
              <div className="icono-atencion-circulo atencion-operadores">
                <IconoUsuario tamano={18} />
              </div>
              <div className="texto-atencion-resumen">
                <strong>{actasSinOperador ? `${actasSinOperador} actas por cargo sin operador asignado` : 'Todas las actas con operador'}</strong>
              </div>
              <button
                type="button"
                className="enlace-accion-atencion"
                disabled={ocupado}
                onClick={() => alIr('asignaciones')}
              >
                Asignar operadores →
              </button>
            </div>

            <div className="item-atencion-resumen">
              <div className="icono-atencion-circulo atencion-destacados">
                <IconoMegafono tamano={18} />
              </div>
              <div className="texto-atencion-resumen">
                <strong>Revisar publicación de destacados</strong>
                <small>{textoSubDestacados}</small>
              </div>
              <button
                type="button"
                className="enlace-accion-atencion"
                disabled={ocupado}
                onClick={() => alIr('publicacion')}
              >
                Revisar →
              </button>
            </div>
          </div>
        </div>

        {/* Columna Estado de los cargos */}
        <div className="panel-admin tarjeta-resumen-seccion">
          <h3 className="titulo-bloque-resumen">Estado de los cargos</h3>
          <div className="lista-estados-cargos-resumen">
            <div className="fila-estado-cargo-resumen">
              <span className="insignia-estado-resumen estado-preparacion">En preparación</span>
              <strong className="cifra-estado-cargo">{cargosBorrador}</strong>
            </div>
            <div className="fila-estado-cargo-resumen">
              <span className="insignia-estado-resumen estado-recepcion">En recepción</span>
              <strong className="cifra-estado-cargo">{cargosRecepcion}</strong>
            </div>
            <div className="fila-estado-cargo-resumen">
              <span className="insignia-estado-resumen estado-finalizados">Finalizados</span>
              <strong className="cifra-estado-cargo">{cargosFinalizados}</strong>
            </div>
          </div>
          <div className="pie-estados-cargos-resumen">
            <small>El estado del conteo y la publicación se revisan por separado.</small>
            <button
              type="button"
              className="enlace-accion-atencion"
              disabled={ocupado}
              onClick={() => alIr('publicacion')}
            >
              Ver estado y publicación →
            </button>
          </div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="barra-accesos-rapidos-resumen">
        <span className="etiqueta-accesos-rapidos">Accesos rápidos</span>
        <span className="separador-accesos-rapidos">|</span>
        <button
          type="button"
          className="boton-acceso-rapido"
          disabled={ocupado}
          onClick={() => alIr('candidatos')}
        >
          <IconoUsuarioMas tamano={17} />
          <span>Agregar candidato</span>
        </button>
        <button
          type="button"
          className="boton-acceso-rapido"
          disabled={ocupado}
          onClick={() => alIr('mesas')}
        >
          <IconoCalendario tamano={17} />
          <span>Crear mesa</span>
        </button>
        <button
          type="button"
          className="boton-acceso-rapido"
          disabled={ocupado}
          onClick={() => alIr('asignaciones')}
        >
          <IconoUsuario tamano={17} />
          <span>Crear operador</span>
        </button>
        <a href="#resultados" className="boton-acceso-rapido">
          <IconoEnlaceExterno tamano={17} />
          <span>Ver resultados públicos</span>
        </a>
      </div>

      {/* Cargos destacados */}
      <PortadaAdministracion
        procesos={procesos}
        organizacion={institucion.idOrganizacion}
        ocupado={ocupado}
        alGuardar={alGuardarPortada}
        alCandidatos={id => alCargo(id, 'candidatos')}
        alPublicacion={id => alCargo(id, 'publicacion')}
      />
    </section>
  );
}
