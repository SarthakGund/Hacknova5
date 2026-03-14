export type LatLng = { lat: number; lng: number }

export type AlertZone = {
  lat: number
  lng: number
  radius: number
}

const TOMTOM_BASE_URL = "https://api.tomtom.com/routing/1/calculateRoute"

function metersToLatLngDelta(lat: number, meters: number) {
  const dLat = meters / 111000
  const dLng = meters / (111000 * Math.cos((lat * Math.PI) / 180) || 1)
  return { dLat, dLng }
}

/**
 * Builds the avoidAreas payload object (NOT stringified) for POST body.
 * Returns null if no valid zones are given.
 */
export function buildAvoidAreas(
  alerts: AlertZone[],
  bufferMeters = 60,
  maxRects = 8
): { rectangles: object[] } | null {
  const rectangles = alerts
    .filter((a) => a.lat != null && a.lng != null && a.radius != null)
    .slice(0, maxRects)
    .flatMap((a) => {
      const lat = Number(a.lat)
      const lng = Number(a.lng)
      const radius = Number(a.radius)

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius)) return []

      const { dLat, dLng } = metersToLatLngDelta(lat, radius + bufferMeters)
      
      const lat1 = lat - dLat
      const lat2 = lat + dLat
      const lng1 = lng - dLng
      const lng2 = lng + dLng

      return [{
        southWestCorner: {
          latitude: Math.min(lat1, lat2),
          longitude: Math.min(lng1, lng2),
        },
        northEastCorner: {
          latitude: Math.max(lat1, lat2),
          longitude: Math.max(lng1, lng2),
        },
      }]
    })

  if (!rectangles.length) return null
  return { rectangles: rectangles as object[] }
}

export async function fetchTomTomRoute(
  start: LatLng,
  end: LatLng,
  options?: { avoidAreas?: { rectangles: object[] } | null }
) {
  const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY
  if (!apiKey) throw new Error("Missing NEXT_PUBLIC_TOMTOM_API_KEY")

  const path = `${start.lat},${start.lng}:${end.lat},${end.lng}`
  
  const searchParamsObj: Record<string, string> = {
    key: apiKey,
    traffic: "true",
    routeType: "fastest",
    travelMode: "car",
  }
  const params = new URLSearchParams(searchParamsObj)

  const url = `${TOMTOM_BASE_URL}/${path}/json?${params.toString()}`

  let response: Response

  if (options?.avoidAreas) {
    // POST request with avoidAreas in the body — required by TomTom API
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avoidAreas: options.avoidAreas }),
    })
  } else {
    // Simple GET for no avoid areas
    response = await fetch(url)
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "")
    throw new Error(`TomTom routing error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  const route = data?.routes?.[0]

  if (!route) throw new Error("TomTom returned no route")

  const points = route?.legs?.[0]?.points || []
  const summary = route?.summary || {}

  return {
    points: points.map((p: any) => ({ lat: p.latitude, lng: p.longitude })),
    summary,
  }
}
