from __future__ import annotations

import os
from functools import lru_cache
from threading import Lock

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_core.messages import AIMessage, ToolMessage
from langchain_openai import ChatOpenAI
from langgraph.errors import GraphRecursionError

from tools.langchain_tools import build_langchain_tools

load_dotenv()

SYSTEM_PROMPT = (
    "You are a disaster response coordinator agent. "
    "Use tools for real-world checks and actions. "
    "Always prioritize life safety, resource efficiency, and concise outputs. "
    "When reasoning about supplies, call list_supplies first and use exact inventory resource names. "
    "If execution mode is LIVE (dry_run=false), do not ask for confirmation; execute appropriate tools and report completed actions. "
    "If execution mode is DRY_RUN (dry_run=true), provide a plan and clearly mark actions as simulated. "
    "If tool output is insufficient, call another relevant tool before finalizing. "
    "Do not call the same tool repeatedly with identical arguments. "
    "After enough evidence is gathered, stop tool calls and provide a final action plan."
)

MEMORY_MAX_MESSAGES = 20
_memory_lock = Lock()
_agent_memory: dict[str, list[dict[str, str]]] = {}


def _get_session_history(session_id: str) -> list[dict[str, str]]:
    with _memory_lock:
        return list(_agent_memory.get(session_id, []))


def _append_session_memory(session_id: str, user_text: str, assistant_text: str) -> int:
    with _memory_lock:
        history = _agent_memory.get(session_id, [])
        history.append({"role": "user", "content": user_text})
        history.append({"role": "assistant", "content": assistant_text})
        history = history[-MEMORY_MAX_MESSAGES:]
        _agent_memory[session_id] = history
        return len(history) // 2


def clear_agent_memory(session_id: str) -> None:
    with _memory_lock:
        _agent_memory.pop(session_id, None)


def get_agent_memory_turns(session_id: str) -> int:
    with _memory_lock:
        return len(_agent_memory.get(session_id, [])) // 2


@lru_cache(maxsize=1)
def _get_model() -> ChatOpenAI:
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is not set")

    return ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        temperature=0.1,
        api_key=os.getenv("OPENAI_API_KEY"),
    )


def run_disaster_agent(
    *,
    message: str,
    dry_run: bool = True,
    max_iterations: int = 20,
    session_id: str = "default",
    remember: bool = True,
) -> dict:
    model = _get_model()
    tools = build_langchain_tools(dry_run=dry_run)

    agent = create_agent(
        model=model,
        tools=tools,
        system_prompt=SYSTEM_PROMPT,
    )

    user_text = f"Execution mode: {'DRY_RUN' if dry_run else 'LIVE'} (dry_run={dry_run}).\n\nTask: {message}"
    messages_payload: list[dict[str, str]] = []
    if remember:
        messages_payload.extend(_get_session_history(session_id))
    messages_payload.append(
        {
            "role": "user",
            "content": user_text,
        }
    )

    try:
        result = agent.invoke(
            {"messages": messages_payload},
            config={"recursion_limit": max_iterations},
        )
    except GraphRecursionError as exc:
        return {
            "output": (
                "Agent stopped due to recursion limit. "
                "This usually means the tool loop did not converge. "
                "Try increasing max_iterations or simplify the prompt."
            ),
            "dry_run": dry_run,
            "tool_calls": [],
            "error": str(exc),
            "session_id": session_id,
            "memory_turns": get_agent_memory_turns(session_id),
        }

    messages = result.get("messages", [])
    final_text = ""
    tool_calls: list[dict] = []

    tool_results_by_id: dict[str, str] = {}

    for msg in messages:
        if isinstance(msg, ToolMessage):
            tool_results_by_id[msg.tool_call_id] = str(msg.content)

    for msg in messages:
        if isinstance(msg, AIMessage):
            if msg.content:
                final_text = str(msg.content)
            if msg.tool_calls:
                for call in msg.tool_calls:
                    call_id = call.get("id")
                    result_text = tool_results_by_id.get(call_id, None)
                    tool_calls.append(
                        {
                            "name": call.get("name"),
                            "args": call.get("args"),
                            "id": call_id,
                            "state": "completed" if result_text is not None else "pending",
                            "result": result_text,
                        }
                    )

    memory_turns = get_agent_memory_turns(session_id)
    if remember and final_text:
        memory_turns = _append_session_memory(session_id, user_text, final_text)

    return {
        "output": final_text,
        "dry_run": dry_run,
        "tool_calls": tool_calls,
        "session_id": session_id,
        "memory_turns": memory_turns,
    }
