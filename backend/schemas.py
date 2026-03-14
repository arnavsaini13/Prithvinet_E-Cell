"""
PrithviNet - Pydantic Schemas
Request/response models for API validation and serialization.
"""

from datetime import datetime
from enum import Enum
from pydantic import BaseModel, EmailStr


# ---------- Roles ----------

class UserRole(str, Enum):
    admin = "admin"
    regional_officer = "regional_officer"
    industry_user = "industry_user"
    citizen = "citizen"


# ---------- User / Auth ----------

class UserRegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.citizen
    region: str | None = None


class UserLoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    region: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Monitoring Station ----------

class StationOut(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    region: str

    model_config = {"from_attributes": True}


# ---------- Pollution Reading ----------

class SensorDataIn(BaseModel):
    """Payload sent by the IoT simulator."""
    station_id: int
    pm25: float
    pm10: float
    co2: float
    no2: float
    ph: float
    turbidity: float
    dissolved_oxygen: float
    noise_level: float


class PollutionReadingOut(BaseModel):
    id: int
    station_id: int
    pm25: float
    pm10: float
    co2: float
    no2: float
    ph: float
    turbidity: float
    dissolved_oxygen: float
    noise_level: float
    timestamp: datetime

    model_config = {"from_attributes": True}


# ---------- Alert ----------

class AlertOut(BaseModel):
    id: int
    station_id: int
    pollutant: str
    value: float
    severity: str
    timestamp: datetime

    model_config = {"from_attributes": True}


# ---------- Industry ----------

class IndustryOut(BaseModel):
    id: int
    name: str
    location: str
    compliance_score: float

    model_config = {"from_attributes": True}


# ---------- Heatmap ----------

class HeatmapPoint(BaseModel):
    latitude: float
    longitude: float
    intensity: float
    pollutant: str


# ---------- Risk Score ----------

class RiskScoreOut(BaseModel):
    station_id: int
    station_name: str
    air_quality_index: float
    water_quality_index: float
    noise_index: float
    overall_risk: float
    risk_level: str  # low, moderate, high, critical


# ---------- Forecast ----------

class ForecastPoint(BaseModel):
    timestamp: str
    predicted_value: float
    lower_bound: float
    upper_bound: float


class ForecastOut(BaseModel):
    station_id: int
    pollutant: str
    forecast: list[ForecastPoint]
