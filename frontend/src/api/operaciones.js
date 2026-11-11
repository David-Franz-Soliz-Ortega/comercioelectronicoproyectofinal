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

