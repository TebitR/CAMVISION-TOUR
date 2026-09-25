"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { LieuForm } from "@/components/monument-form"
import { fetchApi } from "@/lib/api"
import type { Monument } from "@/lib/types"

export default function EditLieuPage() {
  const params = useParams<{ id: string }>()
  const [lieu, setLieu] = useState<Monument | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const id = Number(params.id)
    if (!id) return
    fetchApi<Monument>(`/admin/monuments/${id}`)
      .then(setLieu)
      .catch((e) => setError(e.message))
  }, [params.id])

  if (error) {
    return <p className="p-8 text-sm text-red-400">{error}</p>
  }

  if (!lieu) {
    return <p className="p-8 text-sm text-muted-foreground">Chargement…</p>
  }

  return <LieuForm lieuId={lieu.id} initial={lieu} />
}
