"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getAdminToken } from "@/lib/api"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminTopbar } from "@/components/admin-topbar"

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const isLogin = pathname === "/admin/login"

  useEffect(() => {
    if (isLogin) {
      setReady(true)
      return
    }
    const token = getAdminToken()
    if (!token) {
      router.replace("/admin/login")
      return
    }
    setReady(true)
  }, [isLogin, pathname, router])

  if (isLogin) {
    return <>{children}</>
  }

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        Chargement…
      </div>
    )
  }

  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      <AdminSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
