import React from 'react';
export default function PasosEleccion({ pasos, actual, ocupado, guardado, alIr, alSalir }) {
  const indice = pasos.findIndex(p => p.destino === actual);
  if (indice < 0) return null;
  return <section className="preparacion-eleccion" aria-label="Preparar elección">
    <div className="cabecera-pasos"><div><strong>Paso {indice + 1} de {pasos.length}: {pasos[indice].titulo}</strong><p>Puedes volver, saltar pasos o continuar después. Lo que guardes quedará en el borrador.</p></div><button type="button" className="boton secundario" disabled={ocupado} onClick={alSalir}>Salir y continuar después</button></div>
    <nav aria-label="Pasos de preparación"><ol>{pasos.map((p,i)=><li key={p.destino}><button type="button" className={`${p.listo?'paso-guardado':''} ${i===indice?'paso-actual':''}`} aria-current={i===indice?'step':undefined} disabled={ocupado || (!guardado && i!==0)} onClick={()=>alIr(p.destino)}><span aria-hidden="true">{p.listo?'✓':i+1}</span>{p.titulo}<small>{p.listo?'Datos guardados':'Pendiente'}</small></button></li>)}</ol></nav>
    <div className="acciones-pasos"><button type="button" className="boton secundario" disabled={ocupado || indice===0} onClick={()=>alIr(pasos[indice-1].destino)}>Anterior</button>{indice<pasos.length-1&&<button type="button" className="boton secundario" disabled={ocupado||!guardado} onClick={()=>alIr(pasos[indice+1].destino)}>{pasos[indice].listo?'Continuar':'Saltar por ahora'} → {pasos[indice+1].titulo}</button>}</div>
    <p className="nota-pasos">Guarda cada formulario antes de cambiar de paso. Saltar un paso no lo completa ni inicia el conteo.</p>
  </section>;
}
