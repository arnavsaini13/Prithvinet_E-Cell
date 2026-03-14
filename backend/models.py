"""
PrithviNet - SQLAlchemy ORM Models
Defines the database schema for users, monitoring stations, pollution readings,
industries, and alerts.
"""

from datetime import datetime
from sqlalchemy import Integer, String, Float, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


# ──────────────────────────────────────────────
# User & Authentication
# ──────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(300), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(300), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="citizen")
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


# ──────────────────────────────────────────────
# Environmental Monitoring
# ──────────────────────────────────────────────

class MonitoringStation(Base):
    __tablename__ = "monitoring_stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    region: Mapped[str] = mapped_column(String(100), nullable=False)

    readings: Mapped[list["PollutionReading"]] = relationship(back_populates="station")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="station")


class PollutionReading(Base):
    __tablename__ = "pollution_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    station_id: Mapped[int] = mapped_column(Integer, ForeignKey("monitoring_stations.id"), nullable=False)

    # Air pollution
    pm25: Mapped[float] = mapped_column(Float, nullable=False)
    pm10: Mapped[float] = mapped_column(Float, nullable=False)
    co2: Mapped[float] = mapped_column(Float, nullable=False)
    no2: Mapped[float] = mapped_column(Float, nullable=False)

    # Water quality
    ph: Mapped[float] = mapped_column(Float, nullable=False)
    turbidity: Mapped[float] = mapped_column(Float, nullable=False)
    dissolved_oxygen: Mapped[float] = mapped_column(Float, nullable=False)

    # Noise
    noise_level: Mapped[float] = mapped_column(Float, nullable=False)

    timestamp: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    station: Mapped["MonitoringStation"] = relationship(back_populates="readings")


class Industry(Base):
    __tablename__ = "industries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str] = mapped_column(String(300), nullable=False)
    compliance_score: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    station_id: Mapped[int] = mapped_column(Integer, ForeignKey("monitoring_stations.id"), nullable=False)
    pollutant: Mapped[str] = mapped_column(String(50), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # low, medium, high, critical
    timestamp: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    station: Mapped["MonitoringStation"] = relationship(back_populates="alerts")
