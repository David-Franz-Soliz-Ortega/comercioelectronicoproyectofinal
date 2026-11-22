const normalizar=valor=>String(valor??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');

export function presentacionImportacion({titulo,ruta,general=false}){
 const porCargo=/^\/configuracion\/procesos\/[^/]+\/importaciones\/(candidatos|mesas|asignaciones)$/.test(ruta);
 const alcance=general?' de todos los cargos':porCargo?' solo para este cargo':'';
 return {porCargo,encabezado:`Importar ${titulo}${alcance} desde Excel`,nombreArchivo:`${titulo}${general?'-todos-los-cargos':porCargo?'-solo-este-cargo':''}.xlsx`};
}

const descripcionesColumnas={
 cargo:{obligatoria:true,descripcion:'Rector, Vicerrector, Decano o Director.'},
 facultad:{descripcion:'Facultad del Decano o Director; déjala vacía para Rector y Vicerrector.'},
 grupoCarreras:{descripcion:'Grupo distinto, requerido para Director; déjalo vacío para los demás cargos.'},
 carreras:{descripcion:'Carreras del Director separadas por punto y coma (;).'},
 ambito:{obligatoria:true,descripcion:'Ámbito exacto del cargo. Déjalo vacío si corresponde a toda la institución.'},
 vuelta:{descripcion:'Número de vuelta: 1 o 2. Si se omite, se usa 1.'},
 nombre:{obligatoria:true,descripcion:'Nombre completo del candidato.'},
 orden:{descripcion:'Posición del candidato. Si se omite, se asigna automáticamente.'},
 codigo:{obligatoria:true,descripcion:'Código único de mesa dentro del cargo.'},
 unidad:{obligatoria:true,descripcion:'Facultad, carrera o unidad configurada en el cargo.'},
 sector:{descripcion:'Sector configurado. Si se omite, se intenta usar general.'},
 usuario:{obligatoria:true,descripcion:'Nombre de usuario del operador.'},
 codigoMesa:{obligatoria:true,descripcion:'Código de una mesa ya registrada en el cargo.'},
 recinto:{descripcion:'Nombre del recinto o ubicación, si aplica.'},
 apellidoDesde:{descripcion:'Inicial o apellido desde donde se atiende, si aplica.'},
 apellidoHasta:{descripcion:'Inicial o apellido hasta donde se atiende, si aplica.'},
 contrasena:{obligatoria:true,descripcion:'Contraseña de al menos 12 caracteres. No compartas ni subas este archivo.'},
};

export function columnasImportacion({titulo,ruta,general=false,operadores=false}){
 let nombres;
 const mesasCompartidas=ruta.includes('/mesas-compartidas/');
 if(operadores)nombres=['usuario','contrasena','mesa'];
 else if(titulo==='cargos')nombres=['cargo','facultad','grupoCarreras','carreras'];
 else if(mesasCompartidas)nombres=['codigo','unidad','sector','recinto','apellidoDesde','apellidoHasta','cargo','ambito','vuelta','usuario'];
 else {
  const tipo=ruta.split('/').at(-1);
  const campos={candidatos:['nombre','orden'],mesas:['codigo','unidad','sector'],asignaciones:['usuario','codigoMesa']}[tipo]??[];
  nombres=general?['cargo','ambito','vuelta',...campos]:campos;
 }
 return nombres.map(nombre=>{
  const columna={nombre,...(descripcionesColumnas[nombre]??{descripcion:'Completa este dato según el encabezado.'})};
  if(nombre==='cargo'&&titulo!=='cargos')columna.descripcion=mesasCompartidas?'Cargo existente al que corresponde esta mesa.':'Nombre exacto del cargo de destino.';
  if(nombre==='codigo'&&mesasCompartidas)columna.descripcion='Código físico; repítelo para los cargos vinculados a la misma mesa.';
  if(operadores&&nombre==='mesa')columna.obligatoria=false;
  if(mesasCompartidas&&nombre==='usuario')columna.obligatoria=false;
  return columna;
 });
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
