"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { AppShell } from "@/components/layout/AppShell"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ChevronLeft, Send, Paperclip, Image as ImageIcon, FileText, Loader2, Download, ShieldCheck, ShieldOff } from "lucide-react"
import { PageLoader } from "@/components/ui/loader"
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encryptMedia,
  decryptMedia,
  storeKeyPair,
  loadKeyPair,
  storeTheirPublicKey,
  loadTheirPublicKey,
} from "@/lib/e2ee"

type Message = {
  id: string
  sender_id: string
  content: string
  message_type?: string
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

const WS_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, "ws") || "ws://localhost:8000"

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
  const [unmatching, setUnmatching] = useState(false)
  const [connected, setConnected] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [encrypted, setEncrypted] = useState(false)
  const [decryptedMedia, setDecryptedMedia] = useState<Record<string, string>>({}) // media_id -> objectURL
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 10
  const sharedKeyRef = useRef<CryptoKey | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // WebSocket connection
  const connectWs = useCallback(async () => {
    // Cancel any pending reconnect to prevent timer stacking
    clearTimeout(reconnectTimer.current)

    const token = await getToken()
    if (!token || !matchId) return

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
    }

    const ws = new WebSocket(`${WS_BASE}/ws/chat/${matchId}`)
    wsRef.current = ws

    ws.onopen = () => {
      // Authenticate via first message (not URL query — avoids token in server logs)
      ws.send(JSON.stringify({ type: "auth", token }))
    }

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data)

      if (data.type === "auth_ok") {
        // Auth confirmed — now we're connected
        setConnected(true)
        reconnectAttempts.current = 0
        ws.send(JSON.stringify({ type: "read" }))

        // E2EE key exchange
        let keyPair = await loadKeyPair(matchId)
        if (!keyPair) {
          keyPair = await generateKeyPair()
          await storeKeyPair(matchId, keyPair)
        }
        const pubKey = await exportPublicKey(keyPair.publicKey)
        ws.send(JSON.stringify({ type: "key_exchange", public_key: pubKey }))

        // If we already have their key, derive shared key
        const theirKeyB64 = loadTheirPublicKey(matchId)
        if (theirKeyB64 && keyPair) {
          const theirKey = await importPublicKey(theirKeyB64)
          sharedKeyRef.current = await deriveSharedKey(keyPair.privateKey, theirKey)
          setEncrypted(true)
        }
      } else if (data.type === "auth_error") {
        ws.close(4001, "Auth failed")
      } else if (data.type === "message") {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev
          return [...prev, data]
        })
      } else if (data.type === "media") {
        // Received encrypted media notification
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev
          return [...prev, {
            id: data.id || data.media_id,
            sender_id: data.sender_id,
            content: `[media:${data.media_id}]`,
            created_at: data.created_at,
            sender: data.sender || { id: data.sender_id, name: "" },
            _media: { media_id: data.media_id, iv: data.iv, file_name: data.file_name, file_type: data.file_type, file_size: data.file_size },
          } as any]
        })
      } else if (data.type === "key_exchange") {
        // Received their public key — derive shared key
        storeTheirPublicKey(matchId, data.public_key)
        const keyPair = await loadKeyPair(matchId)
        if (keyPair) {
          const theirKey = await importPublicKey(data.public_key)
          sharedKeyRef.current = await deriveSharedKey(keyPair.privateKey, theirKey)
          setEncrypted(true)
        }
      } else if (data.type === "read") {
        // Other user read our messages
      } else if (data.type === "error") {
        console.error("WebSocket error:", data.detail)
      }
    }

    ws.onclose = (event) => {
      setConnected(false)
      // Don't reconnect on intentional close (4001 = auth failure, 4003 = forbidden)
      if (event.code === 4001 || event.code === 4003) return
      // Exponential backoff: 1s, 2s, 4s, 8s... up to 30s
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
        reconnectAttempts.current++
        reconnectTimer.current = setTimeout(() => {
          connectWs()
        }, delay)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [getToken, matchId])

  // Load initial data + connect WebSocket
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

        // Mark as read via REST (backup)
        try {
          await api.messages.markAllRead(matchId, token)
        } catch {
          // Non-critical
        }
      } catch (error) {
        console.error("Failed to load conversation:", error)
        router.push("/inbox")
      } finally {
        setLoading(false)
      }
    }

    loadConversation()
  }, [matchId, getToken, router])

  // Revoke object URLs on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      Object.values(decryptedMedia).forEach((url) => URL.revokeObjectURL(url))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Connect WebSocket after initial load
  useEffect(() => {
    if (!loading && match) {
      connectWs()
    }
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [loading, match, connectWs])

  // E2EE media upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !match) return
    e.target.value = "" // Reset input

    if (file.size > 10 * 1024 * 1024) {
      alert("File too large. Maximum 10MB.")
      return
    }

    if (!sharedKeyRef.current) {
      alert("Encryption keys not yet exchanged. Please wait a moment and try again.")
      return
    }

    setUploading(true)
    try {
      const token = await getToken()
      if (!token) return

      // Read file → encrypt → upload
      const arrayBuffer = await file.arrayBuffer()
      const encrypted = await encryptMedia(arrayBuffer, sharedKeyRef.current)

      // Convert encrypted data to blob for upload
      const binaryStr = atob(encrypted.data)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
      const encryptedBlob = new Blob([bytes])

      // Upload encrypted blob
      const result = await api.media.upload(
        matchId, encryptedBlob, encrypted.iv,
        file.name, file.type, file.size, token
      )

      // Notify via WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "media",
          media_id: result.media_id,
          message_id: result.message_id,
          iv: encrypted.iv,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        }))
      }

      // Store decrypted version locally for immediate display
      const blob = new Blob([arrayBuffer], { type: file.type })
      setDecryptedMedia((prev) => ({ ...prev, [result.media_id]: URL.createObjectURL(blob) }))
    } catch (error) {
      console.error("Failed to upload media:", error)
      alert("Failed to upload. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  // Decrypt and display a media message
  const handleDecryptMedia = async (mediaId: string, iv: string, fileType: string) => {
    if (decryptedMedia[mediaId]) return // Already decrypted
    if (!sharedKeyRef.current) {
      alert("Encryption keys not available. Reconnect to decrypt.")
      return
    }

    try {
      const token = await getToken()
      if (!token) return

      const encryptedBytes = await api.media.download(mediaId, token)

      // Convert ArrayBuffer to base64 for decryptMedia
      const uint8 = new Uint8Array(encryptedBytes)
      let binary = ""
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
      const base64Data = btoa(binary)

      const decrypted = await decryptMedia({ iv, data: base64Data }, sharedKeyRef.current)
      const blob = new Blob([decrypted], { type: fileType })
      const url = URL.createObjectURL(blob)
      setDecryptedMedia((prev) => ({ ...prev, [mediaId]: url }))
    } catch (error) {
      console.error("Failed to decrypt media:", error)
      alert("Failed to decrypt media.")
    }
  }

  // Auto-decrypt all media messages when shared key becomes available
  useEffect(() => {
    if (!encrypted || !sharedKeyRef.current) return

    const decryptAll = async () => {
      const token = await getToken()
      if (!token) return

      for (const msg of messages) {
        let mediaMeta: { media_id: string; iv: string; file_type: string } | null = null
        if ((msg as any)._media) {
          mediaMeta = (msg as any)._media
        } else if (msg.message_type === "media") {
          try { mediaMeta = JSON.parse(msg.content) } catch { /* skip */ }
        }
        if (!mediaMeta || decryptedMedia[mediaMeta.media_id]) continue

        try {
          const encryptedBytes = await api.media.download(mediaMeta.media_id, token)
          const uint8 = new Uint8Array(encryptedBytes)
          let binary = ""
          for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
          const decrypted = await decryptMedia({ iv: mediaMeta.iv, data: btoa(binary) }, sharedKeyRef.current!)
          const blob = new Blob([decrypted], { type: mediaMeta.file_type })
          setDecryptedMedia((prev) => ({ ...prev, [mediaMeta!.media_id]: URL.createObjectURL(blob) }))
        } catch {
          // Skip individual failures — user can tap to retry
        }
      }
    }

    decryptAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encrypted, messages.length])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !match) return

    const content = newMessage.trim()
    setNewMessage("")

    // Try WebSocket first
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", content }))
      return
    }

    // Fallback to REST
    try {
      const token = await getToken()
      if (!token) return

      setSending(true)
      const message = await api.messages.send(matchId, content, token)
      setMessages((prev) => [...prev, message])
    } catch (error) {
      console.error("Failed to send message:", error)
      setNewMessage(content) // Restore message on failure
      alert("Failed to send message. Please try again.")
    } finally {
      setSending(false)
    }
  }

  const handleUnmatch = async () => {
    if (!match || match.status !== "connected") return
    if (!confirm("Unmatch with this person? They will reappear in your discover feed and can connect again later.")) return
    try {
      const token = await getToken()
      if (!token) return
      setUnmatching(true)
      await api.matches.unmatch(matchId, token)
      // Clean up E2EE keys for this match
      try {
        localStorage.removeItem(`e2ee_keys_${matchId}`)
        localStorage.removeItem(`e2ee_shared_${matchId}`)
      } catch { /* ignore */ }
      router.push("/inbox")
    } catch (error: any) {
      console.error("Failed to unmatch:", error)
      alert(error.message || "Failed to unmatch. Please try again.")
    } finally {
      setUnmatching(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageLoader label="Loading..." />
      </AppShell>
    )
  }

  if (!match) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">Conversation not found</h2>
            <Link href="/inbox" className={cn(buttonVariants())}>
              Back to Inbox
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  const otherUser = match.target_user

  return (
    <AppShell>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-zinc-200 p-4">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <Link href="/inbox" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "shrink-0")}>
              <ChevronLeft className="h-5 w-5" />
              <span className="sr-only">Back to inbox</span>
            </Link>
            <Avatar className="h-10 w-10 shrink-0">
              {otherUser.avatar_url ? (
                <AvatarImage src={otherUser.avatar_url} alt={otherUser.name} />
              ) : null}
              <AvatarFallback className="bg-zinc-200 text-zinc-600 font-semibold">
                {otherUser.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 flex items-center justify-between gap-4 min-w-0">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-zinc-900 truncate">{otherUser.name}</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-xs font-normal gap-1.5">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        connected ? "bg-green-500" : "bg-zinc-300"
                      }`}
                    />
                    {connected ? "Connected" : "Reconnecting..."}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs font-normal gap-1 ${
                      encrypted
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-zinc-200 text-zinc-400"
                    }`}
                  >
                    {encrypted ? (
                      <ShieldCheck className="h-3 w-3" />
                    ) : (
                      <ShieldOff className="h-3 w-3" />
                    )}
                    {encrypted ? "E2EE" : "Unencrypted"}
                  </Badge>
                </div>
              </div>
              {match.status === "connected" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUnmatch}
                  disabled={unmatching}
                  className="text-zinc-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                >
                  {unmatching ? "Unmatching..." : "Unmatch"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div role="log" aria-label="Conversation messages" aria-live="polite" className="flex-1 overflow-y-auto bg-gray-50 p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-zinc-600">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => {
                const isMe = message.sender_id === currentUserId

                // Parse media metadata — from WebSocket (_media) or from DB (JSON in content)
                let media = (message as any)._media as { media_id: string; iv: string; file_name: string; file_type: string; file_size: number } | undefined
                if (!media && (message as any).message_type === "media") {
                  try {
                    media = JSON.parse(message.content)
                  } catch {
                    // Not JSON — legacy [media:uuid] format
                  }
                }
                const isMedia = !!media

                return (
                  <div
                    key={message.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-sm md:max-w-md px-4 py-2.5 ${
                        isMe
                          ? "bg-zinc-900 text-white rounded-2xl rounded-br-md"
                          : "bg-white border border-zinc-200 text-zinc-900 rounded-lg rounded-bl-sm"
                      }`}
                    >
                      {isMedia && media ? (
                        <div className="space-y-2">
                          {decryptedMedia[media.media_id] ? (
                            media.file_type?.startsWith("image/") ? (
                              <img
                                src={decryptedMedia[media.media_id]}
                                alt={media.file_name}
                                className="max-w-full rounded-lg max-h-64 object-contain"
                              />
                            ) : (
                              <a
                                href={decryptedMedia[media.media_id]}
                                download={media.file_name}
                                className={`flex items-center gap-2 text-sm ${isMe ? "text-zinc-300 hover:text-white" : "text-zinc-600 hover:text-zinc-900"}`}
                              >
                                <FileText className="h-4 w-4 shrink-0" />
                                <span className="truncate">{media.file_name}</span>
                                <Download className="h-3.5 w-3.5 shrink-0" />
                              </a>
                            )
                          ) : (
                            <button
                              onClick={() => handleDecryptMedia(media.media_id, media.iv, media.file_type)}
                              className={`flex items-center gap-2 text-sm ${isMe ? "text-zinc-300 hover:text-white" : "text-zinc-600 hover:text-zinc-900"}`}
                            >
                              {media.file_type?.startsWith("image/") ? (
                                <ImageIcon className="h-4 w-4 shrink-0" />
                              ) : (
                                <FileText className="h-4 w-4 shrink-0" />
                              )}
                              <span className="truncate">{media.file_name}</span>
                              <span className="text-xs opacity-70">
                                ({Math.round((media.file_size || 0) / 1024)}KB) — tap to decrypt
                              </span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
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
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                disabled={uploading || !sharedKeyRef.current}
                onClick={() => fileInputRef.current?.click()}
                title={sharedKeyRef.current ? "Send encrypted file" : "Waiting for encryption keys..."}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
                <span className="sr-only">Attach file</span>
              </Button>
              <Input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                aria-label="Type a message"
                className="flex-1"
                disabled={sending}
              />
              <Button
                type="submit"
                disabled={!newMessage.trim() || sending}
                size="icon"
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Send message</span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  )
}
