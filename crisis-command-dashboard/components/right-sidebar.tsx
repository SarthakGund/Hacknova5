"use client"

import { Radio, MessageSquare, Wifi, AlertCircle, CheckCircle2, TrendingUp, PieChart } from "lucide-react"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface RightSidebarProps {
  incidents: Array<{
    id: number
    title: string
    severity: "critical" | "high" | "medium" | "low"
    responders: string[]
    resources: string[]
  }>
}

export default function RightSidebar({ incidents }: RightSidebarProps) {
  const systemStatus = {
    voiceCall: { online: true, devices: 3 },
    sms: { online: true, devices: 5 },
    bluetoothMesh: { online: true, devices: 12 },
  }

  // Mock data for incidents over time (last 8 hours)
  const incidentsOverTime = [
    { time: "08:00", incidents: 0 },
    { time: "09:00", incidents: 1 },
    { time: "10:00", incidents: 2 },
    { time: "11:00", incidents: 2 },
    { time: "12:00", incidents: 3 },
    { time: "13:00", incidents: 3 },
    { time: "14:00", incidents: 4 },
    { time: "15:00", incidents: 4 },
  ]

  const resourceAllocation = [
    { name: "Fire Units", value: 8 },
    { name: "Medical", value: 6 },
    { name: "Hazmat", value: 5 },
    { name: "Police", value: 4 },
  ]

  const getStatusColor = (isOnline: boolean) => {
    return isOnline ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-500"
  }

  const getStatusBg = (isOnline: boolean) => {
    return isOnline ? "bg-green-500/10" : "bg-red-500/10"
  }

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-bold text-foreground mb-4">System Dashboard</h2>

        {/* System Status */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">System Status</h3>

          {/* Voice Call */}
          <div className={`rounded p-2 border border-border/50 ${getStatusBg(systemStatus.voiceCall.online)}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Radio className={`w-3 h-3 flex-shrink-0 ${getStatusColor(systemStatus.voiceCall.online)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">Voice Call</p>
                  <p className="text-xs text-muted-foreground">{systemStatus.voiceCall.devices} channels</p>
                </div>
              </div>
              {systemStatus.voiceCall.online ? (
                <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-500 flex-shrink-0" />
              )}
            </div>
          </div>

          {/* SMS */}
          <div className={`rounded p-2 border border-border/50 ${getStatusBg(systemStatus.sms.online)}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <MessageSquare className={`w-3 h-3 flex-shrink-0 ${getStatusColor(systemStatus.sms.online)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">SMS Gateway</p>
                  <p className="text-xs text-muted-foreground">{systemStatus.sms.devices} gateways</p>
                </div>
              </div>
              {systemStatus.sms.online ? (
                <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-500 flex-shrink-0" />
              )}
            </div>
          </div>

          {/* Bluetooth Mesh */}
          <div className={`rounded p-2 border border-border/50 ${getStatusBg(systemStatus.bluetoothMesh.online)}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Wifi className={`w-3 h-3 flex-shrink-0 ${getStatusColor(systemStatus.bluetoothMesh.online)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">Bluetooth Mesh</p>
                  <p className="text-xs text-muted-foreground">{systemStatus.bluetoothMesh.devices} devices</p>
                </div>
              </div>
              {systemStatus.bluetoothMesh.online ? (
                <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-500 flex-shrink-0" />
              )}
            </div>
          </div>

          {/* Overall Health */}
          <div className="mt-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Overall Health</span>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full" />
                <span className="font-semibold text-green-600 dark:text-green-400">Operational</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content with graphs */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Incidents Over Time Graph */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Incidents Over Time
          </h3>
          <div className="bg-muted/30 rounded-lg p-2 border border-border">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={incidentsOverTime} margin={{ top: 5, right: 5, left: -30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 0, 255, 0.15)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--color-muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--color-muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--color-card))",
                    border: "1px solid hsl(var(--color-border))",
                  }}
                />
                <Line type="monotone" dataKey="incidents" stroke="#a855f7" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resource Allocation Graph */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
            <PieChart className="w-3 h-3" />
            Equipment Allocation
          </h3>
          <div className="bg-muted/30 rounded-lg p-2 border border-border">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={resourceAllocation} margin={{ top: 5, right: 5, left: -30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 0, 255, 0.15)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--color-muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--color-muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--color-card))",
                    border: "1px solid hsl(var(--color-border))",
                  }}
                />
                <Bar dataKey="value" fill="#a855f7" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity Distribution */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Severity Distribution
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full" />
                <span className="text-foreground">Critical</span>
              </div>
              <span className="font-semibold text-primary">
                {incidents.filter((i) => i.severity === "critical").length}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 dark:bg-orange-400 rounded-full" />
                <span className="text-foreground">High</span>
              </div>
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {incidents.filter((i) => i.severity === "high").length}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 dark:bg-yellow-400 rounded-full" />
                <span className="text-foreground">Medium</span>
              </div>
              <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                {incidents.filter((i) => i.severity === "medium").length}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full" />
                <span className="text-foreground">Low</span>
              </div>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {incidents.filter((i) => i.severity === "low").length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
