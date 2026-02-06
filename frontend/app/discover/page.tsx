"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Sidebar } from "@/components/layout/Sidebar"
import { api } from "@/lib/api"
import type { UserPublic } from "@/lib/types"

export default function DiscoverPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [profiles, setProfiles] = useState<UserPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [skipping, setSkipping] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    async function loadProfiles() {
      try {
        const token = await getToken()
        if (!token) {
          router.push("/onboarding")
          return
        }

        const data = await api.profiles.discover({ limit: 20 }, token)
        setProfiles(data)
      } catch (error) {
        console.error("Failed to load profiles:", error)
      } finally {
        setLoading(false)
      }
    }

    loadProfiles()
  }, [getToken, router])

  const handleSave = async (profileId: string) => {
    try {
      const token = await getToken()
      if (!token) return

      setSaving(profileId)
      await api.profiles.save(profileId, token)
      
      // Remove from list and move to next
      setProfiles((prev) => prev.filter((p) => p.id !== profileId))
      if (currentIndex >= profiles.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1))
      }
    } catch (error) {
      console.error("Failed to save profile:", error)
    } finally {
      setSaving(null)
    }
  }

  const handleSkip = async (profileId: string) => {
    try {
      const token = await getToken()
      if (!token) return

      setSkipping(profileId)
      await api.profiles.skip(profileId, token)
      
      // Remove from list and move to next
      setProfiles((prev) => prev.filter((p) => p.id !== profileId))
      if (currentIndex >= profiles.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1))
      }
    } catch (error) {
      console.error("Failed to skip profile:", error)
    } finally {
      setSkipping(null)
    }
  }

  const currentProfile = profiles[currentIndex]

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

  if (profiles.length === 0) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">No more profiles to discover</h2>
            <p className="text-zinc-600 mb-6">
              You&apos;ve reviewed all available profiles. Check back later for new founders!
            </p>
            <Link
              href="/revisit"
              className="inline-block px-6 py-2 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors"
            >
              View Saved Profiles
            </Link>
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
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-zinc-900 mb-2">Discover Profiles</h1>
            <p className="text-zinc-600">
              Profile {currentIndex + 1} of {profiles.length}
            </p>
          </div>

          {currentProfile && (
            <div className="bg-white border border-zinc-200 rounded-lg p-8">
              <div className="flex items-start gap-6 mb-6">
                {currentProfile.avatar_url ? (
                  <img
                    src={currentProfile.avatar_url}
                    alt={currentProfile.name}
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-zinc-200 flex items-center justify-center">
                    <span className="text-2xl font-semibold text-zinc-600">
                      {currentProfile.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-zinc-900 mb-2">{currentProfile.name}</h2>
                  {currentProfile.location && (
                    <p className="text-zinc-600 mb-2">{currentProfile.location}</p>
                  )}
                  {currentProfile.role_intent && (
                    <span className="inline-block px-3 py-1 bg-zinc-100 text-zinc-900 text-sm font-medium rounded-full">
                      {currentProfile.role_intent === "founder" ? "Founder" : currentProfile.role_intent === "cofounder" ? "Co-Founder" : "Early Employee"}
                    </span>
                  )}
                </div>
              </div>

              {currentProfile.bio && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">About</h3>
                  <p className="text-zinc-700 leading-relaxed">{currentProfile.bio}</p>
                </div>
              )}

              {currentProfile.skills && currentProfile.skills.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {currentProfile.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-zinc-100 text-zinc-900 text-sm rounded-full"
                      >
                        {skill.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 pt-6 border-t border-zinc-200">
                <button
                  onClick={() => handleSkip(currentProfile.id)}
                  disabled={skipping === currentProfile.id}
                  className="flex-1 px-6 py-3 border-2 border-zinc-300 text-zinc-700 font-medium rounded-lg hover:border-zinc-400 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  {skipping === currentProfile.id ? "Skipping..." : "Skip"}
                </button>
                <button
                  onClick={() => handleSave(currentProfile.id)}
                  disabled={saving === currentProfile.id}
                  className="flex-1 px-6 py-3 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  {saving === currentProfile.id ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </div>
          )}

          {profiles.length > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentIndex(Math.min(profiles.length - 1, currentIndex + 1))}
                disabled={currentIndex === profiles.length - 1}
                className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
