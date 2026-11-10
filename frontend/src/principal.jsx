import React from 'react';
import { createRoot } from 'react-dom/client';
import Aplicacion from './Aplicacion.jsx';
import './estilos.css';

createRoot(document.getElementById('raiz')).render(<React.StrictMode><Aplicacion /></React.StrictMode>);
