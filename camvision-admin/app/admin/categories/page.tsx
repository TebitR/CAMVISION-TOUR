"use client"

import { useEffect, useState } from "react"
import { Edit, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fetchApi } from "@/lib/api"
import type { Category } from "@/lib/types"

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export default function CategoriesAdminPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState("")
  const [editing, setEditing] = useState<Category | null>(null)
  const [editName, setEditName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const load = async () => {
    try {
      const data = await fetchApi<Category[]>("/admin/categories")
      setCategories(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement")
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError("")
    try {
      const slug = slugify(name)
      await fetchApi("/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), slug }),
      })
      setName("")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur création")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette catégorie ?")) return
    setError("")
    try {
      await fetchApi(`/admin/categories/${id}`, { method: "DELETE" })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur suppression")
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setLoading(true)
    setError("")
    try {
      await fetchApi(`/admin/categories/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          slug: slugify(editName),
        }),
      })
      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur mise à jour")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Catégories</h1>
        <p className="text-sm text-muted-foreground">
          Gestion dynamique (lieux : monuments, musées, hôtels…)
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap gap-3 rounded-xl border bg-card p-4 shadow-sm"
      >
        <Input
          placeholder="Nom de la catégorie (ex: Hôtels, Sites naturels…)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-md"
        />
        <Button type="submit" disabled={loading}>
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </form>

      {editing && (
        <form
          onSubmit={handleUpdate}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"
        >
          <div className="flex-1 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Modifier #{editing.id}
            </p>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            Enregistrer
          </Button>
          <Button type="button" variant="outline" onClick={() => setEditing(null)}>
            Annuler
          </Button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Slug (API)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Aucune catégorie
                </TableCell>
              </TableRow>
            ) : (
              categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.id}</TableCell>
                  <TableCell>{cat.name}</TableCell>
                  <TableCell className="text-muted-foreground">{cat.slug}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(cat)
                        setEditName(cat.name)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-300"
                      onClick={() => handleDelete(cat.id)}
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
