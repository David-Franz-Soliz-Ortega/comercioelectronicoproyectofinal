import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
export function instalarHttp(app:Express,servicio:string){
 app.use((req,res,next)=>{
  const recibido=req.header('X-Correlation-ID')??'';
  const id=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(recibido)?recibido:randomUUID();
  req.headers['x-correlation-id']=id;res.set('X-Correlation-ID',id);const inicio=performance.now();
  const enviar=res.json.bind(res);
  res.json=(contenido:any)=>res.statusCode>=400?enviar({type:'about:blank',title:'Operación no completada',status:res.statusCode,detail:contenido?.detalle??contenido?.detail??'Revisa la solicitud',instance:req.path,idCorrelacion:id}):enviar(contenido);
  res.on('finish',()=>console.log(JSON.stringify({servicio,idCorrelacion:id,metodo:req.method,ruta:req.route?.path??'recurso',estado:res.statusCode,duracionMs:Math.round(performance.now()-inicio)})));
  next();
 });
}
