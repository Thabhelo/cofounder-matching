import type { User, UserPublic, ProfileDiscoverItem, Organization, Resource, Event, ReportListItem, AuditLogEntry, UserSettings, UserSettingsUpdate } from "./types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type RequestOptions = RequestInit & {
  token?: string
}

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = "APIError"
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  })

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`
    try {
      const error = await response.json()
      
      // FastAPI returns validation errors as an array in detail field
      if (Array.isArray(error.detail)) {
        // Format validation errors: extract messages from each error object
        const messages = error.detail.map((err: any) => {
          const field = err.loc?.slice(-1)[0] || "field"
          const msg = err.msg || "Invalid value"
          return `${field}: ${msg}`
        })
        errorMessage = messages.join(". ") || errorMessage
      } else if (typeof error.detail === "string") {
        // Simple string error
        errorMessage = error.detail
      } else if (error.message) {
        errorMessage = error.message
      } else if (error.detail) {
        // If detail exists but isn't string/array, try to stringify it
        errorMessage = JSON.stringify(error.detail)
      }
    } catch {
      // If response is not JSON, try to get text
      try {
        const text = await response.text()
        if (text) errorMessage = text
      } catch {
        // Fallback to status code
      }
    }
    throw new APIError(response.status, errorMessage)
  }

  if (response.status === 204) {
    return null as T
  }

  return response.json()
}

export const api = {
  users: {
    acceptBehaviorAgreement: (token: string) =>
      request<User>("/api/v1/users/accept-behavior-agreement", {
        method: "POST",
        token,
      }),

    onboarding: (data: unknown, token: string) =>
      request<User>("/api/v1/users/onboarding", {
        method: "POST",
        body: JSON.stringify(data),
        token,
      }),

    getMe: (token: string) =>
      request<User>("/api/v1/users/me", { token }),

    updateMe: (data: Partial<User>, token: string) =>
      request<User>("/api/v1/users/me", {
        method: "PUT",
        body: JSON.stringify(data),
        token,
      }),

    getById: (userId: string) =>
      request<UserPublic>(`/api/v1/users/${userId}`),

    getSettings: (token: string) =>
      request<{ settings: UserSettings }>("/api/v1/users/me/settings", { token }),

    updateSettings: (data: Partial<UserSettingsUpdate>, token: string) =>
      request<{ settings: UserSettings }>("/api/v1/users/me/settings", {
        method: "PUT",
        body: JSON.stringify(data),
        token,
      }),

    exportData: (token: string) =>
      request<Record<string, unknown>>("/api/v1/users/me/export", {
        method: "POST",
        token,
      }),

    deleteAccount: (token: string) =>
      request<null>("/api/v1/users/me", {
        method: "DELETE",
        token,
      }),

    search: (params?: {
      idea_status?: string
      location?: string
      commitment?: string
      skip?: number
      limit?: number
    }) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<UserPublic[]>(`/api/v1/users?${queryParams}`)
    },
  },

  organizations: {
    list: (params?: {
      org_type?: string
      verified_only?: boolean
      location?: string
      skip?: number
      limit?: number
    }) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<Organization[]>(`/api/v1/organizations?${queryParams}`)
    },

    getByIdOrSlug: (idOrSlug: string) =>
      request<Organization>(`/api/v1/organizations/${idOrSlug}`),

    create: (data: Partial<Organization>, token: string) =>
      request<Organization>("/api/v1/organizations", {
        method: "POST",
        body: JSON.stringify(data),
        token,
      }),

    update: (id: string, data: Partial<Organization>, token: string) =>
      request<Organization>(`/api/v1/organizations/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        token,
      }),
  },

  resources: {
    list: (params?: {
      category?: string
      resource_type?: string
      stage?: string
      featured_only?: boolean
      skip?: number
      limit?: number
    }) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<Resource[]>(`/api/v1/resources?${queryParams}`)
    },

    getById: (resourceId: string) =>
      request<Resource>(`/api/v1/resources/${resourceId}`),

    create: (data: Partial<Resource>, organizationId: string | undefined, token: string) => {
      const queryParams = organizationId ? `?organization_id=${organizationId}` : ""
      return request<Resource>(`/api/v1/resources${queryParams}`, {
        method: "POST",
        body: JSON.stringify(data),
        token,
      })
    },

    update: (id: string, data: Partial<Resource>, token: string) =>
      request<Resource>(`/api/v1/resources/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        token,
      }),

    delete: (id: string, token: string) =>
      request<void>(`/api/v1/resources/${id}`, {
        method: "DELETE",
        token,
      }),
  },

  events: {
    list: (params?: {
      event_type?: string
      location_type?: string
      upcoming_only?: boolean
      featured_only?: boolean
      skip?: number
      limit?: number
    }) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<Event[]>(`/api/v1/events?${queryParams}`)
    },

    getById: (eventId: string) =>
      request<Event>(`/api/v1/events/${eventId}`),

    create: (data: Partial<Event>, organizationId: string | undefined, token: string) => {
      const queryParams = organizationId ? `?organization_id=${organizationId}` : ""
      return request<Event>(`/api/v1/events${queryParams}`, {
        method: "POST",
        body: JSON.stringify(data),
        token,
      })
    },

    update: (id: string, data: Partial<Event>, token: string) =>
      request<Event>(`/api/v1/events/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        token,
      }),

    rsvp: (eventId: string, rsvpStatus: string, token: string) =>
      request<{ message: string; event_id: string; rsvp_status: string; current_attendees: number }>(
        `/api/v1/events/${eventId}/rsvp`,
        {
          method: "POST",
          body: JSON.stringify({ rsvp_status: rsvpStatus }),
          token,
        }
      ),

    delete: (id: string, token: string) =>
      request<void>(`/api/v1/events/${id}`, {
        method: "DELETE",
        token,
      }),
  },

  profiles: {
    discover: (params?: { skip?: number; limit?: number }, token?: string) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<ProfileDiscoverItem[]>(`/api/v1/profiles/discover?${queryParams}`, { token })
    },

    getCounts: (token: string) =>
      request<{ discover_count: number; saved_count: number; matches_count: number }>(
        "/api/v1/profiles/count",
        { token }
      ),

    save: (profileId: string, token: string) =>
      request<{ message: string; match_id: string }>(`/api/v1/profiles/${profileId}/save`, {
        method: "POST",
        token,
      }),

    skip: (profileId: string, token: string) =>
      request<{ message: string; match_id: string }>(`/api/v1/profiles/${profileId}/skip`, {
        method: "POST",
        token,
      }),

    unsave: (profileId: string, token: string) =>
      request<{ message: string; profile_id: string }>(`/api/v1/profiles/${profileId}/save`, {
        method: "DELETE",
        token,
      }),

    unskip: (profileId: string, token: string) =>
      request<{ message: string; profile_id: string }>(`/api/v1/profiles/${profileId}/skip`, {
        method: "DELETE",
        token,
      }),

    getSaved: (params?: { skip?: number; limit?: number }, token?: string) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<UserPublic[]>(`/api/v1/profiles/saved?${queryParams}`, { token })
    },

    getSkipped: (params?: { skip?: number; limit?: number }, token?: string) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<UserPublic[]>(`/api/v1/profiles/skipped?${queryParams}`, { token })
    },
  },

  matches: {
    sendInvite: (profileId: string, message: string, token: string) =>
      request<{ message: string; match_id: string; invites_remaining: number; auto_connected?: boolean }>(
        `/api/v1/matches/invite/${profileId}`,
        {
          method: "POST",
          body: JSON.stringify({ message }),
          token,
        }
      ),

    getAll: (token: string, params?: { status_filter?: string; skip?: number; limit?: number }) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<any[]>(`/api/v1/matches?${queryParams}`, { token })
    },

    respondToInvite: (matchId: string, accept: boolean, message: string, token: string) =>
      request<{ message: string; match_id: string; accepted: boolean; status: string }>(
        `/api/v1/matches/${matchId}/intro/respond`,
        {
          method: "POST",
          body: JSON.stringify({ accept, message }),
          token,
        }
      ),

    unmatch: (matchId: string, token: string) =>
      request<{ message: string; match_id: string }>(`/api/v1/matches/${matchId}/unmatch`, {
        method: "POST",
        token,
      }),
  },

  messages: {
    getConversations: (token: string, params?: { skip?: number; limit?: number }) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<any[]>(`/api/v1/messages?${queryParams}`, { token })
    },

    getMessages: (matchId: string, token: string, params?: { skip?: number; limit?: number }) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<any[]>(`/api/v1/messages/${matchId}?${queryParams}`, { token })
    },

    send: (matchId: string, content: string, token: string) =>
      request<any>("/api/v1/messages", {
        method: "POST",
        body: JSON.stringify({ match_id: matchId, content }),
        token,
      }),

    markRead: (messageId: string, token: string) =>
      request<any>(`/api/v1/messages/${messageId}/read`, {
        method: "PUT",
        token,
      }),
  },

  reports: {
    create: (reportedUserId: string, reportType: string, description: string, token: string) =>
      request<ReportListItem>("/api/v1/reports", {
        method: "POST",
        body: JSON.stringify({ reported_user_id: reportedUserId, report_type: reportType, description }),
        token,
      }),
  },

  admin: {
    check: (token: string) =>
      request<{ is_admin: boolean; hint?: string }>("/api/v1/admin/check", { token }),

    getStats: (token: string) =>
      request<{
        users_total: number
        users_banned: number
        users_pending_review: number
        reports_pending: number
        reports_total: number
        organizations_total: number
        matches_total: number
        messages_total: number
        users_last_7_days: number
        users_last_30_days: number
        matches_last_7_days: number
      }>("/api/v1/admin/stats", { token }),

    getAnalytics: (token: string, days?: number) =>
      request<{
        signups_by_day: { day: string; count: number }[]
        matches_by_day: { day: string; count: number }[]
        intro_requested_count: number
        intro_accepted_count: number
        intro_acceptance_rate: number
        messages_count: number
        resource_saves_count: number
        event_rsvps_count: number
        organizations_with_activity_count: number
      }>("/api/v1/admin/analytics" + (days != null ? `?days=${days}` : ""), { token }),

    getReports: (token: string, params?: { status_filter?: string; sort_by?: string; sort_order?: string; skip?: number; limit?: number }) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<ReportListItem[]>(`/api/v1/admin/reports?${queryParams}`, { token })
    },

    reviewReport: (reportId: string, status: string, resolutionNotes: string | null, token: string) =>
      request<ReportListItem>(`/api/v1/admin/reports/${reportId}`, {
        method: "PUT",
        body: JSON.stringify({ status, resolution_notes: resolutionNotes }),
        token,
      }),

    getUsers: (token: string, params?: { q?: string; profile_status?: string; is_banned?: boolean; skip?: number; limit?: number }) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<User[]>(`/api/v1/admin/users?${queryParams}`, { token })
    },

    getUser: (userId: string, token: string) =>
      request<User>(`/api/v1/admin/users/${userId}`, { token }),

    updateUser: (userId: string, data: Partial<User> & { profile_status?: string; is_active?: boolean }, token: string) =>
      request<User>(`/api/v1/admin/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(data),
        token,
      }),

    deleteUser: (userId: string, token: string) =>
      request<{ message: string; user_id: string }>(`/api/v1/admin/users/${userId}`, {
        method: "DELETE",
        token,
      }),

    banUser: (userId: string, token: string) =>
      request<{ message: string; user_id: string }>(`/api/v1/admin/users/${userId}/ban`, {
        method: "PUT",
        token,
      }),

    unbanUser: (userId: string, token: string) =>
      request<{ message: string; user_id: string }>(`/api/v1/admin/users/${userId}/unban`, {
        method: "PUT",
        token,
      }),

    reactivateUser: (userId: string, token: string) =>
      request<{ message: string; user_id: string }>(`/api/v1/admin/users/${userId}/reactivate`, {
        method: "PUT",
        token,
      }),

    approveUser: (userId: string, token: string) =>
      request<{ message: string; user_id: string }>(`/api/v1/admin/users/${userId}/approve`, {
        method: "PUT",
        token,
      }),

    rejectUser: (userId: string, token: string) =>
      request<{ message: string; user_id: string }>(`/api/v1/admin/users/${userId}/reject`, {
        method: "PUT",
        token,
      }),

    getOrganizations: (token: string, params?: { verified?: boolean; skip?: number; limit?: number }) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<Organization[]>(`/api/v1/admin/organizations?${queryParams}`, { token })
    },

    verifyOrganization: (orgId: string, token: string) =>
      request<{ message: string; org_id: string }>(`/api/v1/admin/organizations/${orgId}/verify`, {
        method: "PUT",
        token,
      }),

    updateOrganization: (orgId: string, data: Partial<Organization>, token: string) =>
      request<Organization>(`/api/v1/admin/organizations/${orgId}`, {
        method: "PUT",
        body: JSON.stringify(data),
        token,
      }),

    deleteOrganization: (orgId: string, token: string) =>
      request<{ message: string; org_id: string }>(`/api/v1/admin/organizations/${orgId}`, {
        method: "DELETE",
        token,
      }),

    getResources: (token: string, params?: { featured_only?: boolean; is_active?: boolean; skip?: number; limit?: number }) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<Resource[]>(`/api/v1/admin/resources?${queryParams}`, { token })
    },

    updateResource: (resourceId: string, data: Partial<Resource> & { is_featured?: boolean; is_active?: boolean }, token: string) =>
      request<Resource>(`/api/v1/admin/resources/${resourceId}`, {
        method: "PUT",
        body: JSON.stringify(data),
        token,
      }),

    deactivateResource: (resourceId: string, token: string) =>
      request<{ message: string; resource_id: string }>(`/api/v1/admin/resources/${resourceId}`, {
        method: "DELETE",
        token,
      }),

    getEvents: (token: string, params?: { featured_only?: boolean; is_active?: boolean; skip?: number; limit?: number }) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<Event[]>(`/api/v1/admin/events?${queryParams}`, { token })
    },

    updateEvent: (eventId: string, data: Partial<Event> & { is_featured?: boolean; is_active?: boolean }, token: string) =>
      request<Event>(`/api/v1/admin/events/${eventId}`, {
        method: "PUT",
        body: JSON.stringify(data),
        token,
      }),

    deactivateEvent: (eventId: string, token: string) =>
      request<{ message: string; event_id: string }>(`/api/v1/admin/events/${eventId}`, {
        method: "DELETE",
        token,
      }),

    getAuditLog: (token: string, params?: { action?: string; target_type?: string; skip?: number; limit?: number }) => {
      const queryParams = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
      return request<AuditLogEntry[]>(`/api/v1/admin/audit-log?${queryParams}`, { token })
    },

    getNotificationsConfig: (token: string) =>
      request<{
        email_service_configured: boolean
        resend_key_set: boolean
        email_from_set: boolean
        frontend_url: string
        feature_flags: Record<string, boolean>
        flag_labels: Record<string, string>
      }>("/api/v1/admin/notifications/config", { token }),

    updateNotificationsConfig: (
      flags: Record<string, boolean>,
      token: string,
    ) =>
      request<{ updated: Record<string, boolean>; feature_flags: Record<string, boolean> }>(
        "/api/v1/admin/notifications/config",
        {
          method: "PATCH",
          body: JSON.stringify({ feature_flags: flags }),
          token,
        },
      ),

    triggerProfileReminders: (token: string) =>
      request<{ users_notified: number; status: string }>(
        "/api/v1/admin/notifications/trigger/profile-reminders",
        { method: "POST", token },
      ),

    triggerEventReminders: (token: string) =>
      request<{ rsvps_notified: number; status: string }>(
        "/api/v1/admin/notifications/trigger/event-reminders",
        { method: "POST", token },
      ),
  },
}

export { APIError }
