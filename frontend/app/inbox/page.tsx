"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Sidebar } from "@/components/layout/Sidebar"
import { api } from "@/lib/api"

type Conversation = {
  match_id: string
  other_user: {
    id: string
    name: string
    avatar_url?: string
  }
  last_message?: {
    content: string
    created_at: string
    sender_id: string
  }
  unread_count: number
  updated_at: string
}

type Match = {
  id: string
  user_id: string
  target_user_id: string
  status: string
  intro_requested_at?: string
  intro_accepted_at?: string
  created_at: string
  target_user: {
    id: string
    name: string
    avatar_url?: string
    bio?: string
  }
}

export default function InboxPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [pendingInvites, setPendingInvites] = useState<Match[]>([])
  const [sentInvites, setSentInvites] = useState<Match[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [accepting, setAccepting] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const token = await getToken()
        if (!token) {
          router.push("/")
          return
        }

        const [currentUser, convData, matchesData] = await Promise.all([
          api.users.getMe(token),
          api.messages.getConversations(token),
          api.matches.getAll(token)
        ])

        setCurrentUserId(currentUser.id)
        setConversations(convData)

        // Separate matches into pending invites (received) and sent invites
        const pending: Match[] = []
        const sent: Match[] = []

        for (const match of matchesData) {
          if (match.status === "intro_requested") {
            // If I'm the target_user, it's a pending invite I received
            // If I'm the user, it's an invite I sent
            if (match.target_user_id === currentUser.id) {
              pending.push(match)
            } else if (match.user_id === currentUser.id) {
              sent.push(match)
            }
          }
        }

        setPendingInvites(pending)
        setSentInvites(sent)
      } catch (error) {
        console.error("Failed to load data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [getToken, router])

  if (loading) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  const handleAccept = async (matchId: string) => {
    try {
      const token = await getToken()
      if (!token) return

      setAccepting(matchId)
      await api.matches.respondToInvite(matchId, true, "", token)

      // Refresh data
      window.location.reload()
    } catch (error: any) {
      console.error("Failed to accept invite:", error)
      alert(error.message || "Failed to accept invitation. Please try again.")
    } finally {
      setAccepting(null)
    }
  }

  const hasAnyContent = conversations.length > 0 || pendingInvites.length > 0 || sentInvites.length > 0

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-semibold text-zinc-900 mb-6">Inbox</h1>

          {!hasAnyContent ? (
            <div className="bg-white border border-zinc-200 rounded-lg p-12 text-center">
              <svg
                className="w-16 h-16 text-zinc-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <h2 className="text-xl font-semibold text-zinc-900 mb-2">No conversations yet</h2>
              <p className="text-zinc-600 mb-6">
                When you connect with someone, your conversation will appear here.
              </p>
              <Link
                href="/discover"
                className="inline-block px-6 py-2 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Discover Profiles
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pending Invites Received */}
              {pendingInvites.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 mb-3">Pending Invites ({pendingInvites.length})</h2>
                  <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-200">
                    {pendingInvites.map((match) => (
                      <div key={match.id} className="flex items-center gap-4 p-4">
                        {match.target_user.avatar_url ? (
                          <Image
                            src={match.target_user.avatar_url}
                            alt={match.target_user.name}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-zinc-200 flex items-center justify-center">
                            <span className="text-lg font-semibold text-zinc-600">
                              {match.target_user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-zinc-900">{match.target_user.name}</h3>
                          <p className="text-sm text-zinc-600 truncate">
                            {match.target_user.bio || "Wants to connect with you"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Link
                            href={`/profile/${match.target_user.id}`}
                            className="px-4 py-2 border border-zinc-300 text-zinc-900 text-sm font-medium rounded-lg hover:bg-zinc-50 transition-colors"
                          >
                            View Profile
                          </Link>
                          <button
                            onClick={() => handleAccept(match.id)}
                            disabled={accepting === match.id}
                            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            {accepting === match.id ? "Accepting..." : "Accept"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sent Invites */}
              {sentInvites.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 mb-3">Sent Invites ({sentInvites.length})</h2>
                  <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-200">
                    {sentInvites.map((match) => (
                      <div key={match.id} className="flex items-center gap-4 p-4">
                        {match.target_user.avatar_url ? (
                          <Image
                            src={match.target_user.avatar_url}
                            alt={match.target_user.name}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-zinc-200 flex items-center justify-center">
                            <span className="text-lg font-semibold text-zinc-600">
                              {match.target_user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-zinc-900">{match.target_user.name}</h3>
                          <p className="text-sm text-zinc-500">Waiting for response...</p>
                        </div>
                        <span className="text-xs text-zinc-500">
                          {new Date(match.intro_requested_at!).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Conversations */}
              {conversations.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 mb-3">Conversations ({conversations.length})</h2>
                  <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-200">
                    {conversations.map((conv) => (
                      <Link
                        key={conv.match_id}
                        href={`/inbox/${conv.match_id}`}
                        className="flex items-center gap-4 p-4 hover:bg-zinc-50 transition-colors"
                      >
                        {conv.other_user.avatar_url ? (
                          <Image
                            src={conv.other_user.avatar_url}
                            alt={conv.other_user.name}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-zinc-200 flex items-center justify-center">
                            <span className="text-lg font-semibold text-zinc-600">
                              {conv.other_user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-zinc-900">{conv.other_user.name}</h3>
                            {conv.unread_count > 0 && (
                              <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-medium rounded-full">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                          {conv.last_message && (
                            <p className="text-sm text-zinc-600 truncate">{conv.last_message.content}</p>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {new Date(conv.updated_at).toLocaleDateString()}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
