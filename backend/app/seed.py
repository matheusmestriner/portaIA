from app.core.db import SessionLocal, engine
from app.models.base import Base
from app.models.domain import *
from app.core.security import hash_password
Base.metadata.create_all(engine)
db=SessionLocal()
try:
    if not db.query(User).filter_by(email='superadmin@portariaflow.local').first():
        t=Tenant(name='Condomínio Demo',document='00000000000000'); db.add(t); db.flush()
        sr=Role(name='super_admin',permissions=['*']); ar=Role(tenant_id=t.id,name='condo_admin',permissions=['manage:*']); pr=Role(tenant_id=t.id,name='doorman',permissions=['deliveries:*','visitors:*','access:read','cameras:read']); mr=Role(tenant_id=t.id,name='resident',permissions=['self:read']); sec=Role(tenant_id=t.id,name='security',permissions=['cameras:*','access:*','incidents:*'])
        db.add_all([sr,ar,pr,mr,sec]); db.flush()
        db.add(User(name='Super Admin',email='superadmin@portariaflow.local',password_hash=hash_password('ChangeMe123!'),role_id=sr.id,tenant_id=None))
        db.add(User(name='Admin Demo',email='admin@demo.local',password_hash=hash_password('ChangeMe123!'),role_id=ar.id,tenant_id=t.id))
        db.add_all([Plan(name='Básico',limits={'residents':200,'cameras':4,'whatsapp_per_month':500},price_cents=19900),Plan(name='Profissional',limits={'residents':1000,'cameras':32,'whatsapp_per_month':5000},price_cents=49900),Plan(name='Enterprise',limits={'residents':999999,'cameras':999,'whatsapp_per_month':999999},price_cents=0)])
        db.commit()
finally: db.close()
