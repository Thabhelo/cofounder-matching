"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton, useAuth } from "@clerk/nextjs"
import { clsx } from "clsx"
import { api } from "@/lib/api"

type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
  hasSubmenu?: boolean
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    label: "Discover",
    href: "/discover",
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    label: "Revisit",
    href: "/revisit",
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    hasSubmenu: true,
  },
  {
    label: "Inbox",
    href: "/inbox",
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: "My Account",
    href: "/profile",
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    hasSubmenu: true,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: "Admin",
    href: "/admin",
    adminOnly: true,
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
]

// Bottom nav items for mobile (5 key items)
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

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive =
      pathname === item.href ||
      (item.href !== "/dashboard" && item.href !== "/admin" && pathname?.startsWith(item.href)) ||
      (item.href === "/admin" && pathname?.startsWith("/admin"))

    return (
      <Link
        href={item.href}
        className={clsx(
          "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group",
          isActive
            ? "bg-zinc-900 text-white"
            : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
        )}
      >
        <span className={clsx(isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-700")}>
          {item.icon}
        </span>
        <span className="font-medium">{item.label}</span>
        {item.adminOnly && pendingReview > 0 && (
          <span
            aria-label={`${pendingReview} pending reviews`}
            className="ml-auto min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-semibold"
          >
            {pendingReview > 99 ? "99+" : pendingReview}
          </span>
        )}
        {item.hasSubmenu && (
          <svg aria-hidden="true" className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </Link>
    )
  }

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 bg-white border-r border-zinc-200 min-h-screen flex-col flex-shrink-0">
        <div className="p-6 border-b border-zinc-200">
          <h1 className="text-xl font-semibold text-zinc-900">CoFounder Match</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {items.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>
        <div className="p-4 border-t border-zinc-200">
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </aside>

      {/* ── Mobile top header bar ────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-white border-b border-zinc-200 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 rounded-lg text-zinc-600 hover:bg-zinc-100 touch-manipulation"
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-drawer"
        >
          <svg aria-hidden="true" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="font-semibold text-zinc-900 flex-1">CoFounder Match</span>
        <UserButton afterSignOutUrl="/" />
      </header>

      {/* ── Mobile drawer overlay ────────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <aside id="mobile-drawer" className="relative w-72 max-w-[80vw] bg-white flex flex-col h-full shadow-xl">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
              <h1 className="text-xl font-semibold text-zinc-900">CoFounder Match</h1>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 touch-manipulation"
                aria-label="Close menu"
              >
                <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {items.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </nav>
            <div className="p-4 border-t border-zinc-200">
              <div className="flex items-center gap-3">
                <UserButton afterSignOutUrl="/" />
                <span className="text-sm text-zinc-600">Account</span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── Mobile bottom navigation bar ─────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white border-t border-zinc-200 flex items-stretch safe-area-bottom">
        {bottomNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors touch-manipulation",
                isActive ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              <span className={clsx(isActive && "text-zinc-900")}>{item.icon}</span>
              <span className="leading-none">{item.label.replace("My Account", "Account")}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
