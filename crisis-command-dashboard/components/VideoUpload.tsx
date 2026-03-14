"use client"

import { useState, useCallback } from "react"

const AGENTI_BASE = process.env.NEXT_PUBLIC_AGENTI_URL ?? "http://localhost:8000"

// ── Types ──────────────────────────────────────────────────────────────────
interface VideoJobResult {
    job_id: string
    frames_processed: number
    frames_output: number
    person_events: number
    gemini_events: number
    frame_stride: number
    processing_preset: string
    gemini_mode: string
    output_video_download: string
    events_download: string
    gemini_debug: Record<string, string>
}

type ProcessingPreset = "fast" | "balanced" | "quality"
type GeminiMode = "keyframe" | "full_video"

// ── Component ──────────────────────────────────────────────────────────────
export default function VideoUpload() {
    const [file, setFile] = useState<File | null>(null)
    const [preset, setPreset] = useState<ProcessingPreset>("fast")
    const [geminiMode, setGeminiMode] = useState<GeminiMode>("keyframe")
    const [loading, setLoading] = useState(false)
    const [progress, setProgress] = useState<string[]>([])
    const [result, setResult] = useState<VideoJobResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const addLog = (msg: string) =>
        setProgress((p) => [...p, `[${new Date().toLocaleTimeString()}] ${msg}`])

    const handleFileSelect = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const f = e.target.files?.[0]
            if (!f) return
            if (!f.type.startsWith("video/")) {
                setError("Please select a video file.")
                return
            }
            setFile(f)
            setError(null)
            setResult(null)
        },
        []
    )

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        const f = e.dataTransfer.files[0]
        if (!f?.type.startsWith("video/")) { setError("Drop a video file."); return }
        setFile(f)
        setError(null)
        setResult(null)
    }, [])

    const analyze = useCallback(async () => {
        if (!file || loading) return
        setLoading(true)
        setProgress([])
        setResult(null)
        setError(null)
        addLog(`Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)…`)
        addLog(`Preset: ${preset} · Gemini mode: ${geminiMode}`)

        const form = new FormData()
        form.append("video", file)
        form.append("processing_preset", preset)
        form.append("gemini_mode", geminiMode)

        try {
            addLog("Running YOLO v8 object detection…")
            addLog("Sending frames to Google Gemini for scene analysis…")
            const res = await fetch(`${AGENTI_BASE}/video/analyze`, {
                method: "POST",
                body: form,
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.detail ?? `HTTP ${res.status}`)
            }
            const data: VideoJobResult = await res.json()
            addLog(`✅ Done! Processed ${data.frames_processed} frames · ${data.person_events} people detected`)
            setResult(data)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            setError(msg)
            addLog(`❌ Error: ${msg}`)
        } finally {
            setLoading(false)
        }
    }, [file, loading, preset, geminiMode])

    return (
        <div className="flex flex-col gap-6 p-6" style={{ background: "var(--fs-bg-base)", minHeight: "100%" }}>
            {/* Header */}
            <div>
                <h1
                    className="text-2xl font-bold"
                    style={{ color: "var(--fs-brand)", fontFamily: "var(--font-display, 'Space Grotesk')" }}
                >
                    🎥 Video Intelligence
                </h1>
                <p className="text-sm mt-1" style={{ color: "var(--fs-text-muted)" }}>
                    Upload drone or CCTV footage — YOLO v8 detects people · Gemini analyzes scenes · AI overlays events
                </p>
            </div>

            {/* Upload zone + settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Drop zone */}
                <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 p-8 transition-colors cursor-pointer"
                    style={{
                        borderColor: file ? "var(--fs-brand)" : "#CBD5E1",
                        background: file ? "#EFF6FF" : "#fff",
                    }}
                    onClick={() => document.getElementById("video-input")?.click()}
                >
                    <input
                        id="video-input"
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                    <span className="text-4xl">{file ? "🎬" : "📁"}</span>
                    {file ? (
                        <>
                            <p className="font-semibold text-sm" style={{ color: "var(--fs-brand)" }}>
                                {file.name}
                            </p>
                            <p className="text-xs" style={{ color: "var(--fs-text-muted)" }}>
                                {(file.size / 1024 / 1024).toFixed(1)} MB
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="font-semibold text-sm" style={{ color: "var(--fs-text-primary)" }}>
                                Drop video or click to browse
                            </p>
                            <p className="text-xs" style={{ color: "var(--fs-text-muted)" }}>
                                MP4, MOV — max 500 MB
                            </p>
                        </>
                    )}
                </div>

                {/* Settings */}
                <div className="fs-card p-5 flex flex-col gap-4">
                    <h3 className="font-semibold text-sm" style={{ color: "var(--fs-brand)" }}>
                        ⚙️ Analysis Settings
                    </h3>

                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fs-text-muted)" }}>
                            Processing Preset
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(["fast", "balanced", "quality"] as ProcessingPreset[]).map((p) => (
                                <button
                                    key={p}
                                    className="py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize"
                                    style={{
                                        background: preset === p ? "var(--fs-brand)" : "#fff",
                                        color: preset === p ? "#fff" : "var(--fs-brand)",
                                        borderColor: "var(--fs-brand)",
                                    }}
                                    onClick={() => setPreset(p)}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fs-text-muted)" }}>
                            Gemini Analysis Mode
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {(["keyframe", "full_video"] as GeminiMode[]).map((m) => (
                                <button
                                    key={m}
                                    className="py-1.5 rounded-lg text-xs font-semibold border transition-all"
                                    style={{
                                        background: geminiMode === m ? "var(--fs-brand-light)" : "#fff",
                                        color: geminiMode === m ? "#fff" : "var(--fs-brand-light)",
                                        borderColor: "var(--fs-brand-light)",
                                    }}
                                    onClick={() => setGeminiMode(m)}
                                >
                                    {m === "keyframe" ? "🖼 Keyframe" : "🎞 Full Video"}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        className="mt-auto w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: loading ? "var(--fs-neutral)" : "var(--fs-brand)" }}
                        onClick={analyze}
                        disabled={!file || loading}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="agent-spinner" /> Analyzing…
                            </span>
                        ) : "🚀 Analyze Video"}
                    </button>
                </div>
            </div>

            {/* Processing log */}
            {progress.length > 0 && (
                <div
                    className="rounded-xl p-4 font-mono text-xs"
                    style={{ background: "var(--fs-brand-dark)", color: "#BAE6FD" }}
                >
                    {progress.map((line, i) => (
                        <p key={i}>{line}</p>
                    ))}
                    {loading && <span className="agent-spinner mt-1" />}
                </div>
            )}

            {/* Error */}
            {error && (
                <div
                    className="rounded-xl p-4 text-sm"
                    style={{ background: "#FEF2F2", color: "var(--fs-danger)", border: "1px solid #FECACA" }}
                >
                    ⚠️ {error}
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="fs-card p-6">
                    <h2
                        className="text-lg font-bold mb-4 font-display"
                        style={{ color: "var(--fs-brand)", fontFamily: "var(--font-display)" }}
                    >
                        📊 Analysis Results — Job {result.job_id.slice(0, 8)}
                    </h2>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {[
                            { label: "Frames Processed", value: result.frames_processed, icon: "🎞" },
                            { label: "Frames Output", value: result.frames_output, icon: "✅" },
                            { label: "People Detected", value: result.person_events, icon: "🧍" },
                            { label: "Gemini Events", value: result.gemini_events, icon: "🤖" },
                        ].map((stat) => (
                            <div
                                key={stat.label}
                                className="rounded-xl p-4 text-center"
                                style={{ background: "var(--fs-bg-base)" }}
                            >
                                <p className="text-2xl mb-1">{stat.icon}</p>
                                <p
                                    className="text-2xl font-bold font-display"
                                    style={{ color: "var(--fs-brand)", fontFamily: "var(--font-display)" }}
                                >
                                    {stat.value}
                                </p>
                                <p className="text-xs mt-1" style={{ color: "var(--fs-text-muted)" }}>
                                    {stat.label}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Downloads */}
                    <div className="flex gap-3">
                        <a
                            href={`${AGENTI_BASE}${result.output_video_download}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-3 rounded-xl text-center font-semibold text-sm text-white transition-all hover:opacity-90"
                            style={{ background: "var(--fs-brand)" }}
                        >
                            ⬇️ Download Overlay Video
                        </a>
                        <a
                            href={`${AGENTI_BASE}${result.events_download}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-3 rounded-xl text-center font-semibold text-sm border transition-all hover:bg-blue-50"
                            style={{ color: "var(--fs-brand)", borderColor: "var(--fs-brand)" }}
                        >
                            📄 Download Events JSON
                        </a>
                    </div>
                </div>
            )}
        </div>
    )
}
