"use client"

import { useEffect, useState } from "react"
import { useAuth, useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { api } from "@/lib/api"
import type { User } from "@/lib/types"

export default function DashboardPage() {
  const { getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      try {
        const token = await getToken()
        if (!token) {
          router.push("/onboarding")
          return
        }

        const userData = await api.users.getMe(token)
        setUser(userData)
      } catch (error) {
        console.error("Failed to load user:", error)
        router.push("/onboarding")
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [getToken, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-600">CoFounder Match</h1>
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-gray-700 hover:text-blue-600">
                Dashboard
              </Link>
              <Link href="/profile" className="text-gray-700 hover:text-blue-600">
                Profile
              </Link>
              <Link href="/resources" className="text-gray-700 hover:text-blue-600">
                Resources
              </Link>
              <Link href="/events" className="text-gray-700 hover:text-blue-600">
                Events
              </Link>
              <Link href="/organizations" className="text-gray-700 hover:text-blue-600">
                Organizations
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name}!
          </h2>
          <p className="text-gray-600">
            Here's what's happening in your entrepreneurial journey
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Your Profile</h3>
              <span className="text-2xl font-bold text-blue-600">{user?.trust_score || 0}</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">Trust Score</p>
            <Link
              href="/profile"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View Profile →
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Resources</h3>
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mb-4">Discover funding and support</p>
            <Link
              href="/resources"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Browse Resources →
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Events</h3>
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mb-4">Network and learn</p>
            <Link
              href="/events"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View Events →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              href="/profile"
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition-colors"
            >
              <div className="font-medium text-gray-900 mb-1">Complete Your Profile</div>
              <div className="text-sm text-gray-600">
                Add more details to increase your match quality
              </div>
            </Link>
            <Link
              href="/resources"
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition-colors"
            >
              <div className="font-medium text-gray-900 mb-1">Explore Resources</div>
              <div className="text-sm text-gray-600">
                Find funding, mentorship, and tools to help you succeed
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
