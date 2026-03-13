import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from database import get_db_connection
from utils.weather_utils import fetch_weather_data
from config import Config
import sqlite3

logger = logging.getLogger(__name__)

def update_weather_for_active_incidents():
    """
    Fetch weather data for all active incidents and store in weather_logs table.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Get active incidents with valid coordinates
        cursor.execute('''
            SELECT id, lat, lng 
            FROM incidents 
            WHERE status != 'resolved' AND lat IS NOT NULL AND lng IS NOT NULL
        ''')
        
        active_incidents = cursor.fetchall()
        
        if not active_incidents:
            return
            
        logger.info(f"Fetching weather updates for {len(active_incidents)} active incidents.")
        
        for incident in active_incidents:
            incident_id = incident['id']
            lat = incident['lat']
            lng = incident['lng']
            
            weather = fetch_weather_data(lat, lng)
            
            if weather and 'current_weather' in weather:
                current = weather['current_weather']
                try:
                    cursor.execute('''
                        INSERT INTO weather_logs (incident_id, lat, lng, temperature, precipitation, windspeed)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (
                        incident_id,
                        lat,
                        lng,
                        current.get('temperature'),
                        None, # Current weather in API doesn't always include precipitation
                        current.get('windspeed')
                    ))
                except sqlite3.Error as e:
                    logger.error(f"Error inserting weather log for incident {incident_id}: {e}")
                    
        conn.commit()
        
    except sqlite3.Error as e:
        logger.error(f"Database error while updating weather: {e}")
    finally:
        conn.close()


def start_scheduler():
    scheduler = BackgroundScheduler()
    
    # Run every 15 minutes (or as desired)
    scheduler.add_job(
        func=update_weather_for_active_incidents,
        trigger=IntervalTrigger(minutes=15),
        id='weather_update_job',
        name='Update weather for active incidents',
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Background scheduler started. Weather update job added.")