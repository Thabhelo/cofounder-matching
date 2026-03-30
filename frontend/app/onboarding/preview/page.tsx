"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { api } from "@/lib/api"
import { DRAFT_KEY, getDraft } from "@/hooks/useOnboardingDraft"
import { validateForm, validators, type ValidationErrors } from "@/lib/validation"
import { IDEA_STATUSES, READY_TO_START, AREAS_OF_OWNERSHIP, COMMITMENT_LEVELS, WORK_LOCATION_PREFERENCES } from "@/lib/constants/enums"

function enumLabel(enums: readonly { value: string; label: string }[], value: unknown): string {
  if (!value) return "Not provided"
  const found = enums.find((e) => e.value === value)
  return found ? found.label : String(value)
}

function buildPayload(draft: Record<string, unknown>) {
  const num = (v: unknown) => (v === "" || v === undefined ? undefined : Number(v))
  const str = (v: unknown) => (v === "" || v === undefined ? undefined : String(v))
  const arr = (v: unknown) => (Array.isArray(v) && v.length > 0 ? v : undefined)

  return {
    name: str(draft.name),
    email: str(draft.email),
    // Required fields - NO silent defaults
    linkedin_url: str(draft.linkedin_url),
    location: str(draft.location),
    introduction: str(draft.introduction),
    is_technical: draft.is_technical,
    idea_status: str(draft.idea_status),
    ready_to_start: str(draft.ready_to_start),
    areas_of_ownership: arr(draft.areas_of_ownership),
    topics_of_interest: arr(draft.topics_of_interest),
    equity_expectation: str(draft.equity_expectation),
    looking_for_description: str(draft.looking_for_description),

    // Optional fields
    gender: str(draft.gender),
    birthdate: str(draft.birthdate),
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
    domain_expertise: arr(draft.domain_expertise),

    // Preferences (all optional)
    pref_idea_status: str(draft.pref_idea_status),
    pref_idea_importance: str(draft.pref_idea_importance),
    pref_technical: draft.pref_technical === null ? undefined : Boolean(draft.pref_technical),
    pref_technical_importance: str(draft.pref_technical_importance),
    pref_match_timing: Boolean(draft.pref_match_timing),
    pref_timing_importance: str(draft.pref_timing_importance),
    pref_location_type: str(draft.pref_location_type),
    pref_location_distance_miles: num(draft.pref_location_distance_miles),
    pref_location_importance: str(draft.pref_location_importance),
    pref_age_min: num(draft.pref_age_min),
    pref_age_max: num(draft.pref_age_max),
    pref_age_importance: str(draft.pref_age_importance),
    pref_cofounder_areas: arr(draft.pref_cofounder_areas),
    pref_areas_importance: str(draft.pref_areas_importance),
    pref_shared_interests: Boolean(draft.pref_shared_interests),
    pref_interests_importance: str(draft.pref_interests_importance),
    alert_on_new_matches: Boolean(draft.alert_on_new_matches),
  }
}

// Helper to get user-friendly field names
function getFieldDisplayName(fieldName: string): string {
  const fieldNames: Record<string, string> = {
    linkedin_url: "LinkedIn URL",
    location: "Location",
    introduction: "Introduction",
    is_technical: "Technical background",
    idea_status: "Idea status",
    ready_to_start: "Ready to start timing",
    areas_of_ownership: "Areas of ownership",
    topics_of_interest: "Topics of interest",
    equity_expectation: "Equity expectations",
    looking_for_description: "What you're looking for",
  }
  return fieldNames[fieldName] || fieldName
}

// Helper to get the onboarding page for a field
function getFieldPage(fieldName: string): { page: string; path: string } {
  if (['linkedin_url', 'location', 'introduction'].includes(fieldName)) {
    return { page: 'Basics', path: '/onboarding/basics' }
  }
  if (['is_technical', 'idea_status', 'ready_to_start', 'areas_of_ownership', 'topics_of_interest', 'equity_expectation'].includes(fieldName)) {
    return { page: 'You & Startup', path: '/onboarding/you' }
  }
  if (['looking_for_description'].includes(fieldName)) {
    return { page: 'Preferences', path: '/onboarding/preferences' }
  }
  return { page: 'Unknown', path: '/onboarding/basics' }
}

