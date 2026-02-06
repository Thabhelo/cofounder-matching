"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Sidebar } from "@/components/layout/Sidebar"
import { api } from "@/lib/api"
import type { UserPublic } from "@/lib/types"

type Tab = "saved" | "skipped"

export default function RevisitPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get("tab") as Tab) || "saved")
  const [savedProfiles, setSavedProfiles] = useState<UserPublic[]>([])
  const [skippedProfiles, setSkippedProfiles] = useState<UserPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfiles() {
      try {
        const token = await getToken()
        if (!token) {
          router.push("/")
          return
        }

        const [saved, skipped] = await Promise.all([
          api.profiles.getSaved({ limit: 100 }, token),
          api.profiles.getSkipped({ limit: 100 }, token),
        ])
        setSavedProfiles(saved)
        setSkippedProfiles(skipped)
      } catch (error) {
        console.error("Failed to load profiles:", error)
      } finally {
        setLoading(false)
      }
    }

    loadProfiles()
  }, [getToken, router])

  const handleUnsave = async (profileId: string) => {
    try {
      const token = await getToken()
      if (!token) return

      setActionLoading(profileId)
      await api.profiles.unsave(profileId, token)

      // Remove from saved list
      setSavedProfiles((prev) => prev.filter((p) => p.id !== profileId))
    } catch (error) {
      console.error("Failed to unsave profile:", error)
      alert("Failed to unsave profile. Please try again.")
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnskip = async (profileId: string) => {
    try {
      const token = await getToken()
      if (!token) return

      setActionLoading(profileId)
      await api.profiles.unskip(profileId, token)

      // Remove from skipped list
      setSkippedProfiles((prev) => prev.filter((p) => p.id !== profileId))
    } catch (error) {
      console.error("Failed to unskip profile:", error)
      alert("Failed to unskip profile. Please try again.")
    } finally {
      setActionLoading(null)
    }
  }

  const currentProfiles = activeTab === "saved" ? savedProfiles : skippedProfiles

  if (loading) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading profiles...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-semibold text-zinc-900 mb-6">Revisit Profiles</h1>

          {/* Tabs */}
          <div className="border-b border-zinc-200 mb-6">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab("saved")}
                className={`pb-4 px-1 font-medium transition-colors ${
                  activeTab === "saved"
                    ? "text-zinc-900 border-b-2 border-zinc-900"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Saved Profiles ({savedProfiles.length})
              </button>
              <button
                onClick={() => setActiveTab("skipped")}
                className={`pb-4 px-1 font-medium transition-colors ${
                  activeTab === "skipped"
                    ? "text-zinc-900 border-b-2 border-zinc-900"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Skipped Profiles ({skippedProfiles.length})
              </button>
            </div>
          </div>

          {/* Profile List */}
          {currentProfiles.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-lg p-12 text-center">
              <p className="text-zinc-600 text-lg mb-4">
                No {activeTab === "saved" ? "saved" : "skipped"} profiles yet.
              </p>
              <Link
                href="/discover"
                className="inline-block px-6 py-2 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Discover Profiles
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="bg-white border border-zinc-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4 mb-4">
                    {profile.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt={profile.name}
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-zinc-200 flex items-center justify-center">
                        <span className="text-xl font-semibold text-zinc-600">
                          {profile.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-zinc-900 truncate">{profile.name}</h3>
                      {profile.location && (
                        <p className="text-sm text-zinc-600 truncate">{profile.location}</p>
                      )}
                    </div>
                  </div>

                  {profile.bio && (
                    <p className="text-sm text-zinc-700 line-clamp-3 mb-4">{profile.bio}</p>
                  )}

                  {profile.skills && profile.skills.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {profile.skills.slice(0, 3).map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-zinc-100 text-zinc-900 text-xs rounded-full"
                        >
                          {skill.name}
                        </span>
                      ))}
                      {profile.skills.length > 3 && (
                        <span className="px-2 py-1 text-zinc-600 text-xs">
                          +{profile.skills.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Link
                      href={`/profile/${profile.id}`}
                      className="flex-1 text-center px-4 py-2 border border-zinc-300 text-zinc-900 font-medium rounded-lg hover:bg-zinc-50 transition-colors"
                    >
                      View Profile
                    </Link>
                    <button
                      onClick={() => activeTab === "saved" ? handleUnsave(profile.id) : handleUnskip(profile.id)}
                      disabled={actionLoading === profile.id}
                      className="px-4 py-2 border border-zinc-300 text-zinc-700 font-medium rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === profile.id ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : activeTab === "saved" ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
