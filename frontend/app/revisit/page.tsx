"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
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
                      <img
                        src={profile.avatar_url}
                        alt={profile.name}
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

                  <Link
                    href={`/profile/${profile.id}`}
                    className="block w-full text-center px-4 py-2 border border-zinc-300 text-zinc-900 font-medium rounded-lg hover:bg-zinc-50 transition-colors"
                  >
                    View Profile
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
