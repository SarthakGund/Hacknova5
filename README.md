# Agenti Bluuu

Disaster response control system with:
- sensor simulation + streaming
- remote webhook ingestion
- autonomous agent orchestration (with memory)
- YOLO + Gemini video analysis and overlay rendering

## Quick start

1. Install dependencies
    - `uv sync`
2. Configure environment variables in `.env`
    - `OPENAI_API_KEY`
    - `GEMINI_API_KEY`
    - optional: `OPENAI_MODEL`
3. Run server
    - `uv run main.py`

## UI pages

- Home: `GET /`
- Remote console: `GET /remote`
- Sensor console: `GET /sensor-page`
- Agent console: `GET /agent-page`
- Video pipeline console: `GET /video-page`

## Full documentation

See [docs/system-reference.md](docs/system-reference.md) for:
- complete API reference
- page-by-page behavior
- memory + webhook-triggered agent flows
- video pipeline details
- environment variables and current limitations