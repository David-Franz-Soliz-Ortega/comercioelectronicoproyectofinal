import React from 'react';
import { etiquetas } from './formato.js';
export function Estado({ valor }) { return <span className={`estado estado-${valor}`}><i />{etiquetas[valor] ?? valor}</span>; }
export function Identificador({ valor }) { return <span className="identificador" title={valor}>{valor}</span>; }

