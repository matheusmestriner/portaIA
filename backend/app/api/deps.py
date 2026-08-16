from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import decode
from app.models.domain import User

def current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith('Bearer '): raise HTTPException(401,'missing token')
    data=decode(authorization.split(' ',1)[1]); user=db.get(User,data['sub'])
    if not user: raise HTTPException(401,'invalid token')
    return user
def tenant_id(user: User = Depends(current_user)):
    if not user.tenant_id and user.role and user.role.name!='super_admin': raise HTTPException(403,'tenant required')
    return user.tenant_id
