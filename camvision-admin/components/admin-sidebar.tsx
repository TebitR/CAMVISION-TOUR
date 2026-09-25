"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  FolderTree,
  LayoutDashboard,
  LogOut,
  Landmark,
  MapPinned,
  ScanLine,
  Settings,
} from "lucide-react"
import { clearAdminToken } from "@/lib/api"
import { cn } from "@/lib/utils"

const mainLinks = [
  { href: "/admin", label: "Analytics", icon: LayoutDashboard, exact: true },
  { href: "/admin/lieux", label: "Lieux", icon: Landmark },
  { href: "/admin/categories", label: "Catégories", icon: FolderTree },
]

const secondaryLinks = [
  { href: "/admin/lieux/new", label: "Nouveau lieu", icon: MapPinned },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const logout = () => {
    clearAdminToken()
    router.replace("/admin/login")
  }

  return (
    <aside className="flex h-svh w-64 shrink-0 flex-col border-r border-white/10 bg-[#06668C] text-white">
      <div className="px-4 pb-1 pt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/camvision-logo.png?v=2"
          alt="Camvision Tour"
          className="h-auto w-full object-contain"
        />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        <div>
          <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-white/55">
            Dashboards
          </p>
          <div className="space-y-0.5">
            {mainLinks.map(({ href, label, icon: Icon, exact }) => {
              const active = exact
                ? pathname === href
                : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-white/55">
            Contenu
          </p>
          <div className="space-y-0.5">
            {secondaryLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
            <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-white/45">
              <ScanLine className="h-4 w-4" />
              Scans
              <span className="ml-auto rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
                Soon
              </span>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-white/45">
              <Settings className="h-4 w-4" />
              Paramètres
            </div>
          </div>
        </div>
      </nav>

      <div className="space-y-3 border-t border-white/15 p-3">
        <div className="rounded-xl border border-white/15 bg-white/10 p-3">
          <p className="text-xs font-medium text-white">Patrimoine Cameroun</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/70">
            Gère les lieux, catégories et fiches multilingues.
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-white transition-colors hover:bg-white/10"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">
            AD
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Admin Camvision</p>
            <p className="truncate text-[11px] text-white/65">
              admin@camvision.cm
            </p>
          </div>
          <LogOut className="h-4 w-4 text-white/70" />
        </button>
      </div>
    </aside>
  )
}
