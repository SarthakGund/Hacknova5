"use client"

import { useEffect, useRef, useState } from "react"
import { alertsAPI, incidentsAPI } from "@/lib/api"
import { calculateDistance } from "@/lib/utils"
import { buildAvoidAreas, fetchTomTomRoute, type LatLng } from "@/lib/tomtom"

interface UserMapProps {
    incidents?: Array<{
        id: number
        type: string
        location: string
        lat: number
        lng: number
        severity: "high" | "medium" | "low"
    }>
    selectedTarget?: { lat: number; lng: number; type?: string; location?: string } | null
}

export default function UserMap({ incidents = [], resources = [], zones = [], selectedTarget = null }: UserMapProps & { resources?: any[]; zones?: any[] }) {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<any>(null)
    const markersLayer = useRef<any>(null)
    const routeLayer = useRef<any>(null)
    const [isClient, setIsClient] = useState(false)
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

    useEffect(() => {
        setIsClient(true)

        // Get user's actual location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    })
                },
                (error) => {
                    console.error("Error getting location:", error)
                    // Fallback to Delhi if geolocation fails
                    setUserLocation({ lat: 28.6139, lng: 77.2090 })
                }
            )
        } else {
            // Fallback to Delhi if geolocation not supported
            setUserLocation({ lat: 28.6139, lng: 77.2090 })
        }
    }, [])

    // Initialize map only once
    useEffect(() => {
        if (!mapContainer.current || !isClient || !userLocation || map.current) return

        const initMap = async () => {
            const L = (await import("leaflet")).default
            await import("leaflet/dist/leaflet.css")

            // Initialize map centered on user's location
            map.current = L.map(mapContainer.current!).setView([userLocation.lat, userLocation.lng], 12)

            // Add tile layer
            L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
                attribution: "&copy; OpenStreetMap contributors &copy; CartoDB",
                maxZoom: 19,
            }).addTo(map.current)

            // Create a layer group for markers
            markersLayer.current = L.layerGroup().addTo(map.current)

            // Add user location marker
            const userIcon = L.divIcon({
                html: `
          <div class="flex items-center justify-center w-12 h-12 bg-blue-500 rounded-full shadow-lg border-4 border-white animate-pulse">
            <div class="w-3 h-3 bg-white rounded-full"></div>
          </div>
        `,
                className: "",
                iconSize: [48, 48],
                iconAnchor: [24, 24],
            })

            L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
                .addTo(markersLayer.current)
                .bindPopup("<strong>Your Location</strong>")
        }

        initMap()

        return () => {
            if (map.current) {
                map.current.remove()
                map.current = null
                markersLayer.current = null
            }
        }
    }, [isClient, userLocation])

    // Update markers when data changes
    useEffect(() => {
        if (!map.current || !markersLayer.current) return

        const updateMapItems = async () => {
            const L = (await import("leaflet")).default

            // Clear existing markers
            markersLayer.current.clearLayers()

            // Re-add user marker
            if (userLocation) {
                const userIcon = L.divIcon({
                    html: `
            <div class="flex items-center justify-center w-12 h-12 bg-blue-500 rounded-full shadow-lg border-4 border-white animate-pulse">
              <div class="w-3 h-3 bg-white rounded-full"></div>
            </div>
          `,
                    className: "",
                    iconSize: [48, 48],
                    iconAnchor: [24, 24],
                })

                L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
                    .addTo(markersLayer.current)
                    .bindPopup("<strong>Your Location</strong>")
            }

            // 1. Add Incident markers
            incidents.forEach((incident: any) => {
                const color =
                    incident.severity === "high" || incident.severity === "critical" ? "#ef4444" :
                        incident.severity === "medium" ? "#f97316" : "#eab308"

                const incidentIcon = L.divIcon({
                    html: `
            <div class="flex items-center justify-center w-10 h-10 rounded-full shadow-lg border-3 border-white" style="background-color: ${color}">
              <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            </div>
          `,
                    className: "",
                    iconSize: [40, 40],
                    iconAnchor: [20, 20],
                })

                L.marker([incident.lat, incident.lng], { icon: incidentIcon })
                    .addTo(markersLayer.current)
                    .bindPopup(`
            <div class="p-2 min-w-[150px]">
              <div class="flex items-center gap-2 mb-1">
                 <span class="w-2 h-2 rounded-full" style="background-color: ${color}"></span>
                 <strong class="text-sm">${incident.type}</strong>
              </div>
              <p class="text-xs text-gray-600 mb-1">${incident.location}</p>
              <div class="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 w-fit">
                ${(incident.status || 'Active').toUpperCase()}
              </div>
            </div>
          `)
            })

            // 2. Add Resource markers (Blue/Green)
            resources.forEach((resource: any) => {
                const color = "#3b82f6" // Blue for resources

                const resourceIcon = L.divIcon({
                    html: `
            <div class="flex items-center justify-center w-8 h-8 rounded-full shadow-md border-2 border-white bg-white">
              <div class="w-6 h-6 rounded-full flex items-center justify-center text-white" style="background-color: ${color}">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
          `,
                    className: "",
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                })

                L.marker([resource.lat || 0, resource.lng || 0], { icon: resourceIcon })
                    .addTo(markersLayer.current)
                    .bindPopup(`
            <div class="p-2">
              <strong class="text-sm text-blue-600">${resource.name}</strong><br/>
              <span class="text-xs text-gray-500">${resource.type}</span>
            </div>
          `)
            })

            // 3. Add Geofence Zones (Circles)
            zones.forEach((zone: any) => {
                const color = zone.zone_type === "danger" ? "#ef4444" : "#22c55e" // Red for danger, Green for safe
                
                L.circle([zone.lat, zone.lng], {
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.2,
                    radius: zone.radius || 500
                })
                .addTo(markersLayer.current)
                .bindPopup(`
                    <div class="p-2">
                        <strong class="text-sm" style="color: ${color}">${zone.name}</strong><br/>
                        <span class="text-xs text-gray-500">${zone.zone_type.toUpperCase()} ZONE</span>
                    </div>
                `)
            })
        }

        updateMapItems()
    }, [incidents, resources, zones, userLocation])

    useEffect(() => {
        if (!map.current || !userLocation) return

        let active = true

        const clearRoute = () => {
            if (routeLayer.current) {
                routeLayer.current.remove()
                routeLayer.current = null
            }
        }

        const buildRoute = async () => {
            if (!selectedTarget) {
                clearRoute()
                return
            }

            const start: LatLng = { lat: userLocation.lat, lng: userLocation.lng }
            const end: LatLng = { lat: selectedTarget.lat, lng: selectedTarget.lng }

            try {
                // Fetch all active incidents as danger zones to avoid
                const incidentsRes = await incidentsAPI.getAll()
                const dangerZones = (incidentsRes.success ? incidentsRes.incidents : [])
                    .filter((inc: any) =>
                        !["resolved", "closed"].includes(inc.status?.toLowerCase?.() ?? "")
                        && inc.lat && inc.lng
                        && !(inc.lat === selectedTarget.lat && inc.lng === selectedTarget.lng)
                    )
                    .map((inc: any) => ({
                        lat: inc.lat,
                        lng: inc.lng,
                        radius:
                            inc.severity === "critical" ? 700 :
                            inc.severity === "high"     ? 500 :
                            inc.severity === "medium"   ? 350 : 250,
                    }))

                const avoidAreas = buildAvoidAreas(dangerZones)

                const route = await fetchTomTomRoute(start, end, { avoidAreas })
                if (!active) return

                clearRoute()
                const L = (await import("leaflet")).default
                routeLayer.current = L.polyline(
                    route.points.map((p: LatLng) => [p.lat, p.lng]),
                    { color: "#0ea5e9", weight: 5, opacity: 0.9 }
                ).addTo(map.current)

                const bounds = L.latLngBounds(route.points.map((p: LatLng) => [p.lat, p.lng]))
                map.current.fitBounds(bounds, { padding: [40, 40] })
            } catch (error) {
                console.error("Failed to build safe route:", error)
            }
        }

        buildRoute()

        return () => {
            active = false
        }
    }, [selectedTarget, userLocation])

    return <div ref={mapContainer} className="w-full h-full" />
}
