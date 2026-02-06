"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Sidebar } from "@/components/layout/Sidebar"
import { api } from "@/lib/api"
import type { UserPublic } from "@/lib/types"

export default function ProfileDetailPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const params = useParams()
  const profileId = params.id as string
  const [profile, setProfile] = useState<UserPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [skipping, setSkipping] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = await getToken()
        if (!token) {
          router.push("/onboarding")
          return
        }

        const data = await api.users.getById(profileId)
        setProfile(data)
      } catch (error) {
        console.error("Failed to load profile:", error)
      } finally {
        setLoading(false)
      }
    }

    if (profileId) {
      loadProfile()
    }
  }, [profileId, getToken, router])

  const handleSave = async () => {
    if (!profile) return
    try {
      const token = await getToken()
      if (!token) return

      setSaving(true)
      await api.profiles.save(profile.id, token)
      router.push("/revisit?tab=saved")
    } catch (error) {
      console.error("Failed to save profile:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    if (!profile) return
    try {
      const token = await getToken()
      if (!token) return

      setSkipping(true)
      await api.profiles.skip(profile.id, token)
      router.push("/discover")
    } catch (error) {
      console.error("Failed to skip profile:", error)
    } finally {
      setSkipping(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">Profile not found</h2>
            <Link
              href="/discover"
              className="inline-block px-6 py-2 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Back to Discover
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
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-900 mb-6"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Discover
          </Link>

          <div className="bg-white border border-zinc-200 rounded-lg p-8">
            <div className="flex items-start gap-6 mb-6">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="w-32 h-32 rounded-full object-cover"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-zinc-200 flex items-center justify-center">
                  <span className="text-4xl font-semibold text-zinc-600">
                    {profile.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <h1 className="text-3xl font-semibold text-zinc-900 mb-2">{profile.name}</h1>
                {profile.location && (
                  <p className="text-zinc-600 mb-4">{profile.location}</p>
                )}
                {profile.role_intent && (
                  <span className="inline-block px-4 py-2 bg-zinc-100 text-zinc-900 font-medium rounded-full">
                    {profile.role_intent === "founder" ? "Founder" : profile.role_intent === "cofounder" ? "Co-Founder" : "Early Employee"}
                  </span>
                )}
              </div>
            </div>

            {profile.bio && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-zinc-900 mb-3">About</h2>
                <p className="text-zinc-700 leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {profile.skills && profile.skills.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-zinc-900 mb-3">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-4 py-2 bg-zinc-100 text-zinc-900 font-medium rounded-full"
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.experience_years !== undefined && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-zinc-900 mb-3">Experience</h2>
                <p className="text-zinc-700">
                  {profile.experience_years} year{profile.experience_years !== 1 ? "s" : ""} of experience
                  {profile.previous_startups > 0 && (
                    <span className="ml-2">
                      • {profile.previous_startups} previous startup{profile.previous_startups !== 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
            )}

            {profile.stage_preference && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-zinc-900 mb-3">Stage Preference</h2>
                <p className="text-zinc-700 capitalize">{profile.stage_preference.replace("_", " ")}</p>
              </div>
            )}

            <div className="flex items-center gap-4 pt-6 border-t border-zinc-200">
              <button
                onClick={handleSkip}
                disabled={skipping}
                className="flex-1 px-6 py-3 border-2 border-zinc-300 text-zinc-700 font-medium rounded-lg hover:border-zinc-400 hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                {skipping ? "Skipping..." : "Skip"}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
