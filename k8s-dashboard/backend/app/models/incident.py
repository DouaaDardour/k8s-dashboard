from sqlalchemy import (
    Column, String, Integer, Float, DateTime, Boolean,
    Text, ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class SeverityLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IncidentStatus(str, enum.Enum):
    OPEN = "open"
    AUTO_PENDING = "auto_pending"
    REMEDIATING = "remediating"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"


class IncidentCategory(str, enum.Enum):
    SECURITY = "security"
    RELIABILITY = "reliability"
    PERFORMANCE = "performance"


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(100), nullable=False)              # crash_loop, sql_injection, brute_force…
    severity = Column(SAEnum(SeverityLevel), nullable=False)
    category = Column(SAEnum(IncidentCategory), nullable=False)
    score = Column(Float, nullable=False)
    status = Column(SAEnum(IncidentStatus), default=IncidentStatus.OPEN, nullable=False)
    namespace = Column(String(255), nullable=False, index=True)
    pod_name = Column(String(255), nullable=True, index=True)
    container_name = Column(String(255), nullable=True)
    detected_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)    # payload ML, logs bruts associés

    actions = relationship("IncidentAction", back_populates="incident", cascade="all, delete-orphan")
    timers = relationship("IncidentTimer", back_populates="incident", cascade="all, delete-orphan")


class IncidentAction(Base):
    __tablename__ = "incident_actions"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False, index=True)
    playbook = Column(String(100), nullable=False)
    delay_s = Column(Integer, default=0)
    executed_at = Column(DateTime(timezone=True), nullable=True, index=True)
    result = Column(String(50), nullable=True)             # success, failed, cancelled
    error = Column(Text, nullable=True)

    incident = relationship("Incident", back_populates="actions")


class IncidentTimer(Base):
    __tablename__ = "incident_timers"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False, index=True)
    celery_task_id = Column(String(255), nullable=False)
    eta = Column(DateTime(timezone=True), nullable=False, index=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)

    incident = relationship("Incident", back_populates="timers")


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id = Column(Integer, primary_key=True, index=True)
    computed_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    score = Column(Float, nullable=False)
    level = Column(SAEnum(SeverityLevel), nullable=False)
    namespace = Column(String(255), nullable=True, index=True)
    security_score = Column(Float, default=0.0)
    reliability_score = Column(Float, default=0.0)
    frequency_score = Column(Float, default=0.0)
    breakdown = Column(JSON, nullable=True)


class BlockedIP(Base):
    __tablename__ = "blocked_ips"

    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String(45), nullable=False, index=True)
    blocked_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    namespace = Column(String(255), nullable=True)
    reason = Column(String(255), nullable=True)
    auto_blocked = Column(Boolean, default=True)


class CircuitBreaker(Base):
    __tablename__ = "circuit_breaker"

    id = Column(Integer, primary_key=True, index=True)
    service = Column(String(100), nullable=False, unique=True, index=True)
    state = Column(String(20), default="closed")           # closed, open, half_open
    fail_count = Column(Integer, default=0)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    reset_at = Column(DateTime(timezone=True), nullable=True)


class NotificationLog(Base):
    __tablename__ = "notification_log"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)
    channel = Column(String(50), nullable=False)           # slack, email
    status = Column(String(20), nullable=False)            # sent, failed
    message_preview = Column(String(500), nullable=True)
    sent_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
