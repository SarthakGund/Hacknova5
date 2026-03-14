from __future__ import annotations

import os
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, Union
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, Field

from agents.disaster_agent import run_disaster_agent
from routes.sensor_route import SensorId, SpikeRequest, StatusResponse, inject_spike


class RemoteSpikeWebhookRequest(BaseModel):
	sensor_id: SensorId
	spike_value: float = Field(..., description="Forced sensor value")
	duration_seconds: int = Field(..., gt=0, description="Spike duration in seconds")


class EventType(str, Enum):
	SOS = "sos"
	FLOOD_SENSOR = "flood_sensor"
	WEATHER = "weather"
	RESCUE_UPDATE = "rescue_update"
	SUPPLY_REQUEST = "supply_request"


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


class Event(BaseModel):
	id: str = Field(default_factory=lambda: str(uuid4()))
	event_type: EventType
	timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	source: Optional[str] = None
	payload: Union[
		SOSPayload,
		FloodSensorPayload,
		WeatherPayload,
		RescueUpdatePayload,
		SupplyRequestPayload,
	]


class EventReceivedResponse(BaseModel):
    status: str
    event_id: str


router = APIRouter(prefix="/remote/webhook", tags=["Remote Webhooks"])

EVENT_STORE: List[Event] = []
AGENT_INVOCATION_STORE: List[dict] = []


def _parse_bool_env(name: str, default: bool) -> bool:
	raw = os.getenv(name)
	if raw is None:
		return default
	return raw.strip().lower() in {"1", "true", "yes", "on"}


REMOTE_WEBHOOK_AGENT_DRY_RUN = _parse_bool_env("REMOTE_WEBHOOK_AGENT_DRY_RUN", True)
REMOTE_WEBHOOK_AGENT_MAX_ITERATIONS = int(os.getenv("REMOTE_WEBHOOK_AGENT_MAX_ITERATIONS", "20"))


def _event_to_agent_message(event: Event) -> str:
	return (
		"New remote webhook event received. Analyze and take action.\n"
		f"event_id={event.id}\n"
		f"event_type={event.event_type.value}\n"
		f"source={event.source or 'unknown'}\n"
		f"timestamp={event.timestamp.isoformat()}\n"
		f"payload={event.payload.model_dump_json()}"
	)


def _spike_to_agent_message(payload: RemoteSpikeWebhookRequest) -> str:
	return (
		"Remote webhook sensor spike triggered. Analyze risk and respond.\n"
		f"sensor_id={payload.sensor_id.value}\n"
		f"spike_value={payload.spike_value}\n"
		f"duration_seconds={payload.duration_seconds}"
	)


def _invoke_agent_from_webhook(*, trigger_type: str, trigger_ref: str, message: str) -> None:
	started_at = datetime.now(timezone.utc)
	try:
		result = run_disaster_agent(
			message=message,
			dry_run=REMOTE_WEBHOOK_AGENT_DRY_RUN,
			max_iterations=REMOTE_WEBHOOK_AGENT_MAX_ITERATIONS,
			session_id="remote_webhook",
			remember=True,
		)
		AGENT_INVOCATION_STORE.append(
			{
				"timestamp": started_at.isoformat(),
				"trigger_type": trigger_type,
				"trigger_ref": trigger_ref,
				"status": "ok",
				"dry_run": REMOTE_WEBHOOK_AGENT_DRY_RUN,
				"output": result.get("output"),
				"tool_calls_count": len(result.get("tool_calls", [])),
				"memory_turns": result.get("memory_turns", 0),
			}
		)
	except Exception as exc:
		AGENT_INVOCATION_STORE.append(
			{
				"timestamp": started_at.isoformat(),
				"trigger_type": trigger_type,
				"trigger_ref": trigger_ref,
				"status": "error",
				"dry_run": REMOTE_WEBHOOK_AGENT_DRY_RUN,
				"error": str(exc),
			}
		)


