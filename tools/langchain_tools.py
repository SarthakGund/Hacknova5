from __future__ import annotations

import os
import re

from langchain.tools import tool

from tools.agent_tools import (
    trigger_rescue_agent,
    trigger_supply_agent,
    trigger_weather_agent,
)

# ---------------------------------------------------------------------------
# Detect mode: use Hacknova5 Flask API or local inventory.json
# ---------------------------------------------------------------------------
_HACKNOVA_MODE = bool(os.getenv("HACKNOVA_API_URL"))

if _HACKNOVA_MODE:
    from tools.hacknova_tools import (
        allocate_supply_api as allocate_supply,
        broadcast_alert_api as broadcast_alert,
        dispatch_rescue_api as dispatch_rescue,
        find_nearest_resource_api as find_nearest_resource,
        get_available_rescue_team_api as get_available_rescue_team,
        get_supply_api as get_supply,
        load_inventory_from_api as load_inventory,
        notify_rescue_team_api as notify_rescue_team,
        release_rescue_api as release_rescue,
        release_supply_api as release_supply,
        send_supply_request_api as send_supply_request,
        update_supply_api as update_supply,
    )
else:
    from tools.communication_tools import (  # type: ignore[assignment]
        broadcast_alert,
        notify_rescue_team,
        send_supply_request,
    )
    from tools.inventory_tools import (  # type: ignore[assignment]
        allocate_supply,
        dispatch_rescue,
        find_nearest_resource,
        get_available_rescue_team,
        get_supply,
        load_inventory,
        release_rescue,
        release_supply,
        update_supply,
    )


def _normalize_resource_name(name: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", name.strip().lower()).strip("_")
    return normalized


RESOURCE_ALIASES = {
    "water": "water_liters",
    "water_liter": "water_liters",
    "water_liters": "water_liters",
    "food": "food_packets",
    "food_packet": "food_packets",
    "food_packets": "food_packets",
    "blanket": "blankets",
    "blankets": "blankets",
}


def build_langchain_tools(*, dry_run: bool = True):
    mode_label = "hacknova_api" if _HACKNOVA_MODE else "inventory_json"

    @tool
    def list_supplies() -> str:
        """List all current supply resource names and quantities from inventory."""
        data = load_inventory()
        supplies = data.get("supplies", [])
        if not supplies:
            return "no_supplies"
        return "; ".join(
            f"{item.get('resource')}={int(item.get('quantity', 0))}" for item in supplies
        )

    @tool
    def get_supply_level(resource_name: str) -> str:
        """Get available quantity for one supply resource."""
        qty = get_supply(resource_name)
        resolved_name = resource_name

        if qty is None:
            normalized = _normalize_resource_name(resource_name)
            alias = RESOURCE_ALIASES.get(normalized)
            if alias:
                resolved_name = alias
                qty = get_supply(alias)

        if qty is None:
            data = load_inventory()
            supplies = [item.get("resource", "") for item in data.get("supplies", [])]
            normalized_query = _normalize_resource_name(resource_name)

            for resource in supplies:
                normalized_resource = _normalize_resource_name(resource)
                if (
                    normalized_query in normalized_resource
                    or normalized_resource in normalized_query
                ):
                    resolved_name = resource
                    qty = get_supply(resource)
                    break

        if qty is None:
            data = load_inventory()
            available = [item.get("resource") for item in data.get("supplies", [])]
            return f"resource_not_found:{resource_name}; available={available}"

        return f"resource={resolved_name}, quantity={qty}"

    @tool
    def find_nearest(resource_group: str, lat: float, lon: float) -> str:
        """Find nearest item from an inventory group by latitude/longitude."""
        resource = find_nearest_resource(resource_group, lat, lon)
        if resource is None:
            return "not_found"
        return str(resource)

    @tool
    def get_available_rescue() -> str:
        """Get one currently available rescue team if any."""
        team = get_available_rescue_team()
        if team is None:
            return "none_available"
        return str(team)

    @tool
    def allocate_supply_tool(resource_name: str, amount: int) -> str:
        """Allocate supply units to an operation."""
        if dry_run:
            return f"dry_run [{mode_label}]: allocate {amount} of {resource_name}"
        ok = allocate_supply(resource_name, amount)
        return f"allocated={ok}"

    @tool
    def release_supply_tool(resource_name: str, amount: int) -> str:
        """Release supply units back to inventory."""
        if dry_run:
            return f"dry_run [{mode_label}]: release {amount} of {resource_name}"
        ok = release_supply(resource_name, amount)
        return f"released={ok}"

    @tool
    def update_supply_tool(resource_name: str, quantity: int) -> str:
        """Set absolute quantity for a supply resource."""
        if dry_run:
            return f"dry_run [{mode_label}]: set {resource_name} to {quantity}"
        ok = update_supply(resource_name, quantity)
        return f"updated={ok}"

    @tool
    def dispatch_rescue_tool(team_id: str) -> str:
        """Dispatch an available rescue team by ID."""
        if dry_run:
            return f"dry_run [{mode_label}]: dispatch {team_id}"
        ok = dispatch_rescue(team_id)
        return f"dispatched={ok}"

    @tool
    def release_rescue_tool(team_id: str) -> str:
        """Mark rescue team as available by ID."""
        if dry_run:
            return f"dry_run [{mode_label}]: release {team_id}"
        ok = release_rescue(team_id)
        return f"released={ok}"

    @tool
    def broadcast_alert_tool(message: str, location_name: str) -> str:
        """Broadcast public alert message for a location."""
        if dry_run:
            return f"dry_run [{mode_label}]: broadcast '{message}' at {location_name}"
        result = broadcast_alert(message, {"name": location_name})
        return str(result)

    @tool
    def notify_rescue_team_tool(team_id: str, message: str) -> str:
        """Send direct message to rescue team."""
        if dry_run:
            return f"dry_run [{mode_label}]: notify {team_id} with '{message}'"
        result = notify_rescue_team(team_id, message)
        return str(result)

    @tool
    def send_supply_request_tool(resource: str, quantity: int, destination: str) -> str:
        """Create a supply request for a destination."""
        if dry_run:
            return f"dry_run [{mode_label}]: request {resource} x {quantity} to {destination}"
        result = send_supply_request(resource, quantity, destination)
        return str(result)

    @tool
    def trigger_rescue_agent_tool(event_summary: str) -> str:
        """Trigger rescue agent with event summary."""
        result = trigger_rescue_agent({"summary": event_summary})
        return str(result)

    @tool
    def trigger_supply_agent_tool(request_summary: str) -> str:
        """Trigger supply agent with request summary."""
        result = trigger_supply_agent({"summary": request_summary})
        return str(result)

    @tool
    def trigger_weather_agent_tool(context_summary: str) -> str:
        """Trigger weather agent with context summary."""
        result = trigger_weather_agent({"summary": context_summary})
        return str(result)

    return [
        list_supplies,
        get_supply_level,
        find_nearest,
        get_available_rescue,
        allocate_supply_tool,
        release_supply_tool,
        update_supply_tool,
        dispatch_rescue_tool,
        release_rescue_tool,
        broadcast_alert_tool,
        notify_rescue_team_tool,
        send_supply_request_tool,
        trigger_rescue_agent_tool,
        trigger_supply_agent_tool,
        trigger_weather_agent_tool,
    ]
