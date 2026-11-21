import React from 'react';
export default function OpcionesEleccion({ datos, cambiar, procesos, bloqueado, identidadFija = false }) {
 const actualizar=(k,v)=>cambiar({...datos,[k]:v});
 const sectores=datos.sectores??[],regla=datos.reglaSegundaVuelta;
 return <fieldset className="opciones-eleccion" disabled={bloqueado}><legend>Ámbito, vueltas y opciones de conteo</legend>
  {datos.tipo==='universidad'&&['Decano','Director'].includes(datos.cargo)&&<>
   <label>Facultad<input aria-label="Facultad del cargo" required={!identidadFija} maxLength="120" value={datos.facultad??''} placeholder="Facultad de Tecnología" onChange={e=>cambiar({...datos,facultad:e.target.value,ambito:datos.cargo==='Director'?`${e.target.value} · ${datos.grupoCarreras??''}`:e.target.value})}/></label>
   {datos.cargo==='Director'&&<label>Grupo de carreras<input required={!identidadFija} maxLength="100" value={datos.grupoCarreras??''} placeholder="Grupo A" onChange={e=>cambiar({...datos,grupoCarreras:e.target.value,ambito:`${datos.facultad??''} · ${e.target.value}`})}/></label>}
   <label>Carreras participantes, separadas por punto y coma<input required={!identidadFija&&datos.cargo==='Director'} maxLength="12000" defaultValue={(datos.carreras??[]).join('; ')} key={datos.cargo+':'+(datos.idPrimeraVuelta??'')} placeholder="Sistemas; Civil; Eléctrica" onChange={e=>cambiar({...datos,unidad:'Carrera',carreras:e.target.value.split(';').map(c=>c.trim()).filter(Boolean)})}/></label><p>Las mesas de este cargo solo podrán pertenecer a sus carreras configuradas. Usa un grupo distinto para cada Director.</p>
  </>}
  <label>Ámbito o grupo participante<input readOnly={datos.tipo==='universidad'&&!!datos.facultad&&['Decano','Director'].includes(datos.cargo)} value={datos.ambito??''} maxLength="160" placeholder="Toda la universidad, Grupo A de carreras, municipio…" onChange={e=>actualizar('ambito',e.target.value)}/></label>
  <label>Vuelta<select disabled={identidadFija} value={datos.vuelta??1} onChange={e=>cambiar({...datos,vuelta:Number(e.target.value),idPrimeraVuelta:null})}><option value="1">Primera vuelta</option><option value="2">Segunda vuelta</option></select></label>
  {datos.vuelta===2&&<label>Primera vuelta de referencia<select disabled={identidadFija} required value={datos.idPrimeraVuelta??''} onChange={e=>{const p=procesos.find(p=>p.id===e.target.value);if(p)cambiar({...datos,nombre:p.nombre,facultad:p.facultad??'',grupoCarreras:p.grupoCarreras??'',carreras:p.carreras??[],cargo:p.cargo,tipo:p.tipo,unidad:p.unidad,ambito:p.ambito??'',sectores:p.sectores??[],ponderacion:p.ponderacion??false,idPrimeraVuelta:p.id});}}><option value="">Selecciona la primera vuelta del mismo cargo y ámbito</option>{procesos.filter(p=>(p.vuelta??1)===1).map(p=><option key={p.id} value={p.id}>{p.nombre} · {p.cargo} · {p.ambito}</option>)}</select></label>}
  <label className="confirmacion-preparacion"><input type="checkbox" checked={sectores.length>0} onChange={e=>cambiar({...datos,sectores:e.target.checked?[{codigo:'docentes',nombre:'Docentes',pesoBps:5000},{codigo:'estudiantes',nombre:'Estudiantes',pesoBps:5000}]:[],ponderacion:false,reglaSegundaVuelta:regla?.modo==='por_sector'?null:regla})}/><span>Separar mesas y resultados por sectores</span></label>
  {sectores.length>0&&<><p>Cada mesa tendrá un sector. Sin ponderación, todos los votos mantienen el mismo valor.</p>
   <label className="confirmacion-preparacion"><input type="checkbox" checked={datos.ponderacion??false} onChange={e=>actualizar('ponderacion',e.target.checked)}/><span>Activar ponderación por sectores</span></label>
   {sectores.map((s,i)=><div className="fila-sector-configuracion" key={i}>
    <label>Código<input required pattern="[a-z](?:[a-z0-9]|-)*" maxLength="32" value={s.codigo} onChange={e=>actualizar('sectores',sectores.map((v,j)=>j===i?{...v,codigo:e.target.value}:v))}/></label>
    <label>Nombre<input required maxLength="80" value={s.nombre} onChange={e=>actualizar('sectores',sectores.map((v,j)=>j===i?{...v,nombre:e.target.value}:v))}/></label>
    {datos.ponderacion&&<label>Peso %<input type="number" min="0" max="100" step="0.01" required value={s.pesoBps/100} onChange={e=>actualizar('sectores',sectores.map((v,j)=>j===i?{...v,pesoBps:Math.round(Number(e.target.value)*100)}:v))}/></label>}
    <button type="button" className="boton secundario" onClick={()=>cambiar({...datos,sectores:sectores.filter((_,j)=>j!==i),ponderacion:sectores.length>1&&datos.ponderacion,reglaSegundaVuelta:sectores.length===1&&regla?.modo==='por_sector'?null:regla})}>Quitar sector</button>
   </div>)}
   <button type="button" className="boton secundario" disabled={sectores.length>=10} onClick={()=>actualizar('sectores',[...sectores,{codigo:'sector-'+(sectores.length+1),nombre:'',pesoBps:0}])}>Agregar sector</button>
   {datos.ponderacion&&<p role="status">Suma de pesos: {sectores.reduce((a,s)=>a+s.pesoBps,0)/100} % · Debe ser exactamente 100 %.</p>}
  </>}
  <label className="confirmacion-preparacion"><input type="checkbox" checked={!!regla} onChange={e=>actualizar('reglaSegundaVuelta',e.target.checked?{modo:'porcentaje',umbral:50,estricto:true}:null)}/><span>Activar indicador de segunda vuelta</span></label>
  {regla&&<><p>Regla académica configurable. No proclama ganadores ni crea una vuelta automáticamente.</p>
   <label>Condición<select value={regla.modo} onChange={e=>actualizar('reglaSegundaVuelta',{...regla,modo:e.target.value})}><option value="porcentaje">Porcentaje total {datos.ponderacion?'ponderado':'de votos válidos'}</option>{sectores.length>0&&<option value="por_sector">Cumplir el porcentaje en cada sector</option>}</select></label>
   <label>Porcentaje requerido<input type="number" min="0.01" max="99.99" step="0.01" required value={regla.umbral} onChange={e=>actualizar('reglaSegundaVuelta',{...regla,umbral:Number(e.target.value)})}/></label>
   <label>Comparación<select value={String(regla.estricto)} onChange={e=>actualizar('reglaSegundaVuelta',{...regla,estricto:e.target.value==='true'})}><option value="true">Superar el porcentaje (mayor que)</option><option value="false">Alcanzar el porcentaje (mayor o igual)</option></select></label>
  </>}
  <p>Termina estas opciones antes de abrir la recepción. Después se bloquean para preservar el conteo.</p>
 </fieldset>;
}
