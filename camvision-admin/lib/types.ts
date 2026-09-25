export type Category = {
  id: number
  name: string
  slug: string
  description?: string | null
  created_at?: string | null
}

export type LocalizedDict = Record<string, string>

export type Monument = {
  id: number
  code?: string | null
  name: LocalizedDict
  description?: LocalizedDict | null
  history?: LocalizedDict | null
  anecdotes?: LocalizedDict | null
  category?: string | null
  image_url?: string | null
  image_urls?: (string | { url?: string })[] | null
  audio_story_url?: string | null
  region?: string | null
  city_name?: string | null
  latitude?: number | null
  longitude?: number | null
  voice_id?: string | null
  site_id?: number | null
  vector_id?: string | null
}

export type DashboardStats = {
  monuments: number
  categories: number
  sites: number
  scans: number
}

export function monumentTitle(m: Monument, lang = "fr") {
  return m.name?.[lang] || m.name?.en || Object.values(m.name || {})[0] || "Sans titre"
}
