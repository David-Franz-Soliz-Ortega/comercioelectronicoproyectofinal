import React from 'react';
import Icono from '../componentes/Icono.jsx';
const contenidos = {
  usuarios: { titulo: 'Gestión de usuarios', descripcion: 'La interfaz de gestión de cuentas y asignación de roles se incorporará en una próxima fase.' },
  votacion: { titulo: 'Registro de participación', descripcion: 'El servicio de votación dispone de una API académica. Esta interfaz no tiene un portal de emisión de votos: su disponibilidad se consulta en Inicio.' },
  resultados: { titulo: 'Consulta de resultados', descripcion: 'El servicio de resultados dispone de una API de conteos académicos y consumidores RabbitMQ. La consulta por elección no está conectada a esta pantalla; no se presentan cifras sin consultar su API.' },
};
export default function PaginaPendiente({ seccion }) {
  const contenido = contenidos[seccion];
  return <section className="panel panel-pendiente" aria-labelledby="titulo-pendiente"><span className="icono-pendiente"><Icono nombre={seccion === 'resultados' ? 'resultados' : seccion === 'usuarios' ? 'personas' : 'urna'} width="30" height="30" /></span><span className="etiqueta-pendiente">Alcance de la interfaz</span><h2 id="titulo-pendiente">{contenido.titulo}</h2><p>{contenido.descripcion}</p><p className="nota-alcance">No hay acciones operativas habilitadas desde esta pantalla.</p></section>;
}
