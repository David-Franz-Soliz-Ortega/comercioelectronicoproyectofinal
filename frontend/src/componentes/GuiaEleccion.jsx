import React from 'react';
export default function GuiaEleccion({ preparacion, ocupado, alIr }) {
  return <section className="panel-admin guia-eleccion" aria-label="Preparar elección paso a paso">
    <div className="cabecera-guia-eleccion">
      <div><h2>Prepara tu elección, paso a paso</h2><p>Verde: con datos registrados. Ámbar: pendiente o por revisar. Puedes volver a cualquier paso.</p></div>
      <button type="button" className="boton primario" disabled={ocupado} onClick={() => alIr(preparacion.siguiente)}>
        Continuar: {preparacion.siguiente.titulo.toLowerCase()}
      </button>
    </div>
    <ol className="pasos-eleccion">{preparacion.pasos.map((paso, indice) => <li key={paso.id}>
      <button type="button" disabled={ocupado} className={paso.id === 'asignaciones' ? 'paso-por-revisar' : paso.listo ? 'paso-con-datos' : 'paso-pendiente'} onClick={() => alIr(paso)}>
        <span className="numero-paso">{indice + 1}</span><span><strong>{paso.titulo}</strong><small>{paso.id === 'asignaciones' ? 'Revisar responsables' : paso.listo ? '✓ Con datos' : 'Pendiente'}</small></span>
      </button>
    </li>)}</ol>
    <p className="ayuda-siguiente-paso"><strong>{preparacion.siguiente.titulo}:</strong> {preparacion.siguiente.detalle}</p>
  </section>;
}
