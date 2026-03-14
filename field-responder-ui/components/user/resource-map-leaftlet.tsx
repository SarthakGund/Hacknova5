"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Home, Heart, Droplet, User } from "lucide-react"
import { renderToStaticMarkup } from "react-dom/server"
import { alertsAPI, incidentsAPI } from "@/lib/api"
import { calculateDistance } from "@/lib/utils"
import { buildAvoidAreas, fetchTomTomRoute, type LatLng } from "@/lib/tomtom"

export interface RouteInfo {
    travelTimeInSeconds: number
    lengthInMeters: number
}

interface ResourceMapProps {
    resources: any[]
    userLocation?: { lat: number; lng: number } | null
    selectedResource?: any | null
    onSelectResource?: (resource: any) => void
    onRouteReady?: (info: RouteInfo | null) => void
    onRouteLoading?: (loading: boolean) => void
}

// Custom icons
const createIcon = (icon: any, color: string) =>
    L.divIcon({
        className: "custom-icon",
        html: `<div class="w-8 h-8 rounded-full ${color} border-2 border-white shadow-lg flex items-center justify-center text-white">
            ${renderToStaticMarkup(icon)}
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
    })

const icons = {
    shelter: createIcon(<Home size={16} />, "bg-orange-500"),
    medical: createIcon(<Heart size={16} />, "bg-red-500"),
    food_water: createIcon(<Droplet size={16} />, "bg-blue-500"),
    default: createIcon(<User size={16} />, "bg-gray-500"),
    user: L.divIcon({
        className: "user-location-pulse",
        html: `<div class="relative">
            <div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg z-10 relative"></div>
            <div class="absolute top-0 left-0 w-4 h-4 bg-blue-500 rounded-full animate-ping opacity-75"></div>
        </div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
    }),
    selected: L.divIcon({
        className: "selected-resource-icon",
        html: `<div class="relative">
            <div class="w-10 h-10 bg-green-500 rounded-full border-3 border-white shadow-xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-green-500 rotate-45"></div>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40],
    }),
}

function UserLocationMarker({ position }: { position?: { lat: number; lng: number } | null }) {
    const map = useMap()
    useEffect(() => {
        if (!position) return
        map.flyTo([position.lat, position.lng], map.getZoom())
    }, [map, position])
    if (!position) return null
    return (
        <Marker position={[position.lat, position.lng]} icon={icons.user}>
            <Popup>You are here</Popup>
        </Marker>
    )
}

function RouteOverlay({ points }: { points: LatLng[] }) {
    const map = useMap()
    useEffect(() => {
        if (!points.length) return
        const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
        map.fitBounds(bounds, { padding: [50, 50] })
    }, [map, points])
    if (!points.length) return null
    return (
        <Polyline
            positions={points.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: "#007aff", weight: 5, opacity: 0.9, dashArray: undefined }}
        />
    )
}

export default function ResourceMap({
    resources,
    userLocation,
    selectedResource,
    onSelectResource,
    onRouteReady,
    onRouteLoading,
}: ResourceMapProps) {
    const [center] = useState<[number, number]>([19.076, 72.8777])
    const [routePoints, setRoutePoints] = useState<LatLng[]>([])
    const [alertZones, setAlertZones] = useState<any[]>([])

    // Fetch alert zones to show on map
    useEffect(() => {
        alertsAPI.getAll()
            .then((res) => { if (res.success) setAlertZones(res.alerts) })
            .catch(() => {})
    }, [])

    useEffect(() => {
        let active = true

        const buildRoute = async () => {
            if (!userLocation || !selectedResource) {
                setRoutePoints([])
                onRouteReady?.(null)
                return
            }

            onRouteLoading?.(true)

            try {
                const start: LatLng = { lat: userLocation.lat, lng: userLocation.lng }
                const end: LatLng = { lat: selectedResource.lat, lng: selectedResource.lng }

                // Fetch active incidents — treat each as a danger zone to avoid
                const incidentsRes = await incidentsAPI.getAll()
                const activeIncidents = (incidentsRes.success ? incidentsRes.incidents : [])
                    .filter((inc: any) =>
                        !["resolved", "closed"].includes(inc.status?.toLowerCase?.() ?? "")
                        && inc.lat && inc.lng
                    )
                    .map((inc: any) => ({
                        lat: inc.lat,
                        lng: inc.lng,
                        // Use severity to scale the danger radius
                        radius:
                            inc.severity === "critical" ? 700 :
                            inc.severity === "high"     ? 500 :
                            inc.severity === "medium"   ? 350 : 250,
                    }))

                const avoidAreas = buildAvoidAreas(activeIncidents)

                const route = await fetchTomTomRoute(start, end, { avoidAreas })

                if (active) {
                    setRoutePoints(route.points)
                    onRouteReady?.(route.summary as RouteInfo)
                }
            } catch (error) {
                console.error("Failed to build safe route:", error)
                if (active) {
                    setRoutePoints([])
                    onRouteReady?.(null)
                }
            } finally {
                if (active) onRouteLoading?.(false)
            }
        }

        buildRoute()
        return () => { active = false }
    }, [userLocation, selectedResource])

    return (
        <MapContainer
            center={center}
            zoom={13}
            style={{ height: "100%", width: "100%", zIndex: 0 }}
            zoomControl={false}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />

            <UserLocationMarker position={userLocation} />
            <RouteOverlay points={routePoints} />

            {/* Alert danger zones shown as red circles */}
            {alertZones.map((a) => (
                <Circle
                    key={a.id}
                    center={[a.lat, a.lng]}
                    radius={a.radius}
                    pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.15, weight: 1.5, dashArray: "5,5" }}
                >
                    <Popup>
                        <div className="p-1 text-xs">
                            <div className="font-bold text-red-600 mb-0.5">⚠️ Alert Zone</div>
                            <div>{a.message}</div>
                        </div>
                    </Popup>
                </Circle>
            ))}

            {/* Resource markers */}
            {resources.map((res) => {
                const isSelected = selectedResource?.id === res.id
                return (
                    <Marker
                        key={res.id}
                        position={[res.lat, res.lng]}
                        icon={isSelected ? icons.selected : (icons[res.type as keyof typeof icons] || icons.default)}
                        eventHandlers={{ click: () => onSelectResource?.(res) }}
                    >
                        <Popup>
                            <div className="p-1">
                                <div className="font-bold text-sm mb-1">{res.name}</div>
                                <div className="text-xs capitalize mb-1">{res.type.replace("_", " ")}</div>
                                {res.distance != null && (
                                    <div className="text-[10px] font-bold text-blue-600 mb-1">
                                        {res.distance.toFixed(1)} km away
                                    </div>
                                )}
                                <div className="text-xs">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                                        res.status === "deployed" || res.status === "active"
                                            ? "bg-green-100 text-green-700"
                                            : "bg-gray-100 text-gray-700"
                                    }`}>
                                        {res.status}
                                    </span>
                                </div>
                                
                            </div>
                        </Popup>
                    </Marker>
                )
            })}
        </MapContainer>
    )
}
