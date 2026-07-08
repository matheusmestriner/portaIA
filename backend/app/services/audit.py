from app.models.domain import AuditLog
def audit(db, user, action, entity, before=None, after=None, request=None):
    db.add(AuditLog(tenant_id=getattr(user,'tenant_id',None), user_id=getattr(user,'id',None), role=getattr(getattr(user,'role',None),'name',None), ip=request.client.host if request else None, user_agent=request.headers.get('user-agent') if request else None, action=action, entity=entity, before=before, after=after)); db.commit()
