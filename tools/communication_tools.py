from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


ALERT_LOG: list[dict[str, Any]] = []


def broadcast_alert(message: str, location: dict[str, float | str | None]) -> dict[str, Any]:
    alert = {
        "type": "broadcast",
        "message": message,
        "location": location,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    ALERT_LOG.append(alert)
    print("ALERT BROADCAST")
    print(message)
    print(location)
    return {"status": "alert_sent", "alert": alert}


def notify_rescue_team(team_id: str, message: str) -> dict[str, Any]:
    alert = {
        "type": "rescue_notification",
        "team_id": team_id,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    ALERT_LOG.append(alert)
    print(f"RESCUE TEAM NOTIFY: {team_id} -> {message}")
    return {"status": "notified", "notification": alert}


def send_supply_request(resource: str, quantity: int, destination: str) -> dict[str, Any]:
    request = {
        "type": "supply_request",
        "resource": resource,
        "quantity": quantity,
        "destination": destination,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    ALERT_LOG.append(request)
    print(f"SUPPLY REQUEST: {resource} x {quantity} -> {destination}")
    return {"status": "request_sent", "request": request}


def get_alert_log() -> list[dict[str, Any]]:
    return ALERT_LOG
