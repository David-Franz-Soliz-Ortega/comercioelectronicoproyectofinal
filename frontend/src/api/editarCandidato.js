// Las APIs existentes son independientes. El avance confirmado permite reintentar solo lo pendiente.
export async function guardarEdicionCandidato({id,organizacion,nombreActual,nombre,foto,pedir,alNombreGuardado}){
 const nuevo=nombre.trim();
 if(nuevo!==nombreActual){await pedir('/configuracion/candidatos/'+encodeURIComponent(id),{metodo:'PUT',organizacion,datos:{nombre:nuevo},mostrarDetalleValidacion:true});alNombreGuardado?.(nuevo);}
 if(foto)await pedir('/configuracion/candidatos/'+encodeURIComponent(id)+'/foto',{metodo:'PUT',organizacion,datos:{foto},mostrarDetalleValidacion:true});
}
