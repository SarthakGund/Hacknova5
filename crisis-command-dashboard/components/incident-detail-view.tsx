"use client"

import { Users, Truck, Radio, MessageSquare, Wifi, Smartphone } from "lucide-react"

interface IncidentDetailViewProps {
  incident: {
    id: number
    title: string
    severity: "critical" | "high" | "medium" | "low"
    status: string
    time: string
    description: string
    responders: string[]
    resources: string[]
    arrivedUnits: number
    totalUnits: number
    reportSource: "voice-call" | "sms" | "bluetooth-mesh"
  }
}

export default function IncidentDetailView({ incident }: IncidentDetailViewProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-primary"
      case "high":
        return "text-orange-600 dark:text-orange-400"
      case "medium":
        return "text-yellow-600 dark:text-yellow-400"
      default:
        return "text-green-600 dark:text-green-400"
    }
  }

  const getReportSourceIcon = (source: string) => {
    switch (source) {
      case "voice-call":
        return <Radio className="w-3 h-3" />
      case "sms":
        return <MessageSquare className="w-3 h-3" />
      case "bluetooth-mesh":
        return <Wifi className="w-3 h-3" />
      default:
        return <Smartphone className="w-3 h-3" />
    }
  }

  const getReportSourceLabel = (source: string) => {
    switch (source) {
      case "voice-call":
        return "Voice Call"
      case "sms":
        return "SMS"
      case "bluetooth-mesh":
        return "Bluetooth Mesh"
      default:
        return "Unknown"
    }
  }

  return (
    <div className="bg-muted/40 rounded-lg border border-border overflow-hidden space-y-3 p-3">
      {/* Report Source */}
      <div className="bg-muted/30 rounded p-2 border border-border/50">
        <div className="flex items-center gap-2 text-xs">
          {getReportSourceIcon(incident.reportSource)}
          <span className="text-muted-foreground">Report Source:</span>
          <span className="font-semibold text-foreground">{getReportSourceLabel(incident.reportSource)}</span>
        </div>
      </div>

      {/* Description */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Description</h4>
        <p className="text-xs text-foreground leading-relaxed bg-muted/30 rounded p-2">{incident.description}</p>
      </div>

      {/* Personnel */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide flex items-center gap-1">
          <Users className="w-3 h-3" />
          Personnel ({incident.responders.length})
        </h4>
        <div className="space-y-1">
          {incident.responders.map((responder, idx) => (
            <div
              key={idx}
              className="bg-accent/10 border border-accent/30 rounded p-1.5 flex items-center justify-between text-xs"
            >
              <span className="font-semibold text-foreground">{responder}</span>
              <span className="text-accent bg-accent/20 px-1.5 py-0.5 rounded text-xs">
                {idx < incident.arrivedUnits ? "Arrived" : "En Route"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Equipment */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide flex items-center gap-1">
          <Truck className="w-3 h-3" />
          Equipment ({incident.resources.length})
        </h4>
        <div className="space-y-1">
          {incident.resources.map((resource, idx) => (
            <div
              key={idx}
              className="bg-primary/10 border border-primary/30 rounded p-1.5 flex items-center justify-between text-xs"
            >
              <span className="font-semibold text-foreground">{resource}</span>
              <span className="text-primary bg-primary/20 px-1.5 py-0.5 rounded text-xs">Active</span>
            </div>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div className="border-t border-border pt-2">
        <div className="text-xs text-muted-foreground mb-1.5">
          <span className="font-semibold text-accent">{incident.arrivedUnits}</span> of
          <span className="font-semibold text-accent ml-1">{incident.totalUnits}</span> units arrived
        </div>
        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-accent h-full transition-all"
            style={{
              width: `${(incident.arrivedUnits / incident.totalUnits) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  )
}
