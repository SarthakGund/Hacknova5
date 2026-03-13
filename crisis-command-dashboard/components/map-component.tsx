"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface MapComponentProps {
  incidents: Array<{
    id: number
    title: string
    location: { lat: number; lng: number }
    severity: "critical" | "high" | "medium" | "low"
    status: string
    responders: string[]
  }>
  selectedIncident: any | null
  personnel: Array<{
    id: number
    name: string
    location: { lat: number; lng: number } | null
    status: "on-scene" | "en-route" | "available"
    assignedIncident: number | null
    role: string
  }>
}

export default function MapComponent({ incidents, selectedIncident, personnel }: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<number, L.Marker>>({})
  const personnelMarkersRef = useRef<Record<number, L.Marker>>({})

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map("map", {
        center: [incidents[0]?.location.lat || 28.7041, incidents[0]?.location.lng || 77.1025],
        zoom: 5,
        zoomControl: true,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(mapRef.current)
    }

    // Update incident markers
    Object.values(markersRef.current).forEach((marker) => marker.remove())
    markersRef.current = {}

    incidents.forEach((incident) => {
      const isSelected = selectedIncident?.id === incident.id
      const iconSize = isSelected ? [48, 48] : [40, 40]

      // Color based on severity
      let color = "#dc2626" // critical
      if (incident.severity === "high") color = "#ea580c"
      if (incident.severity === "medium") color = "#eab308"
      if (incident.severity === "low") color = "#22c55e"

      const svgIcon = `
        <svg width="${iconSize[0]}" height="${iconSize[1]}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="18" fill="${color}" opacity="0.3"/>
          <circle cx="20" cy="20" r="12" fill="${color}"/>
          <circle cx="20" cy="20" r="6" fill="white"/>
        </svg>
      `

      const icon = L.divIcon({
        html: svgIcon,
        className: isSelected ? "selected-marker" : "",
        iconSize: iconSize as [number, number],
        iconAnchor: [iconSize[0] / 2, iconSize[1] / 2],
      })

      const marker = L.marker([incident.location.lat, incident.location.lng], {
        icon,
      })
        .bindPopup(`
          <div class="font-semibold">${incident.title}</div>
          <div class="text-sm">Status: ${incident.status}</div>
          <div class="text-sm">Personnel: ${incident.responders.length}</div>
        `)
        .addTo(mapRef.current!)

      markersRef.current[incident.id] = marker

      if (isSelected) {
        mapRef.current?.setView([incident.location.lat, incident.location.lng], 16)
      }
    })

    // Update personnel markers
    Object.values(personnelMarkersRef.current).forEach((marker) => marker.remove())
    personnelMarkersRef.current = {}

    personnel.forEach((person) => {
      // Skip personnel without location
      if (!person.location) return;

      // Color based on status
      let color = "#3b82f6" // available (blue)
      let statusText = "Available"
      if (person.status === "on-scene") {
        color = "#22c55e" // green
        statusText = "On Scene"
      } else if (person.status === "en-route") {
        color = "#f59e0b" // amber
        statusText = "En Route"
      }

      // Create person icon SVG
      const personIcon = `
        <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="15" fill="${color}" opacity="0.2"/>
          <circle cx="16" cy="16" r="12" fill="${color}" opacity="0.4"/>
          <g transform="translate(16, 16)">
            <circle cx="0" cy="-3" r="3" fill="white"/>
            <path d="M -4 8 Q -4 2 0 2 Q 4 2 4 8 Z" fill="white"/>
          </g>
        </svg>
      `

      const icon = L.divIcon({
        html: personIcon,
        className: "personnel-marker",
        iconSize: [32, 32] as [number, number],
        iconAnchor: [16, 16],
      })

      const marker = L.marker([person.location.lat, person.location.lng], {
        icon,
      })
        .bindPopup(`
          <div class="font-semibold">${person.name}</div>
          <div class="text-sm">Role: ${person.role}</div>
          <div class="text-sm">Status: <span style="color: ${color}; font-weight: bold;">${statusText}</span></div>
          ${person.assignedIncident ? `<div class="text-sm">Incident: #${person.assignedIncident}</div>` : ""}
        `)
        .addTo(mapRef.current!)

      personnelMarkersRef.current[person.id] = marker
    })

    return () => {
      // Cleanup
    }
  }, [incidents, selectedIncident, personnel])

  return <div id="map" className="w-full h-full" />
}
