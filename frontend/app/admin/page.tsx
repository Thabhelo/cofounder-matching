"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Sidebar } from "@/components/layout/Sidebar"
import { api } from "@/lib/api"
import type { ReportListItem, User, Organization, Resource, Event, AuditLogEntry } from "@/lib/types"

type AdminTab = "overview" | "reports" | "users" | "organizations" | "analytics" | "resources" | "events" | "audit"

type Stats = {
  users_total: number
  users_banned: number
  users_pending_review: number
  reports_pending: number
  reports_total: number
  organizations_total: number
  matches_total?: number
  messages_total?: number
  users_last_7_days?: number
  users_last_30_days?: number
  matches_last_7_days?: number
}

export default function AdminPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<AdminTab>("overview")
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [accessDeniedHint, setAccessDeniedHint] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [reports, setReports] = useState<ReportListItem[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [reportStatusFilter, setReportStatusFilter] = useState("pending")
  const [reportTypeFilter, setReportTypeFilter] = useState("")
  const [reportSort, setReportSort] = useState({ sort_by: "created_at", sort_order: "desc" })
  const [userFilter, setUserFilter] = useState<"all" | "banned" | "pending_review">("all")
  const [userSearch, setUserSearch] = useState("")
  const [resources, setResources] = useState<Resource[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [analytics, setAnalytics] = useState<{
    signups_by_day: { day: string; count: number }[]
    matches_by_day: { day: string; count: number }[]
    intro_requested_count: number
    intro_accepted_count: number
    intro_acceptance_rate: number
    messages_count: number
    resource_saves_count: number
    event_rsvps_count: number
    organizations_with_activity_count: number
  } | null>(null)
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const token = await getToken()
        if (!token) {
          router.push("/")
          return
        }
        const res = await api.admin.check(token)
        if (!cancelled) {
          setIsAdmin(res.is_admin)
          if (!res.is_admin && res.hint) setAccessDeniedHint(res.hint)
        }
      } catch {
        if (!cancelled) setIsAdmin(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [getToken, router])

  useEffect(() => {
    if (!isAdmin) return
    getToken().then((token) => {
      if (!token) return
      api.admin.getStats(token).then(setStats).catch(() => {})
    })
  }, [isAdmin, getToken])

  useEffect(() => {
    if (!isAdmin || tab !== "reports") return
    getToken().then((token) => {
      if (!token) return
      const params: Record<string, string | number> = { status_filter: reportStatusFilter, sort_by: reportSort.sort_by, sort_order: reportSort.sort_order, limit: 100 }
      if (reportTypeFilter) params.report_type = reportTypeFilter
      api.admin.getReports(token, params).then(setReports).catch(() => {})
    })
  }, [isAdmin, tab, reportStatusFilter, reportTypeFilter, reportSort, getToken])

  useEffect(() => {
    if (!isAdmin || tab !== "users") return
    getToken().then((token) => {
      if (!token) return
      const params: { limit: number; q?: string; is_banned?: boolean; profile_status?: string } = { limit: 100 }
      if (userSearch.trim()) params.q = userSearch.trim()
      if (userFilter === "banned") params.is_banned = true
      if (userFilter === "pending_review") params.profile_status = "pending_review"
      api.admin.getUsers(token, params).then(setUsers).catch(() => {})
    })
  }, [isAdmin, tab, userFilter, userSearch, getToken])

  useEffect(() => {
    if (!isAdmin || tab !== "organizations") return
    getToken().then((token) => {
      if (!token) return
      api.admin.getOrganizations(token, { limit: 100 }).then(setOrganizations).catch(() => {})
    })
  }, [isAdmin, tab, getToken])

  useEffect(() => {
    if (!isAdmin || tab !== "analytics") return
    getToken().then((token) => {
      if (!token) return
      api.admin.getAnalytics(token, 30).then(setAnalytics).catch(() => {})
    })
  }, [isAdmin, tab, getToken])

  useEffect(() => {
    if (!isAdmin || tab !== "resources") return
    getToken().then((token) => {
      if (!token) return
      api.admin.getResources(token, { limit: 100 }).then(setResources).catch(() => {})
    })
  }, [isAdmin, tab, getToken])

  useEffect(() => {
    if (!isAdmin || tab !== "events") return
    getToken().then((token) => {
      if (!token) return
      api.admin.getEvents(token, { limit: 100 }).then(setEvents).catch(() => {})
    })
  }, [isAdmin, tab, getToken])

  useEffect(() => {
    if (!isAdmin || tab !== "audit") return
    getToken().then((token) => {
      if (!token) return
      api.admin.getAuditLog(token, { limit: 100 }).then(setAuditLog).catch(() => {})
    })
  }, [isAdmin, tab, getToken])

  const handleReviewReport = async (reportId: string, status: string) => {
    const token = await getToken()
    if (!token) return
    try {
      setActioning(reportId)
      const notes = resolutionNotes[reportId] || null
      await api.admin.reviewReport(reportId, status, notes, token)
      setResolutionNotes((prev) => { const n = { ...prev }; delete n[reportId]; return n })
      setReports((prev) => prev.filter((r) => r.id !== reportId))
    } catch (e) {
      console.error(e)
      alert("Failed to update report")
    } finally {
      setActioning(null)
    }
  }

  const handleBan = async (userId: string) => {
    if (!confirm("Ban this user? They will not be able to sign in.")) return
    const token = await getToken()
    if (!token) return
    try {
      setActioning(userId)
      await api.admin.banUser(userId, token)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_banned: true } : u)))
    } catch (e) {
      console.error(e)
      alert("Failed to ban user")
    } finally {
      setActioning(null)
    }
  }

  const handleUnban = async (userId: string) => {
    const token = await getToken()
    if (!token) return
    try {
      setActioning(userId)
      await api.admin.unbanUser(userId, token)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_banned: false } : u)))
    } catch (e) {
      console.error(e)
      alert("Failed to unban user")
    } finally {
      setActioning(null)
    }
  }

  const handleApprove = async (userId: string) => {
    const token = await getToken()
    if (!token) return
    try {
      setActioning(userId)
      await api.admin.approveUser(userId, token)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, profile_status: "approved" } : u)))
    } catch (e) {
      console.error(e)
      alert("Failed to approve user")
    } finally {
      setActioning(null)
    }
  }

  const handleReject = async (userId: string) => {
    const token = await getToken()
    if (!token) return
    try {
      setActioning(userId)
      await api.admin.rejectUser(userId, token)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, profile_status: "rejected" } : u)))
    } catch (e) {
      console.error(e)
      alert("Failed to reject user")
    } finally {
      setActioning(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Deactivate this user? They will not be able to sign in.")) return
    const token = await getToken()
    if (!token) return
    try {
      setActioning(userId)
      await api.admin.deleteUser(userId, token)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (e) {
      console.error(e)
      alert("Failed to deactivate user")
    } finally {
      setActioning(null)
    }
  }

  const handleVerifyOrg = async (orgId: string) => {
    const token = await getToken()
    if (!token) return
    try {
      setActioning(orgId)
      await api.admin.verifyOrganization(orgId, token)
      setOrganizations((prev) => prev.map((o) => (o.id === orgId ? { ...o, is_verified: true } : o)))
    } catch (e) {
      console.error(e)
      alert("Failed to verify organization")
    } finally {
      setActioning(null)
    }
  }

  const handleUpdateOrg = async (orgId: string, data: Partial<Organization>) => {
    const token = await getToken()
    if (!token) return
    try {
      setActioning(orgId)
      const updated = await api.admin.updateOrganization(orgId, data, token)
      setOrganizations((prev) => prev.map((o) => (o.id === orgId ? updated : o)))
    } catch (e) {
      console.error(e)
      alert("Failed to update organization")
    } finally {
      setActioning(null)
    }
  }

  const handleDeleteOrg = async (orgId: string) => {
    if (!confirm("Deactivate this organization? It will be hidden from the platform.")) return
    const token = await getToken()
    if (!token) return
    try {
      setActioning(orgId)
      await api.admin.deleteOrganization(orgId, token)
      setOrganizations((prev) => prev.filter((o) => o.id !== orgId))
    } catch (e) {
      console.error(e)
      alert("Failed to deactivate organization")
    } finally {
      setActioning(null)
    }
  }

  const handleToggleResourceFeature = async (resourceId: string, isFeatured: boolean) => {
    const token = await getToken()
    if (!token) return
    try {
      setActioning(resourceId)
      const updated = await api.admin.updateResource(resourceId, { is_featured: isFeatured }, token)
      setResources((prev) => prev.map((r) => (r.id === resourceId ? updated : r)))
    } catch (e) {
      console.error(e)
      alert("Failed to update resource")
    } finally {
      setActioning(null)
    }
  }

  const handleDeactivateResource = async (resourceId: string) => {
    if (!confirm("Deactivate this resource? It will be hidden from the platform.")) return
    const token = await getToken()
    if (!token) return
    try {
      setActioning(resourceId)
      await api.admin.deactivateResource(resourceId, token)
      setResources((prev) => prev.filter((r) => r.id !== resourceId))
    } catch (e) {
      console.error(e)
      alert("Failed to deactivate resource")
    } finally {
      setActioning(null)
    }
  }

  const handleToggleEventFeature = async (eventId: string, isFeatured: boolean) => {
    const token = await getToken()
    if (!token) return
    try {
      setActioning(eventId)
      const updated = await api.admin.updateEvent(eventId, { is_featured: isFeatured }, token)
      setEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)))
    } catch (e) {
      console.error(e)
      alert("Failed to update event")
    } finally {
      setActioning(null)
    }
  }

  const handleDeactivateEvent = async (eventId: string) => {
    if (!confirm("Deactivate this event? It will be hidden from the platform.")) return
    const token = await getToken()
    if (!token) return
    try {
      setActioning(eventId)
      await api.admin.deactivateEvent(eventId, token)
      setEvents((prev) => prev.filter((e) => e.id !== eventId))
    } catch (e) {
      console.error(e)
      alert("Failed to deactivate event")
    } finally {
      setActioning(null)
    }
  }

  const formatDate = (s: string | null) => (s ? new Date(s).toLocaleString() : "-")

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-semibold text-zinc-900 mb-2">Access denied</h1>
            <p className="text-zinc-600 mb-6">
              You do not have permission to view the admin area. If you believe this is an error, contact your
              administrator.
            </p>
            {accessDeniedHint && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 text-left">
                {accessDeniedHint}
              </p>
            )}
            <Link
              href="/dashboard"
              className="inline-block px-6 py-2 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800"
            >
              Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "reports", label: "Reports" },
    { id: "users", label: "Users" },
    { id: "organizations", label: "Organizations" },
    { id: "resources", label: "Resources" },
    { id: "events", label: "Events" },
    { id: "analytics", label: "Analytics" },
    { id: "audit", label: "Audit log" },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-semibold text-zinc-900 mb-2">Admin</h1>
          <p className="text-zinc-600 mb-6">Manage users, reports, and organizations.</p>

          <nav className="flex gap-1 border-b border-zinc-200 mb-8">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                  tab === t.id
                    ? "bg-white border border-zinc-200 border-b-0 text-zinc-900 -mb-px"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {tab === "overview" && !stats && (
            <p className="text-zinc-500 text-sm">Failed to load stats. Check that the backend is running and try refreshing.</p>
          )}
          {tab === "overview" && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-zinc-200 rounded-lg p-4">
                  <p className="text-sm text-zinc-500">Total users</p>
                  <p className="text-2xl font-semibold text-zinc-900">{stats.users_total}</p>
                </div>
                <div className="bg-white border border-zinc-200 rounded-lg p-4">
                  <p className="text-sm text-zinc-500">Users (7d)</p>
                  <p className="text-2xl font-semibold text-zinc-900">{stats.users_last_7_days ?? "-"}</p>
                </div>
                <div className="bg-white border border-zinc-200 rounded-lg p-4">
                  <p className="text-sm text-zinc-500">Pending review</p>
                  <p className="text-2xl font-semibold text-zinc-900">{stats.users_pending_review}</p>
                  <button type="button" onClick={() => setTab("users")} className="text-xs text-zinc-600 hover:underline mt-1">View</button>
                </div>
                <div className="bg-white border border-zinc-200 rounded-lg p-4">
                  <p className="text-sm text-zinc-500">Banned</p>
                  <p className="text-2xl font-semibold text-zinc-900">{stats.users_banned}</p>
                </div>
                <div className="bg-white border border-zinc-200 rounded-lg p-4">
                  <p className="text-sm text-zinc-500">Matches</p>
                  <p className="text-2xl font-semibold text-zinc-900">{stats.matches_total ?? "-"}</p>
                </div>
                <div className="bg-white border border-zinc-200 rounded-lg p-4">
                  <p className="text-sm text-zinc-500">Messages</p>
                  <p className="text-2xl font-semibold text-zinc-900">{stats.messages_total ?? "-"}</p>
                </div>
                <div className="bg-white border border-zinc-200 rounded-lg p-4">
                  <p className="text-sm text-zinc-500">Pending reports</p>
                  <p className="text-2xl font-semibold text-zinc-900">{stats.reports_pending}</p>
                  <button type="button" onClick={() => setTab("reports")} className="text-xs text-zinc-600 hover:underline mt-1">Review</button>
                </div>
                <div className="bg-white border border-zinc-200 rounded-lg p-4">
                  <p className="text-sm text-zinc-500">Organizations</p>
                  <p className="text-2xl font-semibold text-zinc-900">{stats.organizations_total}</p>
                  <button type="button" onClick={() => setTab("organizations")} className="text-xs text-zinc-600 hover:underline mt-1">Manage</button>
                </div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-lg p-6">
                <h2 className="text-lg font-medium text-zinc-900 mb-4">Quick actions</h2>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setTab("reports")}
                    className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800"
                  >
                    Review reports
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTab("users"); setUserFilter("pending_review") }}
                    className="px-4 py-2 border border-zinc-300 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-50"
                  >
                    Approve profiles
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("users")}
                    className="px-4 py-2 border border-zinc-300 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-50"
                  >
                    Manage users
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("organizations")}
                    className="px-4 py-2 border border-zinc-300 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-50"
                  >
                    Verify organizations
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "reports" && (
            <>
              <div className="mb-4 flex flex-wrap gap-4 items-center">
                <div className="flex gap-2 items-center">
                  <label className="text-sm font-medium text-zinc-700">Status</label>
                  <select
                    value={reportStatusFilter}
                    onChange={(e) => setReportStatusFilter(e.target.value)}
                    className="border border-zinc-300 rounded px-3 py-1.5 text-zinc-900"
                  >
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-sm font-medium text-zinc-700">Type</label>
                  <select
                    value={reportTypeFilter}
                    onChange={(e) => setReportTypeFilter(e.target.value)}
                    className="border border-zinc-300 rounded px-3 py-1.5 text-zinc-900"
                  >
                    <option value="">All types</option>
                    <option value="spam">Spam</option>
                    <option value="harassment">Harassment</option>
                    <option value="inappropriate">Inappropriate</option>
                    <option value="fake">Fake profile</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-sm font-medium text-zinc-700">Sort</label>
                  <select
                    value={reportSort.sort_by}
                    onChange={(e) => setReportSort((s) => ({ ...s, sort_by: e.target.value }))}
                    className="border border-zinc-300 rounded px-3 py-1.5 text-zinc-900"
                  >
                    <option value="created_at">Date</option>
                    <option value="report_type">Type</option>
                    <option value="status">Status</option>
                  </select>
                  <select
                    value={reportSort.sort_order}
                    onChange={(e) => setReportSort((s) => ({ ...s, sort_order: e.target.value }))}
                    className="border border-zinc-300 rounded px-3 py-1.5 text-zinc-900"
                  >
                    <option value="desc">Newest first</option>
                    <option value="asc">Oldest first</option>
                  </select>
                </div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                {reports.length === 0 ? (
                  <p className="p-6 text-zinc-600">No reports in this status.</p>
                ) : (
                  <div className="divide-y divide-zinc-200">
                    {reports.map((r) => (
                      <div key={r.id} className="p-4 flex justify-between items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-500">
                            Reported: {r.reported_user_name ?? "Unknown"} ({r.reported_user_email ?? "-"})
                          </p>
                          <p className="text-sm text-zinc-500">
                            Reporter: {r.reporter_name ?? "Anonymous"} ({r.reporter_email ?? "-"})
                          </p>
                          <p className="mt-1 font-medium text-zinc-900">{r.report_type}</p>
                          <p className="text-zinc-700 mt-1">{r.description}</p>
                          <p className="text-xs text-zinc-400 mt-2">{formatDate(r.created_at)}</p>
                        </div>
                        {r.status === "pending" && (
                          <div className="flex flex-col gap-2 flex-shrink-0 min-w-[200px]">
                            <textarea
                              rows={2}
                              placeholder="Resolution notes (optional)"
                              value={resolutionNotes[r.id] ?? ""}
                              onChange={(e) => setResolutionNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                              className="border border-zinc-300 rounded px-2 py-1 text-sm text-zinc-900 resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleReviewReport(r.id, "resolved")}
                                disabled={actioning === r.id}
                                className="px-3 py-1.5 text-sm bg-zinc-900 text-white rounded hover:bg-zinc-800 disabled:opacity-50"
                              >
                                Resolve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReviewReport(r.id, "dismissed")}
                                disabled={actioning === r.id}
                                className="px-3 py-1.5 text-sm border border-zinc-300 text-zinc-700 rounded hover:bg-zinc-50 disabled:opacity-50"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "users" && (
            <>
              <div className="mb-4 flex flex-wrap gap-4 items-center">
                <div className="flex gap-2 items-center">
                  <label className="text-sm font-medium text-zinc-700">Search</label>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Name or email..."
                    className="border border-zinc-300 rounded px-3 py-1.5 text-zinc-900 w-48"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-sm font-medium text-zinc-700">Filter</label>
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value as "all" | "banned" | "pending_review")}
                    className="border border-zinc-300 rounded px-3 py-1.5 text-zinc-900"
                  >
                    <option value="all">All users</option>
                    <option value="pending_review">Pending review</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                {users.length === 0 ? (
                  <p className="p-6 text-zinc-600">No users match the filter.</p>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="px-4 py-3 text-sm font-medium text-zinc-900">Name</th>
                        <th className="px-4 py-3 text-sm font-medium text-zinc-900">Email</th>
                        <th className="px-4 py-3 text-sm font-medium text-zinc-900">Profile status</th>
                        <th className="px-4 py-3 text-sm font-medium text-zinc-900">Banned</th>
                        <th className="px-4 py-3 text-sm font-medium text-zinc-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td className="px-4 py-3 text-zinc-900">{u.name}</td>
                          <td className="px-4 py-3 text-zinc-600">{u.email}</td>
                          <td className="px-4 py-3 text-zinc-700">{u.profile_status ?? "incomplete"}</td>
                          <td className="px-4 py-3">{u.is_banned ? "Yes" : "No"}</td>
                          <td className="px-4 py-3 flex gap-2 flex-wrap">
                            {u.is_banned ? (
                              <button
                                type="button"
                                onClick={() => handleUnban(u.id)}
                                disabled={actioning === u.id}
                                className="text-sm text-zinc-600 hover:underline disabled:opacity-50"
                              >
                                Unban
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleBan(u.id)}
                                disabled={actioning === u.id}
                                className="text-sm text-red-600 hover:underline disabled:opacity-50"
                              >
                                Ban
                              </button>
                            )}
                            {u.profile_status === "pending_review" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApprove(u.id)}
                                  disabled={actioning === u.id}
                                  className="text-sm text-green-600 hover:underline disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReject(u.id)}
                                  disabled={actioning === u.id}
                                  className="text-sm text-zinc-600 hover:underline disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {!u.is_banned && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={actioning === u.id}
                                className="text-sm text-amber-600 hover:underline disabled:opacity-50"
                              >
                                Deactivate
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {tab === "organizations" && (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              {organizations.length === 0 ? (
                <p className="p-6 text-zinc-600">No organizations.</p>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-3 text-sm font-medium text-zinc-900">Name</th>
                      <th className="px-4 py-3 text-sm font-medium text-zinc-900">Slug</th>
                      <th className="px-4 py-3 text-sm font-medium text-zinc-900">Verified</th>
                      <th className="px-4 py-3 text-sm font-medium text-zinc-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {organizations.map((o) => (
                      <tr key={o.id}>
                        <td className="px-4 py-3 text-zinc-900">{o.name}</td>
                        <td className="px-4 py-3 text-zinc-600">{o.slug}</td>
                        <td className="px-4 py-3">{o.is_verified ? "Yes" : "No"}</td>
                        <td className="px-4 py-3 flex gap-2 flex-wrap">
                          {!o.is_verified && (
                            <button
                              type="button"
                              onClick={() => handleVerifyOrg(o.id)}
                              disabled={actioning === o.id}
                              className="text-sm text-green-600 hover:underline disabled:opacity-50"
                            >
                              Verify
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const name = prompt("Edit organization name", o.name)
                              if (name != null && name.trim()) handleUpdateOrg(o.id, { name: name.trim() })
                            }}
                            disabled={actioning === o.id}
                            className="text-sm text-zinc-600 hover:underline disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOrg(o.id)}
                            disabled={actioning === o.id}
                            className="text-sm text-amber-600 hover:underline disabled:opacity-50"
                          >
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "analytics" && (
            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              {analytics ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-sm text-zinc-500">Intro requested (30d)</p><p className="text-xl font-semibold">{analytics.intro_requested_count}</p></div>
                    <div><p className="text-sm text-zinc-500">Intro accepted (30d)</p><p className="text-xl font-semibold">{analytics.intro_accepted_count}</p></div>
                    <div><p className="text-sm text-zinc-500">Acceptance rate</p><p className="text-xl font-semibold">{(analytics.intro_acceptance_rate ?? 0).toFixed(1)}%</p></div>
                    <div><p className="text-sm text-zinc-500">Messages (30d)</p><p className="text-xl font-semibold">{analytics.messages_count}</p></div>
                    <div><p className="text-sm text-zinc-500">Resource saves (30d)</p><p className="text-xl font-semibold">{analytics.resource_saves_count}</p></div>
                    <div><p className="text-sm text-zinc-500">Event RSVPs (30d)</p><p className="text-xl font-semibold">{analytics.event_rsvps_count}</p></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-medium text-zinc-900 mb-2">Signups by day (last 30)</h3>
                      <div className="overflow-x-auto max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead><tr><th className="text-left py-1">Day</th><th className="text-right">Count</th></tr></thead>
                          <tbody>
                            {(analytics.signups_by_day ?? []).slice(-30).map((r) => (
                              <tr key={r.day}><td className="py-0.5">{r.day}</td><td className="text-right">{r.count}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium text-zinc-900 mb-2">Matches by day (last 30)</h3>
                      <div className="overflow-x-auto max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead><tr><th className="text-left py-1">Day</th><th className="text-right">Count</th></tr></thead>
                          <tbody>
                            {(analytics.matches_by_day ?? []).slice(-30).map((r) => (
                              <tr key={r.day}><td className="py-0.5">{r.day}</td><td className="text-right">{r.count}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-zinc-600">Loading analytics...</p>
              )}
            </div>
          )}

          {tab === "resources" && (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              {resources.length === 0 ? (
                <p className="p-6 text-zinc-600">No resources.</p>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-3 text-sm font-medium text-zinc-900">Title</th>
                      <th className="px-4 py-3 text-sm font-medium text-zinc-900">Category</th>
                      <th className="px-4 py-3 text-sm font-medium text-zinc-900">Featured</th>
                      <th className="px-4 py-3 text-sm font-medium text-zinc-900">Active</th>
                      <th className="px-4 py-3 text-sm font-medium text-zinc-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {resources.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 text-zinc-900">{r.title}</td>
                        <td className="px-4 py-3 text-zinc-600">{r.category}</td>
                        <td className="px-4 py-3">{r.is_featured ? "Yes" : "No"}</td>
                        <td className="px-4 py-3">{r.is_active ? "Yes" : "No"}</td>
                        <td className="px-4 py-3 flex gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleToggleResourceFeature(r.id, !r.is_featured)}
                            disabled={actioning === r.id}
                            className="text-sm text-zinc-600 hover:underline disabled:opacity-50"
                          >
                            {r.is_featured ? "Unfeature" : "Feature"}
                          </button>
                          {r.is_active && (
                            <button
                              type="button"
                              onClick={() => handleDeactivateResource(r.id)}
                              disabled={actioning === r.id}
                              className="text-sm text-amber-600 hover:underline disabled:opacity-50"
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "events" && (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              {events.length === 0 ? (
                <p className="p-6 text-zinc-600">No events.</p>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-3 text-sm font-medium text-zinc-900">Title</th>
                      <th className="px-4 py-3 text-sm font-medium text-zinc-900">Type</th>
                      <th className="px-4 py-3 text-sm font-medium text-zinc-900">Start</th>
                      <th className="px-4 py-3 text-sm font-medium text-zinc-900">Featured</th>
                      <th className="px-4 py-3 text-sm font-medium text-zinc-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {events.map((e) => (
                      <tr key={e.id}>
                        <td className="px-4 py-3 text-zinc-900">{e.title}</td>
                        <td className="px-4 py-3 text-zinc-600">{e.event_type ?? "-"}</td>
                        <td className="px-4 py-3 text-zinc-600">{e.start_datetime ? new Date(e.start_datetime).toLocaleString() : "-"}</td>
                        <td className="px-4 py-3">{e.is_featured ? "Yes" : "No"}</td>
                        <td className="px-4 py-3 flex gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleToggleEventFeature(e.id, !e.is_featured)}
                            disabled={actioning === e.id}
                            className="text-sm text-zinc-600 hover:underline disabled:opacity-50"
                          >
                            {e.is_featured ? "Unfeature" : "Feature"}
                          </button>
                          {e.is_active && (
                            <button
                              type="button"
                              onClick={() => handleDeactivateEvent(e.id)}
                              disabled={actioning === e.id}
                              className="text-sm text-amber-600 hover:underline disabled:opacity-50"
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "audit" && (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              {auditLog.length === 0 ? (
                <p className="p-6 text-zinc-600">No audit entries.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-3 font-medium text-zinc-900">Time</th>
                      <th className="px-4 py-3 font-medium text-zinc-900">Admin</th>
                      <th className="px-4 py-3 font-medium text-zinc-900">Action</th>
                      <th className="px-4 py-3 font-medium text-zinc-900">Target</th>
                      <th className="px-4 py-3 font-medium text-zinc-900">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {auditLog.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-2 text-zinc-600">{entry.created_at ?? "-"}</td>
                        <td className="px-4 py-2 text-zinc-900">{entry.admin_name ?? entry.admin_id ?? "-"}</td>
                        <td className="px-4 py-2 text-zinc-900">{entry.action}</td>
                        <td className="px-4 py-2 text-zinc-600">{entry.target_type ?? "-"} {entry.target_id ?? ""}</td>
                        <td className="px-4 py-2 text-zinc-500">{entry.details ? JSON.stringify(entry.details) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
