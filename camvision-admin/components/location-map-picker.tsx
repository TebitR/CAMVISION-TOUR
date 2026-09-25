"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Loader2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { searchPlaces, type PlaceHit } from "@/lib/place-search"

const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  ""

const YDE: [number, number] = [11.5021, 3.848]

type Props = {
  latitude: number | null
  longitude: number | null
  onChange: (lat: number, lng: number, placeName?: string) => void
}

export function LocationMapPicker({ latitude, longitude, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<PlaceHit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    if (!TOKEN) return

    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [longitude ?? YDE[0], latitude ?? YDE[1]],
      zoom: latitude && longitude ? 14 : 12,
    })
    map.addControl(new mapboxgl.NavigationControl(), "top-right")

    const placeMarker = (lng: number, lat: number) => {
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat])
      } else {
        markerRef.current = new mapboxgl.Marker({ color: "#10b981" })
          .setLngLat([lng, lat])
          .addTo(map)
      }
    }

    if (latitude != null && longitude != null) {
      placeMarker(longitude, latitude)
    }

    map.on("click", (e) => {
      const { lng, lat } = e.lngLat
      placeMarker(lng, lat)
      onChangeRef.current(lat, lng)
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!mapRef.current || latitude == null || longitude == null) return
    if (markerRef.current) {
      markerRef.current.setLngLat([longitude, latitude])
    } else {
      markerRef.current = new mapboxgl.Marker({ color: "#10b981" })
        .setLngLat([longitude, latitude])
        .addTo(mapRef.current)
    }
    mapRef.current.flyTo({
      center: [longitude, latitude],
      zoom: 15,
      essential: true,
    })
  }, [latitude, longitude])

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([])
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        setHits(await searchPlaces(query))
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => clearTimeout(timer)
  }, [query])

  const selectHit = (hit: PlaceHit) => {
    setQuery(hit.title)
    setHits([])
    onChange(hit.lat, hit.lng, hit.title)
  }

  if (!TOKEN) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        Ajoutez <code className="text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> dans{" "}
        <code className="text-xs">camvision-admin/.env.local</code> pour la carte
        interactive.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher : musée, Réunification, Hilton…"
          className="bg-background pl-9"
        />
        {loading && (
          <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {hits.length > 0 && (
          <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
            {hits.map((hit) => (
              <li
                key={hit.id}
                onClick={() => selectHit(hit)}
                className="cursor-pointer border-b border-border/50 px-4 py-2.5 last:border-none hover:bg-muted/50"
              >
                <div className="text-sm font-medium">{hit.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {hit.source === "catalogue" ? "Catalogue · " : ""}
                  {hit.subtitle}
                </div>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && !loading && hits.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Aucun résultat. Essayez « musée national Yaoundé » ou cliquez sur la
            carte.
          </p>
        )}
      </div>
      <div
        ref={containerRef}
        className="h-80 w-full overflow-hidden rounded-xl border border-border"
      />
    </div>
  )
}
