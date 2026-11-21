import { z } from 'zod';
export const esquemaProceso = z.object({
 nombre:z.string().trim().min(1).max(120), cargo:z.string().trim().min(1).max(100),
 tipo:z.enum(['universidad','municipio','otra']), unidad:z.string().trim().min(1).max(80),
 facultad:z.string().trim().max(120).default(''),grupoCarreras:z.string().trim().max(100).default(''),carreras:z.array(z.string().trim().min(1).max(120)).max(100).default([]),
 ambito:z.string().trim().max(160).default(''), vuelta:z.number().int().min(1).max(2).default(1),
 idPrimeraVuelta:z.string().uuid().nullable().default(null),
 sectores:z.array(z.object({codigo:z.string().regex(/^[a-z][a-z0-9-]{0,31}$/).refine(v=>v!=='general'),nombre:z.string().trim().min(1).max(80),pesoBps:z.number().int().min(0).max(10000).default(0)}).strict()).max(10).default([]),
 ponderacion:z.boolean().default(false),
 reglaSegundaVuelta:z.object({modo:z.enum(['porcentaje','por_sector']),umbral:z.number().gt(0).lt(100),estricto:z.boolean().default(true)}).strict().nullable().default(null),
}).strict().superRefine((p,c)=>{
 if(new Set(p.carreras.map(c=>c.normalize('NFKC').toLocaleLowerCase('es'))).size!==p.carreras.length)c.addIssue({code:'custom',message:'Carreras repetidas'});
 if(p.carreras.length&&p.unidad!=='Carrera')c.addIssue({code:'custom',message:'Las mesas de carreras configuradas se agrupan por Carrera'});
 if(new Set(p.sectores.map(s=>s.codigo)).size!==p.sectores.length)c.addIssue({code:'custom',message:'Códigos de sector repetidos'});
 if(p.ponderacion&&(!p.sectores.length||p.sectores.reduce((a,s)=>a+s.pesoBps,0)!==10000))c.addIssue({code:'custom',message:'Los pesos deben sumar 100 %'});
 if(p.reglaSegundaVuelta?.modo==='por_sector'&&!p.sectores.length)c.addIssue({code:'custom',message:'La regla por sector requiere sectores'});
 if((p.vuelta===2)!==!!p.idPrimeraVuelta)c.addIssue({code:'custom',message:'La segunda vuelta requiere una primera vuelta de referencia'});
});
export type Proceso = z.infer<typeof esquemaProceso>;
export const esquemaMesa=z.object({codigo:z.string().trim().min(1).max(60),unidad:z.string().trim().min(1).max(120),sector:z.string().max(32).default('general')}).strict();
export function opciones(p:Proceso){const {ambito,vuelta,idPrimeraVuelta,sectores,ponderacion,reglaSegundaVuelta,facultad,grupoCarreras,carreras}=p;return {ambito,vuelta,idPrimeraVuelta,sectores,ponderacion,reglaSegundaVuelta,facultad,grupoCarreras,carreras};}
export function sectorValido(config:any,sector:string){
 if(config.sectores?.length)return config.sectores.some((s:any)=>s.codigo===sector);
 return sector==='general'||sector==='estudiantes'||sector==='docentes';
}
export function unidadValida(config:any,unidad:string){
 const normalizar=(s:string)=>s.normalize('NFKC').trim().toLocaleLowerCase('es');
 const grupo=config.grupoCarreras&&config.facultad?`${config.facultad} · ${config.grupoCarreras}`:'';
 return !config.carreras?.length||Boolean(grupo&&normalizar(grupo)===normalizar(unidad))||config.carreras.some((c:string)=>normalizar(c)===normalizar(unidad));
}
// Migración aditiva: todas las mesas históricas pertenecen al conteo general, sin ponderación.
export const ESQUEMA=`
CREATE TABLE IF NOT EXISTS tuvoto_procesos(id UUID PRIMARY KEY,id_organizacion UUID NOT NULL,nombre TEXT NOT NULL,cargo TEXT NOT NULL,tipo TEXT NOT NULL,unidad TEXT NOT NULL,actual BOOLEAN NOT NULL DEFAULT false,archivado BOOLEAN NOT NULL DEFAULT false,creado_en TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE tuvoto_procesos ADD COLUMN IF NOT EXISTS archivado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tuvoto_procesos ADD COLUMN IF NOT EXISTS publicado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tuvoto_procesos ADD COLUMN IF NOT EXISTS configuracion JSONB NOT NULL DEFAULT '{}';
UPDATE tuvoto_procesos SET publicado=true WHERE actual AND NOT publicado;
ALTER TABLE tuvoto_procesos ADD COLUMN IF NOT EXISTS estado TEXT;
UPDATE tuvoto_procesos SET estado=CASE WHEN archivado THEN 'archivada' WHEN publicado OR actual THEN 'recepcion' ELSE 'borrador' END WHERE estado IS NULL;
ALTER TABLE tuvoto_procesos ALTER COLUMN estado SET DEFAULT 'borrador';
ALTER TABLE tuvoto_procesos ALTER COLUMN estado SET NOT NULL;
ALTER TABLE tuvoto_procesos ADD COLUMN IF NOT EXISTS eliminada BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS historial_procesos(id UUID PRIMARY KEY,id_proceso UUID NOT NULL REFERENCES tuvoto_procesos(id),id_actor UUID NOT NULL,anterior TEXT NOT NULL,nuevo TEXT NOT NULL,creado_en TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS registros_en_curso(id UUID PRIMARY KEY,id_proceso UUID NOT NULL REFERENCES tuvoto_procesos(id),id_usuario UUID NOT NULL,creado_en TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE UNIQUE INDEX IF NOT EXISTS tuvoto_actual_unico ON tuvoto_procesos(actual) WHERE actual;
CREATE TABLE IF NOT EXISTS tuvoto_candidatos(id UUID PRIMARY KEY,id_proceso UUID NOT NULL REFERENCES tuvoto_procesos(id),nombre TEXT NOT NULL,orden SERIAL,foto BYTEA,mime TEXT,UNIQUE(id_proceso,nombre));
ALTER TABLE tuvoto_candidatos ADD COLUMN IF NOT EXISTS id_candidato_origen UUID REFERENCES tuvoto_candidatos(id);
ALTER TABLE tuvoto_candidatos ADD COLUMN IF NOT EXISTS eliminada BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS tuvoto_mesas(id UUID PRIMARY KEY,id_proceso UUID NOT NULL REFERENCES tuvoto_procesos(id),codigo TEXT NOT NULL,unidad TEXT NOT NULL,UNIQUE(id_proceso,codigo));
ALTER TABLE tuvoto_mesas ADD COLUMN IF NOT EXISTS sector TEXT NOT NULL DEFAULT 'general';
ALTER TABLE tuvoto_mesas ADD COLUMN IF NOT EXISTS eliminada BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS tuvoto_mesas_fisicas(id UUID PRIMARY KEY,id_organizacion UUID NOT NULL,codigo TEXT NOT NULL,unidad TEXT NOT NULL,sector TEXT NOT NULL,recinto TEXT NOT NULL DEFAULT '',apellido_desde TEXT NOT NULL DEFAULT '',apellido_hasta TEXT NOT NULL DEFAULT '');
CREATE UNIQUE INDEX IF NOT EXISTS tuvoto_mesa_fisica_codigo ON tuvoto_mesas_fisicas(id_organizacion,lower(codigo));
ALTER TABLE tuvoto_mesas ADD COLUMN IF NOT EXISTS id_mesa_fisica UUID REFERENCES tuvoto_mesas_fisicas(id);
CREATE TABLE IF NOT EXISTS tuvoto_asignaciones(id_mesa UUID NOT NULL REFERENCES tuvoto_mesas(id),id_usuario UUID NOT NULL,PRIMARY KEY(id_mesa,id_usuario));
CREATE TABLE IF NOT EXISTS historial_catalogo(id UUID PRIMARY KEY,id_proceso UUID NOT NULL REFERENCES tuvoto_procesos(id),id_actor UUID NOT NULL,tipo TEXT NOT NULL,id_recurso UUID NOT NULL,accion TEXT NOT NULL,anterior JSONB NOT NULL DEFAULT '{}',creado_en TIMESTAMPTZ NOT NULL DEFAULT now());
`;

export function exigirBorrador(p:{estado:string;eliminada?:boolean}){
 if(p.estado!=='borrador'||p.eliminada)throw Object.assign(new Error(),{estado:409,detalle:'La configuración solo se modifica en borrador'});
}
export function validarTransicion(anterior:string,nuevo:string){
 if(!({borrador:['recepcion'],recepcion:['cerrada'],cerrada:['archivada'],archivada:[]} as Record<string,string[]>)[anterior]?.includes(nuevo))throw Object.assign(new Error(),{estado:409,detalle:'Cambio de estado no permitido'});
}
