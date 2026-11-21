import React, { useEffect, useState } from 'react';
import { consultarFotografiaCandidato } from '../api/fotografiasCandidatos.js';

export default function FotoCandidatoAdministracion({ candidato, organizacion, revision = 0, claseIniciales = 'avatar-letra' }) {
  const hayFoto = Boolean(candidato.tieneFoto || candidato.foto);
  const clave = `${organizacion}:${candidato.id}:${revision}`;
  const [imagen, setImagen] = useState({ clave: '', url: '', error: false });
  useEffect(() => {
    if (!hayFoto) return;
    const controlador = new AbortController();
    let vigente = true, url = '';
    consultarFotografiaCandidato(candidato.id, organizacion, controlador.signal).then(blob => {
      if (!vigente) return;
      url = URL.createObjectURL(blob);
      setImagen({ clave, url, error: false });
    }).catch(() => {
      if (vigente) setImagen({ clave, url: '', error: true });
    });
    // Las imágenes privadas solo viven en memoria y se liberan al cambiar de contexto.
    return () => { vigente = false; controlador.abort(); if (url) URL.revokeObjectURL(url); };
  }, [candidato.id, organizacion, revision, hayFoto]);
  if (!hayFoto) return <span className={claseIniciales} aria-hidden="true">{candidato.nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('')}</span>;
  if (imagen.clave === clave && imagen.url) return <img src={imagen.url} alt={candidato.nombre} loading="lazy" onError={() => { URL.revokeObjectURL(imagen.url); setImagen({ clave, url: '', error: true }); }} />;
  const fallo = imagen.clave === clave && imagen.error;
  const aviso = fallo ? 'No se pudo cargar la fotografía. Actualiza la página para reintentar.' : 'Cargando fotografía';
  return <span className={`${claseIniciales} ${fallo ? 'foto-candidato-error' : 'foto-candidato-cargando'}`} role="img" aria-label={`${aviso}: ${candidato.nombre}`} title={aviso}>{fallo ? '!' : '…'}</span>;
}
