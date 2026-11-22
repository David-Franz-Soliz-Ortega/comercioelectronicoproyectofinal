// Catálogo exclusivamente sintético para verificar diseño e interacción, sin APIs reales.
import React from 'react';
import {createRoot} from 'react-dom/client';
import Panel from '../../src/paginas/PanelPrivado.jsx';
import Confirmacion from '../../src/componentes/ConfirmacionGlobal.jsx';
const institucion={idOrganizacion:'10000000-0000-4000-8000-000000000000',nombre:'Universidad de demostración',activa:true};
const usuario={idUsuario:'admin-prueba',usuario:'administrador.prueba',idOrganizacion:institucion.idOrganizacion,roles:[{rol:'ADMINISTRADOR',idOrganizacion:null}]};
const tipos=['Rector','Vicerrector',...Array(12).fill('Decano'),...Array(20).fill('Director')];
const procesos=tipos.map((cargo,i)=>({id:'cargo'+i,cargo,nombre:'Elección académica de demostración',tipo:'universidad',unidad:'Facultad',estado:'borrador',ambito:i<2?'Toda la universidad':'Facultad de demostración '+i,facultad:i<2?'':'Facultad de demostración '+i,carreras:[],sectores:[],vuelta:1,ponderacion:false,publicado:false,actual:false,candidatos:[{id:'c'+i,nombre:'Candidatura de prueba '+i,foto:null}],mesas:[{id:'m'+i,codigo:'M'+i,unidad:'Facultad de demostración',sector:'general'}]}));
for(let i=0;i<procesos.length;i++)procesos[i].candidatos=Array.from({length:i===0?2:i===1?3:i<14?2:1},(_,n)=>({id:'20000000-0000-4000-8000-'+String(i*10+n).padStart(12,'0'),nombre:'Candidatura de prueba '+i+'-'+n,tieneFoto:i<2,foto:i<2?'/foto-sintetica':null}));
procesos.push({...procesos[2],id:'archivo',estado:'archivada',ambito:'Elección archivada de prueba'});
const operadores=Array.from({length:12},(_,i)=>({idUsuario:'operador-'+i,usuario:'operador.prueba'+i,activo:i!==11,roles:[{rol:'OPERADOR',idOrganizacion:institucion.idOrganizacion}]}));
const asignaciones=operadores.flatMap((c,i)=>i===0||i===11?[]:(i===1?[0,1]:[i]).map(n=>({idUsuario:c.idUsuario,idMesa:'m'+n,idProceso:'cargo'+n,idMesaFisica:'fisica-'+n,codigo:'M'+n,unidad:'Facultad de demostración',sector:'general',cargo:procesos[n].cargo,ambito:procesos[n].ambito,estado:'borrador'})));
window.solicitudes=[];
const png='iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGNwa//6H4QZYAwAXgQLBS5SOIIAAAAASUVORK5CYII=';
window.fallarFoto=false;
window.fetch=async(ruta,op={})=>{
 window.solicitudes.push({ruta,metodo:op.method??'GET'});
 if(op.method==='POST'&&/\/configuracion\/mesas\/[^/]+\/asignar$/.test(ruta)){
  if(window.fallarAsignacion){window.fallarAsignacion=false;return Response.json({},{status:503});}
  const id=ruta.split('/').at(-2),p=procesos.find(p=>p.estado!=='archivada'&&p.mesas.some(m=>m.id===id)),m=p?.mesas.find(m=>m.id===id);
  if(!m)throw Error('Mesa sintética no encontrada');
  asignaciones.push({idUsuario:JSON.parse(op.body).idUsuario,idMesa:m.id,idProceso:p.id,codigo:m.codigo,unidad:m.unidad,sector:m.sector,cargo:p.cargo,estado:p.estado});
  return Response.json({asignada:true});
 }
 if(ruta.endsWith('/autenticacion/logout'))return new Response(null,{status:204});
 if(ruta.includes('/configuracion/candidatos/')){
  const id=ruta.split('/')[5],candidato=procesos.flatMap(p=>p.candidatos).find(c=>c.id===id);
  if(!candidato)throw Error('Candidato sintético inexistente');
  if(ruta.endsWith('/foto')){
   if(op.method==='PUT'){
    if(window.fallarFoto){window.fallarFoto=false;return Response.json({},{status:503});}
    candidato.tieneFoto=true;candidato.foto='/foto-sintetica';return new Response(null,{status:204});
   }
   return new Response(Uint8Array.from(atob(png),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/png'}});
  }
  if(op.method==='PUT'){candidato.nombre=JSON.parse(op.body).nombre;return Response.json(candidato);}
 }
 if(ruta.endsWith('/autenticacion/yo'))return Response.json(usuario);
 if(ruta.endsWith('/organizaciones'))return Response.json({elementos:[institucion]});
 if(ruta.includes('/usuarios'))return Response.json({elementos:[{...usuario,activo:true},...operadores],total:13});
 if(ruta.endsWith('/configuracion/procesos'))return Response.json({elementos:procesos});
 if(ruta.endsWith('/asignaciones'))return window.fallarAsignaciones?Response.json({},{status:503}):Response.json({elementos:asignaciones});
 if(ruta.endsWith('/historial'))return Response.json({elementos:[]});
 if(ruta.endsWith('/previsualizar'))return Response.json({total:1,filas:[],errores:[],huella:'sintetica'});
 throw Error('Ruta sintética no prevista: '+ruta);
};
createRoot(document.getElementById('root')).render(<><Confirmacion/><Panel/></>);
