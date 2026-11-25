import React, { useEffect, useRef, useState } from 'react';
import '../operador.css';
import { solicitarRest } from '../api/clienteRest.js';
import { consultarGraphql } from '../api/clienteGraphql.js';
import { crearIdentificador } from '../api/identificadores.js';
import { agruparMesasFisicas } from '../api/mesasCompartidas.js';
import {
  fotoAdmitida, recepcionAbierta, ultimasVersiones, estadoMesa, avance, opcionesDestino,
  camposDePropuesta, revisarConteo, datosRegistro,
} from '../api/operadorActas.js';
import ModalFormulario from './ModalFormulario.jsx';
import { ControlesSesion } from './Sesion.jsx';
import { IconoTuvoto, IconoCamara, IconoSubir, IconoCheck, IconoAlerta, IconoHistorial, IconoMesaFisica } from './Iconos.jsx';

const archivoComoTexto = archivo => new Promise((aceptar, rechazar) => {
  const lector = new FileReader();
  lector.onload = () => aceptar(lector.result);
  lector.onerror = () => rechazar(new Error('No se pudo leer la imagen'));
  lector.readAsDataURL(archivo);
});

const esperar = (ms, senal) => new Promise((aceptar, rechazar) => {
  const reloj = setTimeout(aceptar, ms);
  senal.addEventListener('abort', () => { clearTimeout(reloj); rechazar(new DOMException('Cancelada', 'AbortError')); }, { once: true });
});

const nombreSector = codigo => !codigo || codigo === 'general' ? 'General' : codigo.charAt(0).toUpperCase() + codigo.slice(1);

async function cargarVersiones() {
  const elementos = [];
  for (let pagina = 1; pagina <= 20; pagina += 1) {
    const r = await solicitarRest(`/actas?pagina=${pagina}&limite=100`);
    elementos.push(...r.elementos);
    if (!r.elementos.length || elementos.length >= r.total) break;
  }
  return elementos;
}

function Pasos({ actual }) {
  return (
    <ol className="pasos-operador" aria-label="Progreso del registro">
      {['Foto', 'Lectura', 'Revisión', 'Envío'].map((paso, i) => (
        <li key={paso} className={i < actual ? 'hecho' : i === actual ? 'actual' : ''} aria-current={i === actual ? 'step' : undefined}>
          <span>{i < actual ? <IconoCheck tamano={12} /> : i + 1}</span>{paso}
        </li>
      ))}
    </ol>
  );
}

function FichaEstado({ estado }) {
  return <span className={`ficha-estado ficha-${estado.clave}`}>{estado.texto}</span>;
}

