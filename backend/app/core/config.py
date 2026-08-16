from pydantic_settings import BaseSettings
class Settings(BaseSettings):
    database_url: str = 'sqlite:///./portariaflow.db'
    jwt_secret: str = 'dev-secret'
    jwt_refresh_secret: str = 'dev-refresh-secret'
    jwt_expires_minutes: int = 30
    cors_origins: str = 'http://localhost:3000'
    encryption_key: str = 'change-this-32-byte-key-local-dev!!'
    whatsapp_service_url: str = 'http://localhost:8081'
    class Config: env_file = '.env'
settings = Settings()
