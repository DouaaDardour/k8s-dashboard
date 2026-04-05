from sqlalchemy import Column, String, Integer, DateTime, Text, JSON
from sqlalchemy.sql import func
from app.database import Base


class RawLog(Base):
    __tablename__ = "raw_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    namespace = Column(String(255), nullable=False, index=True)
    pod_name = Column(String(255), nullable=False, index=True)
    container_name = Column(String(255), nullable=True)
    message = Column(Text, nullable=False)
    log_level = Column(String(20), nullable=True)
    raw_json = Column(JSON, nullable=True)
    source_ip = Column(String(45), nullable=True)
