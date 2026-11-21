"""Indicadores académicos configurables; no proclaman resultados oficiales."""
from fractions import Fraction


def porcentajes_ponderados(sectores, candidatos):
    activos=[s for s in sectores if s.get('pesoBps',0)>0]
    if not activos or sum(s.get('pesoBps',0) for s in sectores)!=10000 or any(s['validos']==0 for s in activos):return None
    return {identificador:sum((Fraction(s['votos'].get(identificador,0),s['validos'])*s['pesoBps']/100 for s in activos),Fraction()) for identificador in candidatos}


def evaluar_regla(proceso, votos, sectores, pendientes, revisiones, filtrado=False):
    regla=proceso.get('reglaSegundaVuelta')
    def respuesta(estado,descripcion,ids=None):return {'estado':estado,'descripcion':descripcion,'candidatos':ids or [],'provisional':True}
    if not regla:return respuesta('desactivada','Regla de segunda vuelta desactivada.')
    if filtrado:return respuesta('parcial','La vista filtrada no determina el resultado de toda la elección.')
    if pendientes or revisiones:return respuesta('provisional','Faltan mesas o hay actas por revisar. No se determina ganador ni segunda vuelta.')
    if not proceso.get('mesas') or not sum(votos.values()):return respuesta('pendiente_datos','No hay votos válidos suficientes para evaluar la regla.')
    ponderados=porcentajes_ponderados(sectores,votos) if proceso.get('ponderacion') else None
    if proceso.get('ponderacion') and ponderados is None:return respuesta('pendiente_datos','Faltan votos válidos en algún sector con peso; no se redistribuyen pesos.')
    puntajes=ponderados if proceso.get('ponderacion') else {i:Fraction(v*100,sum(votos.values())) for i,v in votos.items()}
    umbral=Fraction(str(regla['umbral']))
    def supera(valor):return valor>umbral if regla.get('estricto',True) else valor>=umbral
    if regla['modo']=='por_sector':
        if not sectores or any(s['validos']==0 for s in sectores):return respuesta('pendiente_datos','Faltan votos válidos por sector para evaluar la regla.')
        ganadores=[i for i in votos if all(supera(Fraction(s['votos'].get(i,0)*100,s['validos'])) for s in sectores)]
    else:ganadores=[i for i in votos if supera(puntajes[i])]
    if len(ganadores)==1:return respuesta('posible_ganador','Cumple el umbral configurado. Requiere revisión administrativa; no es una proclamación oficial.',ganadores)
    if len(ganadores)>1:return respuesta('requiere_revision','Más de un candidato cumple el umbral. Revisa la configuración.')
    orden=sorted(puntajes,key=lambda i:(-puntajes[i],i))
    if len(orden)<2 or proceso.get('vuelta',1)>=2:return respuesta('requiere_revision','No se determina automáticamente otra vuelta.')
    if len(orden)>2 and puntajes[orden[1]]==puntajes[orden[2]]:return respuesta('requiere_revision','Empate en el puesto de clasificación. Requiere revisión.')
    return respuesta('posible_segunda_vuelta','Nadie cumple el umbral. Se sugieren dos participantes según el total '+('ponderado.' if proceso.get('ponderacion') else 'de votos válidos.'),orden[:2])
