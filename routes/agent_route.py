from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agents.disaster_agent import clear_agent_memory, run_disaster_agent


class AgentInvokeRequest(BaseModel):
    message: str = Field(..., min_length=3, description="User instruction for the disaster agent")
    dry_run: bool = Field(default=True, description="If true, do not mutate inventory/resource state")
    max_iterations: int = Field(default=20, ge=1, le=100)
    session_id: str = Field(default="default", min_length=1, description="Conversation memory key")
    remember: bool = Field(default=True, description="If true, include/store session memory")
    clear_memory_before_run: bool = Field(default=False, description="If true, reset session memory before invoke")


class AgentToolCall(BaseModel):
    name: str | None = None
    args: dict | None = None
    id: str | None = None
    state: str | None = None
    result: str | None = None


class AgentInvokeResponse(BaseModel):
    output: str
    dry_run: bool
    tool_calls: list[AgentToolCall]
    error: str | None = None
    session_id: str
    memory_turns: int = 0


class AgentMemoryResetResponse(BaseModel):
    status: str
    session_id: str


router = APIRouter(prefix="/agent", tags=["Agent"])


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _chunk_text(text: str, size: int = 28) -> list[str]:
    if not text:
        return []
    return [text[i : i + size] for i in range(0, len(text), size)]


@router.post("/invoke", response_model=AgentInvokeResponse)
async def invoke_agent(payload: AgentInvokeRequest) -> AgentInvokeResponse:
    try:
        if payload.clear_memory_before_run:
            clear_agent_memory(payload.session_id)

        result = run_disaster_agent(
            message=payload.message,
            dry_run=payload.dry_run,
            max_iterations=payload.max_iterations,
            session_id=payload.session_id,
            remember=payload.remember,
        )
        return AgentInvokeResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {exc}") from exc


@router.post("/invoke/stream")
async def invoke_agent_stream(payload: AgentInvokeRequest) -> StreamingResponse:
    async def event_generator():
        yield _sse(
            "status",
            {
                "phase": "started",
                "session_id": payload.session_id,
                "dry_run": payload.dry_run,
            },
        )

        if payload.clear_memory_before_run:
            clear_agent_memory(payload.session_id)
            yield _sse(
                "status",
                {"phase": "memory_cleared", "session_id": payload.session_id},
            )

        task = asyncio.create_task(
            asyncio.to_thread(
                run_disaster_agent,
                message=payload.message,
                dry_run=payload.dry_run,
                max_iterations=payload.max_iterations,
                session_id=payload.session_id,
                remember=payload.remember,
            )
        )

        tick = 0
        while not task.done():
            tick += 1
            yield _sse("status", {"phase": "running", "tick": tick})
            await asyncio.sleep(0.65)

        try:
            result = await task
        except RuntimeError as exc:
            yield _sse("error", {"message": str(exc)})
            yield _sse("done", {"ok": False})
            return
        except Exception as exc:
            yield _sse("error", {"message": f"Agent execution failed: {exc}"})
            yield _sse("done", {"ok": False})
            return

        yield _sse(
            "meta",
            {
                "session_id": result.get("session_id"),
                "memory_turns": result.get("memory_turns", 0),
                "dry_run": result.get("dry_run", True),
            },
        )

        tool_calls = result.get("tool_calls", [])
        for idx, tool_call in enumerate(tool_calls, start=1):
            yield _sse(
                "tool_call",
                {"index": idx, "total": len(tool_calls), "tool_call": tool_call},
            )
            await asyncio.sleep(0.02)

        output = result.get("output", "")
        for chunk in _chunk_text(output):
            yield _sse("output_chunk", {"delta": chunk})
            await asyncio.sleep(0.02)

        yield _sse(
            "final",
            {
                "output": output,
                "tool_calls": tool_calls,
                "session_id": result.get("session_id"),
                "memory_turns": result.get("memory_turns", 0),
                "error": result.get("error"),
                "dry_run": result.get("dry_run", True),
            },
        )
        yield _sse("done", {"ok": True})

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.delete("/memory/{session_id}", response_model=AgentMemoryResetResponse)
async def reset_agent_memory(session_id: str) -> AgentMemoryResetResponse:
    clear_agent_memory(session_id)
    return AgentMemoryResetResponse(status="cleared", session_id=session_id)
