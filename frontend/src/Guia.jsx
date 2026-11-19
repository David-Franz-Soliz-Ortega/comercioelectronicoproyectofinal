import React from 'react';
import Icono from './componentes/Icono.jsx';

export default function Guia({ navegar }) {
  return <section className="guia aparicion" aria-labelledby="titulo-guia"><p className="sobretitulo">INFORMACIÓN CON CONTEXTO</p><h1 id="titulo-guia">Del acta al resultado.</h1><p className="introduccion-guia">Cada porcentaje debe poder explicarse. Este es el recorrido propuesto para que nuestra comunidad pueda consultar resultados verificables.</p>
    <div className="pasos-guia">{[
      ['documento', 'Se recibe el acta', 'Una copia autorizada del acta identifica la mesa, la elección y el estamento. Se conserva el documento original y su procedencia.'],
      ['escudo', 'Se revisan los datos', 'Una persona contrasta los votos transcritos con el acta. Se revisan sumas, duplicados, observaciones y correcciones antes de publicar.'],
      ['resultados', 'Se publica el cómputo', 'Solo las actas validadas alimentan el resultado. Cada corrección debe dejar una versión y una explicación visible.'],
    ].map(([icono, titulo, descripcion]) => <article key={titulo}><span className="icono-guia"><Icono nombre={icono} width="28" height="28" /></span><h2>{titulo}</h2><p>{descripcion}</p></article>)}</div>
    <div className="guia-dos-columnas"><section className="panel texto-guia"><h2>Dos estamentos, dos lecturas</h2><p>Los votos de estudiantes y docentes se muestran por separado. Sumarlos directamente puede ocultar las reglas de la elección.</p><p>En esta demostración, cada porcentaje utiliza únicamente los votos válidos del estamento seleccionado. Los blancos y nulos aparecen en el detalle.</p><p>El avance de actas indica cuántas actas se computaron respecto a las esperadas. No equivale a participación ni al porcentaje de una candidatura.</p><div className="nota-guia"><Icono nombre="informacion" /><p>“Mayor porcentaje” describe el ejemplo parcial. La proclamación de una autoridad corresponde a la Comisión Electoral.</p></div></section>
      <section className="panel texto-guia"><h2>Consulta las fuentes oficiales</h2><p>SIGAPE es un proyecto académico independiente; esta interfaz no es un portal oficial de la USFX.</p><ul className="fuentes-guia"><li><a href="https://usfx.bo/Documentos/RESOLUCION_ELECTORAL_N_018-2026.pdf" target="_blank" rel="noreferrer">Instructivo electoral 2026 <Icono nombre="enlace" width="16" height="16" /></a><span>Procedimiento y entrega de actas · USFX</span></li><li><a href="https://usfx.bo/resultados-finales-claustros-2026/" target="_blank" rel="noreferrer">Publicación de resultados 2026 <Icono nombre="enlace" width="16" height="16" /></a><span>Rectorado y Vicerrectorado · USFX</span></li></ul><p>La recepción de actas y el cómputo por candidatura están pendientes de integración. Las pantallas de gestión consultan los registros académicos existentes.</p></section></div>
    <button className="boton primario" onClick={() => navegar('resultados')}>Explorar la demostración</button>
  </section>;
}