@router.post("/spike", response_model=StatusResponse)
async def remote_spike(payload: RemoteSpikeWebhookRequest, background_tasks: BackgroundTasks) -> StatusResponse:
	request = SpikeRequest(
		sensor_id=payload.sensor_id,
		spike_value=payload.spike_value,
		duration_seconds=payload.duration_seconds,
	)
	status = await inject_spike(request)

	background_tasks.add_task(
		_invoke_agent_from_webhook,
		trigger_type="spike",
		trigger_ref=payload.sensor_id.value,
		message=_spike_to_agent_message(payload),
	)
	return status


@router.post("/events", response_model=EventReceivedResponse)
async def receive_event(event: Event, background_tasks: BackgroundTasks) -> EventReceivedResponse:
	EVENT_STORE.append(event)
	background_tasks.add_task(
		_invoke_agent_from_webhook,
		trigger_type="event",
		trigger_ref=event.id,
		message=_event_to_agent_message(event),
	)
	return EventReceivedResponse(status="event_received", event_id=event.id)


@router.get("/events", response_model=List[Event])
async def get_events() -> List[Event]:
	return EVENT_STORE


@router.get("/agent-invocations")
async def get_agent_invocations() -> List[dict]:
	return AGENT_INVOCATION_STORE


@router.post("/simulate/sos", response_model=Event)
async def simulate_sos(background_tasks: BackgroundTasks) -> Event:
	event = Event(
		event_type=EventType.SOS,
		source="mobile_app",
		payload=SOSPayload(
			message="Help! Water rising",
			people=3,
			location=Location(lat=28.61, lon=77.20, name="Street 12"),
		),
	)
	EVENT_STORE.append(event)
	background_tasks.add_task(
		_invoke_agent_from_webhook,
		trigger_type="simulate",
		trigger_ref=event.id,
		message=_event_to_agent_message(event),
	)
	return event


@router.post("/simulate/flood", response_model=Event)
async def simulate_flood(background_tasks: BackgroundTasks) -> Event:
	event = Event(
		event_type=EventType.FLOOD_SENSOR,
		source="river_sensor",
		payload=FloodSensorPayload(
			sensor_id="sensor_45",
			water_level=6.8,
			threshold=5.0,
			location=Location(lat=28.63, lon=77.21, name="River Station"),
		),
	)
	EVENT_STORE.append(event)
	background_tasks.add_task(
		_invoke_agent_from_webhook,
		trigger_type="simulate",
		trigger_ref=event.id,
		message=_event_to_agent_message(event),
	)
	return event


@router.post("/simulate/weather", response_model=Event)
async def simulate_weather(background_tasks: BackgroundTasks) -> Event:
	event = Event(
		event_type=EventType.WEATHER,
		source="weather_api",
		payload=WeatherPayload(
			rainfall_mm=120,
			wind_speed=30,
			location=Location(lat=28.60, lon=77.18, name="City Center"),
		),
	)
	EVENT_STORE.append(event)
	background_tasks.add_task(
		_invoke_agent_from_webhook,
		trigger_type="simulate",
		trigger_ref=event.id,
		message=_event_to_agent_message(event),
	)
	return event


@router.post("/simulate/rescue", response_model=Event)
async def simulate_rescue_update(background_tasks: BackgroundTasks) -> Event:
	event = Event(
		event_type=EventType.RESCUE_UPDATE,
		source="rescue_ops",
		payload=RescueUpdatePayload(
			team_id="team_alpha_2",
			status="en_route",
			location=Location(lat=28.615, lon=77.205, name="Sector B"),
		),
	)
	EVENT_STORE.append(event)
	background_tasks.add_task(
		_invoke_agent_from_webhook,
		trigger_type="simulate",
		trigger_ref=event.id,
		message=_event_to_agent_message(event),
	)
	return event


@router.post("/simulate/supply", response_model=Event)
async def simulate_supply(background_tasks: BackgroundTasks) -> Event:
	event = Event(
		event_type=EventType.SUPPLY_REQUEST,
		source="community_center",
		payload=SupplyRequestPayload(
			resource="food",
			quantity=100,
			location=Location(lat=28.62, lon=77.19, name="Shelter A"),
		),
	)
	EVENT_STORE.append(event)
	background_tasks.add_task(
		_invoke_agent_from_webhook,
		trigger_type="simulate",
		trigger_ref=event.id,
		message=_event_to_agent_message(event),
	)
	return event
