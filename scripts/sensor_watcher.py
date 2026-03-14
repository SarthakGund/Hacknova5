"""
sensor_watcher.py
-----------------
Async background task that consumes agenti_bluuu's sensor SSE streams
and automatically creates incidents in the Hacknova5 Flask backend when
water levels exceed critical thresholds.

Runs as a FastAPI lifespan background task — no additional process needed.
"""
from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from typing import NamedTuple

import httpx

# ---------------------------------------------------------------------------
# Thresholds per sensor
# ---------------------------------------------------------------------------

class SensorThreshold(NamedTuple):
    sensor_id: str
    warning_value: float
    critical_value: float
    unit: str
    location_name: str
    lat: float
    lon: float


SENSOR_THRESHOLDS = [
    SensorThreshold(
        sensor_id="MITHI_RIVER",
        warning_value=2.5,
        critical_value=3.5,
        unit="m",
        location_name="Mithi River – Dharavi",
        lat=19.037,
        lon=72.862,
    ),
    SensorThreshold(
        sensor_id="ANDHERI_SUBWAY",
        warning_value=12.0,
        critical_value=18.0,
        unit="cm",
        location_name="Andheri Subway Underpass",
        lat=19.119,
        lon=72.848,
    ),
    SensorThreshold(
        sensor_id="TIDE_GATE",
        warning_value=3.0,
        critical_value=4.0,
        unit="m",
        location_name="Mahim Causeway Tide Gate",
        lat=19.047,
        lon=72.839,
    ),
]

# Track last-created incident per sensor to avoid duplicate spam
_last_incident: dict[str, dict] = {}  # sensor_id → {severity, created_at}
_COOLDOWN_SECONDS = 300  # 5 min min gap between incidents for same sensor

AGENTI_BASE = os.getenv("SENSOR_AGENTI_BASE", "http://localhost:8000")
HACKNOVA_BASE = os.getenv("HACKNOVA_API_URL", "http://localhost:5000")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _should_create_incident(sensor_id: str, severity: str) -> bool:
    """Rate-limit incident creation per sensor."""
    last = _last_incident.get(sensor_id)
    if not last:
        return True
    elapsed = (datetime.now(timezone.utc) - last["created_at"]).total_seconds()
    # Always re-escalate if severity is higher, otherwise respect cooldown
    severity_rank = {"warning": 1, "critical": 2}
    if severity_rank.get(severity, 0) > severity_rank.get(last.get("severity", ""), 0):
        return True
    return elapsed >= _COOLDOWN_SECONDS


async def _create_flask_incident(
    client: httpx.AsyncClient,
    sensor: SensorThreshold,
    value: float,
    severity: str,
) -> None:
    """POST a new flood incident to the Hacknova5 Flask API."""
    payload = {
        "title": f"Flood Alert: {sensor.location_name} ({value}{sensor.unit})",
        "description": (
            f"Sensor {sensor.sensor_id} reading {value}{sensor.unit} exceeds "
            f"{severity} threshold of "
            f"{sensor.critical_value if severity == 'critical' else sensor.warning_value}{sensor.unit}."
        ),
        "type": "flood",
        "severity": severity,
        "lat": sensor.lat,
        "lng": sensor.lon,
        "location_name": sensor.location_name,
        "report_source": "sensor_watcher",
    }
    try:
        resp = await client.post(f"{HACKNOVA_BASE}/api/incidents", json=payload, timeout=8)
        data = resp.json()
        incident_id = data.get("incident_id")
        print(
            f"🌊 SensorWatcher → Flask incident #{incident_id} "
            f"[{severity.upper()}] {sensor.sensor_id}={value}{sensor.unit}"
        )
        _last_incident[sensor.sensor_id] = {
            "severity": severity,
            "created_at": datetime.now(timezone.utc),
            "incident_id": incident_id,
        }
    except Exception as exc:
        print(f"⚠️  SensorWatcher failed to create incident: {exc}")


async def _watch_sensor(sensor: SensorThreshold) -> None:
    """Open an SSE stream for one sensor and react to threshold breaches."""
    url = f"{AGENTI_BASE}/sensors/stream/{sensor.sensor_id}"
    async with httpx.AsyncClient(timeout=None) as client:
        while True:
            try:
                async with client.stream("GET", url) as response:
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        try:
                            reading = json.loads(line[5:].strip())
                        except json.JSONDecodeError:
                            continue

                        value = float(reading.get("value", 0))
                        severity: str | None = None

                        if value >= sensor.critical_value:
                            severity = "critical"
                        elif value >= sensor.warning_value:
                            severity = "warning"

                        if severity and _should_create_incident(sensor.sensor_id, severity):
                            # Use a separate client for the POST (avoid blocking the stream)
                            asyncio.create_task(
                                _create_flask_incident(
                                    httpx.AsyncClient(), sensor, value, severity
                                )
                            )
            except Exception as exc:
                print(f"⚠️  SensorWatcher stream error ({sensor.sensor_id}): {exc}")
                await asyncio.sleep(10)  # back-off before reconnecting


# ---------------------------------------------------------------------------
# Entry point called from main.py lifespan
# ---------------------------------------------------------------------------

async def start_sensor_watcher() -> None:
    """Start one watcher task per sensor. This coroutine never returns."""
    print("🌊 FloodShield SensorWatcher starting...")
    tasks = [asyncio.create_task(_watch_sensor(s)) for s in SENSOR_THRESHOLDS]
    await asyncio.gather(*tasks)
