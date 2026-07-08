from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from app.core.config import settings
from app.core.db import get_db
from app.core.security import verify_password, token, decode, encrypt
from app.api.deps import current_user
from app.models.domain import *
from app.services.notifications import notify_delivery, WhatsMeowProvider
from app.services.audit import audit
import uuid
app=FastAPI(title='PortariaFlow API',version='0.1.0')
app.state.limiter=Limiter(key_func=get_remote_address)
app.add_middleware(CORSMiddleware,allow_origins=settings.cors_origins.split(','),allow_credentials=True,allow_methods=['*'],allow_headers=['*'])
class Login(BaseModel): email:str; password:str
class TenantIn(BaseModel): name:str; document:str|None=None
class UnitIn(BaseModel): number:str; floor:str|None=None; building_id:str|None=None
class ResidentIn(BaseModel): name:str; unit_id:str|None=None; document:str|None=None; phone:str|None=None; whatsapp:str|None=None; email:str|None=None
class DeliveryIn(BaseModel): unit_id:str|None=None; resident_id:str|None=None; carrier:str|None=None; tracking_code:str|None=None; recipient_name:str; delivered_by:str|None=None; notes:str|None=None; photo_url:str|None=None
class PickupIn(BaseModel): picked_by_name:str; picked_by_document:str|None=None; signature:str|None=None; photo_url:str|None=None
class CameraIn(BaseModel): name:str; location:str|None=None; rtsp_url:str|None=None; stream_url:str|None=None; username:str|None=None; password:str|None=None; manufacturer:str|None=None; model:str|None=None
class AccessIn(BaseModel): external_id:str|None=None; tenant_id:str|None=None; device:str|None=None; location:str|None=None; direction:str='entry'; person_name:str|None=None; unit:str|None=None; method:str|None=None; status:str='authorized'; denied_reason:str|None=None; image_url:str|None=None; raw_payload:dict={}
@app.get('/health')
def health(): return {'status':'ok'}
@app.post('/auth/login')
def login(data:Login, request:Request, db:Session=Depends(get_db)):
    u=db.query(User).filter_by(email=data.email).first()
    if not u or not verify_password(data.password,u.password_hash): raise HTTPException(401,'invalid credentials')
    audit(db,u,'login','auth',request=request)
    payload={'sub':u.id,'tenant_id':u.tenant_id,'role':u.role.name if u.role else None}
    return {'access_token':token(payload),'refresh_token':token(payload,True),'user':{'id':u.id,'name':u.name,'email':u.email,'role':payload['role'],'tenant_id':u.tenant_id}}
@app.post('/auth/refresh')
def refresh(refresh_token:str): return {'access_token':token(decode(refresh_token,True))}
@app.get('/dashboard')
def dashboard(user:User=Depends(current_user), db:Session=Depends(get_db)):
    tid=user.tenant_id
    q=lambda m: db.query(m).filter_by(tenant_id=tid).count() if tid else db.query(m).count()
    pending=db.query(Delivery).filter(Delivery.tenant_id==tid, Delivery.status.in_(['received_at_gate','waiting_pickup','notified'])).count() if tid else 0
    return {'pending_deliveries':pending,'received_today':0,'waiting_pickup':pending,'visitors_inside':0,'entries_today':0,'exits_today':0,'cameras_online':db.query(Camera).filter_by(tenant_id=tid,status='online').count() if tid else 0,'cameras_offline':db.query(Camera).filter_by(tenant_id=tid,status='offline').count() if tid else 0,'recent_alerts':[],'latest_incidents':[],'whatsapp_status':'disconnected','access_control_status':'ready','totals':{'units':q(Unit),'residents':q(Resident),'deliveries':q(Delivery)}}
@app.get('/tenants')
def tenants(user:User=Depends(current_user),db:Session=Depends(get_db)): return db.query(Tenant).all()
@app.post('/tenants')
def create_tenant(data:TenantIn,user:User=Depends(current_user),db:Session=Depends(get_db)):
    if user.role.name!='super_admin': raise HTTPException(403)
    t=Tenant(**data.model_dump()); db.add(t); db.commit(); audit(db,user,'create','tenant',after={'id':t.id}); return t
@app.get('/units')
def units(user:User=Depends(current_user),db:Session=Depends(get_db)): return db.query(Unit).filter_by(tenant_id=user.tenant_id).all()
@app.post('/units')
def create_unit(data:UnitIn,user:User=Depends(current_user),db:Session=Depends(get_db)): o=Unit(tenant_id=user.tenant_id,**data.model_dump()); db.add(o); db.commit(); audit(db,user,'create','unit',after={'id':o.id}); return o
@app.get('/residents')
def residents(user:User=Depends(current_user),db:Session=Depends(get_db)): return db.query(Resident).filter_by(tenant_id=user.tenant_id).all()
@app.post('/residents')
def create_resident(data:ResidentIn,user:User=Depends(current_user),db:Session=Depends(get_db)): o=Resident(tenant_id=user.tenant_id,**data.model_dump()); db.add(o); db.commit(); audit(db,user,'create','resident',after={'id':o.id}); return o
@app.get('/deliveries')
def deliveries(user:User=Depends(current_user),db:Session=Depends(get_db)): return db.query(Delivery).filter_by(tenant_id=user.tenant_id).order_by(Delivery.created_at.desc()).all()
@app.post('/deliveries')
async def create_delivery(data:DeliveryIn,user:User=Depends(current_user),db:Session=Depends(get_db)):
    d=Delivery(tenant_id=user.tenant_id,protocol='PF-'+uuid.uuid4().hex[:8].upper(),doorman_id=user.id,**data.model_dump()); db.add(d); db.commit(); db.refresh(d); db.add(DeliveryEvent(tenant_id=user.tenant_id,delivery_id=d.id,type='created',description='Entrega recebida na portaria')); db.commit(); r=db.get(Resident,d.resident_id) if d.resident_id else None; await notify_delivery(db,user.tenant_id,r,d); audit(db,user,'create','delivery',after={'id':d.id}); return d
