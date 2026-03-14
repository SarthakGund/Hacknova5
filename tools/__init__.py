from tools.agent_tools import (
    get_agent_call_log,
    trigger_rescue_agent,
    trigger_supply_agent,
    trigger_weather_agent,
)
from tools.communication_tools import (
    broadcast_alert,
    get_alert_log,
    notify_rescue_team,
    send_supply_request,
)
from tools.inventory_tools import (
    allocate_supply,
    dispatch_rescue,
    find_nearest_resource,
    get_available_rescue_team,
    get_supply,
    load_inventory,
    release_rescue,
    release_supply,
    save_inventory,
    update_supply,
)

TOOLS = {
    "get_supply": get_supply,
    "update_supply": update_supply,
    "allocate_supply": allocate_supply,
    "release_supply": release_supply,
    "get_available_rescue_team": get_available_rescue_team,
    "dispatch_rescue": dispatch_rescue,
    "release_rescue": release_rescue,
    "find_nearest_resource": find_nearest_resource,
    "broadcast_alert": broadcast_alert,
    "notify_rescue_team": notify_rescue_team,
    "send_supply_request": send_supply_request,
    "trigger_rescue_agent": trigger_rescue_agent,
    "trigger_supply_agent": trigger_supply_agent,
    "trigger_weather_agent": trigger_weather_agent,
}
