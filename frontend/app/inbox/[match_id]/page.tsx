"use client"

import { useEffect, useState, useRef } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Sidebar } from "@/components/layout/Sidebar"
import { api } from "@/lib/api"

type Message = {
  id: string
  sender_id: string
  content: string
  created_at: string
  sender: {
    id: string
    name: string
    avatar_url?: string
  }
}

type Match = {
  id: string
  user_id: string
  target_user_id: string
  status: string
  target_user: {
    id: string
    name: string
    avatar_url?: string
  }
}

export default function ConversationPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const params = useParams()
  const matchId = params.match_id as string
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [match, setMatch] = useState<Match | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    async function loadConversation() {
      try {
        const token = await getToken()
        if (!token) {
          router.push("/")
          return
        }

        const [currentUser, matchData, messagesData] = await Promise.all([
          api.users.getMe(token),
          api.matches.getAll(token).then(matches => matches.find((m: any) => m.id === matchId)),
          api.messages.getMessages(matchId, token)
        ])

        if (!matchData) {
          router.push("/inbox")
          return
        }

        setCurrentUserId(currentUser.id)
        setMatch(matchData)
        setMessages(messagesData)
      } catch (error) {
        console.error("Failed to load conversation:", error)
        router.push("/inbox")
      } finally {
        setLoading(false)
      }
    }

    loadConversation()
  }, [matchId, getToken, router])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !match) return

    try {
      const token = await getToken()
      if (!token) return

      setSending(true)
      const message = await api.messages.send(matchId, newMessage, token)

      setMessages([...messages, message])
      setNewMessage("")
    } catch (error) {
      console.error("Failed to send message:", error)
      alert("Failed to send message. Please try again.")
    } finally {
      setSending(false)
    }
  }

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

  if (!match) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">Conversation not found</h2>
            <Link
              href="/inbox"
              className="inline-block px-6 py-2 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Back to Inbox
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const otherUser = match.target_user

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-zinc-200 p-4">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <Link
              href="/inbox"
              className="text-zinc-600 hover:text-zinc-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            {otherUser.avatar_url ? (
              <Image
                src={otherUser.avatar_url}
                alt={otherUser.name}
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center">
                <span className="text-lg font-semibold text-zinc-600">
                  {otherUser.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">{otherUser.name}</h1>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-zinc-600">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => {
                const isMe = message.sender_id === currentUserId
                return (
                  <div
                    key={message.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-md px-4 py-2 rounded-lg ${
                        isMe
                          ? "bg-zinc-900 text-white"
                          : "bg-white border border-zinc-200 text-zinc-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isMe ? "text-zinc-400" : "text-zinc-500"
                        }`}
                      >
                        {new Date(message.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input */}
        <div className="bg-white border-t border-zinc-200 p-4">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="px-6 py-2 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
