export const consultaResumen = `query ResumenSigape {
  elecciones(limite:1) { total }
  candidaturas(limite:1) { total }
  inscripciones(limite:1) { total }
}`;
export const consultas = {
  elecciones: `query ListarElecciones($pagina:Int!,$limite:Int!,$nombre:String,$estado:EstadoEleccion) {
    elecciones(pagina:$pagina,limite:$limite,nombre:$nombre,estado:$estado) {
      pagina limite total elementos { idEleccion nombre estado creadoEn }
    }
  }`,
  candidaturas: `query ListarCandidaturas($pagina:Int!,$limite:Int!,$estado:EstadoCandidatura) {
    candidaturas(pagina:$pagina,limite:$limite,estado:$estado) {
      pagina limite total elementos { idCandidatura nombre tipo estado idEleccion eleccion { nombre } }
    }
  }`,
  padron: `query ListarPadron($pagina:Int!,$limite:Int!,$elegible:Boolean) {
    inscripciones(pagina:$pagina,limite:$limite,elegible:$elegible) {
      pagina limite total elementos { idInscripcion idEleccion elegible creadoEn eleccion { nombre } }
    }
  }`,
};
export const crearEleccion = `mutation CrearEleccion($entrada:NuevaEleccion!) {
  crearEleccion(entrada:$entrada) { idEleccion nombre estado creadoEn }
}`;

export async function consultarGraphql(query, variables = {}, senal) {
  let respuesta;
  try { respuesta = await fetch('/graphql', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: senal ? AbortSignal.any([senal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  }); } catch (fallo) {
    throw new Error(fallo.name === 'TimeoutError' ? 'La consulta tardó demasiado. Vuelve a actualizar.' : 'No se pudo conectar con SIGAPE. Revisa tu conexión y vuelve a intentarlo.');
  }
  if (!respuesta.ok) throw new Error('No se pudo completar la consulta. Intenta actualizar en unos momentos.');
  let contenido;
  try { contenido = await respuesta.json(); } catch { throw new Error('La respuesta recibida no es válida. Vuelve a actualizar.'); }
  if (!contenido.data) {
    const codigo = contenido.errors?.[0]?.extensions?.code;
    const mensaje = codigo === 'ENTRADA_INVALIDA' ? 'Revisa los datos ingresados e inténtalo de nuevo.' :
      codigo === 'LIMITE_DE_CARGA' ? 'La consulta es demasiado amplia. Aplica un filtro para reducirla.' :
        'No se pudo consultar la información. Intenta actualizar en unos momentos.';
    throw new Error(mensaje);
  }
  return { datos: contenido.data, advertencia: contenido.errors?.length ? 'Algunas referencias no están disponibles. Puedes actualizar para intentarlo de nuevo.' : '' };
}
