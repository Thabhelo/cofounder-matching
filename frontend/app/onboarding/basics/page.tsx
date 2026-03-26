"use client"

import { useEffect, useState } from "react"
import { useAuth, useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { GENDERS } from "@/lib/constants/enums"
import { getDraft, setDraft } from "@/hooks/useOnboardingDraft"
import { useFormValidation } from "@/hooks/useFormValidation"
import { onboardingSchema } from "@/lib/validations/profileSchema"
import {
  TextField,
  SelectField,
  ValidatedRichTextArea,
  ValidatedLocationPicker,
} from "@/components/forms/FormField"
import { DatePicker } from "@/components/forms/DatePicker"

export default function BasicsPage() {
  const { getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

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

  // Initialize form validation
  const validation = useFormValidation(onboardingSchema, {
    validateOnBlur: true,
    showErrorsOnlyAfterTouch: true,
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
    const newForm = { ...form, [key]: value }
    setForm(newForm)
    setDraft({ [key]: value })
  }

  const handleNext = () => {
    // Validate the form before allowing navigation
    const isValid = validation.validateAll(form)

    if (!isValid) {
      const errorMessages = Object.entries(validation.errors).map(([field, message]) => `${field}: ${message}`)
      setValidationErrors(errorMessages)

      // Scroll to first error
      const firstErrorElement = document.querySelector('[aria-invalid="true"]')
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        ;(firstErrorElement as HTMLElement).focus()
      }
      return
    }

    setValidationErrors([])
    setDraft(form)
    router.push("/onboarding/you")
  }

  if (loading) {
    return <div aria-busy="true" className="animate-pulse h-64 bg-gray-100 rounded-lg" />
  }

  return (
    <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Basics</h1>
      <p className="text-sm text-zinc-500 mb-6">Fields marked with * are required</p>

      {validationErrors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-sm font-medium text-red-800 mb-2">Please fix the following errors:</h3>
          <ul className="text-sm text-red-700 space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <TextField
          name="name"
          label="Name"
          value={form.name}
          onChange={(v) => update("name", v)}
          placeholder="Your full name"
          validation={validation}
        />

        <TextField
          name="email"
          label="Email"
          type="email"
          value={form.email}
          onChange={(v) => update("email", v)}
          placeholder="you@example.com"
          validation={validation}
        />

        <TextField
          name="linkedin_url"
          label="LinkedIn URL"
          type="url"
          value={form.linkedin_url}
          onChange={(v) => update("linkedin_url", v)}
          placeholder="https://linkedin.com/in/yourprofile"
          required
          validation={validation}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location (Country) <span className="text-red-500">*</span>
          </label>
          <ValidatedLocationPicker
            name="location"
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
            placeholder="Select your country"
            validation={validation}
            required
          />
        </div>

        <ValidatedRichTextArea
          name="introduction"
          label="Introduction"
          value={form.introduction}
          onChange={(v) => update("introduction", v)}
          minLength={50}
          maxLength={2000}
          placeholder="A paragraph or two about your background and skills"
          required
          validation={validation}
        />

        <SelectField
          name="gender"
          label="Gender"
          value={form.gender}
          onChange={(v) => update("gender", v)}
          options={GENDERS}
          placeholder="Select"
          validation={validation}
        />

        <div>
          <DatePicker
            label="Birthdate"
            value={form.birthdate}
            onChange={(v) => update("birthdate", v)}
          />
        </div>

        <ValidatedRichTextArea
          name="impressive_accomplishment"
          label="Impressive accomplishment"
          value={form.impressive_accomplishment}
          onChange={(v) => update("impressive_accomplishment", v)}
          maxLength={2000}
          rows={3}
          validation={validation}
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
          <TextField
            name="experience_years"
            label="Experience (years)"
            type="text"
            value={form.experience_years}
            onChange={(v) => update("experience_years", v)}
            validation={validation}
          />

          <TextField
            name="previous_startups"
            label="Previous startups"
            type="text"
            value={form.previous_startups}
            onChange={(v) => update("previous_startups", v)}
            validation={validation}
          />
        </div>

        <TextField
          name="github_url"
          label="GitHub URL"
          type="url"
          value={form.github_url}
          onChange={(v) => update("github_url", v)}
          placeholder="https://github.com/yourusername"
          validation={validation}
        />

        <TextField
          name="portfolio_url"
          label="Portfolio URL"
          type="url"
          value={form.portfolio_url}
          onChange={(v) => update("portfolio_url", v)}
          placeholder="https://yourportfolio.com"
          validation={validation}
        />

        <TextField
          name="calendly_url"
          label="Calendly URL"
          type="url"
          value={form.calendly_url}
          onChange={(v) => update("calendly_url", v)}
          placeholder="https://calendly.com/yourusername"
          validation={validation}
        />

        <TextField
          name="video_intro_url"
          label="Video intro URL"
          type="url"
          value={form.video_intro_url}
          onChange={(v) => update("video_intro_url", v)}
          placeholder="https://youtube.com/watch?v=..."
          validation={validation}
        />
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
