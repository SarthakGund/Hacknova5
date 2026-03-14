# Agenti Bluuu — System Reference

This document describes all pages, APIs, and the new features implemented so far.

## 1) Runtime + Entry Point

- App entry: [main.py](main.py)
- Framework: FastAPI
- Default run:
  - `uv run main.py`
  - or `uvicorn main:app --reload`

## 2) UI Pages (Routes + Purpose)

### Home
- Route: `GET /`
- Template: [templates/home.html](templates/home.html)
- Purpose:
  - Landing page + navigation sidebar
  - High-level operational dashboard blocks

### Remote Webhook Console
- Route: `GET /remote`
- Template: [templates/remote.html](templates/remote.html)
- Purpose:
  - Trigger webhook events/spikes/simulations
  - View event store
  - View agent invocations auto-triggered by webhooks
  - **Live UI refresh** every 2 seconds for events + invocation logs

### Sensor Test Page
- Route: `GET /sensor-page`
- Template: [templates/sensor.html](templates/sensor.html)
- Purpose:
  - Read one sensor value
  - Inject direct spike
  - View sensor configs

### Agent Test Console
- Route: `GET /agent-page`
- Template: [templates/agent.html](templates/agent.html)
- Purpose:
  - Manual agent invoke
  - View tool calls and tool results
  - Manage memory by `session_id`
  - Clear memory from UI

### Video AI Pipeline Console
- Route: `GET /video-page`
- Template: [templates/video.html](templates/video.html)
- Purpose:
  - Upload a video
  - Run YOLO + Gemini processing
  - Render processed video with overlays
  - Download output video and events JSON

---

## 3) API Reference

## 3.1 Sensor APIs (`/sensors`)
Source: [routes/sensor_route.py](routes/sensor_route.py)

- `GET /sensors/configs`
  - Returns all sensor configs.

- `GET /sensors/configs/{sensor_id}`
  - Returns one config.

- `GET /sensors/reading/{sensor_id}`
  - Returns current reading.

- `GET /sensors/stream/{sensor_id}`
  - SSE stream (`text/event-stream`) with 1-second updates.

- `POST /sensors/spike`
  - Injects temporary forced value.
  - Body:
    ```json
    {
      "sensor_id": "MITHI_RIVER",
      "spike_value": 6.2,
      "duration_seconds": 10
    }
    ```

## 3.2 Agent APIs (`/agent`)
Source: [routes/agent_route.py](routes/agent_route.py)

- `POST /agent/invoke`
  - Runs disaster coordination agent.
  - Body:
    ```json
    {
      "message": "Flood warning at Street 12",
      "dry_run": true,
      "max_iterations": 20,
      "session_id": "ops_console",
      "remember": true,
      "clear_memory_before_run": false
    }
    ```
  - Response includes:
    - `output`
    - `tool_calls`
    - `session_id`
    - `memory_turns`

- `DELETE /agent/memory/{session_id}`
  - Clears memory for a session.

## 3.3 Remote Webhook APIs (`/remote/webhook`)
Source: [routes/remote_webhook.py](routes/remote_webhook.py)

### Event + spike intake
- `POST /remote/webhook/events`
- `POST /remote/webhook/spike`

### Simulators
- `POST /remote/webhook/simulate/sos`
- `POST /remote/webhook/simulate/flood`
- `POST /remote/webhook/simulate/weather`
- `POST /remote/webhook/simulate/rescue`
- `POST /remote/webhook/simulate/supply`

### Retrieval
- `GET /remote/webhook/events`
- `GET /remote/webhook/agent-invocations`

### Important behavior
All webhook intake/simulator endpoints now trigger the agent automatically in background tasks.

## 3.4 Video Pipeline APIs (`/video`)
Source: [routes/video_route.py](routes/video_route.py)

- `POST /video/analyze`
  - Multipart form upload with `video` file.
  - Processing:
    1. YOLO person detection per frame
    2. Gemini analysis for the **full video once**
    3. Overlay rendering in output video
  - Returns job metadata + download URLs.

- `GET /video/jobs/{job_id}/output`
  - Downloads processed MP4.

- `GET /video/jobs/{job_id}/events`
  - Downloads events JSON.

- `GET /video/jobs/{job_id}`
  - Returns job metadata summary.

---

## 4) Core Features Implemented

## 4.1 Agent memory
Source: [agents/disaster_agent.py](agents/disaster_agent.py)

- In-memory session store keyed by `session_id`
- Stores conversation turns (`user` + `assistant`)
- Supports:
  - keep memory (`remember=true`)
  - clear memory (`DELETE /agent/memory/{session_id}`)

## 4.2 Webhook-driven autonomous agent invoke
Source: [routes/remote_webhook.py](routes/remote_webhook.py)

- Every remote webhook event/spike/simulate can trigger `run_disaster_agent()`.
- Invocation logs captured in `AGENT_INVOCATION_STORE`.

## 4.3 Live remote console updates
Source: [templates/remote.html](templates/remote.html)

- Event and invocation text boxes auto-refresh every 2 seconds.
- Also refresh immediately after user-triggered actions.

## 4.4 Video processing pipeline
Sources:
- [routes/video_route.py](routes/video_route.py)
- [scripts/yolo_gemini_overlay.py](scripts/yolo_gemini_overlay.py)
- [templates/video.html](templates/video.html)

- Upload → Process → Render → Download flow implemented.
- Current Gemini mode: full-video single pass, not frame-interval mode.

---

## 5) Environment Variables

Required for agent:
- `OPENAI_API_KEY`
- optional: `OPENAI_MODEL` (default `gpt-4.1-mini`)

Required for video Gemini:
- `GEMINI_API_KEY`

Remote webhook agent behavior:
- `REMOTE_WEBHOOK_AGENT_DRY_RUN` (default `true`)
- `REMOTE_WEBHOOK_AGENT_MAX_ITERATIONS` (default `20`)

---

## 6) Known Storage Scope

The following are currently in-memory only (reset on server restart):
- Agent memory store
- Webhook event store
- Webhook agent invocation store
- Video job index

Persisted artifacts on disk:
- Video processing outputs under `artifacts/video_jobs/<job_id>/...`

---

## 7) Suggested Next Improvements

- Persist memory/events/invocation logs to DB.
- Add auth for production webhook endpoints.
- Add pagination/limits for stores.
- Add webhook->agent invocation retries and structured failure metrics.