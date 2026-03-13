from flask import Blueprint, request, jsonify
import logging
from utils.weather_utils import fetch_weather_data

weather_bp = Blueprint("weather", __name__, url_prefix="/api/weather")
logger = logging.getLogger(__name__)

@weather_bp.route("/current-status", methods=["GET", "POST"])
def get_current_weather():
    """
    Fetch the latest weather conditions.
    This acts as part of the data ingestion pipelines.
    """
    if request.method == "POST":
        data = request.json or {}
        lat = data.get("latitude")
        lon = data.get("longitude")
    else:
        lat = request.args.get("latitude", type=float)
        lon = request.args.get("longitude", type=float)

    if lat is None or lon is None:
        return jsonify({"success": False, "error": "latitude and longitude required"}), 400
        
    weather = fetch_weather_data(lat, lon)
    if not weather:
        return jsonify({"success": False, "error": "Failed to retrieve weather data from external API"}), 502
    
    return jsonify({
        "success": True,
        "latitude": lat,
        "longitude": lon,
        "current_weather": weather.get("current_weather", {})
    })
