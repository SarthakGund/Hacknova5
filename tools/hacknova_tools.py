"""
hacknova_tools.py
-----------------
HTTP-based replacements for inventory_tools.py.

When HACKNOVA_API_URL is set, the LangChain agent uses these functions
to read/write the Hacknova5 Flask API (SQLite-backed) instead of the
local inventory.json file.

Flask API base: http://localhost:5000
"""
from __future__ import annotations

import math
import os
from typing import Any

import requests

# ---------------------------------------------------------------------------
# Client config
# ---------------------------------------------------------------------------

def _base() -> str:
    url = os.getenv("HACKNOVA_API_URL", "http://localhost:5000")
    return url.rstrip("/")


def _get(path: str, params: dict | None = None) -> Any:
    try:
        r = requests.get(f"{_base()}{path}", params=params, timeout=8)
        r.raise_for_status()
        return r.json()
    except requests.RequestException as exc:
        return {"error": str(exc)}


def _post(path: str, data: dict) -> Any:
    try:
        r = requests.post(f"{_base()}{path}", json=data, timeout=8)
        r.raise_for_status()
        return r.json()
    except requests.RequestException as exc:
        return {"error": str(exc)}


def _put(path: str, data: dict) -> Any:
    try:
        r = requests.put(f"{_base()}{path}", json=data, timeout=8)
        r.raise_for_status()
        return r.json()
    except requests.RequestException as exc:
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# Supply / Resource tools
# (maps to Hacknova5 /api/resources endpoints)
# ---------------------------------------------------------------------------

def load_inventory_from_api() -> dict[str, Any]:
    """Return supplies + rescue teams from Flask API in inventory.json shape."""
    resources_resp = _get("/api/resources")
    personnel_resp = _get("/api/personnel")

    supplies = []
    rescue_resources = []
    medical_resources = []
    shelters = []

    if isinstance(resources_resp, list):
        for r in resources_resp:
            rtype = (r.get("type") or "").lower()
            if any(k in rtype for k in ("food", "water", "blanket", "supply", "kit")):
                supplies.append({
                    "resource": r.get("name", rtype),
                    "quantity": r.get("quantity", r.get("count", 0)),
                    "_id": r.get("id"),
                })
            elif any(k in rtype for k in ("boat", "helicopter", "vehicle", "rescue")):
                rescue_resources.append({
                    "id": str(r.get("id")),
                    "type": rtype,
                    "status": r.get("status", "unknown"),
                    "location": {
                        "lat": r.get("lat", 0),
                        "lon": r.get("lng", 0),
                    },
                    "capacity": r.get("capacity", 5),
                    "_id": r.get("id"),
                })
            elif any(k in rtype for k in ("medical", "clinic", "ambulance")):
                medical_resources.append({
                    "id": str(r.get("id")),
                    "type": rtype,
                    "status": r.get("status", "available"),
                    "location": {"lat": r.get("lat", 0), "lon": r.get("lng", 0)},
                    "_id": r.get("id"),
                })

    if isinstance(personnel_resp, list):
        for p in personnel_resp:
            role = (p.get("role") or "").lower()
            if "rescue" in role or "responder" in role:
                rescue_resources.append({
                    "id": f"personnel_{p.get('id')}",
                    "type": role,
                    "status": p.get("status", "unknown"),
                    "location": {
                        "lat": p.get("lat", 0),
                        "lon": p.get("lng", p.get("lng", 0)),
                    },
                    "capacity": 1,
                    "_api_type": "personnel",
                    "_id": p.get("id"),
                })

    return {
        "supplies": supplies,
        "rescue_resources": rescue_resources,
        "medical_resources": medical_resources,
        "shelters": shelters,
    }


def get_supply_api(resource_name: str) -> int | None:
    """Get quantity for a supply resource from Flask API."""
    data = load_inventory_from_api()
    query = resource_name.lower().replace(" ", "_")
    for item in data.get("supplies", []):
        name = (item.get("resource") or "").lower().replace(" ", "_")
        if name == query or query in name or name in query:
            return int(item.get("quantity", 0))
    return None


def update_supply_api(resource_name: str, quantity: int) -> bool:
    """Set absolute quantity for a supply resource via Flask API."""
    data = load_inventory_from_api()
    for item in data.get("supplies", []):
        name = (item.get("resource") or "").lower().replace(" ", "_")
        query = resource_name.lower().replace(" ", "_")
        if name == query or query in name:
            resource_id = item.get("_id")
            if resource_id is None:
                return False
            resp = _put(f"/api/resources/{resource_id}", {"quantity": quantity})
            return "error" not in resp
    return False


