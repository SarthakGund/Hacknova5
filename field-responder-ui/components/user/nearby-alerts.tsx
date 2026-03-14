"use client"

import { useState, useEffect, useCallback } from "react"
import { Filter, MapPin, Clock, AlertCircle, Loader2, Navigation, X, ChevronRight, ShieldAlert } from "lucide-react"
import UserMap from "./user-map"
import { resourcesAPI, alertsAPI, incidentsAPI } from "@/lib/api"
import { useWebSocket } from "@/hooks/use-websocket"
import { buildAvoidAreas, fetchTomTomRoute, type LatLng } from "@/lib/tomtom"

// Active statuses — resolved/closed are excluded
const ACTIVE_STATUSES = ["active", "new", "responding", "on-scene", "contained", "monitoring"]

interface AlertItem {
    id: number
    lat: number
    lng: number
    type: string
    title: string
    message: string
    severity: string
    status: string
    created_at: string
    distanceKm: number | null
    distance: string
}

interface RouteInfo {
    travelTimeInSeconds: number
    lengthInMeters: number
}

export default function NearbyAlerts() {
    const [selectedFilter, setSelectedFilter] = useState<string>("all")
    const [alerts, setAlerts] = useState<AlertItem[]>([])
    const [resources, setResources] = useState<any[]>([])
    const [zones, setZones] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null)
    const [routeLoading, setRouteLoading] = useState(false)
    const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)

    const { on, isConnected } = useWebSocket({
        autoConnect: true,
        onConnect: () => console.log("NearbyAlerts connected to WebSocket"),
    })

    const typeFilters = [
        { id: "all", label: "All" },
        { id: "fire", label: "🔥 Fire" },
        { id: "medical", label: "🏥 Medical" },
        { id: "police", label: "🚔 Police" },
        { id: "accident", label: "🚗 Accident" },
        { id: "flood", label: "🌊 Flood" },
    ]

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371
        const dLat = (lat2 - lat1) * Math.PI / 180
        const dLon = (lon2 - lon1) * Math.PI / 180
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    const formatDistance = (km: number) => {
        if (km < 1) return `${Math.round(km * 1000)}m`
        if (km < 10) return `${km.toFixed(1)} km`
        return `${Math.round(km)} km`
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000)
        if (diffMinutes < 1) return "Just now"
        if (diffMinutes < 60) return `${diffMinutes} min ago`
        return `${Math.floor(diffMinutes / 60)}h ago`
    }

    const formatTravelTime = (seconds: number) => {
        const mins = Math.round(seconds / 60)
        if (mins < 60) return `${mins} min`
        return `${Math.floor(mins / 60)}h ${mins % 60}min`
    }

    // Pull directly from incidents table — filter non-resolved ones
    const fetchData = useCallback(async () => {
        try {
            setLoading(true)

            const [incidentsRes, resourcesRes, zonesRes] = await Promise.all([
                incidentsAPI.getAll(),
                resourcesAPI.getPublic(),
                alertsAPI.getZones(true),
            ])

            if (incidentsRes.success) {
                const formatted: AlertItem[] = incidentsRes.incidents
                    // Only show active/in-progress incidents, skip resolved/closed
                    .filter((inc: any) =>
                        ACTIVE_STATUSES.includes(inc.status?.toLowerCase?.() ?? "")
                    )
                    .map((inc: any) => {
                        const distanceKm = userLocation
                            ? calculateDistance(userLocation.lat, userLocation.lng, inc.lat, inc.lng)
                            : null
                        return {
                            id: inc.id,
                            lat: inc.lat,
                            lng: inc.lng,
                            type: inc.type,
                            title: inc.title,
                            message: inc.description || inc.title,
                            severity: inc.severity,
                            status: inc.status,
                            created_at: inc.created_at,
                            distanceKm,
                            distance: distanceKm !== null ? formatDistance(distanceKm) : "—",
                        }
                    })
                    .sort((a: AlertItem, b: AlertItem) => {
                        if (a.distanceKm === null) return 1
                        if (b.distanceKm === null) return -1
                        return a.distanceKm - b.distanceKm
                    })

                setAlerts(formatted)
            }

            if (resourcesRes.success) setResources(resourcesRes.resources)
            if (zonesRes.success) setZones(zonesRes.zones)
        } catch (err) {
            console.error("Error fetching alerts:", err)
        } finally {
            setLoading(false)
        }
    }, [userLocation])

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => setUserLocation({ lat: 28.6139, lng: 77.209 })
            )
        } else {
            setUserLocation({ lat: 28.6139, lng: 77.209 })
        }
    }, [])

    useEffect(() => {
        if (userLocation) fetchData()
    }, [userLocation, fetchData])

    useEffect(() => {
        if (!isConnected) return
        on("incident_updated", fetchData)
        on("incident_created", fetchData)
    }, [isConnected, on, fetchData])

    // Compute safe TomTom route when an alert is selected
    useEffect(() => {
        if (!selectedAlert || !userLocation) {
            setRouteInfo(null)
            return
        }
        let active = true
        setRouteLoading(true)
        setRouteInfo(null)

        const buildRoute = async () => {
            try {
                const start: LatLng = { lat: userLocation.lat, lng: userLocation.lng }
                const end: LatLng = { lat: selectedAlert.lat, lng: selectedAlert.lng }

                // Fetch nearby alert zones from DB to avoid
                const mid = { lat: (start.lat + end.lat) / 2, lng: (start.lng + end.lng) / 2 }
                const distanceKm = calculateDistance(start.lat, start.lng, end.lat, end.lng)
                const radius = Math.min(20000, Math.max(5000, distanceKm * 500 + 3000))
                const nearby = await alertsAPI.getNearby(mid.lat, mid.lng, radius)
                const avoidAreas = buildAvoidAreas(nearby?.alerts || [])

                const route = await fetchTomTomRoute(start, end, { avoidAreas })
                if (active) setRouteInfo(route.summary as RouteInfo)
            } catch (err) {
                console.error("Safe route error:", err)
            } finally {
                if (active) setRouteLoading(false)
            }
        }
        buildRoute()
        return () => { active = false }
    }, [selectedAlert, userLocation])

    const getSeverityColor = (s: string) => {
        switch (s?.toLowerCase()) {
            case "critical": return "bg-red-600"
            case "high": return "bg-red-500"
            case "medium": return "bg-orange-500"
            case "low": return "bg-yellow-500"
            default: return "bg-gray-500"
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status?.toLowerCase()) {
            case "active":
            case "new": return "text-red-400 bg-red-500/10"
            case "responding": return "text-orange-400 bg-orange-500/10"
            case "on-scene": return "text-yellow-400 bg-yellow-500/10"
            default: return "text-muted-foreground bg-muted/50"
        }
    }

    const filteredAlerts = selectedFilter === "all"
        ? alerts
        : alerts.filter((a) => a.type?.toLowerCase() === selectedFilter.toLowerCase())

    const mapTarget = selectedAlert
        ? { lat: selectedAlert.lat, lng: selectedAlert.lng, type: selectedAlert.type, location: selectedAlert.title }
        : null

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden pb-16">
            {/* Header */}
            <div className="gradient-header border-b border-border px-4 py-5">
                <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className="w-5 h-5 text-red-400" />
                    <h1 className="text-2xl font-bold">Active Alerts</h1>
                </div>
                <p className="text-sm text-muted-foreground">
                    {loading ? "Loading…" : `${alerts.length} active incident${alerts.length !== 1 ? "s" : ""} near you`}
                </p>
            </div>

            {/* Map */}
            <div className="relative h-[230px] bg-muted/30 border-b border-border flex-shrink-0">
                {loading || !userLocation ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <UserMap
                        incidents={filteredAlerts.map(a => ({
                            id: a.id,
                            type: a.type,
                            location: a.title,
                            lat: a.lat,
                            lng: a.lng,
                            severity: a.severity as any,
                        }))}
                        resources={resources}
                        zones={zones}
                        selectedTarget={mapTarget}
                    />
                )}

                {/* Route overlay */}
                {selectedAlert && (
                    <div className="absolute bottom-2 left-2 right-2 z-[400]">
                        <div className="bg-card/95 backdrop-blur border border-border rounded-xl px-3 py-2 flex items-center justify-between shadow-lg">
                            {routeLoading ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Calculating safest route…</span>
                                </div>
                            ) : routeInfo ? (
                                <div className="flex items-center gap-2 text-xs flex-1">
                                    <Navigation className="w-4 h-4 text-primary flex-shrink-0" />
                                    <span className="font-bold text-foreground">{formatTravelTime(routeInfo.travelTimeInSeconds)}</span>
                                    <span className="text-muted-foreground">· {(routeInfo.lengthInMeters / 1000).toFixed(1)} km</span>
                                    {/* <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold">SAFE ROUTE</span> */}
                                </div>
                            ) : (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Navigation className="w-3 h-3" /> Route unavailable
                                </span>
                            )}
                            <button
                                onClick={() => { setSelectedAlert(null); setRouteInfo(null) }}
                                className="ml-3 text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Type Filters */}
            <div className="px-4 py-2.5 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    {typeFilters.map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setSelectedFilter(f.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                                selectedFilter === f.id
                                    ? "bg-primary text-primary-foreground shadow-apple"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Alert cards */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 opacity-50">
                        <Loader2 className="w-10 h-10 animate-spin mb-3" />
                        <p className="text-sm">Fetching active alerts…</p>
                    </div>
                ) : filteredAlerts.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                            <AlertCircle className="w-7 h-7 text-green-500" />
                        </div>
                        <p className="font-semibold text-foreground mb-1">All Clear</p>
                        <p className="text-xs text-muted-foreground">No active incidents in your area</p>
                    </div>
                ) : (
                    filteredAlerts.map((alert) => {
                        const isSelected = selectedAlert?.id === alert.id
                        return (
                            <div
                                key={alert.id}
                                className={`rounded-2xl p-4 border transition-all ${
                                    isSelected
                                        ? "bg-primary/10 border-primary/50 shadow-apple"
                                        : "card-elevated border-border/50 hover:border-primary/30"
                                }`}
                            >
                                {/* Top row */}
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getSeverityColor(alert.severity)} animate-pulse`} />
                                        <h3 className="font-bold text-sm truncate">{alert.title}</h3>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${getSeverityColor(alert.severity)} text-white`}>
                                            {alert.severity}
                                        </span>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${getStatusBadge(alert.status)}`}>
                                            {alert.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Message */}
                                <p className="text-xs text-muted-foreground mb-3 leading-relaxed line-clamp-2">
                                    {alert.message}
                                </p>

                                {/* Footer row */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        {alert.distanceKm !== null && (
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />
                                                {alert.distance}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatTime(alert.created_at)}
                                        </span>
                                        <span className="capitalize text-[10px] bg-muted px-1.5 py-0.5 rounded">
                                            {alert.type}
                                        </span>
                                    </div>

                                    {/* Safe Route button */}
                                    <button
                                        onClick={() => {
                                            setSelectedAlert(isSelected ? null : alert)
                                            if (isSelected) setRouteInfo(null)
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0 ml-2 ${
                                            isSelected
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-primary/10 text-primary hover:bg-primary/20"
                                        }`}
                                    >
                                        <Navigation className="w-3 h-3" />
                                        {/* {isSelected ? "Routing…" : "Safe Route"} */}
                                        {!isSelected && <ChevronRight className="w-3 h-3" />}
                                    </button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
