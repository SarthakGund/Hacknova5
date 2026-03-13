"use client"

import { Radio, MessageSquare, Wifi, AlertCircle, CheckCircle2 } from "lucide-react"

export default function SystemStatusPanel() {
  // Mock system status data
  const systemStatus = {
    voiceCall: { online: true, devices: 3 },
    sms: { online: true, devices: 5 },
    bluetoothMesh: { online: true, devices: 12 },
  }

  const getStatusColor = (isOnline: boolean) => {
    return isOnline ? "text-green-400" : "text-red-500"
  }

  const getStatusBg = (isOnline: boolean) => {
    return isOnline ? "bg-green-500/10" : "bg-red-500/10"
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">System Status</h3>

      {/* Voice Call */}
      <div className={`rounded-lg p-3 border border-border/50 ${getStatusBg(systemStatus.voiceCall.online)}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Radio className={`w-4 h-4 flex-shrink-0 ${getStatusColor(systemStatus.voiceCall.online)}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">Voice Call</p>
              <p className="text-xs text-muted-foreground">{systemStatus.voiceCall.devices} channels</p>
            </div>
          </div>
          {systemStatus.voiceCall.online ? (
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* SMS */}
      <div className={`rounded-lg p-3 border border-border/50 ${getStatusBg(systemStatus.sms.online)}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MessageSquare className={`w-4 h-4 flex-shrink-0 ${getStatusColor(systemStatus.sms.online)}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">SMS Gateway</p>
              <p className="text-xs text-muted-foreground">{systemStatus.sms.devices} gateways</p>
            </div>
          </div>
          {systemStatus.sms.online ? (
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Bluetooth Mesh */}
      <div className={`rounded-lg p-3 border border-border/50 ${getStatusBg(systemStatus.bluetoothMesh.online)}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Wifi className={`w-4 h-4 flex-shrink-0 ${getStatusColor(systemStatus.bluetoothMesh.online)}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">Bluetooth Mesh</p>
              <p className="text-xs text-muted-foreground">{systemStatus.bluetoothMesh.devices} devices</p>
            </div>
          </div>
          {systemStatus.bluetoothMesh.online ? (
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Overall System Health */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Overall Health</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <span className="font-semibold text-green-400">Operational</span>
          </div>
        </div>
      </div>
    </div>
  )
}
