import VideoUpload from "@/components/VideoUpload"

export const metadata = {
    title: "FloodShield — Video Intelligence",
    description: "YOLO v8 + Gemini AI video analysis for flood footage — detect people, map damage, log events",
}

export default function VideoPage() {
    return (
        <div style={{ minHeight: "100dvh", background: "var(--fs-bg-base)" }}>
            <VideoUpload />
        </div>
    )
}
