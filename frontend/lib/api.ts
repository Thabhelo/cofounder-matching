import type { User, UserPublic, Organization, Resource, Event } from "./types"

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

    search: (params?: {
      role_intent?: string
      stage_preference?: string
      location?: string
      availability_status?: string
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
      return request<UserPublic[]>(`/api/v1/profiles/discover?${queryParams}`, { token })
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
}

export { APIError }
