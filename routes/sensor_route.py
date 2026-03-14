import asyncio
import json
import random
from datetime import datetime, timezone
from enum import Enum

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


class SensorId(str, Enum):
	MITHI_RIVER = "MITHI_RIVER"
	ANDHERI_SUBWAY = "ANDHERI_SUBWAY"
	TIDE_GATE = "TIDE_GATE"


class Unit(str, Enum):
	METER = "m"
	CENTIMETER = "cm"


class SensorConfig(BaseModel):
	sensor_id: SensorId
	base_value: float
	unit: Unit


class SensorReading(BaseModel):
	sensor_id: SensorId
	value: float
	unit: Unit
	timestamp: datetime


class SpikeRequest(BaseModel):
	sensor_id: SensorId
	spike_value: float = Field(..., description="Forced value during spike")
	duration_seconds: int = Field(..., gt=0, description="How long spike lasts")


class StatusResponse(BaseModel):
	status: str
	message: str


router = APIRouter(prefix="/sensors", tags=["Sensors"])

SENSOR_CONFIGS: dict[SensorId, SensorConfig] = {
	SensorId.MITHI_RIVER: SensorConfig(
		sensor_id=SensorId.MITHI_RIVER,
		base_value=1.2,
		unit=Unit.METER,
	),
	SensorId.ANDHERI_SUBWAY: SensorConfig(
		sensor_id=SensorId.ANDHERI_SUBWAY,
		base_value=5.0,
		unit=Unit.CENTIMETER,
	),
	SensorId.TIDE_GATE: SensorConfig(
		sensor_id=SensorId.TIDE_GATE,
		base_value=2.1,
		unit=Unit.METER,
	),
}

# Current active forced values by sensor.
active_spikes: dict[SensorId, float] = {}


def _build_reading(config: SensorConfig) -> SensorReading:
	if config.sensor_id in active_spikes:
		current_value = active_spikes[config.sensor_id] + random.uniform(-0.5, 0.5)
	else:
		current_value = config.base_value + random.uniform(-0.1, 0.1)

	return SensorReading(
		sensor_id=config.sensor_id,
		value=round(current_value, 2),
		unit=config.unit,
		timestamp=datetime.now(timezone.utc),
	)


async def _sensor_event_generator(config: SensorConfig):
	while True:
		reading = _build_reading(config)
		yield f"data: {reading.model_dump_json()}\n\n"
		await asyncio.sleep(1)


async def _reset_sensor_after_delay(sensor_id: SensorId, delay_seconds: int) -> None:
	await asyncio.sleep(delay_seconds)
	active_spikes.pop(sensor_id, None)


@router.get("/configs", response_model=list[SensorConfig])
async def get_sensor_configs() -> list[SensorConfig]:
	return list(SENSOR_CONFIGS.values())


@router.get("/configs/{sensor_id}", response_model=SensorConfig)
async def get_sensor_config(sensor_id: SensorId) -> SensorConfig:
	config = SENSOR_CONFIGS.get(sensor_id)
	if config is None:
		raise HTTPException(status_code=404, detail="Sensor config not found")
	return config


@router.get("/reading/{sensor_id}", response_model=SensorReading)
async def get_sensor_reading(sensor_id: SensorId) -> SensorReading:
	config = SENSOR_CONFIGS.get(sensor_id)
	if config is None:
		raise HTTPException(status_code=404, detail="Sensor not found")
	return _build_reading(config)


@router.get("/stream/{sensor_id}")
async def stream_sensor(sensor_id: SensorId):
	config = SENSOR_CONFIGS.get(sensor_id)
	if config is None:
		raise HTTPException(status_code=404, detail="Sensor not found")

	return StreamingResponse(
		_sensor_event_generator(config),
		media_type="text/event-stream",
	)


@router.post("/spike", response_model=StatusResponse)
async def inject_spike(payload: SpikeRequest) -> StatusResponse:
	config = SENSOR_CONFIGS.get(payload.sensor_id)
	if config is None:
		raise HTTPException(status_code=404, detail="Sensor not found")

	active_spikes[payload.sensor_id] = payload.spike_value
	asyncio.create_task(
		_reset_sensor_after_delay(payload.sensor_id, payload.duration_seconds)
	)

	return StatusResponse(
		status="success",
		message=f"Spike injected into {payload.sensor_id}",
	)
