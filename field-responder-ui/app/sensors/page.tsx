"use client"

import { useState, useEffect, useCallback } from "react"

const AGENTI_BASE = process.env.NEXT_PUBLIC_AGENTI_URL ?? "http://localhost:8000"

type SensorId = "MITHI_RIVER" | "ANDHERI_SUBWAY" | "TIDE_GATE"

interface SensorReading {
    sensor_id: SensorId
    value: number
    unit: string
    timestamp: string
}

const SENSOR_CONFIG: Record<SensorId, { label: string; icon: string; warning: number; critical: number; location: string }> = {
    MITHI_RIVER: { label: "Mithi River", icon: "🌊", warning: 2.5, critical: 3.5, location: "Dharavi, Mumbai" },
    ANDHERI_SUBWAY: { label: "Andheri Subway", icon: "🚇", warning: 12, critical: 18, location: "Andheri Underpass" },
    TIDE_GATE: { label: "Mahim Tide Gate", icon: "⛩️", warning: 3.0, critical: 4.0, location: "Mahim Causeway" },
}

function severityOf(sensor_id: SensorId, value: number): "safe" | "warning" | "critical" {
    const cfg = SENSOR_CONFIG[sensor_id]
    if (value >= cfg.critical) return "critical"
    if (value >= cfg.warning) return "warning"
    return "safe"
}

function SensorCard({ sensorId }: { sensorId: SensorId }) {
    const [reading, setReading] = useState<SensorReading | null>(null)
    const [history, setHistory] = useState<number[]>([])
    const [connected, setConnected] = useState(false)
    const cfg = SENSOR_CONFIG[sensorId]

    useEffect(() => {
        let es: EventSource | null = null
        let retryTimeout: ReturnType<typeof setTimeout>

        const connect = () => {
            es = new EventSource(`${AGENTI_BASE}/sensors/stream/${sensorId}`)

            es.onopen = () => setConnected(true)
            es.onerror = () => {
                setConnected(false)
                es?.close()
                retryTimeout = setTimeout(connect, 5000)
            }
            es.onmessage = (e) => {
                try {
                    const data: SensorReading = JSON.parse(e.data)
                    setReading(data)
                    setHistory((prev) => [...prev.slice(-19), data.value])
                    setConnected(true)
                } catch { }
            }
        }

        connect()
        return () => { es?.close(); clearTimeout(retryTimeout) }
    }, [sensorId])

    const severity = reading ? severityOf(sensorId, reading.value) : "safe"
    const severityColor = severity === "critical" ? "var(--fs-danger)" : severity === "warning" ? "var(--fs-warning)" : "var(--fs-safe)"
    const bgColor = severity === "critical" ? "#FEF2F2" : severity === "warning" ? "#FFFBEB" : "#F0FDF4"

    // Mini bar chart
    const maxVal = Math.max(...history, cfg.critical * 1.2, 1)

    return (
        <div
            className="fs-card p-5 flex flex-col gap-3"
            style={{ borderLeft: `4px solid ${severityColor}`, background: bgColor }}
        >
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{cfg.icon}</span>
                        <span className="font-bold text-sm" style={{ fontFamily: "var(--font-display, 'Space Grotesk')", color: "var(--fs-text-primary)" }}>
                            {cfg.label}
                        </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--fs-text-muted)" }}>{cfg.location}</p>
                </div>

                <div className="text-right">
                    {reading ? (
                        <p
                            className="text-3xl font-bold font-mono"
                            style={{ color: severityColor, fontFamily: "monospace" }}
                        >
                            {reading.value.toFixed(2)}
                            <span className="text-base ml-1" style={{ color: "var(--fs-text-muted)" }}>{reading.unit}</span>
                        </p>
                    ) : (
                        <span className="agent-spinner" />
                    )}
                    <div className="flex items-center gap-1 justify-end mt-1">
                        <span className={`w-2 h-2 rounded-full ${connected ? "sos-pulse" : "opacity-30"}`} style={{ background: connected ? "var(--fs-safe)" : "var(--fs-neutral)" }} />
                        <span className="text-xs" style={{ color: "var(--fs-text-muted)" }}>{connected ? "Live" : "Reconnecting…"}</span>
                    </div>
                </div>
            </div>

            {/* Severity badge */}
            <div className="flex items-center gap-2">
                <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ background: severityColor, color: "#fff" }}
                >
                    {severity === "critical" ? "🚨 CRITICAL" : severity === "warning" ? "⚠️ WARNING" : "✅ SAFE"}
                </span>
                <span className="text-xs" style={{ color: "var(--fs-text-muted)" }}>
                    Threshold: warning={cfg.warning}{reading?.unit ?? ""} · critical={cfg.critical}{reading?.unit ?? ""}
                </span>
            </div>

            {/* Mini sparkline */}
            {history.length > 1 && (
                <div className="flex items-end gap-0.5 h-8">
                    {history.map((v, i) => {
                        const h = Math.max(4, (v / maxVal) * 32)
                        const sv = severityOf(sensorId, v)
                        const c = sv === "critical" ? "var(--fs-danger)" : sv === "warning" ? "var(--fs-warning)" : "var(--fs-safe)"
                        return (
                            <div
                                key={i}
                                className="flex-1 rounded-t transition-all"
                                style={{ height: `${h}px`, background: c, opacity: i === history.length - 1 ? 1 : 0.5 }}
                            />
                        )
                    })}
                </div>
            )}

            {reading && (
                <p className="text-[10px]" style={{ color: "var(--fs-text-muted)" }}>
                    Last updated: {new Date(reading.timestamp).toLocaleTimeString()}
                </p>
            )}
        </div>
    )
}

export default function SensorsPage() {
    return (
        <div className="min-h-screen p-6" style={{ background: "var(--fs-bg-base)" }}>
            {/* Header */}
            <div className="mb-6">
                <h1
                    className="text-2xl font-bold"
                    style={{ color: "var(--fs-brand)", fontFamily: "var(--font-display, 'Space Grotesk')" }}
                >
                    🌊 Live Sensor Dashboard
                </h1>
                <p className="text-sm mt-1" style={{ color: "var(--fs-text-muted)" }}>
                    Real-time water level readings — auto-creates incidents when thresholds are breached
                </p>
            </div>

            {/* Legend */}
            <div className="flex gap-4 mb-6 flex-wrap">
                {[
                    { label: "Safe", color: "var(--fs-safe)", desc: "Below warning threshold" },
                    { label: "Warning", color: "var(--fs-warning)", desc: "Approaching critical" },
                    { label: "Critical", color: "var(--fs-danger)", desc: "Immediate action required" },
                ].map((l) => (
                    <div key={l.label} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full" style={{ background: l.color }} />
                        <span className="font-semibold" style={{ color: l.color }}>{l.label}</span>
                        <span style={{ color: "var(--fs-text-muted)" }}>— {l.desc}</span>
                    </div>
                ))}
            </div>

            {/* Sensor cards */}
            <div className="grid grid-cols-1 gap-4">
                {(Object.keys(SENSOR_CONFIG) as SensorId[]).map((id) => (
                    <SensorCard key={id} sensorId={id} />
                ))}
            </div>

            <p className="text-center text-xs mt-8" style={{ color: "var(--fs-text-muted)" }}>
                Sensor data streamed from FloodShield Agent API · Updates every ~1 second
            </p>
        </div>
    )
}
