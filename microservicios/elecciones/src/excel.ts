import ExcelJS from 'exceljs';
import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
export type FilaExcel={fila:number;datos:Record<string,string>};
export const limiteArchivo=2000000;
export function falloExcel(detalle:string):never{throw Object.assign(new Error(detalle),{estado:422,detalle});}
function comprobarZip(b:Buffer){
 let fin=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50){fin=i;break;}
 if(fin<0)falloExcel('El archivo no es un XLSX válido');
 const cantidad=b.readUInt16LE(fin+10);let posicion=b.readUInt32LE(fin+16),total=0;const nombres=new Set<string>();
 if(cantidad>128||!cantidad)falloExcel('Archivo demasiado complejo');
 for(let i=0;i<cantidad;i++){
  if(posicion+46>b.length||b.readUInt32LE(posicion)!==0x02014b50)falloExcel('Archivo ZIP inválido');
  const flags=b.readUInt16LE(posicion+8),metodo=b.readUInt16LE(posicion+10),comprimido=b.readUInt32LE(posicion+20),declarado=b.readUInt32LE(posicion+24),largo=b.readUInt16LE(posicion+28),extra=b.readUInt16LE(posicion+30),comentario=b.readUInt16LE(posicion+32),local=b.readUInt32LE(posicion+42);
  const nombre=b.subarray(posicion+46,posicion+46+largo).toString('utf8');
  if(nombres.has(nombre)||/vbaProject|externalLinks|\.\.\//i.test(nombre)||flags&1||![0,8].includes(metodo))falloExcel('No se admiten macros, enlaces externos ni archivos cifrados');
  nombres.add(nombre);total+=declarado;if(total>20000000||local+30>b.length)falloExcel('El contenido descomprimido supera el límite');
  if(b.readUInt32LE(local)!==0x04034b50)falloExcel('Archivo ZIP inválido');
  const inicio=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28);
  if(inicio+comprimido>b.length)falloExcel('Archivo incompleto');
  let contenido:Buffer;try{contenido=metodo===0?b.subarray(inicio,inicio+comprimido):inflateRawSync(b.subarray(inicio,inicio+comprimido),{maxOutputLength:20000001});}catch{falloExcel('Contenido comprimido inválido o demasiado grande');}
  if(contenido.length!==declarado||/<!DOCTYPE|<!ENTITY/i.test(contenido.toString('utf8')))falloExcel('Contenido XML no permitido');
  posicion+=46+largo+extra+comentario;
 }
 if(!nombres.has('[Content_Types].xml')||!nombres.has('xl/workbook.xml'))falloExcel('Utiliza la plantilla XLSX');
}
export async function leerExcel(archivo:unknown,columnas:string[],requeridas:string[],maximo=2000):Promise<{filas:FilaExcel[];buffer:Buffer}>{
 if(typeof archivo!=='string'||archivo.length>2800000||(archivo.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(archivo)))falloExcel('Archivo inválido');
 const buffer=Buffer.from(archivo,'base64');if(!buffer.length||buffer.length>limiteArchivo)falloExcel('Máximo 2 MB');comprobarZip(buffer);
 const libro=new ExcelJS.Workbook();try{await libro.xlsx.load(buffer as any);}catch{falloExcel('No se pudo leer el XLSX');}
 if(libro.worksheets.length!==1)falloExcel('La plantilla debe contener una sola hoja');
 const hoja=libro.worksheets[0];
 if(hoja.rowCount>maximo+1)falloExcel(`Máximo ${maximo} filas por archivo`);
 if(hoja.columnCount>columnas.length)falloExcel(`Columnas incorrectas. Esta plantilla solo admite: ${columnas.join(', ')}.`);
 const cabecera:string[]=[];hoja.getRow(1).eachCell({includeEmpty:true},(celda,col)=>{if(typeof celda.value!=='string')falloExcel('Cabecera inválida');cabecera[col-1]=celda.value.trim();});
 if(new Set(cabecera).size!==cabecera.length||cabecera.some(k=>!columnas.includes(k))||requeridas.some(k=>!cabecera.includes(k)))falloExcel(`Las columnas no coinciden con la plantilla. Columnas admitidas: ${columnas.join(', ')}. Obligatorias: ${requeridas.join(', ')}.`);
 const filas:FilaExcel[]=[];
 for(let numero=2;numero<=hoja.rowCount;numero++){
  const datos:Record<string,string>={};let tieneDatos=false;
  for(let i=0;i<cabecera.length;i++){
   const valor=hoja.getRow(numero).getCell(i+1).value;
   if(valor!==null&&typeof valor!=='string'&&typeof valor!=='number')falloExcel(`Fila ${numero}: no se admiten fórmulas, fechas ni objetos`);
   if(cabecera[i]==='contrasena'&&valor!==null&&typeof valor!=='string')falloExcel(`Fila ${numero}: la contraseña debe estar en una celda de texto`);
   datos[cabecera[i]]=valor===null?'':String(valor);if(datos[cabecera[i]]!=='')tieneDatos=true;
   if(datos[cabecera[i]].length>500)falloExcel(`Fila ${numero}: celda demasiado larga`);
  }
  if(tieneDatos)filas.push({fila:numero,datos});
 }
 if(!filas.length)falloExcel('No hay registros para importar');return {filas,buffer};
}
export async function plantillaExcel(columnas:string[]){const libro=new ExcelJS.Workbook();const hoja=libro.addWorksheet('Datos');hoja.addRow(columnas);hoja.getRow(1).font={bold:true};for(const col of hoja.columns){col.width=28;col.numFmt='@';}return Buffer.from(await libro.xlsx.writeBuffer());}
export const huellaExcel=(buffer:Buffer,contexto:string)=>createHash('sha256').update(buffer).update(contexto).digest('hex');
