"use client"

import { useEffect, useState } from "react"
import { useAuth, useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { LocationPicker } from "@/components/forms/LocationPicker"
import { RichTextArea } from "@/components/forms/RichTextArea"
import { DatePicker } from "@/components/forms/DatePicker"
import { FormField, FormInput, FormTextarea, FormSelect } from "@/components/forms/FormField"
import { GENDERS } from "@/lib/constants/enums"
import { getDraft, setDraft } from "@/hooks/useOnboardingDraft"
import { validateForm, validators, type ValidationErrors } from "@/lib/validation"

export default function BasicsPage() {
  const { getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<ValidationErrors>({})
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

    // Clear field error when user starts typing
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: '' }))
    }
  }

  const validateBasicsForm = (): boolean => {
    const fieldValidators = {
      name: [validators.required],
      email: [validators.required, validators.email],
      linkedin_url: [validators.linkedinUrl],
      location: [(value: string) => validators.required(value, 'Location')],
      introduction: [(value: string) => validators.minLength(value, 50, 'Introduction')],
      github_url: [(value: string) => validators.url(value, 'GitHub URL')],
      portfolio_url: [(value: string) => validators.url(value, 'Portfolio URL')],
      calendly_url: [(value: string) => validators.url(value, 'Calendly URL')],
      video_intro_url: [(value: string) => validators.url(value, 'Video intro URL')]
    }

    const validationErrors = validateForm(form, fieldValidators)
    setErrors(validationErrors)

    return Object.keys(validationErrors).length === 0
  }

  const handleNext = () => {
    if (validateBasicsForm()) {
      setDraft(form)
      router.push("/onboarding/you")
    } else {
      // Scroll to first error
      const firstErrorField = Object.keys(errors)[0]
      if (firstErrorField) {
        const element = document.querySelector(`[name="${firstErrorField}"]`)
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  if (loading) {
    return <div aria-busy="true" className="animate-pulse h-64 bg-gray-100 rounded-lg" />
  }

  return (
    <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Basics</h1>
      <p className="text-sm text-zinc-500 mb-6">Fields marked with * are required</p>

      <div className="space-y-4">
        <FormField label="Name" required error={errors.name}>
          <FormInput
            name="name"
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Your full name"
            error={errors.name}
          />
        </FormField>

        <FormField label="Email" required error={errors.email}>
          <FormInput
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="you@example.com"
            error={errors.email}
          />
        </FormField>

        <FormField label="LinkedIn URL" required error={errors.linkedin_url}>
          <FormInput
            name="linkedin_url"
            type="url"
            value={form.linkedin_url}
            onChange={(e) => update("linkedin_url", e.target.value)}
            placeholder="https://linkedin.com/in/yourprofile"
            error={errors.linkedin_url}
          />
        </FormField>
        <FormField label="Location (Country)" required error={errors.location}>
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
        </FormField>

        <FormField label="Introduction" required error={errors.introduction}>
          <RichTextArea
            label=""
            value={form.introduction}
            onChange={(v) => update("introduction", v)}
            minLength={50}
            maxLength={2000}
            placeholder="A paragraph or two about your background and skills (minimum 50 characters)"
            required={false}
          />
        </FormField>
        <FormField label="Gender" error={errors.gender}>
          <FormSelect
            name="gender"
            value={form.gender}
            onChange={(e) => update("gender", e.target.value)}
            options={GENDERS}
            placeholder="Select"
            error={errors.gender}
          />
        </FormField>
        <DatePicker label="Birthdate" value={form.birthdate} onChange={(v) => update("birthdate", v)} />
        <RichTextArea
          label="Impressive accomplishment"
          value={form.impressive_accomplishment}
          onChange={(v) => update("impressive_accomplishment", v)}
          maxLength={2000}
          rows={3}
        />
        <FormField label="Education (one per line)" error={errors.education_history}>
          <FormTextarea
            name="education_history"
            value={form.education_history}
            onChange={(e) => update("education_history", e.target.value)}
            rows={3}
            placeholder="e.g., MIT - Computer Science (2020-2024)"
            error={errors.education_history}
          />
        </FormField>

        <FormField label="Employment (one per line)" error={errors.employment_history}>
          <FormTextarea
            name="employment_history"
            value={form.employment_history}
            onChange={(e) => update("employment_history", e.target.value)}
            rows={3}
            placeholder="e.g., Software Engineer at Google (2024-present)"
            error={errors.employment_history}
          />
        </FormField>
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
        <FormField label="GitHub URL" error={errors.github_url}>
          <FormInput
            name="github_url"
            type="url"
            value={form.github_url}
            onChange={(e) => update("github_url", e.target.value)}
            placeholder="https://github.com/yourusername"
            error={errors.github_url}
          />
        </FormField>
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

      {/* Show validation summary if there are errors */}
      {Object.keys(errors).length > 0 && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <h4 className="text-sm font-medium text-red-800">Please fix the following errors:</h4>
          </div>
          <ul className="mt-2 list-disc list-inside text-sm text-red-700">
            {Object.entries(errors)
              .filter(([, message]) => message)
              .map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
          </ul>
        </div>
      )}

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
