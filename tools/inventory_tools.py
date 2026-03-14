from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

INVENTORY_FILE = Path(__file__).resolve().parents[1] / "inventory.json"


def load_inventory() -> dict[str, Any]:
    with INVENTORY_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_inventory(data: dict[str, Any]) -> None:
    with INVENTORY_FILE.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def get_supply(resource_name: str) -> int | None:
    data = load_inventory()
    for item in data.get("supplies", []):
        if item.get("resource") == resource_name:
            return int(item.get("quantity", 0))
    return None


def update_supply(resource_name: str, quantity: int) -> bool:
    if quantity < 0:
        return False

    data = load_inventory()
    for item in data.get("supplies", []):
        if item.get("resource") == resource_name:
            item["quantity"] = quantity
            save_inventory(data)
            return True

    data.setdefault("supplies", []).append({"resource": resource_name, "quantity": quantity})
    save_inventory(data)
    return True


def allocate_supply(resource_name: str, amount: int) -> bool:
    if amount <= 0:
        return False

    data = load_inventory()
    for item in data.get("supplies", []):
        if item.get("resource") == resource_name:
            current = int(item.get("quantity", 0))
            if current < amount:
                return False
            item["quantity"] = current - amount
            save_inventory(data)
            return True
    return False


def release_supply(resource_name: str, amount: int) -> bool:
    if amount <= 0:
        return False

    data = load_inventory()
    for item in data.get("supplies", []):
        if item.get("resource") == resource_name:
            item["quantity"] = int(item.get("quantity", 0)) + amount
            save_inventory(data)
            return True

    data.setdefault("supplies", []).append({"resource": resource_name, "quantity": amount})
    save_inventory(data)
    return True


def get_available_rescue_team() -> dict[str, Any] | None:
    data = load_inventory()
    for team in data.get("rescue_resources", []):
        if team.get("status") == "available":
            return team
    return None


def dispatch_rescue(team_id: str) -> bool:
    data = load_inventory()
    for team in data.get("rescue_resources", []):
        if team.get("id") == team_id:
            if team.get("status") != "available":
                return False
            team["status"] = "busy"
            save_inventory(data)
            return True
    return False


def release_rescue(team_id: str) -> bool:
    data = load_inventory()
    for team in data.get("rescue_resources", []):
        if team.get("id") == team_id:
            team["status"] = "available"
            save_inventory(data)
            return True
    return False


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


def find_nearest_resource(resource_group: str, lat: float, lon: float) -> dict[str, Any] | None:
    data = load_inventory()
    resources = data.get(resource_group, [])
    nearest = None
    best_distance = float("inf")

    for item in resources:
        loc = item.get("location") or {}
        if "lat" not in loc or "lon" not in loc:
            continue
        dist = _haversine_km(lat, lon, float(loc["lat"]), float(loc["lon"]))
        if dist < best_distance:
            best_distance = dist
            nearest = item

    return nearest
