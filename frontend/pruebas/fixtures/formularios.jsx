// Exclusivo para la prueba de navegador: intercepta todas las llamadas con respuestas sintéticas.
import React from 'react';
import { createRoot } from 'react-dom/client';
import Asignaciones from '../../src/componentes/AsignacionesOperadores.jsx';
import Mesas from '../../src/componentes/MesasCompartidas.jsx';
import Confirmacion from '../../src/componentes/ConfirmacionGlobal.jsx';

window.solicitudes=[];window.fallarAsignacion=false;
const procesos=[{id:'p1',estado:'borrador',cargo:'Rector',ambito:'Universidad sintética',candidatos:[],mesas:[{id:'m1',codigo:'001',unidad:'Facultad sintética',sector:'general'}]}];
let cuentas=[{idUsuario:'op1',usuario:'operador.sintetico',activo:true,roles:[{rol:'OPERADOR',idOrganizacion:'org'}]}];
const asignaciones=[];let siguiente=2;
window.fetch=async(ruta,op={})=>{
 const datos=op.body?JSON.parse(op.body):null;
 // Nunca conservar contraseñas, ni siquiera las ficticias, en las capturas de solicitudes.
 window.solicitudes.push({ruta,metodo:op.method??'GET',datos:datos?{...datos,contrasena:undefined}:null,organizacion:op.headers?.['X-Organizacion']});
 if(ruta.endsWith('/configuracion/procesos'))return Response.json({elementos:procesos});
 if(ruta.endsWith('/configuracion/asignaciones'))return Response.json({elementos:asignaciones});
 if(ruta.endsWith('/usuarios')){const idUsuario='op'+siguiente++;cuentas=[...cuentas,{idUsuario,usuario:datos.usuario,activo:true,roles:[{rol:'OPERADOR',idOrganizacion:'org'}]}];return Response.json({idUsuario,usuario:datos.usuario},{status:201});}
 if(ruta.endsWith('/asignar')){
  if(window.fallarAsignacion){window.fallarAsignacion=false;return Response.json({},{status:503});}
  asignaciones.push({idUsuario:datos.idUsuario,idMesa:'m1',codigo:'001',idProceso:'p1',cargo:'Rector',estado:'borrador',unidad:'Facultad sintética',sector:'general'});return new Response(null,{status:204});
 }
 if(ruta.endsWith('/previsualizar'))return Response.json({total:1,errores:[],filas:[{usuario:'operador.sintetico'}],huella:'sintetica'});
 if(ruta.endsWith('/confirmar')){
  const operadores=[{idUsuario:'op4',usuario:'importado.conmesa',mesa:'001'},{idUsuario:'op5',usuario:'importado.sinmesa',mesa:''},{idUsuario:'op6',usuario:'importado.error',mesa:'NO-EXISTE'}];
  cuentas=[...cuentas,...operadores.map(u=>({...u,activo:true,roles:[{rol:'OPERADOR',idOrganizacion:'org'}]}))];
  return Response.json({importados:3,operadores});
 }
 if(ruta.endsWith('/mesas-compartidas'))return Response.json({id:'mesa-sintetica'});
 throw Error('Ruta sintética no prevista');
};
function App(){
 const [version,setVersion]=React.useState(0);
 return <main className="administracion-tuvoto"><Confirmacion/>
  <Asignaciones organizacion="org" nombreOrganizacion="Institución sintética" cuentas={cuentas} procesos={procesos} version={version} alGuardar={()=>setVersion(v=>v+1)} alCargo={()=>{}} alRevocar={()=>{}}/>
  <Mesas organizacion="org" procesos={procesos} cuentas={cuentas} idProceso="p1" guardar={async f=>{await f();}} alImportar={()=>{}}/>
 </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
