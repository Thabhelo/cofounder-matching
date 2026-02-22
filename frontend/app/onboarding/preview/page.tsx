"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { api } from "@/lib/api"
import { DRAFT_KEY, getDraft } from "@/hooks/useOnboardingDraft"

function buildPayload(draft: Record<string, unknown>) {
  const num = (v: unknown) => (v === "" || v === undefined ? undefined : Number(v))
  const str = (v: unknown) => (v === "" || v === undefined ? undefined : String(v))
  return {
    name: str(draft.name),
    email: str(draft.email),
    linkedin_url: str(draft.linkedin_url) || "",
    location: str(draft.location) || "",
    introduction: str(draft.introduction) || "",
    is_technical: draft.is_technical !== false,
    idea_status: str(draft.idea_status) || "not_set_on_idea",
    ready_to_start: str(draft.ready_to_start) || "now",
    areas_of_ownership: Array.isArray(draft.areas_of_ownership) && draft.areas_of_ownership.length > 0 ? draft.areas_of_ownership : ["engineering"],
    topics_of_interest: Array.isArray(draft.topics_of_interest) && draft.topics_of_interest.length > 0 ? draft.topics_of_interest : ["Other"],
    equity_expectation: str(draft.equity_expectation) || "Equal split",
    looking_for_description: str(draft.looking_for_description) || "Looking for a committed co-founder.",
    gender: str(draft.gender) || undefined,
    birthdate: str(draft.birthdate) || undefined,
    location_city: str(draft.location_city),
    location_state: str(draft.location_state),
    location_country: str(draft.location_country),
    location_latitude: typeof draft.location_latitude === "number" ? draft.location_latitude : undefined,
    location_longitude: typeof draft.location_longitude === "number" ? draft.location_longitude : undefined,
    twitter_url: str(draft.twitter_url),
    instagram_url: str(draft.instagram_url),
    calendly_url: str(draft.calendly_url),
    video_intro_url: str(draft.video_intro_url),
    life_story: str(draft.life_story),
    hobbies: str(draft.hobbies),
    impressive_accomplishment: str(draft.impressive_accomplishment),
    education_history: str(draft.education_history),
    employment_history: str(draft.employment_history),
    experience_years: num(draft.experience_years),
    previous_startups: num(draft.previous_startups) ?? 0,
    github_url: str(draft.github_url),
    portfolio_url: str(draft.portfolio_url),
    commitment: str(draft.commitment),
    work_location_preference: str(draft.work_location_preference),
    startup_name: str(draft.startup_name),
    startup_description: str(draft.startup_description),
    startup_progress: str(draft.startup_progress),
    startup_funding: str(draft.startup_funding),
    domain_expertise: Array.isArray(draft.domain_expertise) ? draft.domain_expertise : undefined,
    pref_idea_status: str(draft.pref_idea_status) || undefined,
    pref_idea_importance: str(draft.pref_idea_importance) || undefined,
    pref_technical: draft.pref_technical === null ? undefined : Boolean(draft.pref_technical),
    pref_technical_importance: str(draft.pref_technical_importance) || undefined,
    pref_match_timing: Boolean(draft.pref_match_timing),
    pref_timing_importance: str(draft.pref_timing_importance) || undefined,
    pref_location_type: str(draft.pref_location_type) || undefined,
    pref_location_distance_miles: num(draft.pref_location_distance_miles),
    pref_location_importance: str(draft.pref_location_importance) || undefined,
    pref_age_min: num(draft.pref_age_min),
    pref_age_max: num(draft.pref_age_max),
    pref_age_importance: str(draft.pref_age_importance) || undefined,
    pref_cofounder_areas: Array.isArray(draft.pref_cofounder_areas) ? draft.pref_cofounder_areas : undefined,
    pref_areas_importance: str(draft.pref_areas_importance) || undefined,
    pref_shared_interests: Boolean(draft.pref_shared_interests),
    pref_interests_importance: str(draft.pref_interests_importance) || undefined,
    alert_on_new_matches: Boolean(draft.alert_on_new_matches),
  }
}

export default function PreviewPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setDraft(getDraft())
  }, [])

  const handleSubmit = async () => {
    setSubmitting(true)
    setError("")
    try {
      const token = await getToken()
      if (!token) {
        router.push("/")
        return
      }
      const payload = buildPayload(draft)
      await api.users.onboarding(payload, token)
      try {
        sessionStorage.removeItem(DRAFT_KEY)
      } catch {
        //
      }
      router.push("/dashboard")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Preview & submit</h1>
      <p className="text-gray-600 mb-6">Review your profile below, then submit for review.</p>

      <div className="space-y-4 text-sm text-gray-800 mb-8">
        <p><strong>Name:</strong> {String(draft.name || "")}</p>
        <p><strong>Location:</strong> {String(draft.location || "")}</p>
        <p><strong>Introduction:</strong> {(draft.introduction as string)?.slice(0, 200)}...</p>
        <p><strong>Idea status:</strong> {String(draft.idea_status || "")}</p>
        <p><strong>Technical:</strong> {draft.is_technical ? "Yes" : "No"}</p>
        <p><strong>Areas of ownership:</strong> {(draft.areas_of_ownership as string[])?.join(", ")}</p>
        <p><strong>Topics of interest:</strong> {(draft.topics_of_interest as string[])?.join(", ")}</p>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="flex gap-3">
        <Link href="/onboarding/preferences" className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          Back to editing
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="px-6 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Looks good — submit"}
        </button>
      </div>
    </div>
  )
}
