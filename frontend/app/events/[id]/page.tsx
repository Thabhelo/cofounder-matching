"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import Link from "next/link"
import { api } from "@/lib/api"
import type { Event, RSVPStatus } from "@/lib/types"
import { formatDateTime } from "@/lib/utils"

export default function EventDetailPage() {
  const params = useParams()
  const { getToken, isSignedIn } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [rsvpLoading, setRsvpLoading] = useState(false)

  useEffect(() => {
    async function loadEvent() {
      try {
        const data = await api.events.getById(params.id as string)
        setEvent(data)
      } catch (error) {
        console.error("Failed to load event:", error)
      } finally {
        setLoading(false)
      }
    }

    loadEvent()
  }, [params.id])

  const handleRSVP = async (status: RSVPStatus) => {
    if (!isSignedIn) {
      alert("Please sign in to RSVP to events")
      return
    }

    setRsvpLoading(true)
    try {
      const token = await getToken()
      if (!token) return

      const result = await api.events.rsvp(params.id as string, status, token)
      setEvent(prev => prev ? { ...prev, current_attendees: result.current_attendees } : null)
      alert(`Successfully RSVP'd as ${status}`)
    } catch (error) {
      console.error("Failed to RSVP:", error)
      alert("Failed to RSVP. Please try again.")
    } finally {
      setRsvpLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Event not found</h2>
          <Link href="/events" className="text-blue-600 hover:underline">
            Back to Events
          </Link>
        </div>
      </div>
    )
  }

  const isAtCapacity = event.max_attendees ? event.current_attendees >= event.max_attendees : false

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/dashboard" className="text-2xl font-bold text-blue-600">
            CoFounder Match
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/events" className="text-blue-600 hover:underline mb-6 inline-block">
          ← Back to Events
        </Link>

        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              {event.event_type && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded">
                  {event.event_type}
                </span>
              )}
              {event.location_type && (
                <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded">
                  {event.location_type.replace("_", " ")}
                </span>
              )}
              {event.is_featured && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded">
                  Featured
                </span>
              )}
              {isAtCapacity && (
                <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded">
                  Full
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-4">{event.title}</h1>
            <p className="text-gray-700 text-lg leading-relaxed">{event.description}</p>
          </div>

          <div className="border-t pt-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Date & Time</h3>
              <p className="text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDateTime(event.start_datetime)}
                {event.end_datetime && ` - ${formatDateTime(event.end_datetime)}`}
              </p>
              <p className="text-sm text-gray-600 mt-1">Timezone: {event.timezone}</p>
            </div>

            {event.location_address && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Location</h3>
                <p className="text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  {event.location_address}
                </p>
              </div>
            )}

            {event.location_url && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Virtual Link</h3>
                <a
                  href={event.location_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {event.location_url}
                </a>
              </div>
            )}

            {event.max_attendees && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Attendance</h3>
                <p className="text-gray-900">
                  {event.current_attendees} / {event.max_attendees} attendees
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min((event.current_attendees / event.max_attendees) * 100, 100)}%`
                    }}
                  />
                </div>
              </div>
            )}

            {event.tags && event.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag, idx) => (
                    <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t pt-6 mt-6">
            {isSignedIn ? (
              <div className="flex gap-3">
                <button
                  onClick={() => handleRSVP("going")}
                  disabled={rsvpLoading || isAtCapacity}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {rsvpLoading ? "Loading..." : "I'm Going"}
                </button>
                <button
                  onClick={() => handleRSVP("maybe")}
                  disabled={rsvpLoading}
                  className="flex-1 px-6 py-3 border-2 border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Maybe
                </button>
              </div>
            ) : (
              <Link
                href="/onboarding"
                className="block text-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
              >
                Sign in to RSVP
              </Link>
            )}

            {event.registration_url && (
              <a
                href={event.registration_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center mt-3 px-6 py-3 border border-gray-300 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                External Registration →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
