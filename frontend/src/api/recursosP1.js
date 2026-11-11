// Campos de los contratos OpenAPI P1; nunca se envía el modelo interno completo.
export const recursosP1 = {
  elecciones: { ruta: 'elecciones', id: 'idEleccion', singular: 'elección', dominio: 'elecciones', estados: ['borrador', 'programada', 'en_curso', 'finalizada', 'anulada'], campos: ['nombre', 'estado'] },
  candidaturas: { ruta: 'candidaturas', id: 'idCandidatura', singular: 'candidatura', dominio: 'candidaturas', estados: ['borrador', 'pendiente', 'aprobada', 'rechazada', 'retirada'], campos: ['idEleccion', 'nombre', 'tipo', 'estado'] },
  padron: { ruta: 'inscripciones', id: 'idInscripcion', singular: 'inscripción', dominio: 'padron', estados: [], campos: ['idEleccion', 'elegible'] },
  identidades: { ruta: 'identidades', id: 'idIdentidad', singular: 'identidad académica', dominio: 'identidades', estados: ['activa', 'suspendida'], campos: ['nombre', 'estado'] },
};
export function datosEditables(recurso, fila = {}) {
  return Object.fromEntries(recursosP1[recurso].campos.map(campo => [campo, fila[campo] ?? (campo === 'elegible' ? false : campo === 'tipo' ? 'individual' : campo === 'estado' ? recursosP1[recurso].estados[0] : '')]));
}