export default function PreviewPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [validationErrors, setValidationErrors] = useState<Array<{field: string, message: string, page: string, path: string}>>([])
  const [errors, setErrors] = useState<ValidationErrors>({})

  // No longer using the validation hook

  useEffect(() => {
    const draftData = getDraft()
    setDraft(draftData)
  }, [])

  const handleSubmit = async () => {
    setError("")
    setValidationErrors([])

    // Build payload without silent defaults
    const payload = buildPayload(draft)

    // Validate the payload
    const fieldValidators = {
      linkedin_url: [validators.linkedinUrl],
      location: [(value: string) => validators.required(value, 'Location')],
      introduction: [(value: string) => validators.minLength(value, 50, 'Introduction')],
      is_technical: [(value: boolean) => value === undefined ? "Please select technical background" : null],
      idea_status: [validators.required],
      ready_to_start: [validators.required],
      areas_of_ownership: [(value: string[]) => Array.isArray(value) && value.length === 0 ? "Please select at least one area" : null],
      topics_of_interest: [(value: string[]) => Array.isArray(value) && value.length === 0 ? "Please select at least one topic" : null],
      equity_expectation: [(value: string) => validators.minLength(value, 10, 'Equity expectations')],
      looking_for_description: [(value: string) => validators.minLength(value, 50, 'Looking for description')],
    }

    const validationResult = validateForm(payload, fieldValidators)
    setErrors(validationResult)

    if (Object.keys(validationResult).length > 0) {
      // Convert validation errors to user-friendly format with page links
      const errorsList = Object.entries(validationResult).map(([field, message]) => {
        const displayName = getFieldDisplayName(field)
        const fieldPage = getFieldPage(field)
        return {
          field: displayName,
          message: message,
          page: fieldPage.page,
          path: fieldPage.path,
        }
      })

      setValidationErrors(errorsList)
      setError("Please complete all required fields before submitting.")
      return
    }

    setSubmitting(true)
    try {
      const token = await getToken()
      if (!token) {
        router.push("/")
        return
      }

      await api.users.onboarding(payload, token)

      try {
        sessionStorage.removeItem(DRAFT_KEY)
      } catch {
        // Ignore storage errors
      }

      router.push("/dashboard")
    } catch (e: unknown) {
      // Handle backend errors
      if (e instanceof Error) {
        setError(e.message)
      } else {
        setError("Failed to submit onboarding. Please try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Preview & submit</h1>
      <p className="text-gray-600 mb-6">Review your profile below, then submit for review.</p>

      {validationErrors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-sm font-medium text-red-800 mb-3">Missing required information:</h3>
          <ul className="space-y-2">
            {validationErrors.map((error, index) => (
              <li key={index} className="text-sm">
                <Link
                  href={error.path}
                  className="text-red-700 hover:text-red-900 hover:underline font-medium"
                >
                  {error.field} ({error.page} page)
                </Link>
                <p className="text-red-600 text-xs mt-1">{error.message}</p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-red-700 mt-3">
            Click the links above to complete the missing information, then return here to submit.
          </p>
        </div>
      )}

      <div className="space-y-4 text-sm text-gray-800 mb-8">
        <p><strong>Name:</strong> {String(draft.name || "Not provided")}</p>
        <p><strong>Location:</strong> {String(draft.location || "Not provided")}</p>
        <p><strong>Introduction:</strong> {(draft.introduction as string)?.slice(0, 200) || "Not provided"}...</p>
        <p><strong>Idea status:</strong> {enumLabel(IDEA_STATUSES, draft.idea_status)}</p>
        <p><strong>Ready to start:</strong> {enumLabel(READY_TO_START, draft.ready_to_start)}</p>
        <p><strong>Technical:</strong> {draft.is_technical !== undefined ? (draft.is_technical ? "Yes" : "No") : "Not provided"}</p>
        <p><strong>Areas of ownership:</strong> {(draft.areas_of_ownership as string[])?.map((v) => enumLabel(AREAS_OF_OWNERSHIP, v)).join(", ") || "Not provided"}</p>
        <p><strong>Topics of interest:</strong> {(draft.topics_of_interest as string[])?.join(", ") || "Not provided"}</p>
        <p><strong>Equity expectations:</strong> {String(draft.equity_expectation || "Not provided")}</p>
        <p><strong>Looking for:</strong> {String(draft.looking_for_description || "Not provided")}</p>
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
