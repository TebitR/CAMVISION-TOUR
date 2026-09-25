"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Info,
  Loader2,
  MapPin,
  Sparkles,
  UploadCloud,
  X,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { LocationMapPicker } from "@/components/location-map-picker"
import { API_URL, fetchApi, getAdminToken } from "@/lib/api"
import { searchPlaces, type PlaceHit } from "@/lib/place-search"
import type { Category, Monument } from "@/lib/types"

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const IMAGE_EXTS = /\.(jpe?g|png|webp|gif)$/i

function publicImageSrc(url: string) {
  if (!url) return ""
  if (url.startsWith("http") || url.startsWith("blob:")) return url
  const base = API_URL.replace(/\/api\/v1$/, "")
  return `${base}/${url.replace(/^\//, "")}`
}

function galleryFromInitial(m?: Monument | null): string[] {
  const urls = Array.isArray(m?.image_urls) ? m!.image_urls! : []
  const normalized = urls
    .map((u) => (typeof u === "string" ? u : (u as { url?: string })?.url || ""))
    .filter(Boolean)
  if (m?.image_url && !normalized.includes(m.image_url)) {
    return [m.image_url, ...normalized]
  }
  return normalized
}

export function LieuForm({
  lieuId,
  initial,
}: {
  lieuId?: number
  initial?: Monument | null
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [titleFr, setTitleFr] = useState(initial?.name?.fr || "")
  const [category, setCategory] = useState(initial?.category || "")
  const [descriptionFr, setDescriptionFr] = useState(
    initial?.description?.fr || ""
  )
  const [historyFr, setHistoryFr] = useState(initial?.history?.fr || "")
  const [city, setCity] = useState(initial?.city_name || "Yaoundé")
  const [region, setRegion] = useState(initial?.region || "")
  const [latitude, setLatitude] = useState<number | null>(
    initial?.latitude ?? null
  )
  const [longitude, setLongitude] = useState<number | null>(
    initial?.longitude ?? null
  )
  const [existingImages, setExistingImages] = useState<string[]>(() =>
    galleryFromInitial(initial)
  )
  const [uploading, setUploading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [error, setError] = useState("")

  // États pour l'autocomplétion intelligente de la recherche
  const [searchQuery, setSearchQuery] = useState("")
  const [suggestions, setSuggestions] = useState<PlaceHit[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        setSuggestions(await searchPlaces(searchQuery))
      } catch (err) {
        console.error("Erreur recherche lieu:", err)
      } finally {
        setSearchLoading(false)
      }
    }, 280)

    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    fetchApi<Category[]>("/admin/categories")
      .then((cats) => {
        setCategories(cats)
        setCategory((prev) => prev || cats[0]?.slug || "artifact")
      })
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (!initial) return
    setTitleFr(initial.name?.fr || "")
    setCategory(initial.category || "")
    setDescriptionFr(initial.description?.fr || "")
    setHistoryFr(initial.history?.fr || "")
    setCity(initial.city_name || "Yaoundé")
    setRegion(initial.region || "")
    setLatitude(initial.latitude ?? null)
    setLongitude(initial.longitude ?? null)
    setExistingImages(galleryFromInitial(initial))
  }, [initial])

  const handleSelectSuggestion = (hit: PlaceHit) => {
    setLatitude(hit.lat)
    setLongitude(hit.lng)
    setSearchQuery(hit.title)
    setSuggestions([])

    if (!titleFr) {
      setTitleFr(hit.title)
    }

    const parts = hit.subtitle.split("·").map((p) => p.trim())
    const cityGuess = parts[0] && !parts[0].includes("Catalogue") ? parts[0] : ""
    if (cityGuess && !city) setCity(cityGuess.split(",")[0] || cityGuess)
  }

  const handleGetLocation = () => {
    if (!("geolocation" in navigator)) {
      setError("La géolocalisation n'est pas supportée par ce navigateur.")
      return
    }
    setGpsLoading(true)
    setError("")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude)
        setLongitude(pos.coords.longitude)
        setGpsLoading(false)
      },
      () => {
        setError(
          "Impossible de récupérer la position. Autorisez la géolocalisation."
        )
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  const uploadOne = async (file: File): Promise<string> => {
    const fd = new FormData()
    fd.append("file", file, file.name || "photo.jpg")
    const token = getAdminToken()
    const res = await fetch(`${API_URL}/admin/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    })
    if (res.status === 401) {
      window.location.href = "/admin/login"
      throw new Error("Session expirée")
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        typeof err.detail === "string" ? err.detail : "Échec upload image"
      )
    }
    const data = (await res.json()) as { url: string }
    if (!data.url) throw new Error("Réponse upload sans URL")
    return data.url
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const chosenFiles = Array.from(e.target.files)
    e.target.value = ""
    const images = chosenFiles.filter((file) => {
      if (IMAGE_TYPES.has(file.type)) return true
      return IMAGE_EXTS.test(file.name)
    })
    const rejected = chosenFiles.length - images.length
    if (rejected > 0) {
      setError(
        `${rejected} fichier(s) ignoré(s) : seules les images JPG, PNG, WEBP ou GIF sont acceptées (pas de HEIC / PDF / vidéo).`
      )
    } else {
      setError("")
    }
    if (!images.length) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of images) {
        urls.push(await uploadOne(file))
      }
      setExistingImages((prev) => [...prev, ...urls])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec upload image")
    } finally {
      setUploading(false)
    }
  }

  const removeExisting = (url: string) => {
    setExistingImages((prev) => prev.filter((u) => u !== url))
  }

  const onMapChange = (lat: number, lng: number, placeName?: string) => {
    setLatitude(lat)
    setLongitude(lng)
    if (placeName) {
      const parts = placeName.split(",").map((p) => p.trim())
      if (parts.length >= 2 && !city) setCity(parts[1] || parts[0])
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!titleFr.trim()) {
      setError("Le titre est obligatoire.")
      return
    }
    if (!category) {
      setError("Choisissez une catégorie.")
      return
    }
    setLoading(true)
    try {
      const formData = new FormData()

      // IMPORTANT: these field names must match the FastAPI Form(...) params exactly.
      formData.append("name", titleFr.trim())
      formData.append("category", category)
      formData.append("city", city.trim())
      formData.append("region", region.trim())
      formData.append("description", descriptionFr.trim())
      formData.append("history", historyFr.trim())
      if (latitude != null) formData.append("latitude", String(latitude))
      if (longitude != null) formData.append("longitude", String(longitude))

      formData.append("existing_images", JSON.stringify(existingImages))

      const token = getAdminToken()
      const url = lieuId
        ? `${API_URL}/admin/monuments/${lieuId}`
        : `${API_URL}/admin/monuments`

      // Do not set Content-Type manually here: the browser must generate the
      // multipart/form-data boundary automatically when sending FormData.
      const res = await fetch(url, {
        method: lieuId ? "PUT" : "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      })
      if (res.status === 401) {
        window.location.href = "/admin/login"
        throw new Error("Session expirée")
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const detail = err.detail
        if (typeof detail === "string") throw new Error(detail)
        if (Array.isArray(detail)) {
          throw new Error(
            detail
              .map((d: { loc?: unknown[]; msg?: string }) => {
                const field = Array.isArray(d.loc) ? d.loc.slice(1).join(".") : ""
                return [field, d.msg].filter(Boolean).join(": ")
              })
              .join(" · ") || "Erreur enregistrement"
          )
        }
        throw new Error("Erreur enregistrement")
      }
      router.push("/admin/lieux")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'enregistrement")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {lieuId ? "Modifier le lieu" : "Nouveau lieu"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Recherche intelligente, carte Mapbox et galerie multi-photos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading || gpsLoading || uploading}>
            {loading || uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : existingImages.length > 0 ? (
              `Enregistrer (${existingImages.length} photo${existingImages.length > 1 ? "s" : ""})`
            ) : (
              "Enregistrer"
            )}
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {/* RECHERCHE INTELLIGENTE */}
      <section className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold">Recherche Intelligente (Géocodage)</h2>
          <Badge className="border-0 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">Autocomplétion</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Tapez le nom du lieu pour remplir automatiquement les coordonnées GPS.
        </p>

        <div className="relative">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ex: musee national (même sans accent)…"
            className="w-full bg-background"
          />
          {searchLoading && (
            <div className="absolute right-3 top-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {suggestions.length > 0 && (
            <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
              {suggestions.map((item) => (
                <li
                  key={item.id}
                  onClick={() => handleSelectSuggestion(item)}
                  className="cursor-pointer px-4 py-2.5 text-sm hover:bg-muted/50 border-b border-border/50 last:border-none"
                >
                  <div className="font-medium text-foreground">{item.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {item.source === "catalogue" ? "Catalogue · " : ""}
                    {item.subtitle}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* INFORMATIONS DE BASE */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Informations Générales</h2>
          <Badge variant="secondary">Manuel</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Nom du lieu *</Label>
            <Input
              id="title"
              required
              value={titleFr}
              onChange={(e) => setTitleFr(e.target.value)}
              placeholder="Ex: Monument de la Réunification"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Catégorie *</Label>
            <select
              id="category"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (FR)</Label>
          <Textarea
            id="description"
            rows={4}
            value={descriptionFr}
            onChange={(e) => setDescriptionFr(e.target.value)}
            placeholder="Racontez l'histoire du site…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="history">Histoire (FR) — optionnel</Label>
          <Textarea
            id="history"
            rows={3}
            value={historyFr}
            onChange={(e) => setHistoryFr(e.target.value)}
          />
        </div>
      </section>

      {/* LOCALISATION & CARTE */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold">Localisation</h2>
            <Badge className="border-0 bg-sky-500/15 text-sky-700 dark:text-sky-300">Mapbox</Badge>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGetLocation}
            disabled={gpsLoading}
          >
            {gpsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            Ma position GPS
          </Button>
        </div>

        <LocationMapPicker
          latitude={latitude}
          longitude={longitude}
          onChange={onMapChange}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lat">Latitude</Label>
            <Input
              id="lat"
              type="number"
              step="any"
              value={latitude ?? ""}
              onChange={(e) =>
                setLatitude(
                  e.target.value === "" ? null : parseFloat(e.target.value)
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lng">Longitude</Label>
            <Input
              id="lng"
              type="number"
              step="any"
              value={longitude ?? ""}
              onChange={(e) =>
                setLongitude(
                  e.target.value === "" ? null : parseFloat(e.target.value)
                )
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="region">Région (optionnel)</Label>
          <Input
            id="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Centre, Littoral…"
          />
        </div>
      </section>

      {/* GESTION DES PHOTOS (CORRIGÉ & VISIBLE) */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Photos du lieu</h2>
          <Badge variant="secondary">Galerie</Badge>
        </div>

        <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 transition hover:bg-muted/40">
          {uploading ? (
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-emerald-400" />
          ) : (
            <UploadCloud className="mb-2 h-8 w-8 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground">
            {uploading ? (
              "Envoi des photos…"
            ) : (
              <>
                <span className="font-semibold text-foreground">Cliquez</span> pour ajouter des images
              </>
            )}
          </p>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
            onChange={handleImageChange}
          />
        </label>

        {/* Affichage simultané des images existantes et des nouvelles images sélectionnées */}
        {existingImages.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {existingImages.map((url) => (
              <div key={url} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={publicImageSrc(url)}
                  alt="existant"
                  className="h-24 w-full rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeExisting(url)}
                  className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-dashed border-border bg-muted/20 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold">Généré automatiquement</h2>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Code, traductions, audio TTS, index vision Qdrant.
          </li>
        </ul>
      </section>
    </form>
  )
}

export const MonumentForm = LieuForm