def allocate_supply_api(resource_name: str, amount: int) -> bool:
    """Deduct `amount` from a supply resource in the Flask DB."""
    current = get_supply_api(resource_name)
    if current is None or current < amount:
        return False
    return update_supply_api(resource_name, current - amount)


def release_supply_api(resource_name: str, amount: int) -> bool:
    """Add `amount` back to a supply resource in the Flask DB."""
    current = get_supply_api(resource_name) or 0
    return update_supply_api(resource_name, current + amount)


# ---------------------------------------------------------------------------
# Rescue team tools
# (maps to Hacknova5 /api/personnel endpoints)
# ---------------------------------------------------------------------------

def get_available_rescue_team_api() -> dict[str, Any] | None:
    """Get one available rescue team / responder from Flask API."""
    resp = _get("/api/personnel/available")
    if isinstance(resp, list) and resp:
        p = resp[0]
        return {
            "id": f"personnel_{p.get('id')}",
            "type": p.get("role", "responder"),
            "status": p.get("status", "available"),
            "name": p.get("name", "Unknown"),
            "location": {"lat": p.get("lat", 0), "lon": p.get("lng", 0)},
            "_id": p.get("id"),
            "_api_type": "personnel",
        }
    # Fallback: try resources
    data = load_inventory_from_api()
    for team in data.get("rescue_resources", []):
        if team.get("status") == "available":
            return team
    return None


def dispatch_rescue_api(team_id: str) -> bool:
    """Mark a rescue team / personnel as deployed."""
    if team_id.startswith("personnel_"):
        pid = team_id.removeprefix("personnel_")
        resp = _put(f"/api/personnel/{pid}/status", {"status": "deployed"})
        return "error" not in resp
    resp = _put(f"/api/resources/{team_id}", {"status": "deployed"})
    return "error" not in resp


def release_rescue_api(team_id: str) -> bool:
    """Mark a rescue team / personnel as available again."""
    if team_id.startswith("personnel_"):
        pid = team_id.removeprefix("personnel_")
        resp = _put(f"/api/personnel/{pid}/status", {"status": "available"})
        return "error" not in resp
    resp = _put(f"/api/resources/{team_id}", {"status": "available"})
    return "error" not in resp


# ---------------------------------------------------------------------------
# Communication tools
# ---------------------------------------------------------------------------

def broadcast_alert_api(message: str, location: dict) -> dict:
    """Broadcast a public alert via Flask notification system."""
    resp = _post("/api/notifications/broadcast", {
        "title": "🚨 Flood Alert",
        "message": message,
        "location": location.get("name", ""),
        "priority": "critical",
    })
    return resp


def notify_rescue_team_api(team_id: str, message: str) -> dict:
    """Send a direct message to a team via Flask communications."""
    resp = _post("/api/comms", {
        "message": message,
        "sender_name": "FloodShield AI Agent",
        "type": "direct",
        "recipient_id": team_id,
    })
    return resp


def send_supply_request_api(resource: str, quantity: int, destination: str) -> dict:
    """Log a supply request as a timeline event on an active incident."""
    # Find active incident at destination (best effort: first active)
    incidents = _get("/api/incidents", {"status": "active"})
    incident_id = None
    if isinstance(incidents, list) and incidents:
        incident_id = incidents[0].get("id")

    payload: dict[str, Any] = {
        "event_type": "supply_request",
        "description": f"AI Agent supply request: {quantity}x {resource} → {destination}",
        "user_name": "FloodShield AI Agent",
    }
    if incident_id:
        resp = _post(f"/api/incidents/{incident_id}/timeline", payload)
    else:
        # No active incident — broadcast as notification
        resp = _post("/api/notifications/broadcast", {
            "title": "Supply Request",
            "message": f"{quantity}x {resource} needed at {destination}",
            "priority": "high",
        })
    return resp


# ---------------------------------------------------------------------------
# Geospatial
# ---------------------------------------------------------------------------

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def find_nearest_resource_api(
    resource_group: str, lat: float, lon: float
) -> dict[str, Any] | None:
    """Find nearest resource from Flask DB using haversine distance."""
    data = load_inventory_from_api()
    resources = data.get(resource_group, [])

    nearest = None
    best_dist = float("inf")

    for item in resources:
        loc = item.get("location") or {}
        item_lat = loc.get("lat") or loc.get("latitude")
        item_lon = loc.get("lon") or loc.get("lng") or loc.get("longitude")
        if item_lat is None or item_lon is None:
            continue
        dist = _haversine_km(lat, lon, float(item_lat), float(item_lon))
        if dist < best_dist:
            best_dist = dist
            nearest = {**item, "_distance_km": round(dist, 2)}

    return nearest
