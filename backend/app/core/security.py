from datetime import datetime, timedelta, timezone
from jose import jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import base64, hashlib
from .config import settings
pwd=CryptContext(schemes=['bcrypt'], deprecated='auto')
def hash_password(p): return pwd.hash(p)
def verify_password(p,h): return pwd.verify(p,h)
def token(data, refresh=False):
    exp=datetime.now(timezone.utc)+timedelta(days=7 if refresh else 0, minutes=0 if refresh else settings.jwt_expires_minutes)
    return jwt.encode({**data,'exp':exp}, settings.jwt_refresh_secret if refresh else settings.jwt_secret, algorithm='HS256')
def decode(t, refresh=False): return jwt.decode(t, settings.jwt_refresh_secret if refresh else settings.jwt_secret, algorithms=['HS256'])
def fernet(): return Fernet(base64.urlsafe_b64encode(hashlib.sha256(settings.encryption_key.encode()).digest()))
def encrypt(v): return fernet().encrypt((v or '').encode()).decode()
def decrypt(v): return fernet().decrypt(v.encode()).decode() if v else None
