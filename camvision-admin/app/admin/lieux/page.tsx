"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Edit, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fetchApi } from "@/lib/api"
import { monumentTitle, type Category, type Monument } from "@/lib/types"

export default function LieuxAdminPage() {
  const [lieux, setLieux] = useState<Monument[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [q, setQ] = useState("")
  const [category, setCategory] = useState("")
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSaved(new URLSearchParams(window.location.search).get("saved") === "1")
  }, [])

  const load = async () => {
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set("q", q.trim())
      if (category) params.set("category", category)
      const qs = params.toString()
      const [items, cats] = await Promise.all([
        fetchApi<Monument[]>(`/admin/monuments${qs ? `?${qs}` : ""}`),
        fetchApi<Category[]>("/admin/categories"),
      ])
      setLieux(items)
      setCategories(cats)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement")
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const catLabel = useMemo(() => {
    const map = new Map(categories.map((c) => [c.slug, c.name]))
    return (slug?: string | null) => (slug ? map.get(slug) || slug : "—")
  }, [categories])

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce lieu ?")) return
    try {
      await fetchApi(`/admin/monuments/${id}`, { method: "DELETE" })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur suppression")
    }
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lieux</h1>
          <p className="text-sm text-muted-foreground">
            Catalogue universel (monuments, musées, hôtels, nature…)
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/lieux/new">
            <Plus className="h-4 w-4" />
            Nouveau lieu
          </Link>
        </Button>
      </div>

      {saved && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          Lieu enregistré. Les photos JPG/PNG apparaissent dans le catalogue mobile après actualisation.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3 rounded-xl border bg-card p-4">
        <Input
          placeholder="Rechercher…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" onClick={load}>
          Filtrer
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lieux.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucun lieu
                </TableCell>
              </TableRow>
            ) : (
              lieux.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.id}</TableCell>
                  <TableCell className="font-medium">{monumentTitle(m)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.code || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{catLabel(m.category)}</Badge>
                  </TableCell>
                  <TableCell>{m.city_name || "—"}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/admin/lieux/${m.id}/edit`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => handleDelete(m.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
