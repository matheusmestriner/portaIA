from sqlalchemy import *
from sqlalchemy.orm import relationship
from .base import Base
import uuid

def uid(): return str(uuid.uuid4())
class Tenant(Base):
    __tablename__='tenants'; id=Column(String,primary_key=True,default=uid); name=Column(String,nullable=False); document=Column(String); status=Column(String,default='active'); created_at=Column(DateTime,server_default=func.now())
class Role(Base):
    __tablename__='roles'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String,ForeignKey('tenants.id'),nullable=True); name=Column(String); permissions=Column(JSON,default=list)
class User(Base):
    __tablename__='users'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String,ForeignKey('tenants.id'),nullable=True); role_id=Column(String,ForeignKey('roles.id')); name=Column(String); email=Column(String,unique=True); password_hash=Column(String); status=Column(String,default='active'); role=relationship('Role')
class Building(Base):
    __tablename__='buildings'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String,ForeignKey('tenants.id')); name=Column(String); tower=Column(String)
class Unit(Base):
    __tablename__='units'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String,ForeignKey('tenants.id')); building_id=Column(String,ForeignKey('buildings.id'),nullable=True); number=Column(String); floor=Column(String); status=Column(String,default='active')
class Resident(Base):
    __tablename__='residents'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String,ForeignKey('tenants.id')); unit_id=Column(String,ForeignKey('units.id'),nullable=True); name=Column(String); document=Column(String); phone=Column(String); whatsapp=Column(String); email=Column(String); status=Column(String,default='active'); notification_preference=Column(String,default='whatsapp'); notes=Column(Text)
class Delivery(Base):
    __tablename__='deliveries'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String,ForeignKey('tenants.id')); unit_id=Column(String,ForeignKey('units.id'),nullable=True); resident_id=Column(String,ForeignKey('residents.id'),nullable=True); protocol=Column(String,unique=True); carrier=Column(String); tracking_code=Column(String); recipient_name=Column(String); delivered_by=Column(String); doorman_id=Column(String,ForeignKey('users.id'),nullable=True); status=Column(String,default='received_at_gate'); notes=Column(Text); photo_url=Column(String); created_at=Column(DateTime,server_default=func.now()); picked_up_at=Column(DateTime)
class DeliveryPhoto(Base):
    __tablename__='delivery_photos'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String); delivery_id=Column(String,ForeignKey('deliveries.id')); object_key=Column(String); signed_url=Column(String); created_at=Column(DateTime,server_default=func.now())
class DeliveryEvent(Base):
    __tablename__='delivery_events'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String); delivery_id=Column(String,ForeignKey('deliveries.id')); type=Column(String); description=Column(Text); payload=Column(JSON,default=dict); created_at=Column(DateTime,server_default=func.now())
class DeliveryPickup(Base):
    __tablename__='delivery_pickups'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String); delivery_id=Column(String,ForeignKey('deliveries.id')); picked_by_name=Column(String); picked_by_document=Column(String); signature=Column(Text); photo_url=Column(String); created_at=Column(DateTime,server_default=func.now())
class Visitor(Base):
    __tablename__='visitors'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String); name=Column(String); document=Column(String); phone=Column(String); unit_id=Column(String); resident_id=Column(String); status=Column(String,default='waiting_authorization'); reason=Column(String); photo_url=Column(String); entered_at=Column(DateTime); exited_at=Column(DateTime)
class AccessDevice(Base):
    __tablename__='access_devices'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String); name=Column(String); location=Column(String); integration_type=Column(String)
class AccessEvent(Base):
    __tablename__='access_events'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String); external_id=Column(String); device=Column(String); location=Column(String); direction=Column(String); person_name=Column(String); unit=Column(String); method=Column(String); status=Column(String); denied_reason=Column(String); image_url=Column(String); raw_payload=Column(JSON); created_at=Column(DateTime,server_default=func.now())
class CameraGroup(Base):
    __tablename__='camera_groups'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String); name=Column(String)
class Camera(Base):
    __tablename__='cameras'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String); group_id=Column(String,ForeignKey('camera_groups.id'),nullable=True); name=Column(String); location=Column(String); rtsp_url_encrypted=Column(Text); stream_url=Column(String); username_encrypted=Column(Text); password_encrypted=Column(Text); manufacturer=Column(String); model=Column(String); status=Column(String,default='offline'); tags=Column(JSON,default=list); snapshot_url=Column(String); notes=Column(Text)
class CameraMosaic(Base):
    __tablename__='camera_mosaics'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String); user_id=Column(String); name=Column(String); layout=Column(String,default='2x2')
class CameraMosaicItem(Base):
    __tablename__='camera_mosaic_items'; id=Column(String,primary_key=True,default=uid); mosaic_id=Column(String,ForeignKey('camera_mosaics.id')); camera_id=Column(String); position=Column(Integer); config=Column(JSON,default=dict)
class Incident(Base):
    __tablename__='incidents'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String); type=Column(String); description=Column(Text); status=Column(String,default='open'); priority=Column(String,default='medium'); created_at=Column(DateTime,server_default=func.now())
class NotificationProvider(Base):
    __tablename__='notification_providers'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String); type=Column(String); status=Column(String,default='disconnected'); config=Column(JSON,default=dict)
class NotificationLog(Base):
    __tablename__='notification_logs'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String); provider=Column(String); to=Column(String); message=Column(Text); status=Column(String); error=Column(Text); related_entity=Column(String); created_at=Column(DateTime,server_default=func.now())
class WhatsappSession(Base):
    __tablename__='whatsapp_sessions'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String); status=Column(String,default='waiting_qr'); qr_code=Column(Text); updated_at=Column(DateTime,server_default=func.now())
class AuditLog(Base):
    __tablename__='audit_logs'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String,nullable=True); user_id=Column(String,nullable=True); role=Column(String); ip=Column(String); user_agent=Column(String); action=Column(String); entity=Column(String); before=Column(JSON); after=Column(JSON); created_at=Column(DateTime,server_default=func.now())
class Plan(Base):
    __tablename__='plans'; id=Column(String,primary_key=True,default=uid); name=Column(String); limits=Column(JSON,default=dict); price_cents=Column(Integer,default=0)
class Subscription(Base):
    __tablename__='subscriptions'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String); plan_id=Column(String); status=Column(String,default='active')
class UsageEvent(Base):
    __tablename__='usage_events'; id=Column(String,primary_key=True,default=uid); tenant_id=Column(String); metric=Column(String); quantity=Column(Integer,default=1); created_at=Column(DateTime,server_default=func.now())
