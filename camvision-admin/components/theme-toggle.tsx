"use client"

import { Moon, Sun } from "lucide-react"
import { useAdminTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useAdminTheme()

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5",
        compact && "border-white/10 bg-white/5"
      )}
      role="group"
      aria-label="Thème de l'interface"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
          theme === "light"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={theme === "light"}
        title="Mode clair"
      >
        <Sun className="h-3.5 w-3.5" />
        {!compact && "Clair"}
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
          theme === "dark"
            ? compact
              ? "bg-white/10 text-white shadow-sm"
              : "bg-muted text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={theme === "dark"}
        title="Mode sombre"
      >
        <Moon className="h-3.5 w-3.5" />
        {!compact && "Sombre"}
      </button>
    </div>
  )
}
