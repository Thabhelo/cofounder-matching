"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { api } from "@/lib/api"
import type { User } from "@/lib/types"

export default function ProfilePage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<User>>({})
  const [saving, setSaving] = useState(false)

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
        setFormData(userData)
      } catch (error) {
        console.error("Failed to load user:", error)
        router.push("/onboarding")
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [getToken, router])

  const handleSave = async () => {
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) return

      const updated = await api.users.updateMe(formData, token)
      setUser(updated)
      setIsEditing(false)
    } catch (error) {
      console.error("Failed to update profile:", error)
      alert("Failed to update profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/dashboard" className="text-2xl font-bold text-blue-600">
              CoFounder Match
            </Link>
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Your Profile</h1>
              <p className="text-gray-600 mt-1">Manage your information and preferences</p>
            </div>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Edit Profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setFormData(user || {})
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </div>

          <div className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                {isEditing ? (
                  <input
                    value={formData.name || ""}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{user?.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <p className="text-gray-900">{user?.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role Intent</label>
                {isEditing ? (
                  <select
                    value={formData.role_intent || ""}
                    onChange={e => setFormData({ ...formData, role_intent: e.target.value as any })}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="founder">Founder</option>
                    <option value="cofounder">Co-Founder</option>
                    <option value="early_employee">Early Employee</option>
                  </select>
                ) : (
                  <p className="text-gray-900 capitalize">{user?.role_intent?.replace("_", " ")}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                {isEditing ? (
                  <input
                    value={formData.location || ""}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{user?.location || "Not specified"}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stage Preference</label>
                {isEditing ? (
                  <select
                    value={formData.stage_preference || ""}
                    onChange={e => setFormData({ ...formData, stage_preference: e.target.value as any })}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="">Select stage</option>
                    <option value="idea">Idea</option>
                    <option value="mvp">MVP</option>
                    <option value="revenue">Revenue</option>
                    <option value="growth">Growth</option>
                  </select>
                ) : (
                  <p className="text-gray-900 capitalize">{user?.stage_preference || "Not specified"}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Commitment</label>
                {isEditing ? (
                  <select
                    value={formData.commitment || ""}
                    onChange={e => setFormData({ ...formData, commitment: e.target.value as any })}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="">Select commitment</option>
                    <option value="full_time">Full-time</option>
                    <option value="part_time">Part-time</option>
                    <option value="exploratory">Exploratory</option>
                  </select>
                ) : (
                  <p className="text-gray-900 capitalize">{user?.commitment?.replace("_", " ") || "Not specified"}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Experience Years</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.experience_years || ""}
                    onChange={e => setFormData({ ...formData, experience_years: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{user?.experience_years || "Not specified"}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Previous Startups</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.previous_startups || 0}
                    onChange={e => setFormData({ ...formData, previous_startups: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{user?.previous_startups || 0}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
              {isEditing ? (
                <textarea
                  value={formData.bio || ""}
                  onChange={e => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={4}
                />
              ) : (
                <p className="text-gray-900">{user?.bio || "Not specified"}</p>
              )}
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Links</h3>
              <div className="space-y-4">
                {user?.github_url && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GitHub</label>
                    <a href={user.github_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {user.github_url}
                    </a>
                  </div>
                )}
                {user?.portfolio_url && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio</label>
                    <a href={user.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {user.portfolio_url}
                    </a>
                  </div>
                )}
                {user?.linkedin_url && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
                    <a href={user.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {user.linkedin_url}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Details</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Trust Score:</span>
                  <span className="ml-2 font-semibold text-blue-600">{user?.trust_score}</span>
                </div>
                <div>
                  <span className="text-gray-600">Verified:</span>
                  <span className="ml-2">{user?.is_verified ? "Yes" : "No"}</span>
                </div>
                <div>
                  <span className="text-gray-600">Member since:</span>
                  <span className="ml-2">{new Date(user?.created_at || "").toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span className="ml-2 capitalize">{user?.availability_status?.replace("_", " ") || "Not set"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
