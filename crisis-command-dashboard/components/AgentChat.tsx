"use client"

import { useState, useRef, useEffect, useCallback } from "react"

const AGENTI_BASE = process.env.NEXT_PUBLIC_AGENTI_URL ?? "http://localhost:8000"

// ── Types ─────────────────────────────────────────────────────────────────
interface ToolCall {
    name: string
    args: Record<string, unknown>
    id: string
    state: "pending" | "completed"
    result?: string
}

interface Message {
    role: "user" | "assistant"
    content: string
    toolCalls?: ToolCall[]
    streaming?: boolean
}

interface StreamMeta {
    session_id: string
    memory_turns: number
    dry_run: boolean
}

// ── Tool icon map ─────────────────────────────────────────────────────────
const TOOL_ICONS: Record<string, string> = {
    list_supplies: "📦",
    get_supply_level: "🔍",
    allocate_supply_tool: "➕",
    release_supply_tool: "↩️",
    update_supply_tool: "✏️",
    get_available_rescue: "🛟",
    dispatch_rescue_tool: "🚁",
    release_rescue_tool: "✅",
    find_nearest: "📍",
    broadcast_alert_tool: "📣",
    notify_rescue_team_tool: "📡",
    send_supply_request_tool: "📬",
    trigger_rescue_agent_tool: "🤖",
    trigger_supply_agent_tool: "🤖",
    trigger_weather_agent_tool: "🌧️",
}

