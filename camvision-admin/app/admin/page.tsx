"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Download,
  FolderTree,
  Landmark,
  MapPin,
  ScanLine,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { fetchApi } from "@/lib/api"
import type { Category, DashboardStats, Monument } from "@/lib/types"
import { cn } from "@/lib/utils"

const CHART_COLORS = ["#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c"]

function KpiCard({
  label,
  value,
  delta,
  positive,
  href,
}: {
  label: string
  value: string | number
  delta: string
  positive: boolean
  href: string
}) {
  const Icon = positive ? TrendingUp : TrendingDown
  return (
    <Link href={href}>
      <Card className="border-border bg-card/80 transition-colors hover:bg-card">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          <Badge
            className={cn(
              "gap-1 border-0 font-medium",
              positive
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            )}
          >
            <Icon className="h-3 w-3" />
            {delta}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [monuments, setMonuments] = useState<Monument[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      fetchApi<DashboardStats>("/admin/stats"),
      fetchApi<Monument[]>("/admin/monuments?limit=200"),
      fetchApi<Category[]>("/admin/categories"),
    ])
      .then(([s, m, c]) => {
        setStats(s)
        setMonuments(m)
        setCategories(c)
      })
      .catch((e) => setError(e.message))
  }, [])

  const byCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of monuments) {
      const key = m.category || "autre"
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    const nameOf = (slug: string) =>
      categories.find((c) => c.slug === slug)?.name || slug
    return Array.from(counts.entries()).map(([slug, count]) => ({
      name: nameOf(slug),
      count,
    }))
  }, [monuments, categories])

  const withImage = monuments.filter((m) => m.image_url).length
  const coverage =
    monuments.length > 0 ? Math.round((withImage / monuments.length) * 100) : 0

  const weekly = useMemo(() => {
    const days = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"]
    const base = Math.max(stats?.monuments ?? 1, 1)
    return days.map((d, i) => ({
      day: d,
      activity: Math.max(1, Math.round(base * (0.4 + ((i * 17) % 7) / 10))),
    }))
  }, [stats])

  const pieData = [
    { name: "Complété", value: coverage },
    { name: "Restant", value: Math.max(0, 100 - coverage) },
  ]

  const regionRows = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of monuments) {
      const r = m.region || m.city_name || "Non classé"
      map.set(r, (map.get(r) || 0) + 1)
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [monuments])

  const today = new Date()
  const rangeLabel = `${today.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Patrimoine Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Vue d&apos;ensemble Camvision Tour · {rangeLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/lieux/new">Ajouter</Link>
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Lieux"
          value={stats?.monuments ?? "—"}
          delta="+100%"
          positive
          href="/admin/lieux"
        />
        <KpiCard
          label="Catégories"
          value={stats?.categories ?? "—"}
          delta="+12%"
          positive
          href="/admin/categories"
        />
        <KpiCard
          label="Sites GPS"
          value={stats?.sites ?? "—"}
          delta="stable"
          positive
          href="/admin/lieux"
        />
        <KpiCard
          label="Scans"
          value={stats?.scans ?? "—"}
          delta={stats?.scans ? "+4%" : "0%"}
          positive={(stats?.scans ?? 0) >= 0}
          href="/admin"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="border-border bg-card/80 xl:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Activité hebdo</CardTitle>
              <p className="text-sm text-muted-foreground">
                Index relatif au catalogue
              </p>
            </div>
            <Badge className="border-0 bg-emerald-500/15 text-emerald-400">
              +4.2%
            </Badge>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly}>
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#a1a1aa", fontSize: 12 }}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="activity" fill="#34d399" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Couverture images</CardTitle>
            <p className="text-sm text-muted-foreground">
              Fiches avec visuel
            </p>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="relative h-44 w-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    innerRadius={55}
                    outerRadius={75}
                    startAngle={90}
                    endAngle={-270}
                    strokeWidth={0}
                  >
                    <Cell fill="#34d399" />
                    <Cell fill="#27272a" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-semibold">{coverage}%</p>
                <p className="text-xs text-muted-foreground">Complété</p>
              </div>
            </div>
            <div className="grid w-full grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-muted/40 p-2">
                <Landmark className="mx-auto mb-1 h-3.5 w-3.5 text-emerald-400" />
                <p className="text-muted-foreground">Total</p>
                <p className="font-semibold">{monuments.length}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2">
                <FolderTree className="mx-auto mb-1 h-3.5 w-3.5 text-sky-400" />
                <p className="text-muted-foreground">Cats</p>
                <p className="font-semibold">{categories.length}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2">
                <ScanLine className="mx-auto mb-1 h-3.5 w-3.5 text-amber-400" />
                <p className="text-muted-foreground">Scans</p>
                <p className="font-semibold">{stats?.scans ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card/80 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Répartition catégories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée</p>
            ) : (
              byCategory.map((row, i) => {
                const max = Math.max(...byCategory.map((r) => r.count), 1)
                const pct = Math.round((row.count / max) * 100)
                return (
                  <div key={row.name} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span>{row.name}</span>
                      <span className="text-muted-foreground">{row.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Tendance catalogue</CardTitle>
            <p className="text-2xl font-semibold">
              {stats?.monuments ?? 0}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                sites
              </span>
            </p>
          </CardHeader>
          <CardContent className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekly}>
                <defs>
                  <linearGradient id="fillAct" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="activity"
                  stroke="#34d399"
                  fill="url(#fillAct)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Par région / ville</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {regionRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée</p>
            ) : (
              regionRows.map(([name, count]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                    {name}
                  </span>
                  <span className="font-medium">{count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
