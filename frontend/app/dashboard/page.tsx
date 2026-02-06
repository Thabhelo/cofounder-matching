"use client"

import { useEffect, useState } from "react"
import { useAuth, useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Sidebar } from "@/components/layout/Sidebar"
import { api } from "@/lib/api"
import type { User } from "@/lib/types"

type ProfileCounts = {
  discover_count: number
  saved_count: number
  matches_count: number
}

export default function DashboardPage() {
  const { getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [counts, setCounts] = useState<ProfileCounts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const token = await getToken()
        if (!token) {
          router.push("/onboarding")
          return
        }

        const [userData, countsData] = await Promise.all([
          api.users.getMe(token),
          api.profiles.getCounts(token),
        ])
        setUser(userData)
        setCounts(countsData)
      } catch (error) {
        console.error("Failed to load data:", error)
        router.push("/onboarding")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [getToken, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const formatFilters = () => {
    if (!user) return "No filters set"
    
    const parts: string[] = []
    if (user.role_intent) {
      parts.push(`looking for a ${user.role_intent === "founder" ? "co-founder" : user.role_intent}`)
    }
    if (user.commitment) {
      parts.push(`who is ${user.commitment.replace("_", " ")}`)
    }
    if (user.location) {
      parts.push(`in ${user.location}`)
    }
    if (user.stage_preference) {
      parts.push(`at ${user.stage_preference} stage`)
    }
    
    return parts.length > 0 ? parts.join(", ") : "No filters set"
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 flex">
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-semibold text-zinc-900 mb-8">Dashboard</h1>

            {/* Summary Cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white border border-zinc-200 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-zinc-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-zinc-900 font-medium mb-2">
                      {counts?.discover_count || 0} founders in your queue meet your requirements!
                    </p>
                    <Link
                      href="/discover"
                      className="inline-block mt-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      View Profiles
                    </Link>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-zinc-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-zinc-900 font-medium mb-2">
                      You have {counts?.saved_count || 0} saved profile{counts?.saved_count !== 1 ? "s" : ""} awaiting an invite!
                    </p>
                    <Link
                      href="/revisit?tab=saved"
                      className="inline-block mt-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      View Saved Profiles
                    </Link>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-zinc-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-zinc-900 font-medium mb-2">
                      You have {counts?.matches_count || 0} match{counts?.matches_count !== 1 ? "es" : ""} that you haven&apos;t met yet.
                    </p>
                    <p className="text-sm text-zinc-600 mt-1">
                      Keep the search moving fast! Most successful teams set up an initial meeting within a week of matching.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Left Column - Main Content */}
              <div className="md:col-span-2 space-y-6">
                {/* How It Works */}
                <div className="bg-white border border-zinc-200 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 mb-4">How It Works</h2>
                  <ul className="space-y-3 text-zinc-700">
                    <li className="flex gap-3">
                      <span className="text-zinc-900 font-medium">1.</span>
                      <span>When you go to the candidates page, you will be shown one profile at a time.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-zinc-900 font-medium">2.</span>
                      <span>If you choose to send a message request to someone, they will receive an email with your profile.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-zinc-900 font-medium">3.</span>
                      <span>If they accept your request, we&apos;ll match the two of you!</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-zinc-900 font-medium">4.</span>
                      <span>To ensure that founders have a good experience on this platform, you are limited to sending 20 invites per week.</span>
                    </li>
                  </ul>
                </div>

                {/* Your Matches */}
                <div className="bg-white border border-zinc-200 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 mb-4">Your Matches</h2>
                  {counts && counts.matches_count > 0 ? (
                    <>
                      <p className="text-zinc-700 mb-4">
                        You have {counts.matches_count} active match{counts.matches_count !== 1 ? "es" : ""}! Go to your inbox to review them and set up meetings.
                      </p>
                      <Link
                        href="/inbox"
                        className="inline-block px-6 py-2 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        View your matches
                      </Link>
                    </>
                  ) : (
                    <p className="text-zinc-600">You don&apos;t have any active matches yet. Start browsing profiles to find your co-founder!</p>
                  )}
                </div>
              </div>

              {/* Right Column - Sidebar */}
              <div className="space-y-6">
                {/* Your Filters */}
                <div className="bg-white border border-zinc-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-zinc-900">Your filters</h2>
                    <Link
                      href="/profile"
                      className="text-sm text-zinc-600 hover:text-zinc-900 font-medium"
                    >
                      Edit
                    </Link>
                  </div>
                  <p className="text-zinc-700 text-sm leading-relaxed">
                    I want a co-founder {formatFilters()}.
                  </p>
                  {user?.skills && user.skills.length > 0 && (
                    <p className="text-zinc-700 text-sm mt-3">
                      I want a co-founder willing to be responsible for{" "}
                      <span className="font-medium">
                        {user.skills.map((s) => s.name).join(", ")}
                      </span>
                      .
                    </p>
                  )}
                </div>

                {/* Community Trust */}
                <div className="bg-white border border-zinc-200 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 mb-3">Community Trust</h2>
                  <p className="text-sm text-zinc-700 leading-relaxed mb-3">
                    Community trust is very important to us. If anyone harasses you, uses the co-founder matching platform to sell services or do anything other than find a co-founder, or contacts you without consent outside of Startup School, please report it to us.
                  </p>
                  <p className="text-sm text-zinc-700">
                    We&apos;re always trying to improve your experience. If you have any feedback,{" "}
                    <a href="mailto:support@cofoundermatch.com" className="text-zinc-900 font-medium hover:underline">
                      let us know!
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
