"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { AppShell } from "@/components/layout/AppShell"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PageLoader } from "@/components/ui/loader"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Mail,
  Send,
  MessageSquare,
  Clock,
  Check,
  ArrowRight,
  Inbox,
} from "lucide-react"

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
      <AppShell>
        <PageLoader label="Loading..." />
      </AppShell>
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

  // Determine default tab
  const defaultTab = pendingInvites.length > 0
    ? "pending"
    : conversations.length > 0
      ? "conversations"
      : "pending"

  return (
    <AppShell>
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-semibold text-zinc-900 mb-6">Inbox</h1>

          {!hasAnyContent ? (
            <Card className="border-zinc-200">
              <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="rounded-full bg-zinc-100 p-4 mb-4">
                  <Inbox className="h-10 w-10 text-zinc-400" />
                </div>
                <h2 className="text-xl font-semibold text-zinc-900 mb-2">No conversations yet</h2>
                <p className="text-zinc-600 mb-6 max-w-sm">
                  When you connect with someone, your conversation will appear here.
                </p>
                <Link href="/discover" className={cn(buttonVariants())}>
                  Discover Profiles
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className="w-full grid grid-cols-3 mb-4">
                <TabsTrigger value="pending" className="gap-1.5">
                  <Mail className="h-4 w-4" />
                  <span className="hidden sm:inline">Pending</span>
                  {pendingInvites.length > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
                      {pendingInvites.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="sent" className="gap-1.5">
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Sent</span>
                  {sentInvites.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
                      {sentInvites.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="conversations" className="gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Messages</span>
                  {conversations.some((c) => c.unread_count > 0) && (
                    <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
                      {conversations.reduce((sum, c) => sum + c.unread_count, 0)}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Pending Invites */}
              <TabsContent value="pending">
                {pendingInvites.length === 0 ? (
                  <Card className="border-zinc-200">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Mail className="h-8 w-8 text-zinc-300 mb-3" />
                      <p className="text-sm text-zinc-500">No pending invites</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-zinc-200">
                    <CardContent className="p-0">
                      {pendingInvites.map((match, index) => {
                        const sender = match.target_user
                        return (
                          <div key={match.id}>
                            {index > 0 && <Separator />}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4">
                              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                <Avatar className="h-10 w-10 sm:h-12 sm:w-12 shrink-0">
                                  {sender.avatar_url ? (
                                    <AvatarImage src={sender.avatar_url} alt={sender.name} />
                                  ) : null}
                                  <AvatarFallback className="bg-zinc-200 text-zinc-600 font-semibold">
                                    {sender.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-zinc-900">{sender.name}</h3>
                                  <p className="text-sm text-zinc-600 truncate">
                                    {sender.bio || "Wants to connect with you"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2 ml-13 sm:ml-0">
                                <Link href={`/profile/${sender.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                                  View
                                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                </Link>
                                <Button
                                  size="sm"
                                  onClick={() => handleAccept(match.id)}
                                  disabled={accepting === match.id}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="mr-1.5 h-3.5 w-3.5" />
                                  {accepting === match.id ? "..." : "Accept"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Sent Invites */}
              <TabsContent value="sent">
                {sentInvites.length === 0 ? (
                  <Card className="border-zinc-200">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Send className="h-8 w-8 text-zinc-300 mb-3" />
                      <p className="text-sm text-zinc-500">No sent invites</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-zinc-200">
                    <CardContent className="p-0">
                      {sentInvites.map((match, index) => (
                        <div key={match.id}>
                          {index > 0 && <Separator />}
                          <div className="flex items-center gap-4 p-4">
                            <Avatar className="h-12 w-12 shrink-0">
                              {match.target_user.avatar_url ? (
                                <AvatarImage src={match.target_user.avatar_url} alt={match.target_user.name} />
                              ) : null}
                              <AvatarFallback className="bg-zinc-200 text-zinc-600 font-semibold">
                                {match.target_user.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-zinc-900">{match.target_user.name}</h3>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                                <p className="text-sm text-zinc-500">Waiting for response...</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs text-zinc-500 shrink-0">
                              {new Date(match.intro_requested_at!).toLocaleDateString()}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Conversations */}
              <TabsContent value="conversations">
                {conversations.length === 0 ? (
                  <Card className="border-zinc-200">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <MessageSquare className="h-8 w-8 text-zinc-300 mb-3" />
                      <p className="text-sm text-zinc-500">No conversations yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-zinc-200">
                    <CardContent className="p-0">
                      {conversations.map((conv, index) => (
                        <div key={conv.match_id}>
                          {index > 0 && <Separator />}
                          <Link
                            href={`/inbox/${conv.match_id}`}
                            className="flex items-center gap-4 p-4 hover:bg-zinc-50 transition-colors"
                          >
                            <Avatar className="h-12 w-12 shrink-0">
                              {conv.other_user.avatar_url ? (
                                <AvatarImage src={conv.other_user.avatar_url} alt={conv.other_user.name} />
                              ) : null}
                              <AvatarFallback className="bg-zinc-200 text-zinc-600 font-semibold">
                                {conv.other_user.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-zinc-900">{conv.other_user.name}</h3>
                                {conv.unread_count > 0 && (
                                  <Badge
                                    variant="destructive"
                                    className="h-5 min-w-[20px] px-1.5 text-xs"
                                    aria-label={`${conv.unread_count} unread message${conv.unread_count !== 1 ? "s" : ""}`}
                                  >
                                    {conv.unread_count}
                                  </Badge>
                                )}
                              </div>
                              {conv.last_message && (
                                <p className="text-sm text-zinc-600 truncate mt-0.5">{conv.last_message.content}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-zinc-500">
                                {new Date(conv.updated_at).toLocaleDateString()}
                              </span>
                              <ArrowRight className="h-4 w-4 text-zinc-400" />
                            </div>
                          </Link>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </AppShell>
  )
}