// ── ToolCallCard ──────────────────────────────────────────────────────────
function ToolCallCard({ call }: { call: ToolCall }) {
    const [open, setOpen] = useState(false)
    const icon = TOOL_ICONS[call.name] ?? "🔧"

    return (
        <div
            className="border rounded-lg overflow-hidden text-xs"
            style={{
                borderColor: "#E0F2FE",
                background: "#F0F9FF",
            }}
        >
            <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50 transition-colors"
                onClick={() => setOpen((p) => !p)}
                style={{ color: "var(--fs-brand)" }}
            >
                <span>{icon}</span>
                <span className="font-semibold font-mono">{call.name}</span>
                <span
                    className="ml-auto text-xs px-1.5 py-0.5 rounded"
                    style={{
                        background: call.state === "completed" ? "#059669" : "#F59E0B",
                        color: "#fff",
                    }}
                >
                    {call.state}
                </span>
                <span className="opacity-50">{open ? "▲" : "▼"}</span>
            </button>

            {open && (
                <div className="px-3 py-2 border-t" style={{ borderColor: "#E0F2FE" }}>
                    <p className="text-gray-500 mb-1 font-semibold uppercase tracking-wide text-[10px]">Args</p>
                    <pre className="whitespace-pre-wrap break-all text-gray-700">
                        {JSON.stringify(call.args, null, 2)}
                    </pre>
                    {call.result && (
                        <>
                            <p className="text-gray-500 mt-2 mb-1 font-semibold uppercase tracking-wide text-[10px]">Result</p>
                            <pre className="whitespace-pre-wrap break-all" style={{ color: "var(--fs-brand)" }}>
                                {call.result}
                            </pre>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

// ── MessageBubble ──────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
    const isUser = msg.role === "user"

    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
            <div style={{ maxWidth: "80%" }}>
                {!isUser && (
                    <div className="flex items-center gap-2 mb-1.5">
                        <span
                            className="text-xs font-semibold uppercase tracking-widest"
                            style={{ color: "var(--fs-brand)" }}
                        >
                            FloodShield AI
                        </span>
                        {msg.streaming && <span className="agent-spinner" />}
                    </div>
                )}

                {/* Tool calls */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="flex flex-col gap-1.5 mb-2">
                        {msg.toolCalls.map((tc) => (
                            <ToolCallCard key={tc.id} call={tc} />
                        ))}
                    </div>
                )}

                {/* Text bubble */}
                {msg.content && (
                    <div
                        className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
                        style={{
                            background: isUser ? "var(--fs-brand)" : "var(--fs-bg-card)",
                            color: isUser ? "#fff" : "var(--fs-text-primary)",
                            boxShadow: isUser
                                ? "0 2px 8px rgb(12 74 110 / 0.25)"
                                : "var(--fs-shadow-card)",
                            borderBottomRightRadius: isUser ? "4px" : "1rem",
                            borderBottomLeftRadius: isUser ? "1rem" : "4px",
                        }}
                    >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Main AgentChat component ───────────────────────────────────────────────
export default function AgentChat() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [dryRun, setDryRun] = useState(true)
    const [sessionId] = useState(() => `session_${Date.now()}`)
    const [meta, setMeta] = useState<StreamMeta | null>(null)
    const [loading, setLoading] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const sendMessage = useCallback(async () => {
        const text = input.trim()
        if (!text || loading) return

        setInput("")
        setLoading(true)

        // Add user message
        setMessages((prev) => [...prev, { role: "user", content: text }])

        // Add placeholder assistant message
        const assistantIdx = messages.length + 1
        setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "", streaming: true },
        ])

        try {
            const res = await fetch(`${AGENTI_BASE}/agent/invoke/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: text,
                    dry_run: dryRun,
                    session_id: sessionId,
                    remember: true,
                }),
            })

            if (!res.ok || !res.body) throw new Error("Stream failed")

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })

                const lines = buffer.split("\n")
                buffer = lines.pop() ?? ""

                for (const line of lines) {
                    if (line.startsWith("event: ")) continue
                    if (!line.startsWith("data: ")) continue
                    try {
                        const event = JSON.parse(line.slice(6))

                        if (line.includes("event: meta") || event.session_id) {
                            setMeta({
                                session_id: event.session_id,
                                memory_turns: event.memory_turns,
                                dry_run: event.dry_run,
                            })
                        }

                        if (event.tool_call) {
                            setMessages((prev) =>
                                prev.map((m, i) =>
                                    i === assistantIdx
                                        ? {
                                            ...m,
                                            toolCalls: [...(m.toolCalls ?? []), event.tool_call],
                                        }
                                        : m
                                )
                            )
                        }

                        if (event.delta) {
                            setMessages((prev) =>
                                prev.map((m, i) =>
                                    i === assistantIdx
                                        ? { ...m, content: m.content + event.delta }
                                        : m
                                )
                            )
                        }

                        if (event.output !== undefined) {
                            setMessages((prev) =>
                                prev.map((m, i) =>
                                    i === assistantIdx
                                        ? { ...m, content: event.output, streaming: false }
                                        : m
                                )
                            )
                        }
                    } catch { }
                }
            }
        } catch (err) {
            setMessages((prev) =>
                prev.map((m, i) =>
                    i === assistantIdx
                        ? {
                            ...m,
                            content: `⚠️ Could not reach agent. Make sure agenti_bluuu is running on ${AGENTI_BASE}`,
                            streaming: false,
                        }
                        : m
                )
            )
        } finally {
            setLoading(false)
            setMessages((prev) =>
                prev.map((m, i) =>
                    i === assistantIdx ? { ...m, streaming: false } : m
                )
            )
        }
    }, [input, loading, messages.length, dryRun, sessionId])

    return (
        <div className="flex flex-col h-full" style={{ background: "var(--fs-bg-base)" }}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-6 py-4 border-b"
                style={{
                    background: "var(--fs-brand-dark)",
                    borderColor: "rgba(255,255,255,0.1)",
                }}
            >
                <div>
                    <h1
                        className="text-lg font-bold text-white font-display"
                        style={{ fontFamily: "var(--font-display), 'Space Grotesk', sans-serif" }}
                    >
                        🤖 FloodShield AI Agent
                    </h1>
                    <p className="text-xs mt-0.5" style={{ color: "var(--fs-brand-light)" }}>
                        LangChain · LangGraph · GPT-4.1-mini · Session: {sessionId.slice(-8)}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {meta && (
                        <span
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: "rgba(14,165,233,0.2)", color: "var(--fs-brand-light)" }}
                        >
                            {meta.memory_turns} turns
                        </span>
                    )}
                    <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
                        <span style={{ color: dryRun ? "var(--fs-warning)" : "var(--fs-safe)" }}>
                            {dryRun ? "🔵 Dry Run" : "🟢 Live"}
                        </span>
                        <div
                            className="relative w-10 h-5 rounded-full transition-colors cursor-pointer"
                            style={{ background: dryRun ? "#475569" : "var(--fs-safe)" }}
                            onClick={() => setDryRun((p) => !p)}
                        >
                            <div
                                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                                style={{ left: dryRun ? "2px" : "22px" }}
                            />
                        </div>
                    </label>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                        <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                            style={{ background: "var(--fs-brand)", color: "#fff" }}
                        >
                            🌊
                        </div>
                        <h2
                            className="text-xl font-bold font-display"
                            style={{ color: "var(--fs-brand)", fontFamily: "var(--font-display)" }}
                        >
                            Ask the Flood Agent
                        </h2>
                        <div className="grid grid-cols-1 gap-2 max-w-md">
                            {[
                                "Check water levels at Mithi River and allocate rescue teams",
                                "How many food packets do we have? Dispatch supplies to Shelter A",
                                "Broadcast a flood evacuation alert for Andheri",
                            ].map((prompt) => (
                                <button
                                    key={prompt}
                                    className="text-left text-sm px-4 py-3 rounded-xl border transition-all hover:scale-[1.02]"
                                    style={{
                                        borderColor: "var(--fs-brand-light)",
                                        background: "#fff",
                                        color: "var(--fs-brand)",
                                    }}
                                    onClick={() => { setInput(prompt) }}
                                >
                                    &ldquo;{prompt}&rdquo;
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <MessageBubble key={i} msg={msg} />
                ))}
                <div ref={scrollRef} />
            </div>

            {/* Input */}
            <div
                className="px-6 py-4 border-t"
                style={{ borderColor: "#CBD5E1", background: "#fff" }}
            >
                {!dryRun && (
                    <p
                        className="text-xs mb-2 px-3 py-1.5 rounded-lg"
                        style={{ background: "#FEF3C7", color: "#92400E" }}
                    >
                        ⚠️ <strong>Live mode</strong> — agent will mutate inventory and dispatch resources
                    </p>
                )}
                <div className="flex gap-3">
                    <textarea
                        className="flex-1 resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-all"
                        style={{
                            borderColor: "#CBD5E1",
                            minHeight: "52px",
                            maxHeight: "140px",
                            fontFamily: "var(--font-body)",
                        }}
                        placeholder="Describe a flood situation or ask about resources…"
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                sendMessage()
                            }
                        }}
                    />
                    <button
                        className="px-5 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: "var(--fs-brand)", minWidth: "80px" }}
                        onClick={sendMessage}
                        disabled={loading || !input.trim()}
                    >
                        {loading ? <span className="agent-spinner" /> : "Send"}
                    </button>
                </div>
            </div>
        </div>
    )
}
