const normalizar=valor=>String(valor??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');

export function presentacionImportacion({titulo,ruta,general=false}){
 const porCargo=/^\/configuracion\/procesos\/[^/]+\/importaciones\/(candidatos|mesas|asignaciones)$/.test(ruta);
 const alcance=general?' de todos los cargos':porCargo?' solo para este cargo':'';
 return {porCargo,encabezado:`Importar ${titulo}${alcance} desde Excel`,nombreArchivo:`${titulo}${general?'-todos-los-cargos':porCargo?'-solo-este-cargo':''}.xlsx`};
}

// El servidor vuelve a comprobar institución, rol, estado y destinos al confirmar.
export function cargosParaReferencia(cargos,referencia){
 return cargos.filter(p=>p.estado==='borrador'&&normalizar(p.cargo)===normalizar(referencia.cargo)&&(p.vuelta??1)===referencia.vuelta);
}

export function mensajeImportacion(resultado){
 if(resultado.mesasFisicas!==undefined)return `${resultado.mesasFisicas} mesas físicas · ${resultado.actasEsperadas} cargos vinculados para registrar sus actas.`;
 return resultado.creados===undefined?`${resultado.importados} registros importados correctamente.`:`${resultado.creados} cargos creados · ${resultado.actualizados} actualizados · ${resultado.mantenidos} mantenidos sin cambios.`;
}

export function motivoBloqueoImportacion({vista,ocupado=false,revisar=false}){
 if(ocupado)return 'Espera a que termine la operación en curso.';
 if(!vista)return 'Primero selecciona un archivo y pulsa «Revisar archivo».';
 if(revisar)return 'Cambiaste una decisión o un destino. Pulsa «Revisar archivo» otra vez antes de confirmar.';
 if(vista.errores.length)return `El archivo todavía tiene ${vista.errores.length} ${vista.errores.length===1?'error pendiente':'errores pendientes'}. La tabla muestra las filas válidas, pero no se puede importar el lote completo. Corrige las filas indicadas en el Excel, vuelve a seleccionarlo y pulsa «Revisar archivo».`;
 return null;
}
