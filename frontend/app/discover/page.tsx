"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
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
  const [inviting, setInviting] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteMessage, setInviteMessage] = useState("")
  const [invitesRemaining, setInvitesRemaining] = useState<number | null>(null)
  const [savedProfiles, setSavedProfiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function loadProfiles() {
      try {
        const token = await getToken()
        if (!token) {
          router.push("/")
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

      // Mark as saved
      setSavedProfiles((prev) => new Set(prev).add(profileId))

      // Remove from list and move to next
      setProfiles((prev) => prev.filter((p) => p.id !== profileId))
      if (currentIndex >= profiles.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1))
      }
    } catch (error) {
      console.error("Failed to save profile:", error)
      alert("Failed to save profile. Please try again.")
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

  const handleInviteClick = () => {
    setShowInviteModal(true)
    setInviteMessage("")
  }

  const handleSendInvite = async () => {
    if (!currentProfile) return

    try {
      const token = await getToken()
      if (!token) return

      setInviting(currentProfile.id)
      const result = await api.matches.sendInvite(currentProfile.id, inviteMessage || "Hi! I'd like to connect.", token)

      setInvitesRemaining(result.invites_remaining)
      setShowInviteModal(false)
      setInviteMessage("")

      // Remove from list and move to next
      setProfiles((prev) => prev.filter((p) => p.id !== currentProfile.id))
      if (currentIndex >= profiles.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1))
      }

      if ((result as any).auto_connected) {
        alert(`You're now connected with ${currentProfile.name}! Check your inbox to start chatting. You have ${result.invites_remaining} invites remaining this week.`)
      } else {
        alert(`Invitation sent to ${currentProfile.name}! You have ${result.invites_remaining} invites remaining this week.`)
      }
    } catch (error: any) {
      console.error("Failed to send invite:", error)
      alert(error.message || "Failed to send invitation. Please try again.")
    } finally {
      setInviting(null)
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
            <button
              onClick={() => window.location.reload()}
              className="inline-block px-6 py-2 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Refresh
            </button>
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
              {invitesRemaining !== null && ` • ${invitesRemaining} invites left this week`}
            </p>
          </div>

          {currentProfile && (
            <div className="bg-white border border-zinc-200 rounded-lg p-8">
              {/* Header with Avatar and Basic Info */}
              <div className="flex items-start gap-6 mb-6">
                {currentProfile.avatar_url ? (
                  <Image
                    src={currentProfile.avatar_url}
                    alt={currentProfile.name}
                    width={96}
                    height={96}
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
                  <div className="flex flex-wrap gap-2">
                    {currentProfile.role_intent && (
                      <span className="inline-block px-3 py-1 bg-zinc-900 text-white text-sm font-medium rounded-full">
                        {currentProfile.role_intent === "founder" ? "Founder" : currentProfile.role_intent === "cofounder" ? "Co-Founder" : "Early Employee"}
                      </span>
                    )}
                    {currentProfile.commitment && (
                      <span className="inline-block px-3 py-1 bg-zinc-100 text-zinc-900 text-sm rounded-full">
                        {currentProfile.commitment === "full_time" ? "Full-time" : currentProfile.commitment === "part_time" ? "Part-time" : "Exploratory"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bio */}
              {currentProfile.bio && (
                <div className="mb-6 pb-6 border-b border-zinc-200">
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">About</h3>
                  <p className="text-zinc-700 leading-relaxed whitespace-pre-wrap">{currentProfile.bio}</p>
                </div>
              )}

              {/* Experience & Background */}
              <div className="grid md:grid-cols-2 gap-6 mb-6 pb-6 border-b border-zinc-200">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 mb-3">Experience</h3>
                  <div className="space-y-2 text-sm">
                    {currentProfile.experience_years !== null && currentProfile.experience_years !== undefined && (
                      <p className="text-zinc-700">
                        <span className="font-medium">Years of experience:</span> {currentProfile.experience_years}
                      </p>
                    )}
                    {currentProfile.previous_startups !== null && currentProfile.previous_startups !== undefined && (
                      <p className="text-zinc-700">
                        <span className="font-medium">Previous startups:</span> {currentProfile.previous_startups}
                      </p>
                    )}
                    {currentProfile.availability_status && (
                      <p className="text-zinc-700">
                        <span className="font-medium">Availability:</span>{" "}
                        {currentProfile.availability_status === "actively_looking" ? "Available now" :
                         currentProfile.availability_status === "open" ? "Currently busy" : "Not looking"}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Skills */}
              {currentProfile.skills && currentProfile.skills.length > 0 && (
                <div className="mb-6 pb-6 border-b border-zinc-200">
                  <h3 className="text-lg font-semibold text-zinc-900 mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {currentProfile.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-green-50 text-green-800 text-sm font-medium rounded-full border border-green-200"
                      >
                        {skill.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Social Links */}
              {(currentProfile.github_url || currentProfile.linkedin_url || currentProfile.portfolio_url) && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-zinc-900 mb-3">Links</h3>
                  <div className="flex flex-wrap gap-3">
                    {currentProfile.github_url && (
                      <a
                        href={currentProfile.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-zinc-700 hover:text-zinc-900 underline"
                      >
                        GitHub
                      </a>
                    )}
                    {currentProfile.linkedin_url && (
                      <a
                        href={currentProfile.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-zinc-700 hover:text-zinc-900 underline"
                      >
                        LinkedIn
                      </a>
                    )}
                    {currentProfile.portfolio_url && (
                      <a
                        href={currentProfile.portfolio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-zinc-700 hover:text-zinc-900 underline"
                      >
                        Portfolio
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons - YC Style */}
              <div className="flex items-center gap-3 pt-6 border-t border-zinc-200">
                <button
                  onClick={() => handleSkip(currentProfile.id)}
                  disabled={skipping === currentProfile.id}
                  className="px-6 py-3 border border-zinc-300 text-zinc-700 font-medium rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  {skipping === currentProfile.id ? "Skipping..." : "Skip"}
                </button>
                <button
                  onClick={() => handleSave(currentProfile.id)}
                  disabled={saving === currentProfile.id || savedProfiles.has(currentProfile.id)}
                  className="px-6 py-3 border border-zinc-300 text-zinc-700 font-medium rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {savedProfiles.has(currentProfile.id) ? (
                    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  )}
                  {saving === currentProfile.id ? "Saving..." : savedProfiles.has(currentProfile.id) ? "Saved" : "Save for Later"}
                </button>
                <button
                  onClick={handleInviteClick}
                  disabled={inviting === currentProfile.id}
                  className="flex-1 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {inviting === currentProfile.id ? "Sending..." : "Invite to Connect"}
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

      {/* Invite Modal */}
      {showInviteModal && currentProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h3 className="text-xl font-semibold text-zinc-900 mb-4">
              Invite {currentProfile.name} to connect
            </h3>
            <p className="text-sm text-zinc-600 mb-4">
              Write a message explaining why you&apos;d like to connect (optional).
            </p>
            <textarea
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              placeholder="Hi! I'm interested in connecting because... (optional)"
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600 transition-colors resize-none"
              rows={6}
              maxLength={500}
            />
            <p className="text-xs text-zinc-500 mt-2">
              {inviteMessage.length}/500 characters
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-2 border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvite}
                disabled={inviting === currentProfile?.id}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {inviting === currentProfile?.id ? "Sending..." : "Send Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
