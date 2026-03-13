"use client"

import { useEffect, useRef, useState } from "react"

interface UserMapProps {
    incidents?: Array<{
        id: number
        type: string
        location: string
        lat: number
        lng: number
        severity: "high" | "medium" | "low"
    }>
}

export default function UserMap({ incidents = [] }: UserMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<any>(null)
    const markersLayer = useRef<any>(null)
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

    // Update incident markers when incidents change
    useEffect(() => {
        if (!map.current || !markersLayer.current) return

        const updateIncidents = async () => {
            const L = (await import("leaflet")).default

            // Clear existing incident markers (keep user marker)
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

            // Add incident markers
            incidents.forEach((incident) => {
                const color =
                    incident.severity === "high" ? "#ef4444" :
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
            <div class="p-2">
              <strong class="text-sm">${incident.type}</strong><br/>
              <span class="text-xs text-gray-600">${incident.location}</span>
            </div>
          `)
            })
        }

        updateIncidents()
    }, [incidents, userLocation])

    return <div ref={mapContainer} className="w-full h-full" />
}
