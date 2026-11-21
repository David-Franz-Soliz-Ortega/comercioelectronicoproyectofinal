"""Consulta de asignación por gRPC: deadline obligatorio, sin reintentos de escritura."""
import importlib
import os
import sys
from pathlib import Path
from fastapi import HTTPException
import grpc

CODIGOS = {grpc.StatusCode.UNAUTHENTICATED:401, grpc.StatusCode.PERMISSION_DENIED:403,
           grpc.StatusCode.INVALID_ARGUMENT:422, grpc.StatusCode.NOT_FOUND:404,
           grpc.StatusCode.FAILED_PRECONDITION:409, grpc.StatusCode.DEADLINE_EXCEEDED:504,
           grpc.StatusCode.UNAVAILABLE:503, grpc.StatusCode.CANCELLED:503}


def consultar_mesa(req, identificador, para_registro=False, id_registro="", finalizar_registro=False):
    carpeta = str(Path(os.getenv('CONTRATOS_GENERADOS', Path(__file__).parent/'generado')).resolve())
    if carpeta not in sys.path: sys.path.insert(0, carpeta)
    try:
        mensajes = importlib.import_module('mesa_v1_pb2')
        servicios = importlib.import_module('mesa_v1_pb2_grpc')
    except ImportError: raise HTTPException(503, 'Contrato gRPC no generado') from None
    metadata = [(k.lower(), req.headers.get(k,'')) for k in ('Cookie','Origin','X-CSRF-Token','X-Organizacion','X-Correlation-ID')]
    metadata += [('x-clave-servicio',os.environ['CLAVE_SERVICIO'])]
    if getattr(req,'state',None) and getattr(req.state,'correlacion',None):metadata=[(k,v) for k,v in metadata if k!='x-correlation-id']+[('x-correlation-id',req.state.correlacion)]
    try:
        with grpc.insecure_channel(os.getenv('ELECCIONES_GRPC','elecciones:50051')) as canal:
            respuesta = servicios.ServicioMesasStub(canal).ConsultarMesa(mensajes.SolicitudMesa(id_mesa=str(identificador),para_registro=para_registro,id_registro=id_registro,finalizar_registro=finalizar_registro),timeout=1.2,metadata=metadata)
        return {'id':respuesta.id,'idProceso':respuesta.id_proceso,'codigo':respuesta.codigo,'unidad':respuesta.unidad,'sector':respuesta.sector or 'general','nombreProceso':respuesta.nombre_proceso,'estado':respuesta.estado_proceso,'candidatos':[{'id':c.id,'nombre':c.nombre} for c in respuesta.candidatos]}
    except grpc.RpcError as e: raise HTTPException(CODIGOS.get(e.code(),503),'Consulta de mesa no disponible') from None


from contextlib import contextmanager
from uuid import uuid4

@contextmanager
def registro_mesa(req, identificador):
    # Sin vencimiento automático: ante una caída, se bloquea el cierre antes que permitir escrituras tardías.
    registro=str(uuid4())
    try:
        mesa=consultar_mesa(req,identificador,True,registro)
        yield mesa
    finally:
        # También libera si el cliente agotó su deadline después de que Elecciones registrara la reserva.
        for intento in range(2):
            try:
                consultar_mesa(req,identificador,False,registro,True)
                break
            except HTTPException:
                if intento==1:
                    # No ocultar un commit confirmado: el cierre detectará la reserva pendiente.
                    import logging
                    logging.getLogger(__name__).warning('No se pudo liberar un registro en curso; cierre bloqueado hasta revisión técnica')
