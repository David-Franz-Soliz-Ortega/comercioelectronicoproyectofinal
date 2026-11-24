// APIs en memoria: no contacta servicios ni conserva credenciales.
import React from 'react';
import {createRoot} from 'react-dom/client';
import EditarOperador from '../../src/componentes/EditarOperador.jsx';
import ConfirmacionGlobal from '../../src/componentes/ConfirmacionGlobal.jsx';
const org='organizacion-sintetica';
const propias=['a1r','a1v','a3r'];
const procesos=['r','v'].map(c=>({id:c,cargo:c==='r'?'Rectorado de demostración':'Vicerrectorado de demostración',facultad:'Facultad sintética con nombre largo para comprobar la lectura',estado:'borrador',mesas:[1,2,3,4].map(n=>({id:'a'+n+c,idMesaFisica:'a'+n,codigo:'A-00'+n,unidad:'Unidad de demostración',sector:'general'}))}));
procesos.push({id:'dec',cargo:'Decano',facultad:'Otra facultad',estado:'borrador',mesas:[{id:'b1',codigo:'B-001',unidad:'Otra unidad',sector:'docentes'}]});
let asignaciones=[...propias.map(idMesa=>({idMesa,idUsuario:'yo'})),...['a2r','a2v','b1'].map(idMesa=>({idMesa,idUsuario:'otro'}))];
window.solicitudes=[];
window.ocuparMesa=()=>{asignaciones.push({idMesa:'a4r',idUsuario:'otro'});};
window.fetch=async(ruta,op={})=>{
 const metodo=op.method??'GET',datos=op.body?JSON.parse(op.body):null;
 window.solicitudes.push({ruta,metodo,idUsuario:datos?.idUsuario});
 if(ruta.endsWith('/configuracion/asignaciones'))return Response.json({elementos:asignaciones});
 if(ruta.endsWith('/usuarios'))return Response.json({idUsuario:'nuevo'});
 if(ruta.endsWith('/asignar')){
  const idMesa=ruta.split('/').at(-2);
  if(window.fallarMesa===idMesa){window.fallarMesa=null;return Response.json({},{status:503});}
  if(metodo==='DELETE')asignaciones=asignaciones.filter(a=>a.idMesa!==idMesa);
  else if(!asignaciones.some(a=>a.idMesa===idMesa&&a.idUsuario===datos.idUsuario))asignaciones.push({idMesa,idUsuario:datos.idUsuario});
  return new Response(null,{status:204});
 }
 throw Error('API de prueba no prevista: '+ruta);
};
function App(){
 const [abierto,setAbierto]=React.useState(true),[version,setVersion]=React.useState(0);
 const nueva=new URLSearchParams(location.search).has('nuevo');
 return <main className="administracion-tuvoto"><ConfirmacionGlobal/><button onClick={()=>setAbierto(true)}>Abrir editor</button>{abierto&&<EditarOperador cuenta={nueva?null:{idUsuario:'yo',usuario:'operador.prueba'}} organizacion={org} nombreOrganizacion="Institución sintética" procesos={procesos} asignaciones={[...asignaciones]} alGuardar={()=>setVersion(version+1)} alCerrar={()=>setAbierto(false)}/>}</main>;
}
createRoot(document.getElementById('raiz')).render(<App/>);
