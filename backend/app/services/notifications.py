import httpx
from app.core.config import settings
from app.models.domain import NotificationLog
class MessageProvider:
    async def sendText(self,to,message): raise NotImplementedError
    async def sendMedia(self,to,mediaUrl,caption): raise NotImplementedError
    async def getStatus(self): raise NotImplementedError
    async def reconnect(self): raise NotImplementedError
    async def disconnect(self): raise NotImplementedError
class WhatsMeowProvider(MessageProvider):
    async def sendText(self,to,message):
        async with httpx.AsyncClient(timeout=5) as c: return (await c.post(f'{settings.whatsapp_service_url}/send-text',json={'to':to,'message':message})).json()
    async def sendMedia(self,to,mediaUrl,caption):
        async with httpx.AsyncClient(timeout=5) as c: return (await c.post(f'{settings.whatsapp_service_url}/send-media',json={'to':to,'mediaUrl':mediaUrl,'caption':caption})).json()
    async def getStatus(self):
        async with httpx.AsyncClient(timeout=5) as c: return (await c.get(f'{settings.whatsapp_service_url}/status')).json()
    async def reconnect(self):
        async with httpx.AsyncClient(timeout=5) as c: return (await c.post(f'{settings.whatsapp_service_url}/connect')).json()
    async def disconnect(self):
        async with httpx.AsyncClient(timeout=5) as c: return (await c.post(f'{settings.whatsapp_service_url}/disconnect')).json()
async def notify_delivery(db, tenant_id, resident, delivery, tenant_name='condomínio'):
    msg=f'Olá, {resident.name if resident else delivery.recipient_name}. Sua entrega foi recebida na portaria do condomínio {tenant_name}. Unidade: {delivery.unit_id or "não informada"}. Transportadora: {delivery.carrier or "não informada"}. Retire quando possível. Protocolo: {delivery.protocol}.'
    status='pending'; err=None
    try:
        if resident and resident.whatsapp:
            await WhatsMeowProvider().sendText(resident.whatsapp,msg); status='sent'
    except Exception as e: err=str(e)
    db.add(NotificationLog(tenant_id=tenant_id,provider='whatsmeow',to=getattr(resident,'whatsapp',None),message=msg,status=status,error=err,related_entity=delivery.id)); db.commit()
