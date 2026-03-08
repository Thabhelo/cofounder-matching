"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { AppShell } from "@/components/layout/AppShell"
import { api } from "@/lib/api"
import type { UserPublic } from "@/lib/types"

const REPORT_TYPES = [
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Abuse or harassment" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "fake", label: "Fake or misleading profile" },
  { value: "other", label: "Other" },
] as const

export default function ProfileDetailPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const params = useParams()
  const profileId = params.id as string
  const [profile, setProfile] = useState<UserPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportType, setReportType] = useState("abuse")
  const [reportDesc, setReportDesc] = useState("")
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportDone, setReportDone] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = await getToken()
        if (!token) {
          router.push("/")
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
      setIsSaved(true)
    } catch (error) {
      console.error("Failed to save profile:", error)
      alert("Failed to save profile. Please try again.")
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

  const handleReportSubmit = async () => {
    if (!profile || reportDesc.trim().length < 10) return
    try {
      const token = await getToken()
      if (!token) return
      setReportSubmitting(true)
      await api.reports.create(profile.id, reportType, reportDesc.trim(), token)
      setReportDone(true)
      setTimeout(() => {
        setReportOpen(false)
        setReportDone(false)
        setReportDesc("")
      }, 1500)
    } catch (error) {
      console.error("Report failed:", error)
      alert(error instanceof Error ? error.message : "Failed to submit report.")
    } finally {
      setReportSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading profile...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!profile) {
    return (
      <AppShell>
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
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex-1 p-4 md:p-8">
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
                <Image
                  src={profile.avatar_url}
                  alt={profile.name}
                  width={128}
                  height={128}
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
                {profile.idea_status && (
                  <span className="inline-block px-4 py-2 bg-zinc-100 text-zinc-900 font-medium rounded-full">
                    {profile.idea_status.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            </div>

            {profile.introduction && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-zinc-900 mb-3">About</h2>
                <p className="text-zinc-700 leading-relaxed">{profile.introduction}</p>
              </div>
            )}

            {profile.areas_of_ownership && profile.areas_of_ownership.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-zinc-900 mb-3">Areas of ownership</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.areas_of_ownership.map((area) => (
                    <span
                      key={area}
                      className="px-4 py-2 bg-zinc-100 text-zinc-900 font-medium rounded-full"
                    >
                      {area.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.topics_of_interest && profile.topics_of_interest.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-zinc-900 mb-3">Topics of interest</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.topics_of_interest.map((topic) => (
                    <span
                      key={topic}
                      className="px-4 py-2 bg-zinc-100 text-zinc-900 font-medium rounded-full"
                    >
                      {topic}
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
                disabled={saving || isSaved}
                className="flex-1 px-6 py-3 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaved ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                )}
                {saving ? "Saving..." : isSaved ? "Saved" : "Save for Later"}
              </button>
            </div>
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="text-sm text-zinc-500 hover:text-zinc-700 underline"
              >
                Report this profile
              </button>
            </div>
            {reportOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                  <h3 className="text-lg font-semibold text-zinc-900 mb-4">Report profile</h3>
                  {reportDone ? (
                    <p className="text-zinc-700">Thank you. Your report has been submitted and will be reviewed.</p>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-zinc-700 mb-2">Reason</label>
                      <select
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                        className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 mb-4"
                      >
                        {REPORT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <label className="block text-sm font-medium text-zinc-700 mb-2">Details (min 10 characters)</label>
                      <textarea
                        value={reportDesc}
                        onChange={(e) => setReportDesc(e.target.value)}
                        placeholder="Describe what happened..."
                        rows={4}
                        className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 placeholder-zinc-400 mb-4"
                      />
                      <div className="flex gap-3 justify-end">
                        <button
                          type="button"
                          onClick={() => { setReportOpen(false); setReportDesc("") }}
                          className="px-4 py-2 text-zinc-700 hover:bg-zinc-100 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleReportSubmit}
                          disabled={reportSubmitting || reportDesc.trim().length < 10}
                          className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                        >
                          {reportSubmitting ? "Submitting..." : "Submit report"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
