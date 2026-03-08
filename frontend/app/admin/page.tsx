"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AppShell } from "@/components/layout/AppShell"
import { api } from "@/lib/api"
import type { ReportListItem, User, Organization, Resource, Event, AuditLogEntry } from "@/lib/types"

type AdminTab = "overview" | "reports" | "users" | "organizations" | "analytics" | "resources" | "events" | "audit" | "notifications"

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
  const [notifConfig, setNotifConfig] = useState<{
    email_service_configured: boolean
    resend_key_set: boolean
    email_from_set: boolean
    frontend_url: string
    feature_flags: Record<string, boolean>
    flag_labels: Record<string, string>
  } | null>(null)
  const [notifLoading, setNotifLoading] = useState(false)
  const [triggerResult, setTriggerResult] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({})

  // Create event form
  const [createEventForm, setCreateEventForm] = useState({
    title: "",
    description: "",
    event_type: "",
    start_datetime: "",
    end_datetime: "",
    timezone: "America/Chicago",
    location_type: "",
    location_address: "",
    location_url: "",
    registration_url: "",
    is_featured: false,
  })
  const [createEventNotify, setCreateEventNotify] = useState(false)
  const [createEventLoading, setCreateEventLoading] = useState(false)
  const [createEventError, setCreateEventError] = useState<string | null>(null)

  // Create resource form
  const [createResourceForm, setCreateResourceForm] = useState({
    title: "",
    description: "",
    category: "",
    resource_type: "",
    application_url: "",
    is_featured: false,
  })
  const [createResourceLoading, setCreateResourceLoading] = useState(false)
  const [createResourceError, setCreateResourceError] = useState<string | null>(null)

  // Create organization form
  const [createOrgForm, setCreateOrgForm] = useState({
    name: "",
    description: "",
    org_type: "",
    website_url: "",
    location: "",
  })
  const [createOrgLoading, setCreateOrgLoading] = useState(false)
  const [createOrgError, setCreateOrgError] = useState<string | null>(null)

  // Broadcast email form
  const [broadcastForm, setBroadcastForm] = useState({ subject: "", message: "" })
  const [broadcastLoading, setBroadcastLoading] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null)

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

  useEffect(() => {
    if (!isAdmin || tab !== "notifications") return
    getToken().then((token) => {
      if (!token) return
      api.admin.getNotificationsConfig(token).then(setNotifConfig).catch(() => {})
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

  const handleReactivateUser = async (userId: string) => {
    if (!confirm("Reactivate this user? They will regain access to the platform.")) return
    const token = await getToken()
    if (!token) return
    setActioning(userId)
    try {
      await api.admin.reactivateUser(userId, token)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: true } : u)))
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to reactivate user")
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

  const handleToggleFlag = async (flagName: string, currentValue: boolean) => {
    const token = await getToken()
    if (!token) return
    setNotifLoading(true)
    try {
      const result = await api.admin.updateNotificationsConfig({ [flagName]: !currentValue }, token)
      setNotifConfig((prev) => prev ? { ...prev, feature_flags: result.feature_flags } : prev)
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update flag")
    } finally {
      setNotifLoading(false)
    }
  }

  const handleTriggerProfileReminders = async () => {
    const token = await getToken()
    if (!token) return
    setNotifLoading(true)
    setTriggerResult((prev) => ({ ...prev, profile: "Running..." }))
    try {
      const result = await api.admin.triggerProfileReminders(token)
      setTriggerResult((prev) => ({ ...prev, profile: `Done - ${result.users_notified} user(s) notified` }))
    } catch (e) {
      setTriggerResult((prev) => ({ ...prev, profile: e instanceof Error ? e.message : "Error" }))
    } finally {
      setNotifLoading(false)
    }
  }

  const handleTriggerEventReminders = async () => {
    const token = await getToken()
    if (!token) return
    setNotifLoading(true)
    setTriggerResult((prev) => ({ ...prev, event: "Running..." }))
    try {
      const result = await api.admin.triggerEventReminders(token)
      setTriggerResult((prev) => ({ ...prev, event: `Done - ${result.rsvps_notified} RSVP(s) notified` }))
    } catch (e) {
      setTriggerResult((prev) => ({ ...prev, event: e instanceof Error ? e.message : "Error" }))
    } finally {
      setNotifLoading(false)
    }
  }

  const handleMakeAdmin = async (userId: string) => {
    if (!confirm("Grant admin access to this user?")) return
    const token = await getToken()
    if (!token) return
    try {
      setActioning(userId)
      await api.admin.makeAdmin(userId, token)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_admin: true } : u)))
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to grant admin")
    } finally {
      setActioning(null)
    }
  }

  const handleRemoveAdmin = async (userId: string) => {
    if (!confirm("Revoke admin access from this user?")) return
    const token = await getToken()
    if (!token) return
    try {
      setActioning(userId)
      await api.admin.removeAdmin(userId, token)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_admin: false } : u)))
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to revoke admin")
    } finally {
      setActioning(null)
    }
  }

  const handleBanFromReport = async (reportedUserId: string | null, reportId: string) => {
    if (!reportedUserId) return
    if (!confirm("Ban the reported user?")) return
    const token = await getToken()
    if (!token) return
    try {
      setActioning(reportId)
      await api.admin.banUser(reportedUserId, token)
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status: "resolved" as const } : r))
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to ban user")
    } finally {
      setActioning(null)
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = await getToken()
    if (!token) return
    setCreateEventLoading(true)
    setCreateEventError(null)
    try {
      const data: Record<string, unknown> = {
        title: createEventForm.title,
        description: createEventForm.description,
        start_datetime: createEventForm.start_datetime,
        timezone: createEventForm.timezone,
      }
      if (createEventForm.event_type) data.event_type = createEventForm.event_type
      if (createEventForm.end_datetime) data.end_datetime = createEventForm.end_datetime
      if (createEventForm.location_type) data.location_type = createEventForm.location_type
      if (createEventForm.location_address) data.location_address = createEventForm.location_address
      if (createEventForm.location_url) data.location_url = createEventForm.location_url
      if (createEventForm.registration_url) data.registration_url = createEventForm.registration_url
      data.is_featured = createEventForm.is_featured
      const created = await api.admin.createEvent(data, createEventNotify, token)
      setEvents((prev) => [created, ...prev])
      setCreateEventForm({
        title: "",
        description: "",
        event_type: "",
        start_datetime: "",
        end_datetime: "",
        timezone: "America/Chicago",
        location_type: "",
        location_address: "",
        location_url: "",
        registration_url: "",
        is_featured: false,
      })
      setCreateEventNotify(false)
    } catch (err) {
      setCreateEventError(err instanceof Error ? err.message : "Failed to create event")
    } finally {
      setCreateEventLoading(false)
    }
  }

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = await getToken()
    if (!token) return
    setCreateResourceLoading(true)
    setCreateResourceError(null)
    try {
      const data: Record<string, unknown> = {
        title: createResourceForm.title,
        description: createResourceForm.description,
        category: createResourceForm.category,
        is_featured: createResourceForm.is_featured,
      }
      if (createResourceForm.resource_type) data.resource_type = createResourceForm.resource_type
      if (createResourceForm.application_url) data.application_url = createResourceForm.application_url
      const created = await api.admin.createResource(data, token)
      setResources((prev) => [created, ...prev])
      setCreateResourceForm({ title: "", description: "", category: "", resource_type: "", application_url: "", is_featured: false })
    } catch (err) {
      setCreateResourceError(err instanceof Error ? err.message : "Failed to create resource")
    } finally {
      setCreateResourceLoading(false)
    }
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = await getToken()
    if (!token) return
    setCreateOrgLoading(true)
    setCreateOrgError(null)
    try {
      const data: Record<string, unknown> = { name: createOrgForm.name }
      if (createOrgForm.description) data.description = createOrgForm.description
      if (createOrgForm.org_type) data.org_type = createOrgForm.org_type
      if (createOrgForm.website_url) data.website_url = createOrgForm.website_url
      if (createOrgForm.location) data.location = createOrgForm.location
      const created = await api.admin.createOrganization(data, token)
      setOrganizations((prev) => [created, ...prev])
      setCreateOrgForm({ name: "", description: "", org_type: "", website_url: "", location: "" })
    } catch (err) {
      setCreateOrgError(err instanceof Error ? err.message : "Failed to create organization")
    } finally {
      setCreateOrgLoading(false)
    }
  }

  const handleBroadcastEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = await getToken()
    if (!token) return
    setBroadcastLoading(true)
    setBroadcastResult(null)
    try {
      const result = await api.admin.broadcastEmail(broadcastForm.subject, broadcastForm.message, token)
      setBroadcastResult(`Sent to ${result.recipients} user(s).`)
      setBroadcastForm({ subject: "", message: "" })
    } catch (err) {
      setBroadcastResult(err instanceof Error ? err.message : "Failed to send broadcast")
    } finally {
      setBroadcastLoading(false)
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
      <AppShell>
        <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
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
      </AppShell>
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
    { id: "notifications", label: "Notifications" },
  ]

  return (
    <AppShell>
      <main className="flex-1 p-4 md:p-8 overflow-auto">
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
                            <div className="flex gap-2 flex-wrap">
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
                              <button
                                type="button"
                                onClick={() => handleBanFromReport(r.reported_user_id, r.id)}
                                disabled={actioning === r.id || !r.reported_user_id}
                                className="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
                              >
                                Ban user
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
                        <th className="px-4 py-3 text-sm font-medium text-zinc-900">Active</th>
                        <th className="px-4 py-3 text-sm font-medium text-zinc-900">Admin</th>
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
                          <td className="px-4 py-3">{u.is_active ? "Yes" : "No"}</td>
                          <td className="px-4 py-3">{u.is_admin ? "Yes" : "No"}</td>
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
                            {u.is_admin ? (
                              <button
                                type="button"
                                onClick={() => handleRemoveAdmin(u.id)}
                                disabled={actioning === u.id}
                                className="text-sm text-red-600 hover:underline disabled:opacity-50"
                              >
                                Revoke Admin
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleMakeAdmin(u.id)}
                                disabled={actioning === u.id}
                                className="text-sm text-zinc-600 hover:underline disabled:opacity-50"
                              >
                                Grant Admin
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
                            {!u.is_active && (
                              <button
                                type="button"
                                onClick={() => handleReactivateUser(u.id)}
                                disabled={actioning === u.id}
                                className="text-sm text-green-600 hover:underline disabled:opacity-50"
                              >
                                Reactivate
                              </button>
                            )}
                            {u.is_active && !u.is_banned && (
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
            <div className="space-y-6">
              <div className="bg-white border border-zinc-200 rounded-lg p-6">
                <h2 className="text-lg font-medium text-zinc-900 mb-4">Create Organization</h2>
                <form onSubmit={handleCreateOrg} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={createOrgForm.name}
                        onChange={(e) => setCreateOrgForm((p) => ({ ...p, name: e.target.value }))}
                        required
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Type</label>
                      <select
                        value={createOrgForm.org_type}
                        onChange={(e) => setCreateOrgForm((p) => ({ ...p, org_type: e.target.value }))}
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      >
                        <option value="">Select type</option>
                        <option value="accelerator">Accelerator</option>
                        <option value="university">University</option>
                        <option value="nonprofit">Nonprofit</option>
                        <option value="coworking">Co-working</option>
                        <option value="government">Government</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Website URL</label>
                      <input
                        type="url"
                        value={createOrgForm.website_url}
                        onChange={(e) => setCreateOrgForm((p) => ({ ...p, website_url: e.target.value }))}
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Location</label>
                      <input
                        type="text"
                        value={createOrgForm.location}
                        onChange={(e) => setCreateOrgForm((p) => ({ ...p, location: e.target.value }))}
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={createOrgForm.description}
                      onChange={(e) => setCreateOrgForm((p) => ({ ...p, description: e.target.value }))}
                      className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm resize-none"
                    />
                  </div>
                  {createOrgError && <p className="text-sm text-red-600">{createOrgError}</p>}
                  <button
                    type="submit"
                    disabled={createOrgLoading}
                    className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {createOrgLoading ? "Creating..." : "Create Organization"}
                  </button>
                </form>
              </div>
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
            <div className="space-y-6">
              <div className="bg-white border border-zinc-200 rounded-lg p-6">
                <h2 className="text-lg font-medium text-zinc-900 mb-4">Create Resource</h2>
                <form onSubmit={handleCreateResource} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Title *</label>
                      <input
                        type="text"
                        value={createResourceForm.title}
                        onChange={(e) => setCreateResourceForm((p) => ({ ...p, title: e.target.value }))}
                        required
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Category *</label>
                      <select
                        value={createResourceForm.category}
                        onChange={(e) => setCreateResourceForm((p) => ({ ...p, category: e.target.value }))}
                        required
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      >
                        <option value="">Select category</option>
                        <option value="funding">Funding</option>
                        <option value="mentorship">Mentorship</option>
                        <option value="legal">Legal</option>
                        <option value="accounting">Accounting</option>
                        <option value="prototyping">Prototyping</option>
                        <option value="program">Program</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Resource type</label>
                      <input
                        type="text"
                        value={createResourceForm.resource_type}
                        onChange={(e) => setCreateResourceForm((p) => ({ ...p, resource_type: e.target.value }))}
                        placeholder="grant, loan, service, program, tool"
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Application URL</label>
                      <input
                        type="url"
                        value={createResourceForm.application_url}
                        onChange={(e) => setCreateResourceForm((p) => ({ ...p, application_url: e.target.value }))}
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Description *</label>
                    <textarea
                      rows={3}
                      value={createResourceForm.description}
                      onChange={(e) => setCreateResourceForm((p) => ({ ...p, description: e.target.value }))}
                      required
                      className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm resize-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={createResourceForm.is_featured}
                      onChange={(e) => setCreateResourceForm((p) => ({ ...p, is_featured: e.target.checked }))}
                    />
                    Featured
                  </label>
                  {createResourceError && <p className="text-sm text-red-600">{createResourceError}</p>}
                  <button
                    type="submit"
                    disabled={createResourceLoading}
                    className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {createResourceLoading ? "Creating..." : "Create Resource"}
                  </button>
                </form>
              </div>
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
            </div>
          )}

          {tab === "events" && (
            <div className="space-y-6">
              <div className="bg-white border border-zinc-200 rounded-lg p-6">
                <h2 className="text-lg font-medium text-zinc-900 mb-4">Create Event</h2>
                <form onSubmit={handleCreateEvent} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Title *</label>
                      <input
                        type="text"
                        value={createEventForm.title}
                        onChange={(e) => setCreateEventForm((p) => ({ ...p, title: e.target.value }))}
                        required
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Event type</label>
                      <select
                        value={createEventForm.event_type}
                        onChange={(e) => setCreateEventForm((p) => ({ ...p, event_type: e.target.value }))}
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      >
                        <option value="">Select type</option>
                        <option value="workshop">Workshop</option>
                        <option value="networking">Networking</option>
                        <option value="pitch">Pitch</option>
                        <option value="conference">Conference</option>
                        <option value="webinar">Webinar</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Start datetime *</label>
                      <input
                        type="datetime-local"
                        value={createEventForm.start_datetime}
                        onChange={(e) => setCreateEventForm((p) => ({ ...p, start_datetime: e.target.value }))}
                        required
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">End datetime</label>
                      <input
                        type="datetime-local"
                        value={createEventForm.end_datetime}
                        onChange={(e) => setCreateEventForm((p) => ({ ...p, end_datetime: e.target.value }))}
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Timezone</label>
                      <input
                        type="text"
                        value={createEventForm.timezone}
                        onChange={(e) => setCreateEventForm((p) => ({ ...p, timezone: e.target.value }))}
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Location type</label>
                      <select
                        value={createEventForm.location_type}
                        onChange={(e) => setCreateEventForm((p) => ({ ...p, location_type: e.target.value }))}
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      >
                        <option value="">Select type</option>
                        <option value="in_person">In person</option>
                        <option value="virtual">Virtual</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Location address</label>
                      <input
                        type="text"
                        value={createEventForm.location_address}
                        onChange={(e) => setCreateEventForm((p) => ({ ...p, location_address: e.target.value }))}
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Location URL</label>
                      <input
                        type="url"
                        value={createEventForm.location_url}
                        onChange={(e) => setCreateEventForm((p) => ({ ...p, location_url: e.target.value }))}
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Registration URL</label>
                      <input
                        type="url"
                        value={createEventForm.registration_url}
                        onChange={(e) => setCreateEventForm((p) => ({ ...p, registration_url: e.target.value }))}
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Description *</label>
                    <textarea
                      rows={3}
                      value={createEventForm.description}
                      onChange={(e) => setCreateEventForm((p) => ({ ...p, description: e.target.value }))}
                      required
                      className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm resize-none"
                    />
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={createEventForm.is_featured}
                        onChange={(e) => setCreateEventForm((p) => ({ ...p, is_featured: e.target.checked }))}
                      />
                      Featured
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={createEventNotify}
                        onChange={(e) => setCreateEventNotify(e.target.checked)}
                      />
                      Notify all users by email
                    </label>
                  </div>
                  {createEventError && <p className="text-sm text-red-600">{createEventError}</p>}
                  <button
                    type="submit"
                    disabled={createEventLoading}
                    className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {createEventLoading ? "Creating..." : "Create Event"}
                  </button>
                </form>
              </div>
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
          {tab === "notifications" && (
            <div className="space-y-6">
              {!notifConfig ? (
                <p className="text-zinc-500 text-sm">Loading notification configuration...</p>
              ) : (
                <>
                  <div className="bg-white border border-zinc-200 rounded-lg p-6">
                    <h2 className="text-lg font-medium text-zinc-900 mb-4">Email service status</h2>
                    <dl className="space-y-2 text-sm">
                      <div className="flex gap-3">
                        <dt className="text-zinc-500 w-48 shrink-0">Service configured</dt>
                        <dd className={notifConfig.email_service_configured ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
                          {notifConfig.email_service_configured ? "Yes" : "No - set RESEND_API_KEY and EMAIL_FROM in .env"}
                        </dd>
                      </div>
                      <div className="flex gap-3">
                        <dt className="text-zinc-500 w-48 shrink-0">RESEND_API_KEY</dt>
                        <dd className={notifConfig.resend_key_set ? "text-green-700" : "text-red-700"}>
                          {notifConfig.resend_key_set ? "Set" : "Not set"}
                        </dd>
                      </div>
                      <div className="flex gap-3">
                        <dt className="text-zinc-500 w-48 shrink-0">EMAIL_FROM</dt>
                        <dd className={notifConfig.email_from_set ? "text-green-700" : "text-red-700"}>
                          {notifConfig.email_from_set ? "Set" : "Not set"}
                        </dd>
                      </div>
                      <div className="flex gap-3">
                        <dt className="text-zinc-500 w-48 shrink-0">Frontend URL</dt>
                        <dd>
                          <span className="text-zinc-700 font-mono">{notifConfig.frontend_url}</span>
                          {notifConfig.frontend_url.includes("localhost") && (
                            <span className="ml-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                              Warning: localhost URL - unsubscribe links will not work in production emails. Set FRONTEND_URL in .env.
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-lg p-6">
                    <h2 className="text-lg font-medium text-zinc-900 mb-1">Feature flags</h2>
                    <p className="text-sm text-zinc-500 mb-4">These flags are in-memory and reset on server restart.</p>
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-zinc-700">Flag</th>
                          <th className="px-4 py-2 text-left font-medium text-zinc-700">Description</th>
                          <th className="px-4 py-2 text-left font-medium text-zinc-700">State</th>
                          <th className="px-4 py-2 text-left font-medium text-zinc-700">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {Object.entries(notifConfig.feature_flags).map(([name, enabled]) => (
                          <tr key={name}>
                            <td className="px-4 py-2 font-mono text-zinc-800">{name}</td>
                            <td className="px-4 py-2 text-zinc-600">{notifConfig.flag_labels[name] ?? "-"}</td>
                            <td className="px-4 py-2">
                              <span className={enabled ? "text-green-700 font-medium" : "text-zinc-400"}>
                                {enabled ? "Enabled" : "Disabled"}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                onClick={() => handleToggleFlag(name, enabled)}
                                disabled={notifLoading}
                                className={`text-sm hover:underline disabled:opacity-50 ${enabled ? "text-amber-600" : "text-green-600"}`}
                              >
                                {enabled ? "Disable" : "Enable"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-lg p-6">
                    <h2 className="text-lg font-medium text-zinc-900 mb-1">Scheduled jobs</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                      Jobs run automatically (profile reminders: Monday 9am, event reminders: daily 8am).
                      Use the buttons below to trigger them immediately.
                    </p>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={handleTriggerProfileReminders}
                          disabled={notifLoading}
                          className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                        >
                          Run profile reminder job now
                        </button>
                        {triggerResult.profile && (
                          <span className="text-sm text-zinc-600">{triggerResult.profile}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={handleTriggerEventReminders}
                          disabled={notifLoading}
                          className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                        >
                          Run event reminder job now
                        </button>
                        {triggerResult.event && (
                          <span className="text-sm text-zinc-600">{triggerResult.event}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-lg p-6">
                    <h2 className="text-lg font-medium text-zinc-900 mb-1">Broadcast email</h2>
                    <p className="text-sm text-zinc-500 mb-4">Send a custom email to all active, non-banned users.</p>
                    <form onSubmit={handleBroadcastEmail} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Subject *</label>
                        <input
                          type="text"
                          value={broadcastForm.subject}
                          onChange={(e) => setBroadcastForm((p) => ({ ...p, subject: e.target.value }))}
                          required
                          className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Message *</label>
                        <textarea
                          rows={4}
                          value={broadcastForm.message}
                          onChange={(e) => setBroadcastForm((p) => ({ ...p, message: e.target.value }))}
                          required
                          className="w-full border border-zinc-300 rounded px-3 py-2 text-zinc-900 text-sm resize-none"
                        />
                      </div>
                      {broadcastResult && (
                        <p className="text-sm text-zinc-700">{broadcastResult}</p>
                      )}
                      <button
                        type="submit"
                        disabled={broadcastLoading}
                        className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                      >
                        {broadcastLoading ? "Sending..." : "Send broadcast email"}
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  )
}
