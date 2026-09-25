const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"

const TOKEN_KEY = "admin_token"

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setAdminToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export async function loginAdmin(email: string, password: string) {
  const formData = new URLSearchParams()
  formData.append("username", email)
  formData.append("password", password)

  let res: Response
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      body: formData,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
  } catch {
    throw new Error(
      `Impossible de joindre l'API (${API_URL}). Vérifiez que le backend tourne sur le port 8000.`
    )
  }

  if (!res.ok) {
    throw new Error("Email ou mot de passe incorrect")
  }

  const data = (await res.json()) as { access_token: string }
  setAdminToken(data.access_token)
  return data
}

export async function fetchApi<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAdminToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json"
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    clearAdminToken()
    if (typeof window !== "undefined") {
      window.location.href = "/admin/login"
    }
    throw new Error("Session expirée")
  }

  if (response.status === 204) {
    return undefined as T
  }

  if (!response.ok) {
    let detail = response.statusText
    try {
      const err = await response.json()
      detail = err.detail || detail
      if (Array.isArray(detail)) {
        detail = detail.map((d: { msg?: string }) => d.msg).join(", ")
      }
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : "Erreur API")
  }

  return response.json() as Promise<T>
}

export { API_URL }