export default function OperadorActas({ sesion, salir, seleccionar, ocupado: ocupadoSesion }) {
  const [mesas, setMesas] = useState([]);
  const [ultimas, setUltimas] = useState(new Map());
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState('inicio');
  const [foto, setFoto] = useState('');
  const [lectura, setLectura] = useState(null);
  const [destino, setDestino] = useState(null);
  const [campos, setCampos] = useState(null);
  const [confirmado, setConfirmado] = useState(false);
  const [solicitud, setSolicitud] = useState(crearIdentificador);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(null);
  const [ampliada, setAmpliada] = useState(false);
  const [error, setError] = useState('');
  const peticion = useRef(null);
  const mesaPedida = useRef(null);
  const camara = useRef(null);
  const galeria = useRef(null);

  const abiertas = mesas.filter(recepcionAbierta);
  const progreso = avance(mesas, ultimas);

  async function actualizarMesas() {
    try {
      const [respuesta, versiones] = await Promise.all([solicitarRest('/mis-mesas'), cargarVersiones()]);
      setMesas(respuesta.elementos);
      setUltimas(ultimasVersiones(versiones));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    actualizarMesas();
    return () => peticion.current?.abort();
  }, []);

  function cancelar() {
    peticion.current?.abort();
    peticion.current = null;
    mesaPedida.current = null;
    setVista('inicio'); setFoto(''); setLectura(null); setDestino(null); setCampos(null); setConfirmado(false); setAmpliada(false);
  }

  function escanear(mesa = null, desdeGaleria = false) {
    mesaPedida.current = mesa;
    setError('');
    (desdeGaleria ? galeria : camara).current?.click();
  }

  async function abrirDestino(idMesa, propuesta, control, detectada, aviso = '') {
    const [contexto, historial] = await Promise.all([
      solicitarRest(`/mesas/${idMesa}/contexto`, { senal: control.signal }),
      solicitarRest(`/actas/mesa/${idMesa}`, { senal: control.signal }),
    ]);
    if (control.signal.aborted) return;
    setDestino({ mesa: mesas.find(m => m.id === idMesa) ?? { id: idMesa, codigo: contexto.codigo }, contexto, historial, detectada });
    setCampos({ ...camposDePropuesta(contexto.candidatos, propuesta), editados: new Set() });
    setLectura({ completa: Boolean(propuesta?.completa), advertencias: propuesta?.advertencias ?? [], aviso, leida: Boolean(propuesta) });
    setConfirmado(false);
    setSolicitud(crearIdentificador());
    setVista('revision');
  }

  // Lee la foto. Sin mesa elegida, Actas identifica el destino entre las mesas abiertas del operador.
  async function leer(imagen, pedido, control) {
    for (let intento = 0; ; intento += 1) {
      try {
        const r = await solicitarRest('/actas/lectura', { metodo: 'POST', datos: { ...pedido, foto: imagen }, senal: control.signal, espera: 30000, mostrarDetalleValidacion: true });
        if (control.signal.aborted) return;
        if (!r.idMesa) {
          setLectura({ aviso: r.advertencias[0] ?? 'Elige la mesa y el cargo del acta.', opciones: r.opciones ?? [] });
          setVista('elegir');
          return;
        }
        await abrirDestino(r.idMesa, r, control, r.detectada);
        return;
      } catch (e) {
        if (control.signal.aborted) return;
        if (e.estado === 429 && intento < 5) {
          setLectura({ fase: 'espera', intento: intento + 1 });
          await esperar(1500 + intento * 1000, control.signal).catch(() => {});
          if (control.signal.aborted) return;
          setLectura({ fase: pedido.idMesa ? 'cifras' : 'destino' });
          continue;
        }
        const aviso = [409, 422].includes(e.estado) ? e.message : 'No se pudo leer la foto. Puedes escribir las cifras mirando el papel.';
        if (pedido.idMesa) {
          await abrirDestino(pedido.idMesa, null, control, false, aviso).catch(fallo => { if (!control.signal.aborted) { setError(fallo.message); cancelar(); } });
        } else {
          setLectura({ aviso, opciones: [] });
          setVista('elegir');
        }
        return;
      }
    }
  }

  async function alElegirFoto(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;
    const problema = fotoAdmitida(archivo);
    if (problema) { setError(problema); return; }
    peticion.current?.abort();
    const control = new AbortController();
    peticion.current = control;
    const pedida = mesaPedida.current;
    setError(''); setDestino(null); setCampos(null); setConfirmado(false); setEnviado(null); setAmpliada(false);
    setLectura({ fase: pedida ? 'cifras' : 'destino' });
    setVista('leyendo');
    try {
      const imagen = await archivoComoTexto(archivo);
      if (control.signal.aborted) return;
      setFoto(imagen);
      await leer(imagen, pedida ? { idMesa: pedida.id } : { candidatas: abiertas.map(m => m.id) }, control);
    } catch (e) {
      if (!control.signal.aborted) { setError(e.message); cancelar(); }
    }
  }

  async function elegirDestino(mesa) {
    peticion.current?.abort();
    const control = new AbortController();
    peticion.current = control;
    setLectura({ fase: 'cifras' });
    setVista('leyendo');
    await leer(foto, { idMesa: mesa.id }, control);
  }

  function editar(campo, valor) {
    setCampos(actual => {
      const editados = new Set(actual.editados).add(campo);
      return campo in actual.votos ? { ...actual, votos: { ...actual.votos, [campo]: valor }, editados } : { ...actual, [campo]: valor, editados };
    });
    setConfirmado(false);
    setSolicitud(crearIdentificador());
  }

  const revision = campos ? revisarConteo(campos) : null;
  const abiertaDestino = destino?.contexto?.estado === 'recepcion';
  const versionAnterior = destino?.historial?.versionAnterior ?? 0;
  const puedeEnviar = vista === 'revision' && abiertaDestino && foto && revision?.completos && confirmado && !enviando && destino.contexto.candidatos.length > 0;

  async function enviar(evento) {
    evento.preventDefault();
    if (!puedeEnviar) return;
    setEnviando(true);
    setError('');
    try {
      const datos = datosRegistro({ idMesa: destino.mesa.id, idSolicitud: solicitud, versionAnterior, foto, ...campos });
      const r = versionAnterior > 0
        ? await solicitarRest('/actas/mesas/' + destino.mesa.id, { metodo: 'PUT', datos })
        : (await consultarGraphql('mutation Registrar($entrada:NuevaActa!){registrarActa(entrada:$entrada){id version estado}}', { entrada: datos })).datos.registrarActa;
      setUltimas(previas => new Map(previas).set(destino.mesa.id, { version: r.version, estado: r.estado }));
      setEnviado({ ...destino, version: r.version, estado: r.estado });
      setVista('enviado');
      navigator.vibrate?.(40);
      actualizarMesas();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  const contextoTexto = c => [c.cargo, c.unidad, c.sectorNombre ?? nombreSector(c.sector)].filter(Boolean).join(' · ');
  const totalCampos = campos ? Object.keys(campos.votos).length + 3 : 0;
  const estadoCampo = clave => campos.editados.has(clave) ? 'editado' : campos.leidos.has(clave) ? 'leido' : 'vacio';
  const filas = destino && campos ? [
    ...destino.contexto.candidatos.map(c => ({ clave: c.id, nombre: c.nombre, etiqueta: `Votos de ${c.nombre}`, valor: campos.votos[c.id] })),
    { clave: 'blancos', nombre: 'Votos blancos', etiqueta: 'Blancos', valor: campos.blancos },
    { clave: 'nulos', nombre: 'Votos nulos', etiqueta: 'Nulos', valor: campos.nulos },
    { clave: 'total', nombre: 'Total del acta', etiqueta: 'Total del acta', valor: campos.total, total: true },
  ] : [];

  return (
    <div className="operador-actas">
      <header className="barra-operador">
        <a className="marca-operador" href="#" aria-label="Ir al portal público"><IconoTuvoto tamano={26} /><span>TUVOTO</span></a>
        <ControlesSesion sesion={sesion} ocupado={enviando || ocupadoSesion} salir={salir} seleccionar={seleccionar} subtituloRol="Operador" />
      </header>

      <input ref={camara} className="entrada-oculta" type="file" accept="image/jpeg,image/png" capture="environment" aria-label="Tomar fotografía del acta" onChange={alElegirFoto} />
      <input ref={galeria} className="entrada-oculta" type="file" accept="image/jpeg,image/png" aria-label="Subir imagen del acta" onChange={alElegirFoto} />

      <main className="contenido-operador">
        {error && <p className="aviso-operador" role="alert"><IconoAlerta tamano={18} />{error}</p>}

        {vista === 'inicio' && (
          <>
            <section className="portada-operador" aria-labelledby="saludo-operador">
              <div>
                <p className="rotulo-operador">Registro de actas</p>
                <h1 id="saludo-operador">Hola, {sesion.usuario}</h1>
                <p>{cargando ? 'Cargando tus mesas…' : progreso.total ? `Registraste ${progreso.registradas} de ${progreso.total} ${progreso.total === 1 ? 'acta' : 'actas'}.` : 'No tienes mesas con la recepción abierta.'}</p>
                {progreso.total > 0 && <div className="progreso-operador" role="progressbar" aria-label="Actas registradas" aria-valuemin={0} aria-valuemax={progreso.total} aria-valuenow={progreso.registradas}><i style={{ width: `${(progreso.registradas / progreso.total) * 100}%` }} /></div>}
              </div>
              <button type="button" className="boton-escanear" disabled={!abiertas.length || cargando} onClick={() => escanear()}>
                <span className="icono-escanear"><IconoCamara tamano={30} /></span>
                <span><strong>Escanear acta</strong><small>Detectamos la mesa y el cargo al leer la hoja</small></span>
              </button>
              <button type="button" className="boton-galeria" disabled={!abiertas.length || cargando} onClick={() => escanear(null, true)}><IconoSubir tamano={16} />Subir desde la galería</button>
              <p className="consejo-operador">Encuadra la hoja completa, recta y con buena luz. Tú confirmas cada número antes de enviar.</p>
            </section>

            <section className="mesas-operador" aria-labelledby="titulo-mesas-operador">
              <div className="cabecera-mesas-operador">
                <h2 id="titulo-mesas-operador">Tus mesas</h2>
                {progreso.pendientes > 0 && <span>{progreso.pendientes} {progreso.pendientes === 1 ? 'pendiente' : 'pendientes'}</span>}
              </div>
              {cargando ? <p className="vacio-operador" role="status">Cargando mesas asignadas…</p>
                : !mesas.length ? <p className="vacio-operador">No hay mesas asignadas para la elección actual. Solicita la asignación al administrador.</p>
                : agruparMesasFisicas(mesas).map(grupo => (
                  <article key={grupo.id} className="mesa-operador">
                    <header>
                      <IconoMesaFisica tamano={20} />
                      <div><h3>Mesa {grupo.codigo}</h3><p>{grupo.unidad} · {nombreSector(grupo.sector)}</p></div>
                    </header>
                    <ul>
                      {grupo.cargos.map(mesa => {
                        const estado = estadoMesa(mesa, ultimas);
                        return (
                          <li key={mesa.id}>
                            <span className="cargo-operador">{mesa.cargo}</span>
                            <FichaEstado estado={estado} />
                            <button type="button" className="boton-mesa-operador" disabled={!recepcionAbierta(mesa)} onClick={() => escanear(mesa)} aria-label={`Escanear acta de ${mesa.cargo}, mesa ${mesa.codigo}`}>
                              <IconoCamara tamano={16} />{estado.version ? 'Corregir' : 'Escanear'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                ))}
            </section>
          </>
        )}

        {vista === 'leyendo' && (
          <section className="flujo-operador" aria-labelledby="titulo-leyendo">
            <Pasos actual={1} />
            <div className="escaner-operador">
              {foto ? <img src={foto} alt="Fotografía del acta en lectura" /> : <div className="foto-pendiente" />}
              <span className="linea-escaner" aria-hidden="true" />
            </div>
            <div className="estado-escaner" role="status" aria-live="polite">
              <h2 id="titulo-leyendo">{lectura?.fase === 'espera' ? 'Otras actas se están leyendo' : lectura?.fase === 'cifras' ? 'Leyendo los votos…' : 'Buscando la mesa y el cargo…'}</h2>
              <p>{lectura?.fase === 'espera' ? `Reintentamos solos en un momento (intento ${lectura.intento} de 5).` : 'La lectura propone las cifras; tú las revisas antes de enviar.'}</p>
            </div>
            <button type="button" className="boton-secundario-operador" onClick={cancelar}>Cancelar</button>
          </section>
        )}

        {vista === 'elegir' && (
          <section className="flujo-operador" aria-labelledby="titulo-elegir">
            <Pasos actual={1} />
            <div className="encabezado-elegir">
              {foto && <img src={foto} alt="Fotografía del acta" />}
              <div>
                <h2 id="titulo-elegir">¿De qué mesa y cargo es esta acta?</h2>
                <p>{lectura?.aviso}</p>
              </div>
            </div>
            <ul className="opciones-destino">
              {opcionesDestino(mesas, lectura?.opciones).map(mesa => (
                <li key={mesa.id}>
                  <button type="button" onClick={() => elegirDestino(mesa)}>
                    <strong>Mesa {mesa.codigo} · {mesa.cargo}</strong>
                    <span>{mesa.unidad} · {nombreSector(mesa.sector)}</span>
                    <FichaEstado estado={estadoMesa(mesa, ultimas)} />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="boton-secundario-operador" onClick={cancelar}>Cancelar</button>
          </section>
        )}

        {vista === 'revision' && destino && campos && (
          <form className="flujo-operador revision-operador" onSubmit={enviar} aria-labelledby="titulo-revision">
            <Pasos actual={2} />
            <section className="destino-operador">
              <div>
                <p className={destino.detectada ? 'insignia-detectada' : 'insignia-elegida'}>{destino.detectada ? <><IconoCheck tamano={13} />Detectada en la foto</> : 'Elegida por ti'}</p>
                <h2 id="titulo-revision">Mesa {destino.contexto.codigo}</h2>
                <p>{contextoTexto(destino.contexto)}</p>
              </div>
              <button type="button" className="boton-cambiar" onClick={() => { setLectura({ aviso: 'Elige el destino correcto; volveremos a leer la foto.', opciones: [] }); setVista('elegir'); }}>Cambiar</button>
            </section>
            {!abiertaDestino && <p className="aviso-operador" role="status"><IconoAlerta tamano={18} />La recepción de esta mesa está cerrada: puedes revisar, pero no registrar.</p>}
            {versionAnterior > 0 && <p className="aviso-correccion">Esta mesa ya tiene la versión {versionAnterior}. Se guardará la versión {versionAnterior + 1}: reemplaza a la anterior, no se suma.</p>}

            <div className="grilla-revision">
              <figure className="foto-revision">
                <img src={foto} alt="Fotografía del acta a comparar con el conteo" className="foto-acta-operador" />
                <button type="button" className="boton-ampliar" onClick={() => setAmpliada(true)}>Ampliar fotografía ↗</button>
              </figure>

              <section className="datos-revision" aria-label="Cifras del acta">
                <div className={`resumen-lectura ${lectura?.aviso ? 'resumen-aviso' : lectura?.completa ? 'resumen-completo' : 'resumen-parcial'}`} role="status" aria-live="polite">
                  {lectura?.aviso ? <><strong>Necesitamos tu revisión</strong><p>{lectura.aviso}</p></>
                    : lectura?.completa ? <><strong>Leímos los {totalCampos} campos. Comprueba cada número.</strong></>
                    : <><strong>Leímos {campos.leidos.size} de {totalCampos} campos. Completa los vacíos.</strong>{lectura?.advertencias.map(a => <p key={a}>{a}</p>)}</>}
                </div>

                <div className="campos-acta">
                  {filas.map(fila => (
                    <label key={fila.clave} className={`campo-acta campo-${estadoCampo(fila.clave)}${fila.total ? ' campo-total' : ''}`}>
                      <span className="nombre-campo">{fila.nombre}<small>{{ leido: 'leído', vacio: 'completa', editado: 'editado' }[estadoCampo(fila.clave)]}</small></span>
                      <input type="number" inputMode="numeric" min="0" max="1000000" step="1" required aria-label={fila.etiqueta} placeholder="—"
                        disabled={enviando || !abiertaDestino} value={fila.valor ?? ''} onChange={e => editar(fila.clave, e.target.value)} />
                    </label>
                  ))}
                </div>

                <p className={`suma-operador ${revision.coincide ? 'suma-correcta' : 'suma-pendiente'}`}>
                  {revision.coincide ? <><IconoCheck tamano={16} />Suma correcta: {campos.total}</>
                    : !revision.completos ? <>Faltan {revision.faltan} {revision.faltan === 1 ? 'campo' : 'campos'} para comprobar la suma.</>
                    : <><IconoAlerta tamano={16} />Suma calculada ({revision.suma}) ≠ total declarado ({campos.total}). Si el papel dice eso, se enviará como observada.</>}
                </p>

                <label className="confirmacion-operador">
                  <input type="checkbox" checked={confirmado} disabled={enviando || !abiertaDestino || !revision.completos || !foto} onChange={e => setConfirmado(e.target.checked)} />
                  <span>He comparado los datos con el acta.</span>
                </label>

                <details className="historial-operador">
                  <summary><IconoHistorial tamano={16} />Historial de la mesa ({destino.historial.elementos.length})</summary>
                  {destino.historial.elementos.length === 0 ? <p>No hay versiones previas.</p> : (
                    <ul>{destino.historial.elementos.map(a => (
                      <li key={a.id}><strong>Versión {a.version}</strong> · {a.estado} · <small>{new Date(a.creado_en).toLocaleString('es-BO')}</small> <a href={`/api/v1/actas/${a.id}/foto`} target="_blank" rel="noreferrer">Ver original ↗</a></li>
                    ))}</ul>
                  )}
                </details>
              </section>
            </div>

            <div className="barra-envio">
              <button type="button" className="boton-secundario-operador" onClick={cancelar} disabled={enviando}>Descartar</button>
              <button type="submit" className="boton-enviar" disabled={!puedeEnviar}>
                <IconoCheck tamano={18} />{enviando ? 'Enviando…' : versionAnterior > 0 ? 'Confirmar corrección' : 'Confirmar y enviar'}
              </button>
            </div>
            <ModalFormulario abierto={ampliada} titulo="Compara la fotografía original" alCerrar={() => setAmpliada(false)}><div className="ampliacion-foto-operador"><img src={foto} alt="Acta ampliada; desplázate para revisar sus cifras" /></div></ModalFormulario>
          </form>
        )}

        {vista === 'enviado' && enviado && (
          <section className="flujo-operador enviado-operador" aria-labelledby="titulo-enviado">
            <Pasos actual={4} />
            <div className={`sello-enviado ${enviado.estado === 'observada' ? 'sello-observada' : ''}`} aria-hidden="true">{enviado.estado === 'observada' ? <IconoAlerta tamano={44} /> : <IconoCheck tamano={48} />}</div>
            <h2 id="titulo-enviado">{enviado.estado === 'observada' ? 'Acta enviada como observada' : '¡Acta enviada!'}</h2>
            <p className="destino-enviado">Mesa {enviado.contexto.codigo} · {enviado.contexto.cargo} · versión {enviado.version}</p>
            <p>{enviado.estado === 'observada' ? 'La suma no coincide con el total: el cómputo conserva la última versión válida hasta que se corrija.' : 'El conteo y la auditoría la procesan en segundo plano; el resultado público se actualiza al terminar.'}</p>
            <p className="pendientes-enviado">{progreso.pendientes > 0 ? `Te ${progreso.pendientes === 1 ? 'queda 1 acta' : `quedan ${progreso.pendientes} actas`} por registrar.` : 'Registraste todas tus actas abiertas.'}</p>
            <button type="button" className="boton-escanear" disabled={!abiertas.length} onClick={() => { cancelar(); escanear(); }}>
              <span className="icono-escanear"><IconoCamara tamano={30} /></span>
              <span><strong>Escanear siguiente acta</strong><small>La mesa se detecta al leer la hoja</small></span>
            </button>
            <button type="button" className="boton-secundario-operador" onClick={cancelar}>Volver a mis mesas</button>
          </section>
        )}
      </main>
    </div>
  );
}
