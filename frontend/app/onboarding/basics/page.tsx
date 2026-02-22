"use client"

import { useEffect, useState } from "react"
import { useAuth, useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { LocationPicker } from "@/components/forms/LocationPicker"
import { RichTextArea } from "@/components/forms/RichTextArea"
import { DatePicker } from "@/components/forms/DatePicker"
import { GENDERS } from "@/lib/constants/enums"
import { getDraft, setDraft } from "@/hooks/useOnboardingDraft"

export default function BasicsPage() {
  const { getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  type FormState = {
    name: string
    email: string
    linkedin_url: string
    location: string
    introduction: string
    gender: string
    birthdate: string
    impressive_accomplishment: string
    education_history: string
    employment_history: string
    experience_years: string
    previous_startups: string
    github_url: string
    portfolio_url: string
    calendly_url: string
    video_intro_url: string
  }
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    linkedin_url: "",
    location: "",
    introduction: "",
    gender: "",
    birthdate: "",
    impressive_accomplishment: "",
    education_history: "",
    employment_history: "",
    experience_years: "",
    previous_startups: "0",
    github_url: "",
    portfolio_url: "",
    calendly_url: "",
    video_intro_url: "",
  })

  useEffect(() => {
    const draft = getDraft() as Record<string, unknown>
    setForm((prev) => ({
      ...prev,
      name: String(draft.name ?? clerkUser?.fullName ?? ""),
      email: String(draft.email ?? clerkUser?.primaryEmailAddress?.emailAddress ?? ""),
      linkedin_url: String(draft.linkedin_url ?? ""),
      location: String(draft.location ?? ""),
      introduction: String(draft.introduction ?? ""),
      gender: String(draft.gender ?? ""),
      birthdate: String(draft.birthdate ?? ""),
      impressive_accomplishment: String(draft.impressive_accomplishment ?? ""),
      education_history: String(draft.education_history ?? ""),
      employment_history: String(draft.employment_history ?? ""),
      experience_years: String(draft.experience_years ?? ""),
      previous_startups: String(draft.previous_startups ?? "0"),
      github_url: String(draft.github_url ?? ""),
      portfolio_url: String(draft.portfolio_url ?? ""),
      calendly_url: String(draft.calendly_url ?? ""),
      video_intro_url: String(draft.video_intro_url ?? ""),
    }))
    setLoading(false)
  }, [clerkUser])

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDraft({ [key]: value })
  }

  const handleNext = () => {
    setDraft(form)
    router.push("/onboarding/you")
  }

  if (loading) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Basics</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            placeholder="Your full name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL *</label>
          <input
            type="url"
            value={form.linkedin_url}
            onChange={(e) => update("linkedin_url", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            placeholder="https://linkedin.com/in/yourprofile"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
          <LocationPicker
            value={form.location}
            onChange={(v, components) => {
              update("location", v)
              if (components) {
                setDraft({
                  location: v,
                  location_city: components.city ?? "",
                  location_state: components.state ?? "",
                  location_country: components.country ?? "",
                  location_latitude: components.lat,
                  location_longitude: components.lng,
                })
              }
            }}
          />
        </div>
        <RichTextArea
          label="Introduction *"
          value={form.introduction}
          onChange={(v) => update("introduction", v)}
          minLength={50}
          maxLength={2000}
          placeholder="A paragraph or two about your background and skills"
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
          <select
            value={form.gender}
            onChange={(e) => update("gender", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Select</option>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
        <DatePicker label="Birthdate" value={form.birthdate} onChange={(v) => update("birthdate", v)} />
        <RichTextArea
          label="Impressive accomplishment"
          value={form.impressive_accomplishment}
          onChange={(v) => update("impressive_accomplishment", v)}
          maxLength={2000}
          rows={3}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Education (one per line)</label>
          <textarea
            value={form.education_history}
            onChange={(e) => update("education_history", e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employment (one per line)</label>
          <textarea
            value={form.employment_history}
            onChange={(e) => update("employment_history", e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Experience (years)</label>
            <input
              type="number"
              min={0}
              max={70}
              value={form.experience_years}
              onChange={(e) => update("experience_years", e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Previous startups</label>
            <input
              type="number"
              min={0}
              value={form.previous_startups}
              onChange={(e) => update("previous_startups", e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">GitHub URL</label>
          <input
            type="url"
            value={form.github_url}
            onChange={(e) => update("github_url", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio URL</label>
          <input
            type="url"
            value={form.portfolio_url}
            onChange={(e) => update("portfolio_url", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Calendly URL</label>
          <input
            type="url"
            value={form.calendly_url}
            onChange={(e) => update("calendly_url", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Video intro URL</label>
          <input
            type="url"
            value={form.video_intro_url}
            onChange={(e) => update("video_intro_url", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <Link href="/onboarding/agreement" className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          Back
        </Link>
        <button
          type="button"
          onClick={handleNext}
          className="px-6 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800"
        >
          Save & Continue
        </button>
      </div>
    </div>
  )
}
