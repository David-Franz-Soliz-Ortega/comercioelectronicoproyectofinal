"""Cálculo puro: cada mesa aporta una sola instantánea vigente."""
def resumir(proceso, mesas):
    try: from .reglas import porcentajes_ponderados, evaluar_regla
    except ImportError:
        import importlib.util
        from pathlib import Path
        spec=importlib.util.spec_from_file_location('reglas_resultados',Path(__file__).with_name('reglas.py'));mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
        porcentajes_ponderados,evaluar_regla=mod.porcentajes_ponderados,mod.evaluar_regla
    configuradas = {str(m['id']): m for m in proceso['mesas']}
    candidatos = {str(c['id']): {**c, 'votos': 0} for c in proceso['candidatos']}
    unidades = {}
    for mesa in configuradas.values():
        unidades.setdefault(mesa['unidad'], {'unidad': mesa['unidad'], 'esperadas': 0, 'contabilizadas': 0})['esperadas'] += 1
    contabilizadas = observadas = blancos = nulos = total = 0
    for fila in mesas:
        if fila['idMesa'] not in configuradas: continue
        conteo = fila.get('conteo')
        if conteo:
            contabilizadas += 1
            unidades[configuradas[fila['idMesa']]['unidad']]['contabilizadas'] += 1
            for voto in conteo['votos']:
                if voto['idCandidato'] not in candidatos: raise ValueError('Candidato fuera del proceso')
                candidatos[voto['idCandidato']]['votos'] += voto['cantidad']
            blancos += conteo['blancos']; nulos += conteo['nulos']; total += conteo['total']
        elif fila.get('observada'): observadas += 1
    validos = sum(c['votos'] for c in candidatos.values())
    for candidato in candidatos.values(): candidato['porcentaje'] = round(candidato['votos'] * 100 / validos, 2) if validos else 0
    for unidad in unidades.values(): unidad['pendientes'] = unidad['esperadas'] - unidad['contabilizadas']
    definiciones=proceso.get('sectores') or [{'codigo':'general','nombre':'General','pesoBps':0}]
    sectores=[]
    for definicion in definiciones:
        codigo=definicion['codigo']; ids={i for i,m in configuradas.items() if m.get('sector','general')==codigo}
        votos={i:0 for i in candidatos};contadas=obs=sb=sn=st=0
        for fila in mesas:
            if fila['idMesa'] not in ids:continue
            c=fila.get('conteo')
            if c:
                contadas+=1;sb+=c['blancos'];sn+=c['nulos'];st+=c['total']
                for v in c['votos']:votos[v['idCandidato']]+=v['cantidad']
            elif fila.get('observada'):obs+=1
        validos_sector=sum(votos.values())
        sectores.append({**definicion,'esperadas':len(ids),'contabilizadas':contadas,'pendientes':len(ids)-contadas,'observadas':obs,'validos':validos_sector,'blancos':sb,'nulos':sn,'total':st,'votos':votos,
            'candidatos':[{'id':i,'nombre':candidatos[i]['nombre'],'votos':v,'porcentaje':round(v*100/validos_sector,2) if validos_sector else 0} for i,v in votos.items()]})
    ponderados=porcentajes_ponderados(sectores,candidatos) if proceso.get('ponderacion') else None
    for i,c in candidatos.items():c['porcentajePonderado']=round(float(ponderados[i]),2) if ponderados is not None else None
    revisiones=sum(1 for f in mesas if f['idMesa'] in configuradas and f.get('observada'))
    regla=evaluar_regla(proceso,{i:c['votos'] for i,c in candidatos.items()},sectores,len(configuradas)-contabilizadas,revisiones,proceso.get('filtroUnidad',False))
    return {'esperadas': len(configuradas), 'contabilizadas': contabilizadas, 'pendientes': len(configuradas) - contabilizadas,
            'observadas': observadas, 'avance': round(contabilizadas * 100 / len(configuradas), 2) if configuradas else 0,
            'blancos': blancos, 'nulos': nulos, 'total': total, 'validos': validos,
            'candidatos': list(candidatos.values()), 'unidades': list(unidades.values()),
            'sectores':[{k:v for k,v in s.items() if k!='votos'} for s in sectores], 'ponderacionAplicada':bool(proceso.get('ponderacion')),
            'requierenRevision':revisiones,'regla':regla}
