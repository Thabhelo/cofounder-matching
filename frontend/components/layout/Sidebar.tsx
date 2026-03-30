"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton, useAuth } from "@clerk/nextjs"
import {
  LayoutDashboard,
  Search,
  Star,
  Mail,
  User,
  Settings,
  Shield,
  Menu,
  X,
  ChevronRight,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  hasSubmenu?: boolean
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Discover",
    href: "/discover",
    icon: Search,
  },
  {
    label: "Revisit",
    href: "/revisit",
    icon: Star,
    hasSubmenu: true,
  },
  {
    label: "Inbox",
    href: "/inbox",
    icon: Mail,
  },
  {
    label: "My Account",
    href: "/profile",
    icon: User,
    hasSubmenu: true,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
  {
    label: "Admin",
    href: "/admin",
    adminOnly: true,
    icon: Shield,
  },
]

const BOTTOM_NAV_HREFS = ["/dashboard", "/discover", "/inbox", "/profile", "/settings"]

export function Sidebar() {
  const pathname = usePathname()
  const { getToken } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [pendingReview, setPendingReview] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getToken()
      .then((token) => {
        if (!token || cancelled) return
        return api.admin.check(token).then((res) => {
          if (!cancelled && res?.is_admin) {
            setIsAdmin(true)
            return api.admin.getStats(token)
          }
        })
      })
      .then((stats) => {
        if (!cancelled && stats?.users_pending_review) {
          setPendingReview(stats.users_pending_review)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [getToken])

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const items = navItems.filter((item) => !item.adminOnly || isAdmin)
  const bottomNavItems = navItems.filter((item) => BOTTOM_NAV_HREFS.includes(item.href))

  function isActive(href: string) {
    return (
      pathname === href ||
      (href !== "/dashboard" && href !== "/admin" && pathname?.startsWith(href)) ||
      (href === "/admin" && pathname?.startsWith("/admin"))
    )
  }

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href)
    const Icon = item.icon

    return (
      <Link
        href={item.href}
        className={cn(
          buttonVariants({ variant: "ghost", size: "lg" }),
          "w-full justify-start gap-3 px-3 py-2.5 h-auto font-medium transition-all duration-150",
          active
            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Icon
          className={cn(
            "h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover:scale-110",
            active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
          )}
        />
        <span className="truncate">{item.label}</span>
        {item.adminOnly && pendingReview > 0 && (
          <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 h-5 min-w-[20px]">
            {pendingReview > 99 ? "99+" : pendingReview}
          </Badge>
        )}
        {item.hasSubmenu && (
          <ChevronRight
            className={cn(
              "ml-auto h-4 w-4 shrink-0",
              active ? "text-primary-foreground/70" : "text-muted-foreground/50"
            )}
          />
        )}
      </Link>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-border h-screen flex-col shrink-0 sticky top-0">
        <div className="px-6 py-5">
          <Link
            href="/dashboard"
            className="text-lg font-bold tracking-tight text-foreground hover:text-foreground/80 transition-colors"
          >
            CoFounder Match
          </Link>
        </div>
        <Separator />
        <nav className="flex-1 p-3 space-y-0.5">
          {items.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>
        <Separator />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </aside>

      {/* Mobile top header bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-white/95 backdrop-blur-sm border-b border-border flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "-ml-1 text-muted-foreground"
          )}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-drawer"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link
          href="/dashboard"
          className="font-bold tracking-tight text-foreground flex-1"
        >
          CoFounder Match
        </Link>
        <UserButton afterSignOutUrl="/" />
      </header>

      {/* Mobile drawer overlay */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-50",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
        {/* Drawer panel */}
        <aside
          id="mobile-drawer"
          className={cn(
            "relative w-72 max-w-[80vw] bg-white flex flex-col h-full shadow-xl transition-transform duration-300 ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="px-5 py-4 flex items-center justify-between">
            <Link
              href="/dashboard"
              className="text-lg font-bold tracking-tight text-foreground"
            >
              CoFounder Match
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "text-muted-foreground"
              )}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Separator />
          <ScrollArea className="flex-1">
            <nav className="p-3 space-y-0.5">
              {items.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </nav>
          </ScrollArea>
          <Separator />
          <div className="p-4">
            <div className="flex items-center gap-3">
              <UserButton afterSignOutUrl="/" />
              <span className="text-sm text-muted-foreground">Account</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile bottom navigation bar */}
      <TooltipProvider>
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 backdrop-blur-sm border-t border-border flex items-stretch safe-area-bottom">
          {bottomNavItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger
                  render={
                    <Link
                      href={item.href}
                      className={cn(
                        "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors touch-manipulation",
                        active
                          ? "text-foreground"
                          : "text-muted-foreground/60 hover:text-muted-foreground"
                      )}
                    />
                  }
                >
                  <Icon
                    className={cn(
                      "h-6 w-6 transition-transform duration-150",
                      active && "scale-105"
                    )}
                  />
                  <span className="leading-none">
                    {item.label.replace("My Account", "Account")}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>
      </TooltipProvider>
    </>
  )
}
