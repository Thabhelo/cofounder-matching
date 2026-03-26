"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { api } from "@/lib/api"
import type { User } from "@/lib/types"
import { useFormValidation } from "@/hooks/useFormValidation"
import { profileUpdateSchema } from "@/lib/validations/profileSchema"
import {
  TextField,
  SelectField,
  ValidatedRichTextArea,
  ValidatedLocationPicker,
  ValidatedMultiSelect,
} from "@/components/forms/FormField"
import { TagInput } from "@/components/forms/TagInput"
import { MultiSelect } from "@/components/forms/MultiSelect"
import { RichTextArea } from "@/components/forms/RichTextArea"
import {
  IDEA_STATUSES,
  READY_TO_START,
  AREAS_OF_OWNERSHIP,
  COMMITMENT_LEVELS,
  WORK_LOCATION_PREFERENCES,
  GENDERS,
} from "@/lib/constants/enums"
import { TOPICS_OF_INTEREST } from "@/lib/constants/topics"

type Tab = "basics" | "you" | "preferences"

export default function ProfilePage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("basics")
  const [formData, setFormData] = useState<Partial<User>>({})
  const [saving, setSaving] = useState(false)

  // Initialize form validation
  const validation = useFormValidation(profileUpdateSchema, {
    validateOnBlur: true,
    showErrorsOnlyAfterTouch: true,
  })

  useEffect(() => {
    async function loadUser() {
      try {
        const token = await getToken()
        if (!token) {
          router.push("/dashboard")
          return
        }
        const userData = await api.users.getMe(token)
        setUser(userData)
        setFormData(userData)
      } catch (error) {
        console.error("Failed to load user:", error)
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [getToken, router])

  const handleSave = async () => {
    // Validate form before saving
    const isValid = validation.validateAll(formData)

    if (!isValid) {
      // Scroll to first error
      const firstErrorElement = document.querySelector('[aria-invalid="true"]')
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        ;(firstErrorElement as HTMLElement).focus()
      }
      return
    }

    setSaving(true)
    try {
      const token = await getToken()
      if (!token) return
      const updated = await api.users.updateMe(formData, token)
      setUser(updated)
      setFormData(updated)
      validation.clearErrors() // Clear any validation errors on success
    } catch (error: any) {
      console.error("Failed to update profile:", error)

      // Try to parse backend validation errors
      validation.setBackendErrors(error)

      // If no specific field errors, show generic alert
      if (Object.keys(validation.errors).length === 0) {
        alert("Failed to update profile. Please try again.")
      }
    } finally {
      setSaving(false)
    }
  }

  const update = (key: keyof User, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900" />
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "basics", label: "Basics" },
    { id: "you", label: "You & Startup" },
    { id: "preferences", label: "Preferences" },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-xs border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/dashboard" className="text-2xl font-bold text-zinc-900">
              CoFounder Match
            </Link>
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-lg shadow-xs">
          <div className="p-6 border-b flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Your Profile</h1>
              <p className="text-gray-600 mt-1">Manage your information and preferences</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>

          <div className="border-b">
            <nav className="flex gap-4 px-6">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm ${
                    tab === t.id
                      ? "border-zinc-900 text-zinc-900"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6 space-y-6">
            {tab === "basics" && (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <TextField
                    name="name"
                    label="Name"
                    value={formData.name ?? ""}
                    onChange={(v) => update("name", v)}
                    validation={validation}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <p className="text-gray-900 py-2">{user?.email}</p>
                  </div>
                </div>
                <TextField
                  name="linkedin_url"
                  label="LinkedIn URL"
                  type="url"
                  value={formData.linkedin_url ?? ""}
                  onChange={(v) => update("linkedin_url", v)}
                  placeholder="https://linkedin.com/in/yourprofile"
                  validation={validation}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location (Country)</label>
                  <ValidatedLocationPicker
                    name="location"
                    value={formData.location ?? ""}
                    onChange={(v, components) => {
                      if (components) {
                        setFormData((prev) => ({
                          ...prev,
                          location: v,
                          location_city: components.city ?? prev?.location_city,
                          location_state: components.state ?? prev?.location_state,
                          location_country: components.country ?? prev?.location_country,
                          location_latitude: components.lat ?? prev?.location_latitude,
                          location_longitude: components.lng ?? prev?.location_longitude,
                        }))
                      } else {
                        update("location", v)
                      }
                    }}
                    validation={validation}
                  />
                </div>
                <ValidatedRichTextArea
                  name="introduction"
                  label="Introduction"
                  value={formData.introduction ?? ""}
                  onChange={(v) => update("introduction", v)}
                  maxLength={2000}
                  rows={4}
                  validation={validation}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select
                      value={formData.gender ?? ""}
                      onChange={(e) => update("gender", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select</option>
                      {GENDERS.map((g) => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Birthdate</label>
                    <input
                      type="date"
                      value={formData.birthdate ?? ""}
                      onChange={(e) => update("birthdate", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Experience (years)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.experience_years ?? ""}
                      onChange={(e) => update("experience_years", e.target.value ? parseInt(e.target.value, 10) : undefined)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Previous startups</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.previous_startups ?? 0}
                      onChange={(e) => update("previous_startups", parseInt(e.target.value, 10) || 0)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <TextField
                  name="github_url"
                  label="GitHub URL"
                  type="url"
                  value={formData.github_url ?? ""}
                  onChange={(v) => update("github_url", v)}
                  placeholder="https://github.com/yourusername"
                  validation={validation}
                />
                <TextField
                  name="portfolio_url"
                  label="Portfolio URL"
                  type="url"
                  value={formData.portfolio_url ?? ""}
                  onChange={(v) => update("portfolio_url", v)}
                  placeholder="https://yourportfolio.com"
                  validation={validation}
                />
              </>
            )}

            {tab === "you" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Idea status</label>
                  <div className="space-y-2">
                    {IDEA_STATUSES.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="idea_status"
                          value={opt.value}
                          checked={(formData.idea_status ?? "") === opt.value}
                          onChange={() => update("idea_status", opt.value)}
                          className="rounded border-gray-300"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Technical?</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="is_technical"
                        checked={formData.is_technical === true}
                        onChange={() => update("is_technical", true)}
                        className="rounded border-gray-300"
                      />
                      Yes
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="is_technical"
                        checked={formData.is_technical === false}
                        onChange={() => update("is_technical", false)}
                        className="rounded border-gray-300"
                      />
                      No
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ready to start</label>
                  <select
                    value={formData.ready_to_start ?? ""}
                    onChange={(e) => update("ready_to_start", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    {READY_TO_START.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commitment</label>
                  <select
                    value={formData.commitment ?? ""}
                    onChange={(e) => update("commitment", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    {COMMITMENT_LEVELS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work location</label>
                  <select
                    value={formData.work_location_preference ?? ""}
                    onChange={(e) => update("work_location_preference", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select</option>
                    {WORK_LOCATION_PREFERENCES.map((w) => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>
                <MultiSelect
                  options={AREAS_OF_OWNERSHIP}
                  value={formData.areas_of_ownership ?? []}
                  onChange={(v) => update("areas_of_ownership", v)}
                  label="Areas of ownership"
                />
                <TagInput
                  options={TOPICS_OF_INTEREST}
                  value={formData.topics_of_interest ?? []}
                  onChange={(v) => update("topics_of_interest", v)}
                  label="Topics of interest"
                />
                <RichTextArea
                  label="Equity expectation"
                  value={formData.equity_expectation ?? ""}
                  onChange={(v) => update("equity_expectation", v)}
                  maxLength={500}
                />
              </>
            )}

            {tab === "preferences" && (
              <>
                <RichTextArea
                  label="What you're looking for"
                  value={formData.looking_for_description ?? ""}
                  onChange={(v) => update("looking_for_description", v)}
                  maxLength={1000}
                  rows={4}
                />
                <MultiSelect
                  options={AREAS_OF_OWNERSHIP}
                  value={formData.pref_cofounder_areas ?? []}
                  onChange={(v) => update("pref_cofounder_areas", v)}
                  label="Areas co-founder should handle"
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.alert_on_new_matches ?? false}
                    onChange={(e) => update("alert_on_new_matches", e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">Alert me when new profiles match my preferences</span>
                </label>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
          {user?.profile_status && (
            <span className="ml-4">Status: {user.profile_status.replace("_", " ")}</span>
          )}
        </div>
      </div>
    </div>
  )
}
