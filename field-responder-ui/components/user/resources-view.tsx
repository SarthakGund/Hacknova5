"use client"

import { useState, useEffect } from "react"
import { MapPin, Search, Filter, Home, Heart, Droplet, Info, Loader2, Navigation, X, Clock } from "lucide-react"
import dynamic from "next/dynamic"
import { resourcesAPI } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { RouteInfo } from "@/components/user/resource-map-leaftlet"

// Dynamic import for Leaflet map (SSR-safe)
const ResourceMap = dynamic(() => import("@/components/user/resource-map-leaftlet"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-muted flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
    ),
})

export default function ResourcesView() {
    const [resources, setResources] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [selectedResource, setSelectedResource] = useState<any | null>(null)
    const [routeLoading, setRouteLoading] = useState(false)
    const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.error("Location access denied", err)
            )
        }

        const fetchResources = async () => {
            try {
                setLoading(true)
                const response = await resourcesAPI.getPublic()
                if (response.success) setResources(response.resources)
            } catch (error) {
                console.error("Failed to fetch resources:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchResources()
    }, [])

    const { calculateDistance } = require("@/lib/utils")

    const processedResources = resources.map((res) => {
        let distance = null
        if (userLocation && res.lat && res.lng) {
            distance = calculateDistance(userLocation.lat, userLocation.lng, res.lat, res.lng)
        }
        return { ...res, distance }
    })

    const filteredResources = processedResources
        .filter((res) => {
            const matchesFilter = filter === "all" || res.type === filter
            const matchesSearch = res.name.toLowerCase().includes(searchQuery.toLowerCase())
            return matchesFilter && matchesSearch
        })
        .sort((a: any, b: any) => {
            if (a.distance && b.distance) return a.distance - b.distance
            return 0
        })

    const resourceTypes = [
        { id: "all", label: "All", icon: Filter },
        { id: "shelter", label: "Shelter", icon: Home },
        { id: "medical", label: "Medical", icon: Heart },
        { id: "food_water", label: "Food/Water", icon: Droplet },
    ]

    const formatTravelTime = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`
        const mins = Math.round(seconds / 60)
        if (mins < 60) return `${mins} min`
        return `${Math.floor(mins / 60)}h ${mins % 60}min`
    }

    const handleSelectResource = (resource: any) => {
        setSelectedResource(resource)
        setRouteInfo(null)
        setRouteLoading(false)
    }

    const nearestResource = filteredResources[0]

    return (
        <div className="flex flex-col h-full bg-background relative pb-20">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-background/80 backdrop-blur-md z-10">
                <h1 className="text-xl font-bold mb-3">Community Resources</h1>

                {/* Search */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search shelters, medical..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>

                {/* Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {resourceTypes.map((type) => {
                        const Icon = type.icon
                        return (
                            <button
                                key={type.id}
                                onClick={() => setFilter(type.id)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border",
                                    filter === type.id
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-card text-muted-foreground border-border hover:border-primary/50"
                                )}
                            >
                                <Icon className="w-3 h-3" />
                                {type.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Map */}
            <div className="flex-1 overflow-hidden relative m-1">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <p className="text-sm">Finding help nearby…</p>
                    </div>
                ) : (
                    <div className="h-full w-full">
                        <ResourceMap
                            resources={filteredResources}
                            userLocation={userLocation}
                            selectedResource={selectedResource}
                            onSelectResource={handleSelectResource}
                            onRouteReady={(info) => setRouteInfo(info)}
                            onRouteLoading={(isLoading) => setRouteLoading(isLoading)}
                        />
                    </div>
                )}
            </div>

            {/* Bottom info card */}
            <div className="relative z-[50] mb-5 px-1">
                {selectedResource ? (
                    /* Selected resource: route status card */
                    <div className="bg-card border border-primary/30 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom duration-400">
                        <div className="flex items-start justify-between mb-2">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary opacity-80 mb-0.5">Selected Resource</p>
                                <h3 className="text-base font-black leading-tight">{selectedResource.name}</h3>
                                <p className="text-xs text-muted-foreground capitalize">{selectedResource.type?.replace("_", " ")}</p>
                            </div>
                            <button
                                onClick={() => { setSelectedResource(null); setRouteInfo(null) }}
                                className="text-muted-foreground hover:text-foreground mt-0.5"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Route status */}
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
                            {routeLoading ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                    <span>Calculating safest route…</span>
                                </div>
                            ) : routeInfo ? (
                                <div className="flex items-center gap-3 text-xs flex-1">
                                    <Navigation className="w-4 h-4 text-primary flex-shrink-0" />
                                    <div className="flex-1">
                                        <span className="font-black text-base text-foreground">{formatTravelTime(routeInfo.travelTimeInSeconds)}</span>
                                        <span className="text-muted-foreground ml-1">· {(routeInfo.lengthInMeters / 1000).toFixed(1)} km</span>
                                    </div>
                                    <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Safe Route</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Navigation className="w-4 h-4" />
                                    <span>Tap a resource marker to get a safe route</span>
                                </div>
                            )}
                        </div>

                        {selectedResource.distance != null && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <MapPin className="w-3 h-3" />
                                <span>{selectedResource.distance.toFixed(1)} km away (straight line)</span>
                            </div>
                        )}
                    </div>
                ) : nearestResource && nearestResource.distance !== null ? (
                    /* Default: nearest resource card */
                    <div
                        className="bg-primary text-primary-foreground border border-primary/20 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom duration-500 cursor-pointer active:scale-[0.98] transition-transform"
                        onClick={() => handleSelectResource(nearestResource)}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 fill-primary-foreground/20" />
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-90">Nearest Assistance</span>
                            </div>
                            <span className="text-xs font-black bg-white/20 px-2 py-0.5 rounded-full">
                                {nearestResource.distance.toFixed(1)} KM
                            </span>
                        </div>
                        <h3 className="text-lg font-black leading-tight mb-1">{nearestResource.name}</h3>
                        <p className="text-xs font-medium opacity-70">Tap to get a safe route →</p>
                    </div>
                ) : (
                    /* No resources or no location */
                    <div className="bg-card/90 backdrop-blur border border-border rounded-xl p-3 shadow-lg">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-medium">Public Assistance</p>
                                <p className="text-[10px] text-muted-foreground">
                                    Verified resources from Crisis Command. Tap a marker for a safe route.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
