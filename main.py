from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path

from routes.agent_route import router as agent_router
from routes.remote_webhook import router as remote_webhook_router
from routes.sensor_route import router as sensor_router
from routes.twilio_route import router as twilio_router
from routes.video_route import router as video_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background tasks on startup; cancel them on shutdown."""
    # Import here to avoid circular imports at module level
    from scripts.sensor_watcher import start_sensor_watcher
    import os

    watcher_task = None
    if os.getenv("HACKNOVA_API_URL"):
        # Only start sensor watcher when Hacknova5 backend is configured
        watcher_task = asyncio.create_task(start_sensor_watcher())
        print("✅ FloodShield SensorWatcher started")
    else:
        print("ℹ️  SensorWatcher disabled (set HACKNOVA_API_URL to enable)")

    yield  # app is running

    if watcher_task:
        watcher_task.cancel()
        try:
            await watcher_task
        except asyncio.CancelledError:
            pass
        print("🛑 FloodShield SensorWatcher stopped")


app = FastAPI(title="FloodShield Agent API", lifespan=lifespan)
BASE_DIR = Path(__file__).resolve().parent

# Allow CORS — also allow the two Next.js frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",
        "http://localhost:3000",  # crisis-command-dashboard
        "http://localhost:3001",  # field-responder-ui
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sensor_router)
app.include_router(remote_webhook_router)
app.include_router(agent_router)
app.include_router(video_router)
app.include_router(twilio_router)

@app.get("/")
def read_root():
    return FileResponse(BASE_DIR / "templates" / "home.html")


@app.get("/remote")
def remote_test_page():
    return FileResponse(BASE_DIR / "templates" / "remote.html")


@app.get("/sensor-page")
def reroute_test_page():
    return FileResponse(BASE_DIR / "templates" / "sensor.html")


@app.get("/agent-page")
def agent_test_page():
    return FileResponse(BASE_DIR / "templates" / "agent.html")


@app.get("/docs-page")
def docs_page():
    return FileResponse(BASE_DIR / "templates" / "docs.html")


@app.get("/video-page")
def video_page():
    return FileResponse(BASE_DIR / "templates" / "video.html")

# Run with: uvicorn main:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)