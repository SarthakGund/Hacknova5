import httpx
import json
import asyncio

# --- CONFIGURATION ---
SENSOR_URL = "http://localhost:8000/stream/MITHI_RIVER"
# Thresholds for 'EPerson' authority action
CRITICAL_THRESHOLD = 3.5  # meters
VELOCITY_THRESHOLD = 0.5  # rise of 0.5m per update is a flash flood

async def monitor_sensors():
    prev_value = None
    
    print("Agent Active: Monitoring Mithi River Levels...")
    
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("GET", SENSOR_URL) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    # Parse the JSON from the yield
                    data = json.loads(line[6:])
                    current_val = data["value"]
                    
                    # 1. Check Absolute Spike
                    if current_val >= CRITICAL_THRESHOLD:
                        print(f"⚠️  ALERT: {data['sensor_id']} AT {current_val}m! (Exceeds Danger Mark)")
                    
                    # 2. Check Rate of Change (Velocity)
                    if prev_value is not None:
                        diff = current_val - prev_value
                        if diff > VELOCITY_THRESHOLD:
                            print(f"🚨 EMERGENCY: Sudden Spike Detected! Rise of {round(diff, 2)}m/s")
                            print("ACTION: EPerson Authority - Initiate Ward L Evacuation.")
                    
                    prev_value = current_val
                    print(f"Live Feed [{data['timestamp'][-8:]}]: {current_val} {data['unit']}")

if __name__ == "__main__":
    try:
        asyncio.run(monitor_sensors())
    except KeyboardInterrupt:
        print("Agent deactivated.")