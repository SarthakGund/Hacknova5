from fastapi import FastAPI
from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime
from typing import Optional, List, Union
from uuid import uuid4


app = FastAPI(title="Flood Event Simulator")


# ===============================
# EVENT TYPES
# ===============================

class EventType(str, Enum):
    SOS = "sos"
    FLOOD_SENSOR = "flood_sensor"
    WEATHER = "weather"
    RESCUE_UPDATE = "rescue_update"
    SUPPLY_REQUEST = "supply_request"


# ===============================
# DATA MODELS
# ===============================

class Location(BaseModel):
    lat: float
    lon: float
    name: Optional[str] = None


class SOSPayload(BaseModel):
    message: str
    people: int
    location: Location


class FloodSensorPayload(BaseModel):
    sensor_id: str
    water_level: float
    threshold: float
    location: Location


class WeatherPayload(BaseModel):
    rainfall_mm: float
    wind_speed: float
    location: Location


class RescueUpdatePayload(BaseModel):
    team_id: str
    status: str
    location: Location


class SupplyRequestPayload(BaseModel):
    resource: str
    quantity: int
    location: Location


# ===============================
# GENERIC EVENT MODEL
# ===============================

class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: EventType
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    source: Optional[str] = None

    payload: Union[
        SOSPayload,
        FloodSensorPayload,
        WeatherPayload,
        RescueUpdatePayload,
        SupplyRequestPayload
    ]


# ===============================
# IN MEMORY EVENT STORE
# ===============================

EVENT_STORE: List[Event] = []


# ===============================
# WEBHOOK
# ===============================

@app.post("/events")
def receive_event(event: Event):

    EVENT_STORE.append(event)

    return {
        "status": "event_received",
        "event_id": event.id
    }


# ===============================
# VIEW EVENTS
# ===============================

@app.get("/events")
def get_events():
    return EVENT_STORE


# ===============================
# SIMULATION ENDPOINTS
# ===============================

@app.post("/simulate/sos")
def simulate_sos():

    event = Event(
        event_type=EventType.SOS,
        source="mobile_app",
        payload=SOSPayload(
            message="Help! Water rising",
            people=3,
            location=Location(lat=28.61, lon=77.20, name="Street 12")
        )
    )

    EVENT_STORE.append(event)

    return event


@app.post("/simulate/flood")
def simulate_flood():

    event = Event(
        event_type=EventType.FLOOD_SENSOR,
        source="river_sensor",
        payload=FloodSensorPayload(
            sensor_id="sensor_45",
            water_level=6.8,
            threshold=5.0,
            location=Location(lat=28.63, lon=77.21, name="River Station")
        )
    )

    EVENT_STORE.append(event)

    return event


@app.post("/simulate/weather")
def simulate_weather():

    event = Event(
        event_type=EventType.WEATHER,
        source="weather_api",
        payload=WeatherPayload(
            rainfall_mm=120,
            wind_speed=30,
            location=Location(lat=28.60, lon=77.18, name="City Center")
        )
    )

    EVENT_STORE.append(event)

    return event


@app.post("/simulate/supply")
def simulate_supply():

    event = Event(
        event_type=EventType.SUPPLY_REQUEST,
        source="community_center",
        payload=SupplyRequestPayload(
            resource="food",
            quantity=100,
            location=Location(lat=28.62, lon=77.19, name="Shelter A")
        )
    )

    EVENT_STORE.append(event)

    return event
