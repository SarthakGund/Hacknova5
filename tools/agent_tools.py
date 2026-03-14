from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


AGENT_CALL_LOG: list[dict[str, Any]] = []


def _log(agent_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    call = {
        "agent": agent_name,
        "status": "activated",
        "payload": payload,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    AGENT_CALL_LOG.append(call)
    return call


def trigger_rescue_agent(event: dict[str, Any]) -> dict[str, Any]:
    print("Triggering Rescue Agent")
    return _log("rescue_agent", event)


def trigger_supply_agent(request: dict[str, Any]) -> dict[str, Any]:
    print("Triggering Supply Agent")
    return _log("supply_agent", request)


def trigger_weather_agent(context: dict[str, Any]) -> dict[str, Any]:
    print("Triggering Weather Agent")
    return _log("weather_agent", context)


def get_agent_call_log() -> list[dict[str, Any]]:
    return AGENT_CALL_LOG
