import React,{useRef,useState} from 'react';
import { solicitarRest } from '../api/clienteRest.js';
import { notificarExito } from '../api/confirmaciones.js';
import { guardarEdicionCandidato } from '../api/editarCandidato.js';
import ModalFormulario from './ModalFormulario.jsx';
import FotoCandidatoAdministracion from './FotoCandidatoAdministracion.jsx';

export default function EditarNombreCandidato({candidato,organizacion,ocupado,alGuardar,revision}){
 const [abierto,setAbierto]=useState(false),[nombre,setNombre]=useState(candidato.nombre),[foto,setFoto]=useState(''),[guardando,setGuardando]=useState(false),[leyendo,setLeyendo]=useState(false),[error,setError]=useState('');
 const confirmado=useRef(candidato.nombre),huboCambios=useRef(false);
 const bloqueado=ocupado||guardando||leyendo;
 function cerrar(){if(bloqueado)return;setAbierto(false);setFoto('');if(huboCambios.current)alGuardar();}
 async function leer(e){
  const archivo=e.target.files[0];setFoto('');setError('');if(!archivo)return;
  if(!['image/jpeg','image/png'].includes(archivo.type)||archivo.size>2000000){setError('Selecciona una imagen JPEG o PNG de máximo 2 MB.');e.target.value='';return;}
  setLeyendo(true);try{setFoto(await new Promise((ok,no)=>{const lector=new FileReader();lector.onload=()=>ok(String(lector.result));lector.onerror=()=>no(Error('No se pudo leer la imagen.'));lector.readAsDataURL(archivo);}));}catch(e){setError(e.message);}finally{setLeyendo(false);}
 }
 async function guardar(e){
  e.preventDefault();if(bloqueado||!nombre.trim()||(!foto&&nombre.trim()===confirmado.current))return;
  setGuardando(true);setError('');
  try{await guardarEdicionCandidato({id:candidato.id,organizacion,nombreActual:confirmado.current,nombre,foto,pedir:solicitarRest,alNombreGuardado:n=>{confirmado.current=n;huboCambios.current=true;}});setAbierto(false);setFoto('');alGuardar();notificarExito('Candidato actualizado correctamente.');}
  catch(e){setError((huboCambios.current?'Nombre guardado. No se pudo confirmar la fotografía. ':'')+e.message);}finally{setGuardando(false);}
 }
 return <><button type="button" className="boton secundario editar-candidato" disabled={ocupado} onClick={()=>{confirmado.current=candidato.nombre;huboCambios.current=false;setNombre(candidato.nombre);setFoto('');setError('');setAbierto(true);}}>Editar</button>
 <ModalFormulario abierto={abierto} titulo="Editar candidato" ocupado={bloqueado} alCerrar={cerrar}><form className="formulario-simple formulario-editar-candidato" onSubmit={guardar}>
 <div className="vista-foto-edicion">{foto?<img src={foto} alt="Vista previa de la nueva fotografía"/>:<FotoCandidatoAdministracion candidato={candidato} organizacion={organizacion} revision={revision}/>}</div>
 <label>Nombre del candidato<input autoFocus required maxLength={120} value={nombre} disabled={bloqueado} onChange={e=>setNombre(e.target.value)}/></label>
 <label>Fotografía<input type="file" accept="image/jpeg,image/png" disabled={bloqueado} onChange={leer}/><small>JPEG o PNG · Máximo 2 MB</small></label>
 {error&&<p className="aviso" role="alert">{error}</p>}
 <div className="acciones-edicion-candidato"><button className="boton primario" disabled={bloqueado||!nombre.trim()||(!foto&&nombre.trim()===confirmado.current)}>{guardando?'Guardando…':'Guardar cambios'}</button><button type="button" className="boton secundario" disabled={bloqueado} onClick={cerrar}>Cancelar</button></div>
 </form></ModalFormulario></>;
}
