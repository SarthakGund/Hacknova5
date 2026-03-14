from __future__ import annotations

import asyncio
import base64
import json
import os
from importlib import import_module

import websockets
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request, WebSocket
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.websockets import WebSocketDisconnect

load_dotenv()

router = APIRouter(tags=["Twilio"])

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TEMPERATURE = float(os.getenv("TEMPERATURE", 0.8))
SYSTEM_MESSAGE = (
    """
You are Flood-Eye, a friendly and clear AI assistant here to help people during floods.
You provide real-time flood safety tips, evacuation directions, and local shelter information.
Be concise, practical, and reassuring. Use a calm, positive tone and light humor only when appropriate.

You are also aware of Indian geography and can assist users in India with local flood information, safety tips, and shelter locations. If the user is in India, greet them with a friendly "Namaste" and ask for their city or locality to provide more relevant information.
"""
)
VOICE = "alloy"
LOG_EVENT_TYPES = {
    "error",
    "response.content.done",
    "rate_limits.updated",
    "response.done",
    "input_audio_buffer.committed",
    "input_audio_buffer.speech_stopped",
    "input_audio_buffer.speech_started",
    "session.created",
    "session.updated",
}


def _load_twiml_classes():
    try:
        voice_module = import_module("twilio.twiml.voice_response")
        return voice_module.Connect, voice_module.VoiceResponse
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Twilio SDK is not installed. Install package 'twilio' to use this route.",
        ) from exc


@router.get("/twilio", response_class=JSONResponse)
async def twilio_index_page():
    return {"message": "Twilio Media Stream route is running"}


@router.api_route("/incoming-call", methods=["GET", "POST"])
async def handle_incoming_call(request: Request):
    Connect, VoiceResponse = _load_twiml_classes()

    response = VoiceResponse()
    if not OPENAI_API_KEY:
        response.say(
            "The voice assistant is temporarily unavailable. Please try again later.",
            voice="Google.en-US-Chirp3-HD-Aoede",
        )
        return HTMLResponse(content=str(response), media_type="application/xml")

    response.say(
        "Please wait while we connect your call to the A. I. voice assistant, powered by Twilio and the Open A I Realtime API",
        voice="Google.en-US-Chirp3-HD-Aoede",
    )
    response.pause(length=1)
    response.say(
        "O.K. you can start talking!",
        voice="Google.en-US-Chirp3-HD-Aoede",
    )

    host = request.headers.get("x-forwarded-host") or request.url.hostname
    connect = Connect()
    connect.stream(url=f"wss://{host}/media-stream")
    response.append(connect)
    return HTMLResponse(content=str(response), media_type="application/xml")


@router.websocket("/media-stream")
async def handle_media_stream(websocket: WebSocket):
    if not OPENAI_API_KEY:
        await websocket.close(code=1011)
        return

    await websocket.accept()

    async with websockets.connect(
        f"wss://api.openai.com/v1/realtime?model=gpt-realtime&temperature={TEMPERATURE}",
        additional_headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
    ) as openai_ws:
        await initialize_session(openai_ws)

        stream_sid = None
        latest_media_timestamp = 0
        last_assistant_item = None
        mark_queue = []
        response_start_timestamp_twilio = None

        async def receive_from_twilio():
            nonlocal stream_sid, latest_media_timestamp, last_assistant_item, response_start_timestamp_twilio
            try:
                async for message in websocket.iter_text():
                    data = json.loads(message)
                    if data.get("event") == "media" and openai_ws.state.name == "OPEN":
                        latest_media_timestamp = int(data["media"]["timestamp"])
                        await openai_ws.send(
                            json.dumps(
                                {
                                    "type": "input_audio_buffer.append",
                                    "audio": data["media"]["payload"],
                                }
                            )
                        )
                    elif data.get("event") == "start":
                        stream_sid = data["start"]["streamSid"]
                        response_start_timestamp_twilio = None
                        latest_media_timestamp = 0
                        last_assistant_item = None
                    elif data.get("event") == "mark" and mark_queue:
                        mark_queue.pop(0)
            except WebSocketDisconnect:
                if openai_ws.state.name == "OPEN":
                    await openai_ws.close()

        async def send_to_twilio():
            nonlocal stream_sid, last_assistant_item, response_start_timestamp_twilio
            try:
                async for openai_message in openai_ws:
                    response = json.loads(openai_message)
                    if response.get("type") in LOG_EVENT_TYPES:
                        print(f"Received event: {response['type']}")

                    if response.get("type") == "response.output_audio.delta" and "delta" in response:
                        audio_payload = base64.b64encode(
                            base64.b64decode(response["delta"])
                        ).decode("utf-8")
                        await websocket.send_json(
                            {
                                "event": "media",
                                "streamSid": stream_sid,
                                "media": {"payload": audio_payload},
                            }
                        )

                        if response.get("item_id") and response["item_id"] != last_assistant_item:
                            response_start_timestamp_twilio = latest_media_timestamp
                            last_assistant_item = response["item_id"]

                        await send_mark(websocket, stream_sid)

                    if response.get("type") == "input_audio_buffer.speech_started" and last_assistant_item:
                        await handle_speech_started_event()
            except Exception as exc:
                print(f"Error in send_to_twilio: {exc}")

        async def handle_speech_started_event():
            nonlocal response_start_timestamp_twilio, last_assistant_item
            if mark_queue and response_start_timestamp_twilio is not None:
                elapsed_time = latest_media_timestamp - response_start_timestamp_twilio

                if last_assistant_item:
                    await openai_ws.send(
                        json.dumps(
                            {
                                "type": "conversation.item.truncate",
                                "item_id": last_assistant_item,
                                "content_index": 0,
                                "audio_end_ms": elapsed_time,
                            }
                        )
                    )

                await websocket.send_json({"event": "clear", "streamSid": stream_sid})
                mark_queue.clear()
                last_assistant_item = None
                response_start_timestamp_twilio = None

        async def send_mark(connection: WebSocket, sid: str | None):
            if sid:
                await connection.send_json(
                    {"event": "mark", "streamSid": sid, "mark": {"name": "responsePart"}}
                )
                mark_queue.append("responsePart")

        await asyncio.gather(receive_from_twilio(), send_to_twilio())


async def initialize_session(openai_ws):
    session_update = {
        "type": "session.update",
        "session": {
            "type": "realtime",
            "model": "gpt-realtime",
            "output_modalities": ["audio"],
            "audio": {
                "input": {
                    "format": {"type": "audio/pcmu"},
                    "turn_detection": {"type": "server_vad"},
                },
                "output": {
                    "format": {"type": "audio/pcmu"},
                    "voice": VOICE,
                },
            },
            "instructions": SYSTEM_MESSAGE,
        },
    }
    await openai_ws.send(json.dumps(session_update))
