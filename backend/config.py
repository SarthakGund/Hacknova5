import os
from datetime import timedelta

class Config:
    """Application configuration"""
    
    # Base directory
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    
    # Database
    DATABASE_PATH = os.path.join(BASE_DIR, 'crisis_management.db')
    
    # File uploads
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'pdf'}
    
    # WebSocket
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # CORS - Allow all origins for development
    CORS_ORIGINS = '*'
    
    # Geofencing
    DANGER_ZONE_RADIUS_METERS = 500  # Default radius for danger zones
    NEARBY_ALERT_RADIUS_METERS = 5000  # 5km radius for nearby alerts
    
    # Analytics
    RESPONSE_TIME_THRESHOLD_MINUTES = 15  # Target response time
    
    # Notifications
    CRITICAL_SEVERITY_LEVELS = ['critical', 'high']

    # ── FloodShield integration ────────────────────────────────────────────
    # agenti_bluuu FastAPI URL — receives forwarded events for AI agent processing
    AGENTI_BLUUU_URL = os.environ.get('AGENTI_BLUUU_URL', 'http://localhost:8000')
    # Sensor SSE base URL (same agenti_bluuu service)
    SENSOR_STREAM_URL = os.environ.get('SENSOR_STREAM_URL', 'http://localhost:8000')

    
    @staticmethod
    def init_app(app):
        """Initialize application with config"""
        # Create upload folder if it doesn't exist
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