@app.get('/deliveries/{id}')
def delivery(id:str,user:User=Depends(current_user),db:Session=Depends(get_db)):
    d=db.get(Delivery,id)
    if not d or d.tenant_id!=user.tenant_id: raise HTTPException(404)
    return {'delivery':d,'events':db.query(DeliveryEvent).filter_by(delivery_id=id).all(),'pickup':db.query(DeliveryPickup).filter_by(delivery_id=id).first(),'notifications':db.query(NotificationLog).filter_by(related_entity=id).all()}
@app.post('/deliveries/{id}/photos')
def add_photo(id:str, object_key:str, signed_url:str|None=None,user:User=Depends(current_user),db:Session=Depends(get_db)): p=DeliveryPhoto(tenant_id=user.tenant_id,delivery_id=id,object_key=object_key,signed_url=signed_url); db.add(p); db.commit(); return p
@app.post('/deliveries/{id}/pickup')
def pickup(id:str,data:PickupIn,user:User=Depends(current_user),db:Session=Depends(get_db)):
    d=db.get(Delivery,id)
    if not d or d.tenant_id!=user.tenant_id: raise HTTPException(404)
    if d.status in ['picked_up_by_resident','picked_up_by_authorized','returned','cancelled']: raise HTTPException(400,'invalid status')
    p=DeliveryPickup(tenant_id=user.tenant_id,delivery_id=id,**data.model_dump()); d.status='picked_up_by_resident'; d.picked_up_at=func.now(); db.add(p); db.add(DeliveryEvent(tenant_id=user.tenant_id,delivery_id=id,type='pickup',description=f'Retirada por {data.picked_by_name}')); db.commit(); audit(db,user,'pickup','delivery',after={'id':id}); return p
@app.post('/deliveries/{id}/notify')
async def resend(id:str,user:User=Depends(current_user),db:Session=Depends(get_db)): d=db.get(Delivery,id); await notify_delivery(db,user.tenant_id,db.get(Resident,d.resident_id) if d and d.resident_id else None,d); return {'status':'queued'}
@app.post('/access/webhook')
def access_webhook(data:AccessIn, db:Session=Depends(get_db)): ev=AccessEvent(tenant_id=data.tenant_id,**data.model_dump(exclude={'tenant_id'})); db.add(ev); db.commit(); return {'stored':True,'id':ev.id}
@app.get('/access/events')
def access_events(user:User=Depends(current_user),db:Session=Depends(get_db)): return db.query(AccessEvent).filter_by(tenant_id=user.tenant_id).order_by(AccessEvent.created_at.desc()).all()
@app.get('/cameras')
def cameras(user:User=Depends(current_user),db:Session=Depends(get_db)): return db.query(Camera.id,Camera.name,Camera.location,Camera.stream_url,Camera.manufacturer,Camera.model,Camera.status,Camera.tags,Camera.snapshot_url).filter_by(tenant_id=user.tenant_id).all()
@app.post('/cameras')
def create_camera(data:CameraIn,user:User=Depends(current_user),db:Session=Depends(get_db)): c=Camera(tenant_id=user.tenant_id,name=data.name,location=data.location,stream_url=data.stream_url,manufacturer=data.manufacturer,model=data.model,rtsp_url_encrypted=encrypt(data.rtsp_url),username_encrypted=encrypt(data.username),password_encrypted=encrypt(data.password)); db.add(c); db.commit(); audit(db,user,'create','camera',after={'id':c.id}); return {'id':c.id,'name':c.name,'status':c.status}
@app.post('/cameras/{id}/test')
def test_camera(id:str): return {'status':'offline','message':'Conector MediaMTX/FFmpeg preparado para integração real'}
@app.get('/camera-mosaics')
def mosaics(user:User=Depends(current_user),db:Session=Depends(get_db)): return db.query(CameraMosaic).filter_by(tenant_id=user.tenant_id).all()
@app.post('/camera-mosaics')
def create_mosaic(name:str,layout:str='2x2',user:User=Depends(current_user),db:Session=Depends(get_db)): m=CameraMosaic(tenant_id=user.tenant_id,user_id=user.id,name=name,layout=layout); db.add(m); db.commit(); return m
@app.get('/notifications/whatsapp/status')
async def wa_status(): return await WhatsMeowProvider().getStatus()
@app.post('/notifications/whatsapp/connect')
async def wa_connect(): return await WhatsMeowProvider().reconnect()
@app.post('/notifications/whatsapp/send-test')
async def wa_test(to:str,message:str): return await WhatsMeowProvider().sendText(to,message)
@app.get('/reports/summary')
def reports(user:User=Depends(current_user),db:Session=Depends(get_db)): return {'deliveries':db.query(Delivery.status,func.count(Delivery.id)).filter_by(tenant_id=user.tenant_id).group_by(Delivery.status).all(),'notifications':db.query(NotificationLog.status,func.count(NotificationLog.id)).filter_by(tenant_id=user.tenant_id).group_by(NotificationLog.status).all()}
@app.get('/audit-logs')
def audit_logs(user:User=Depends(current_user),db:Session=Depends(get_db)): return db.query(AuditLog).filter_by(tenant_id=user.tenant_id).order_by(AuditLog.created_at.desc()).limit(100).all()
