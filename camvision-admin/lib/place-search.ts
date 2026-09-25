import { fetchApi } from "@/lib/api"
import { monumentTitle, type Monument } from "@/lib/types"

export type PlaceHit = {
  id: string
  title: string
  subtitle: string
  lat: number
  lng: number
  source: "catalogue" | "mapbox" | "osm"
}

const YDE = { lng: 11.5021, lat: 3.848 }
const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  ""

function mapboxUrl(query: string, extra = "") {
  return `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query
  )}.json?access_token=${TOKEN}&proximity=${YDE.lng},${YDE.lat}&language=fr&autocomplete=true&fuzzyMatch=true&limit=8${extra}`
}

async function searchMapbox(query: string): Promise<PlaceHit[]> {
  if (!TOKEN) return []
  const attempts = [
    mapboxUrl(`${query}, Yaoundé, Cameroun`, "&country=cm"),
    mapboxUrl(query, "&country=cm"),
    mapboxUrl(`${query} Cameroon`),
  ]
  for (const url of attempts) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const data = await res.json()
      const features = Array.isArray(data.features) ? data.features : []
      if (!features.length) continue
      return features
        .filter((f: { center?: number[] }) => Array.isArray(f.center) && f.center.length >= 2)
        .map((f: { id?: string; text?: string; place_name?: string; center: number[] }) => ({
          id: `mapbox-${f.id || `${f.center[0]},${f.center[1]}`}`,
          title: f.text || f.place_name || query,
          subtitle: f.place_name || "Mapbox",
          lng: f.center[0],
          lat: f.center[1],
          source: "mapbox" as const,
        }))
    } catch {
      /* try next */
    }
  }
  return []
}

async function searchCatalog(query: string): Promise<PlaceHit[]> {
  try {
    const rows = await fetchApi<Monument[]>(
      `/admin/monuments?q=${encodeURIComponent(query)}&limit=12`
    )
    return (rows || [])
      .filter((m) => m.latitude != null && m.longitude != null)
      .map((m) => ({
        id: `catalog-${m.id}`,
        title: monumentTitle(m),
        subtitle: [m.city_name, m.region, "Catalogue Camvision"]
          .filter(Boolean)
          .join(" · "),
        lat: Number(m.latitude),
        lng: Number(m.longitude),
        source: "catalogue" as const,
      }))
  } catch {
    return []
  }
}

async function searchNominatim(query: string): Promise<PlaceHit[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
      `${query}, Cameroun`
    )}&countrycodes=cm&limit=6&accept-language=fr`
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map((item: { place_id?: number; display_name?: string; lat: string; lon: string; name?: string }) => ({
      id: `osm-${item.place_id || `${item.lat},${item.lon}`}`,
      title: item.name || item.display_name?.split(",")[0] || query,
      subtitle: item.display_name || "OpenStreetMap",
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      source: "osm" as const,
    }))
  } catch {
    return []
  }
}

export async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const [catalog, mapbox] = await Promise.all([searchCatalog(q), searchMapbox(q)])
  let hits = [...catalog, ...mapbox]
  if (hits.length === 0) {
    hits = await searchNominatim(q)
  }
  const seen = new Set<string>()
  return hits.filter((h) => {
    const key = `${h.title.toLowerCase()}|${h.lat.toFixed(4)}|${h.lng.toFixed(4)}`
    if (seen.has(key)) return false
    seen.add(key)
    return Number.isFinite(h.lat) && Number.isFinite(h.lng)
  })
}
