import React from 'react';
import { Estado, Identificador } from './DatosRegistro.jsx';
import { fecha } from './formato.js';
export default function TablaRegistros({ seccion, lista, columnas, titulo, acciones }) {
  return (<div className="contenedor-tabla"><table><caption className="solo-lectores">Listado de {titulo.toLowerCase()}</caption><thead><tr>{columnas.map(columna => <th scope="col" key={columna}>{columna}</th>)}</tr></thead><tbody>{lista?.elementos.map(fila => <tr key={fila.idEleccion && seccion === 'elecciones' ? fila.idEleccion : fila.idCandidatura ?? fila.idInscripcion}>
            {seccion === 'elecciones' ? <><td><strong className="nombre-registro">{fila.nombre}</strong><Identificador valor={fila.idEleccion} /></td><td><Estado valor={fila.estado} /></td><td className="fecha">{fecha(fila.creadoEn)}</td></> : seccion === 'candidaturas' ? <><td><strong className="nombre-registro">{fila.nombre}</strong><Identificador valor={fila.idCandidatura} /></td><td><span>{fila.eleccion?.nombre ?? 'Referencia no disponible'}</span><Identificador valor={fila.idEleccion} /></td><td>{fila.tipo === 'individual' ? 'Individual' : 'Lista'}</td><td><Estado valor={fila.estado} /></td></> : <><td><Identificador valor={fila.idInscripcion} /></td><td><span>{fila.eleccion?.nombre ?? 'Referencia no disponible'}</span><Identificador valor={fila.idEleccion} /></td><td><span className={`estado ${fila.elegible ? 'estado-aprobada' : 'estado-retirada'}`}><i />{fila.elegible ? 'Elegible' : 'No elegible'}</span></td><td className="fecha">{fecha(fila.creadoEn)}</td></>}
            {acciones && <td>{acciones(fila)}</td>}
          </tr>)}</tbody></table></div>);
}
