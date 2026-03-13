"use client"

import { Phone, Camera, AlertCircle } from "lucide-react"
import { useState } from "react"

interface ActionButtonsProps {
  status?: "en-route" | "arrived" | "complete"
  onStatusChange?: (status: "en-route" | "arrived" | "complete") => void
}

export default function ActionButtons({ status, onStatusChange }: ActionButtonsProps) {
  const [showToast, setShowToast] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isCalling, setIsCalling] = useState(false)

  const showNotification = (message: string) => {
    setShowToast(message)
    setTimeout(() => setShowToast(null), 3000)
  }

  const handleCamera = () => {
    setIsCapturing(true)
    showNotification("📸 Evidence captured successfully")
    setTimeout(() => setIsCapturing(false), 600)
  }

  const handleCall = () => {
    setIsCalling(true)
    showNotification("📞 Calling dispatch...")
    setTimeout(() => setIsCalling(false), 2000)
  }

  const handleSOS = () => {
    showNotification("🚨 SOS Alert sent to all nearby units!")
  }

  return (
    <>
      <div className="fixed bottom-24 right-4 flex flex-col gap-3 z-[60]">
        {/* SOS / Emergency */}
        <button
          onClick={handleSOS}
          className="w-16 h-16 rounded-full shadow-apple-lg flex items-center justify-center transition-apple hover:scale-110 ios-press glass-strong bg-accent/20 text-accent border-2 border-accent/30 animate-pulse active:scale-95"
        >
          <AlertCircle className="w-7 h-7" strokeWidth={2.5} />
        </button>

        {/* Request Backup / Call */}
        <button
          onClick={handleCall}
          className={`w-16 h-16 rounded-full shadow-apple-lg flex items-center justify-center transition-apple hover:scale-110 ios-press glass-strong border border-border/50 active:scale-95 ${isCalling ? "bg-primary/20 scale-110" : ""
            }`}
        >
          <Phone className={`w-6 h-6 text-primary transition-transform ${isCalling ? "animate-bounce" : ""}`} strokeWidth={2} />
        </button>

        {/* Log Evidence / Camera */}
        <button
          onClick={handleCamera}
          className={`w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-apple-lg flex items-center justify-center transition-apple hover:scale-110 ios-press active:scale-95 ${isCapturing ? "scale-95 brightness-125" : ""
            }`}
        >
          <Camera className="w-6 h-6" strokeWidth={2} />
        </button>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top duration-300">
          <div className="glass-strong px-6 py-3 rounded-2xl shadow-apple-lg border border-border/50 max-w-[90vw]">
            <p className="text-sm font-medium text-foreground text-center">{showToast}</p>
          </div>
        </div>
      )}
    </>
  )
}
