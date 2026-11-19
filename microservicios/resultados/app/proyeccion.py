"""Cálculo puro: cada mesa aporta una sola instantánea vigente."""
def resumir(proceso, mesas):
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
    return {'esperadas': len(configuradas), 'contabilizadas': contabilizadas, 'pendientes': len(configuradas) - contabilizadas,
            'observadas': observadas, 'avance': round(contabilizadas * 100 / len(configuradas), 2) if configuradas else 0,
            'blancos': blancos, 'nulos': nulos, 'total': total, 'validos': validos,
            'candidatos': list(candidatos.values()), 'unidades': list(unidades.values())}
