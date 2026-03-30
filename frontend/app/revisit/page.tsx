"use client"

import { Suspense, useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { AppShell } from "@/components/layout/AppShell"
import { api } from "@/lib/api"
import type { UserPublic } from "@/lib/types"
import { PageLoader } from "@/components/ui/loader"

type Tab = "saved" | "skipped"

function RevisitPageContent() {
  const { getToken } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>((searchParams?.get("tab") as Tab) || "saved")
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
      <AppShell>
        <PageLoader label="Loading profiles..." />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-semibold text-zinc-900 mb-6">Revisit Profiles</h1>

          {/* Tabs */}
          <div className="border-b border-zinc-200 mb-6">
            <div role="tablist" className="flex gap-8">
              <button
                role="tab"
                aria-selected={activeTab === "saved"}
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
                role="tab"
                aria-selected={activeTab === "skipped"}
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
          <div role="tabpanel">
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

                  {profile.introduction && (
                    <p className="text-sm text-zinc-700 line-clamp-3 mb-4">{profile.introduction}</p>
                  )}

                  {((profile.areas_of_ownership?.length ?? 0) > 0 || (profile.topics_of_interest?.length ?? 0) > 0) && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(profile.areas_of_ownership ?? []).slice(0, 2).map((area) => (
                        <span
                          key={area}
                          className="px-2 py-1 bg-zinc-100 text-zinc-900 text-xs rounded-full"
                        >
                          {area.replace(/_/g, " ")}
                        </span>
                      ))}
                      {(profile.topics_of_interest ?? []).slice(0, 2).map((topic) => (
                        <span key={topic} className="px-2 py-1 bg-zinc-100 text-zinc-900 text-xs rounded-full">
                          {topic}
                        </span>
                      ))}
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
                      className="px-4 py-2 border border-zinc-300 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                      title={activeTab === "saved" ? "Remove from saved and return to discover queue" : "Remove from skipped and return to discover queue"}
                    >
                      {actionLoading === profile.id
                        ? "Removing..."
                        : activeTab === "saved"
                          ? "Unsave"
                          : "Unskip"
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default function RevisitPage() {
  return (
    <Suspense fallback={
      <AppShell>
        <PageLoader label="Loading..." />
      </AppShell>
    }>
      <RevisitPageContent />
    </Suspense>
  )
}
