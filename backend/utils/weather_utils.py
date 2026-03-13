import requests
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Open-Meteo is a free API that requires no API key for non-commercial use
WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast"

def fetch_weather_data(lat: float, lon: float) -> Optional[Dict[str, Any]]:
    """
    Fetch current weather and alerts/warnings for a specific latitude and longitude.
    """
    try:
        params = {
            "latitude": lat,
            "longitude": lon,
            "current_weather": True,
            "hourly": "temperature_2m,precipitation,windspeed_10m",
            "timezone": "auto"
        }
        response = requests.get(WEATHER_API_URL, params=params, timeout=10.0)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Failed to fetch weather data for ({lat}, {lon}): {e}")
        return None
