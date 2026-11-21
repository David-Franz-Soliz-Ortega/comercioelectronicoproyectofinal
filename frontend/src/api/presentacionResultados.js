// Los votos absolutos y el porcentaje ponderado son magnitudes distintas.
export function puntuacionCandidatura(candidato, resultados) {
 return resultados.ponderacionAplicada ? candidato.porcentajePonderado ?? null : candidato.porcentaje;
}
export function ordenarCandidaturas(resultados) {
 return [...resultados.candidatos].sort((a,b)=>(puntuacionCandidatura(b,resultados)??-1)-(puntuacionCandidatura(a,resultados)??-1)||a.nombre.localeCompare(b.nombre,'es'));
}
