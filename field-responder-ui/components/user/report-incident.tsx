"use client"

import { useState, useRef, useEffect } from "react"
import { Flame, Heart, Shield, AlertTriangle, Car, Zap, MapPin, Camera, Send, CheckCircle } from "lucide-react"
import { incidentsAPI } from "@/lib/api"

interface ReportIncidentProps {
    preSelectedType?: string
    onSubmit?: (incidentData: any) => void
}

export default function ReportIncident({ preSelectedType, onSubmit }: ReportIncidentProps) {
    const [selectedType, setSelectedType] = useState<string | null>(preSelectedType || null)
    const [description, setDescription] = useState("")
    const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium")
    const [isAnonymous, setIsAnonymous] = useState(false)
    const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
    const [showSuccessPopup, setShowSuccessPopup] = useState(false)
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [locationName, setLocationName] = useState("Getting location...")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Get user's location on mount
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords
                    setLocation({ lat: latitude, lng: longitude })
                    setLocationName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
                },
                (error) => {
                    console.error("Error getting location:", error)
                    // Default to Delhi location if geolocation fails
                    setLocation({ lat: 28.7041, lng: 77.1025 })
                    setLocationName("Delhi, India (Default)")
                }
            )
        } else {
            // Default location if geolocation not supported
            setLocation({ lat: 28.7041, lng: 77.1025 })
            setLocationName("Delhi, India (Default)")
        }
    }, [])

    const incidentTypes = [
        { id: "fire", icon: Flame, label: "Fire", color: "bg-red-500" },
        { id: "medical", icon: Heart, label: "Medical", color: "bg-pink-500" },
        { id: "police", icon: Shield, label: "Police", color: "bg-blue-500" },
        { id: "accident", icon: Car, label: "Accident", color: "bg-purple-500" },
        { id: "disaster", icon: Zap, label: "Disaster", color: "bg-yellow-500" },
        { id: "other", icon: AlertTriangle, label: "Other", color: "bg-orange-500" },
    ]

    const handlePhotoClick = () => {
        fileInputRef.current?.click()
    }

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setSelectedPhoto(file)
        }
    }

    const handleSubmit = async () => {
        if (!selectedType || !description || !location) {
            return
        }

        setIsSubmitting(true)

        try {
            // Create incident via API
            const incidentData = {
                title: `${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Emergency`,
                description,
                type: selectedType,
                severity,
                lat: location.lat,
                lng: location.lng,
                location_name: locationName,
                report_source: "mobile-app",
            }

            const response = await incidentsAPI.create(incidentData)

            if (response.success) {
                const incidentId = response.incident_id

                // Upload photo if selected
                if (selectedPhoto) {
                    try {
                        await incidentsAPI.uploadFile(incidentId, selectedPhoto)
                    } catch (error) {
                        console.error("Error uploading photo:", error)
                    }
                }

                // Call parent callback
                if (onSubmit) {
                    onSubmit({ ...incidentData, id: incidentId })
                }

                // Show success popup
                setShowSuccessPopup(true)

                // Reset form after 3 seconds
                setTimeout(() => {
                    setShowSuccessPopup(false)
                    setSelectedType(null)
                    setDescription("")
                    setSeverity("medium")
                    setIsAnonymous(false)
                    setSelectedPhoto(null)
                    setIsSubmitting(false)
                }, 3000)
            }
        } catch (error) {
            console.error("Error submitting incident:", error)
            alert("Failed to submit incident. Please try again.")
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto pb-20">
            {/* Header */}
            <div className="gradient-header border-b border-border px-4 py-6">
                <h1 className="text-2xl font-bold mb-1">Report Incident</h1>
                <p className="text-sm text-muted-foreground">Help is on the way once you submit</p>
            </div>

            <div className="px-4 py-4 space-y-6">
                {/* Incident Type Selection */}
                <div>
                    <label className="text-sm font-bold text-foreground mb-3 block">
                        What type of emergency? *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {incidentTypes.map((type) => {
                            const Icon = type.icon
                            const isSelected = selectedType === type.id
                            return (
                                <button
                                    key={type.id}
                                    onClick={() => setSelectedType(type.id)}
                                    className={`
                    rounded-xl p-4 transition-all duration-300 ios-press
                    flex flex-col items-center justify-center gap-2
                    ${isSelected
                                            ? `${type.color} text-white shadow-apple-lg scale-105`
                                            : "bg-muted/50 hover:bg-muted text-muted-foreground"
                                        }
                  `}
                                >
                                    <Icon className="w-6 h-6" strokeWidth={2} />
                                    <span className="text-xs font-semibold">{type.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Location */}
                <div>
                    <label className="text-sm font-bold text-foreground mb-2 block">
                        Location
                    </label>
                    <div className="card-elevated rounded-xl p-3 flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-primary" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">Current Location</p>
                            <p className="text-xs text-muted-foreground">{locationName}</p>
                        </div>
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="text-sm font-bold text-foreground mb-2 block">
                        Description *
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe what's happening..."
                        className="w-full card-elevated rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>

                {/* Severity */}
                <div>
                    <label className="text-sm font-bold text-foreground mb-3 block">
                        Severity Level
                    </label>
                    <div className="flex gap-2">
                        {[
                            { value: "low", label: "Low", color: "bg-yellow-500" },
                            { value: "medium", label: "Medium", color: "bg-orange-500" },
                            { value: "high", label: "High", color: "bg-red-500" },
                        ].map((level) => (
                            <button
                                key={level.value}
                                onClick={() => setSeverity(level.value as any)}
                                className={`
                  flex-1 py-3 rounded-xl font-semibold text-sm transition-all ios-press
                  ${severity === level.value
                                        ? `${level.color} text-white shadow-apple scale-105`
                                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                    }
                `}
                            >
                                {level.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Photo Upload */}
                <div>
                    <label className="text-sm font-bold text-foreground mb-2 block">
                        Add Photo (Optional)
                    </label>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoChange}
                        className="hidden"
                    />
                    <button
                        onClick={handlePhotoClick}
                        className="w-full card-elevated rounded-xl p-4 flex items-center justify-center gap-2 hover:bg-muted/50 transition-all ios-press"
                    >
                        <Camera className="w-5 h-5 text-primary" />
                        <span className="text-sm font-semibold text-primary">
                            {selectedPhoto ? selectedPhoto.name : "Take or Upload Photo"}
                        </span>
                    </button>
                </div>

                {/* Anonymous Toggle */}
                <label className="flex items-center justify-between card-elevated rounded-xl p-4 cursor-pointer">
                    <div>
                        <p className="text-sm font-semibold text-foreground">Report Anonymously</p>
                        <p className="text-xs text-muted-foreground">Your identity will be hidden</p>
                    </div>
                    <div
                        onClick={() => setIsAnonymous(!isAnonymous)}
                        className={`w-12 h-7 rounded-full relative transition-all duration-300 ${isAnonymous ? "bg-primary" : "bg-muted"
                            }`}
                    >
                        <div
                            className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${isAnonymous ? "right-1" : "left-1"
                                }`}
                        />
                    </div>
                </label>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={!selectedType || !description || !location || isSubmitting}
                    className={`
            w-full py-4 rounded-2xl font-bold text-base shadow-apple-lg
            transition-all duration-300 ios-press flex items-center justify-center gap-2
            ${selectedType && description && location && !isSubmitting
                            ? "bg-primary text-primary-foreground hover:scale-105 active:scale-95"
                            : "bg-muted/50 text-muted-foreground cursor-not-allowed"
                        }
          `}
                >
                    <Send className="w-5 h-5" />
                    {isSubmitting ? "Submitting..." : "Submit Report"}
                </button>

                <p className="text-xs text-center text-muted-foreground">
                    Emergency services will be notified immediately
                </p>
            </div>

            {/* Success Popup */}
            {showSuccessPopup && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="glass-strong rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border animate-in zoom-in duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mb-4">
                                <CheckCircle className="w-10 h-10 text-success" />
                            </div>
                            <h2 className="text-xl font-bold mb-2">Alert Sent!</h2>
                            <p className="text-sm text-muted-foreground mb-4">
                                Emergency services have been notified. Help is on the way.
                            </p>
                            <div className="w-full bg-muted/30 rounded-full h-1 overflow-hidden">
                                <div className="h-full bg-success rounded-full animate-pulse" style={{ width: '100%' }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
