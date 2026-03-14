"""
agenti_utils.py
---------------
FloodShield integration helpers for Hacknova5 backend.
Forwards critical incident events to the agenti_bluuu FastAPI
service so the AI agent can respond autonomously.
"""
from __future__ import annotations

import threading
import requests
from config import Config


# Event type mapping to agenti_bluuu webhook format
_INCIDENT_TYPE_TO_EVENT = {
    "flood":           "flood_sensor",
    "natural_disaster":"flood_sensor",
    "fire":            "sos",
    "medical":         "sos",
    "accident":        "sos",
    "security":        "sos",
    "other":           "sos",
}


def _forward_to_agent(payload: dict) -> None:
    """POST a webhook event to agenti_bluuu (runs in background thread)."""
    url = f"{Config.AGENTI_BLUUU_URL}/remote/webhook/events"
    try:
        resp = requests.post(url, json=payload, timeout=8)
        resp.raise_for_status()
        print(f"🤖 FloodShield Agent triggered: event_id={resp.json().get('event_id')}")
    except Exception as exc:
        print(f"⚠️  FloodShield Agent forward failed: {exc}")


def trigger_agent_for_incident(
    *,
    incident_id: int,
    title: str,
    incident_type: str,
    severity: str,
    lat: float,
    lng: float,
    description: str = "",
    source: str = "hacknova_backend",
) -> None:
    """
    Non-blocking: forward an incident to the AI agent as a webhook event.
    Only fires for critical/high severity incidents.
    """
    if severity not in Config.CRITICAL_SEVERITY_LEVELS:
        return

    event_type = _INCIDENT_TYPE_TO_EVENT.get(incident_type, "sos")

    # Build payload matching agenti_bluuu Event + SOSPayload schema
    payload = {
        "event_type": event_type,
        "source": source,
        "payload": {
            # SOSPayload fields
            "message": f"[{severity.upper()}] {title}. {description}".strip(". "),
            "people": 0,
            "location": {
                "lat": lat,
                "lon": lng,
                "name": title,
            },
            # Extra context (agent will see these via model_dump_json)
            "incident_id": incident_id,
            "incident_type": incident_type,
            "severity": severity,
        },
    }

    threading.Thread(
        target=_forward_to_agent,
        args=(payload,),
        daemon=True,
    ).start()
