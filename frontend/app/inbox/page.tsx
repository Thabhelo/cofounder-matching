"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { api } from "@/lib/api"

export default function InboxPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      try {
        const token = await getToken()
        if (!token) {
          router.push("/onboarding")
          return
        }
      } catch (error) {
        console.error("Failed to check auth:", error)
        router.push("/onboarding")
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
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

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-semibold text-zinc-900 mb-6">Inbox</h1>

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
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">No messages yet</h2>
            <p className="text-zinc-600 mb-6">
              When you match with someone and start a conversation, your messages will appear here.
            </p>
            <p className="text-sm text-zinc-500">
              The messaging system will be available once the matching algorithm is implemented.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
