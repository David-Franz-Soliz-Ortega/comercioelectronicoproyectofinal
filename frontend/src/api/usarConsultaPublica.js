import { useEffect, useState } from 'react';
import { consultarGraphql } from './clienteGraphql.js';

// Cada selección tiene su propia respuesta: nunca mezclar cifras de dos cargos.
export function usarConsultaPublica(consulta, variables, comprobar, intervalo = 10000, habilitada = true) {
  const clave = JSON.stringify(variables);
  const [revision, cambiarRevision] = useState(0);
  const [estado, cambiarEstado] = useState({ clave: '', datos: null, cargando: true, error: '' });
  useEffect(() => {
    if (!habilitada) return;
    let vigente = true, temporizador, pendiente = false;
    const controlador = new AbortController();
    async function cargar() {
      clearTimeout(temporizador);
      if (!vigente || pendiente || document.hidden) return;
      pendiente = true;
      try {
        const { datos, advertencia } = await consultarGraphql(consulta, JSON.parse(clave), controlador.signal);
        if (advertencia) throw new Error(advertencia);
        const respuesta = comprobar(datos);
        if (vigente) cambiarEstado({ clave, datos: respuesta, cargando: false, error: '' });
      } catch (error) {
        if (vigente) cambiarEstado(anterior => ({ clave, datos: anterior.clave === clave ? anterior.datos : null, cargando: false, error: error.message }));
      } finally {
        pendiente = false;
        if (vigente && !document.hidden) temporizador = setTimeout(cargar, intervalo);
      }
    }
    const alMostrar = () => document.hidden ? clearTimeout(temporizador) : cargar();
    document.addEventListener('visibilitychange', alMostrar);
    cargar();
    return () => { vigente = false; clearTimeout(temporizador); controlador.abort(); document.removeEventListener('visibilitychange', alMostrar); };
  }, [consulta, clave, revision, intervalo, habilitada, comprobar]);
  const vigente = estado.clave === clave;
  return { ...(vigente ? estado : { datos: null, cargando: habilitada, error: '' }), reintentar: () => cambiarRevision(v => v + 1) };
}
