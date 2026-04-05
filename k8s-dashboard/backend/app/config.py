from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/k8s_platform"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ML_SERVICE_URL: str = "http://localhost:8001"
    SLACK_WEBHOOK_URL: Optional[str] = None
    SLACK_SIGNING_SECRET: Optional[str] = None
    AWS_SES_REGION: str = "eu-west-1"
    ALERT_EMAIL_FROM: Optional[str] = None
    ALERT_EMAIL_TO: Optional[str] = None
    RISK_THRESHOLD_MEDIUM: int = 26
    RISK_THRESHOLD_HIGH: int = 51
    RISK_THRESHOLD_CRITICAL: int = 76
    IR_DELAY_IMMEDIATE: int = 0
    IR_DELAY_ML_DETECTION: int = 120
    IR_DELAY_ROLLBACK: int = 300
    CIRCUIT_BREAKER_FAIL_THRESHOLD: int = 3
    CIRCUIT_BREAKER_RESET_TIMEOUT: int = 300
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        extra = "ignore"   # ignore SECRET_KEY et toute variable inconnue


settings = Settings()
