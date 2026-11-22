# Acceso de login y errores de contraseña

- **Objetivo:** mejorar el feedback visual del login: eliminar el aviso al volver a escribir, reemplazar «Mostrar/Ocultar» por icono, y añadir temblor, entrada suave y pulso con movimiento reducido.
- **Responsable:** Copilot; siguiente responsable QA por asignar. **Estado:** listo_para_qa.
- **Base:** rama `main`; revisión no alterada por esta tarea. Conservados los cambios locales ajenos de candidatos y el resto del diff del workspace.
- **Archivos:** `frontend/src/componentes/Sesion.jsx`, `frontend/src/componentes/Iconos.jsx` y `frontend/src/privado.css`.
- **Comportamiento:** el usuario puede reescribir usuario o contraseña y el aviso desaparece inmediatamente. El campo de contraseña queda marcado visualmente durante el error. El control usa iconos de ojo para mostrar/ocultar y el formulario vibra brevemente ante errores. Los avisos entran con una animación breve y el CSS conserva la reducción de movimiento.
- **Pruebas ejecutadas:** `npm --prefix frontend run compilar` pasó; `npm --prefix frontend run probar` pasó 47/47; Pylance sin errores en los tres archivos modificados; `git diff --check` pasó. Se inició Vite temporal en `127.0.0.1:4174` proxy hacia NGINX local aislado y se comprobó visualmente el cambio de sesión, icono y limpieza del aviso al escribir.
- **Pendiente:** no se probó una contraseña equivocada real contra un usuario autorizado ni se desplegó el frontend. Validar manualmente el intento fallido real y, si se autoriza, publicar solo frontend.
