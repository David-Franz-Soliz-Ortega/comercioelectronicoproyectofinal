const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function procesoDesdeEnlace(hash){
 if(!hash.startsWith('#resultados?'))return '';
 const valor=new URLSearchParams(hash.slice('#resultados?'.length)).get('proceso')??'';
 return uuid.test(valor)?valor:'';
}
export function enlaceResultados(proceso){
 if(!proceso||proceso.estado==='archivada'||!(proceso.publicado||proceso.actual)||!uuid.test(proceso.id))return null;
 return '#resultados?proceso='+encodeURIComponent(proceso.id);
}
