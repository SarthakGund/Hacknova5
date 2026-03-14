import asyncio
import random
import json
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="Mumbai Flood Simulator")

# --- STATE MANAGEMENT ---
# Holds current override values for sensors
active_spikes = {}

class ChaosRequest(BaseModel):
    sensor_id: str
    spike_value: float
    duration: int

# --- SENSOR GENERATOR ---
async def sensor_generator(sensor_id: str, base_val: float, unit: str):
    """Infinitely yields sensor data with occasional noise or spikes."""
    while True:
        # Check if a spike is active for this sensor
        if sensor_id in active_spikes:
            current_val = active_spikes[sensor_id] + random.uniform(-0.5, 0.5)
        else:
            # Normal oscillation (e.g., simulating small waves or light rain)
            current_val = base_val + random.uniform(-0.1, 0.1)
        
        payload = {
            "sensor_id": sensor_id,
            "value": round(current_val, 2),
            "unit": unit,
            "timestamp": datetime.now().isoformat()
        }
        
        yield f"data: {json.dumps(payload)}\n\n"
        await asyncio.sleep(1) # Polling interval

# --- ROUTES ---

@app.get("/stream/{sensor_id}")
async def stream_sensor(sensor_id: str):
    """SSE Endpoint for the Agent to connect to."""
    configs = {
        "MITHI_RIVER": {"base": 1.2, "unit": "m"},
        "ANDHERI_SUBWAY": {"base": 5.0, "unit": "cm"},
        "TIDE_GATE": {"base": 2.1, "unit": "m"}
    }
    
    conf = configs.get(sensor_id, {"base": 0.0, "unit": "unknown"})
    return StreamingResponse(
        sensor_generator(sensor_id, conf["base"], conf["unit"]),
        media_type="text/event-stream"
    )

@app.post("/webhook/spike")
async def inject_spike(chaos: ChaosRequest):
    """The 'Chaos Button' to purposely increase sensor values."""
    active_spikes[chaos.sensor_id] = chaos.spike_value
    
    # Schedule the reset
    asyncio.create_task(reset_sensor(chaos.sensor_id, chaos.duration))
    
    return {"status": "success", "message": f"Spike injected into {chaos.sensor_id}"}

async def reset_sensor(sensor_id: str, delay: int):
    await asyncio.sleep(delay)
    if sensor_id in active_spikes:
        del active_spikes[sensor_id]
        print(f"DEBUG: {sensor_id} returned to normal.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)