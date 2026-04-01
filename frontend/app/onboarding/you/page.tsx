"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FormField, FormInput, FormTextarea, FormSelect } from "@/components/forms/FormField"
import { TagInput } from "@/components/forms/TagInput"
import { RichTextArea } from "@/components/forms/RichTextArea"
import { MultiSelect } from "@/components/forms/MultiSelect"
import {
  IDEA_STATUSES,
  READY_TO_START,
  AREAS_OF_OWNERSHIP,
  COMMITMENT_LEVELS,
  WORK_LOCATION_PREFERENCES,
  STARTUP_PROGRESS,
  STARTUP_FUNDING,
} from "@/lib/constants/enums"
import { TOPICS_OF_INTEREST } from "@/lib/constants/topics"
import { getDraft, setDraft } from "@/hooks/useOnboardingDraft"
import { validateForm, validators, type ValidationErrors } from "@/lib/validation"

export default function YouPage() {
  const router = useRouter()
  const [errors, setErrors] = useState<ValidationErrors>({})

  const [form, setForm] = useState({
    idea_status: "not_set_on_idea",
    is_technical: true,
    ready_to_start: "now",
    commitment: "full_time",
    work_location_preference: "",
    startup_name: "",
    startup_description: "",
    startup_progress: "",
    startup_funding: "",
    areas_of_ownership: [] as string[],
    topics_of_interest: [] as string[],
    domain_expertise: [] as string[],
    equity_expectation: "",
    life_story: "",
    hobbies: "",
  })

  useEffect(() => {
    const draft = getDraft() as Record<string, unknown>
    setForm((prev) => ({
      ...prev,
      idea_status: (draft.idea_status as string) ?? prev.idea_status,
      is_technical: (draft.is_technical as boolean) ?? prev.is_technical,
      ready_to_start: (draft.ready_to_start as string) ?? prev.ready_to_start,
      commitment: (draft.commitment as string) ?? prev.commitment,
      work_location_preference: (draft.work_location_preference as string) ?? "",
      startup_name: (draft.startup_name as string) ?? "",
      startup_description: (draft.startup_description as string) ?? "",
      startup_progress: (draft.startup_progress as string) ?? "",
      startup_funding: (draft.startup_funding as string) ?? "",
      areas_of_ownership: (draft.areas_of_ownership as string[]) ?? [],
      topics_of_interest: (draft.topics_of_interest as string[]) ?? [],
      domain_expertise: (draft.domain_expertise as string[]) ?? [],
      equity_expectation: (draft.equity_expectation as string) ?? "",
      life_story: (draft.life_story as string) ?? "",
      hobbies: (draft.hobbies as string) ?? "",
    }))
  }, [])

  const update = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDraft({ [key]: value })

    // Clear field error when user starts typing
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: '' }))
    }
  }

  const validateYouForm = (): boolean => {
    const fieldValidators = {
      idea_status: [validators.required],
      is_technical: [(value: boolean) => value === undefined ? "Please select technical background" : null],
      ready_to_start: [validators.required],
      areas_of_ownership: [(value: string[]) => value.length === 0 ? "Please select at least one area" : null],
      topics_of_interest: [(value: string[]) => value.length === 0 ? "Please select at least one topic" : null],
      equity_expectation: [(value: string) => validators.minLength(value, 10, 'Equity expectations')],
    }

    const validationErrors = validateForm(form, fieldValidators)
    setErrors(validationErrors)

    return Object.keys(validationErrors).length === 0
  }

  const handleNext = () => {
    if (validateYouForm()) {
      setDraft(form)
      router.push("/onboarding/preferences")
    } else {
      // Scroll to first error
      const firstErrorField = Object.keys(errors)[0]
      if (firstErrorField) {
        const element = document.querySelector(`[name="${firstErrorField}"]`)
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">You & your startup</h1>

      {Object.keys(errors).length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
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

      <div className="space-y-6">
        <FormField label="Are you working on an idea?" required error={errors.idea_status}>
          <div className="space-y-2">
            {IDEA_STATUSES.map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="idea_status"
                  value={option.value}
                  checked={form.idea_status === option.value}
                  onChange={(e) => update("idea_status", e.target.value)}
                  className="rounded border-gray-300 text-zinc-900 focus:ring-zinc-900"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </FormField>

        <FormField label="Can you build the product without outside help? (Technical)" required error={errors.is_technical}>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="is_technical"
                value="true"
                checked={form.is_technical === true}
                onChange={() => update("is_technical", true)}
                className="rounded border-gray-300 text-zinc-900 focus:ring-zinc-900"
              />
              <span>Yes</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="is_technical"
                value="false"
                checked={form.is_technical === false}
                onChange={() => update("is_technical", false)}
                className="rounded border-gray-300 text-zinc-900 focus:ring-zinc-900"
              />
              <span>No</span>
            </label>
          </div>
        </FormField>

        <FormField label="When are you ready to go full-time?" required error={errors.ready_to_start}>
          <div className="space-y-2">
            {READY_TO_START.map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="ready_to_start"
                  value={option.value}
                  checked={form.ready_to_start === option.value}
                  onChange={(e) => update("ready_to_start", e.target.value)}
                  className="rounded border-gray-300 text-zinc-900 focus:ring-zinc-900"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </FormField>

        <FormField label="Commitment" error={errors.commitment}>
          <FormSelect
            name="commitment"
            value={form.commitment}
            onChange={(e) => update("commitment", e.target.value)}
            options={COMMITMENT_LEVELS}
            error={errors.commitment}
          />
        </FormField>

        <FormField label="Work location preference" error={errors.work_location_preference}>
          <FormSelect
            name="work_location_preference"
            value={form.work_location_preference}
            onChange={(e) => update("work_location_preference", e.target.value)}
            options={WORK_LOCATION_PREFERENCES}
            placeholder="Select"
            error={errors.work_location_preference}
          />
        </FormField>

        {(form.idea_status === "building_specific_idea" || form.idea_status === "have_ideas_flexible") && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Startup name</label>
              <input
                type="text"
                value={form.startup_name}
                onChange={(e) => update("startup_name", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <RichTextArea
              label="What are you building?"
              value={form.startup_description}
              onChange={(v) => update("startup_description", v)}
              maxLength={2000}
              rows={3}
            />
            <FormField label="Progress" error={errors.startup_progress}>
              <FormSelect
                name="startup_progress"
                value={form.startup_progress}
                onChange={(e) => update("startup_progress", e.target.value)}
                options={STARTUP_PROGRESS}
                placeholder="Select"
                error={errors.startup_progress}
              />
            </FormField>
            <FormField label="Funding status" error={errors.startup_funding}>
              <FormSelect
                name="startup_funding"
                value={form.startup_funding}
                onChange={(e) => update("startup_funding", e.target.value)}
                options={STARTUP_FUNDING}
                placeholder="Select"
                error={errors.startup_funding}
              />
            </FormField>
          </>
        )}

        <MultiSelect
          options={AREAS_OF_OWNERSHIP}
          value={form.areas_of_ownership}
          onChange={(v) => update("areas_of_ownership", v)}
          label="Which areas will you own?"
          minSelection={1}
          error={errors.areas_of_ownership}
        />

        <TagInput
          options={TOPICS_OF_INTEREST}
          value={form.topics_of_interest}
          onChange={(v) => update("topics_of_interest", v)}
          label="Topics of interest"
          minSelection={1}
          error={errors.topics_of_interest}
        />

        <RichTextArea
          label="Equity expectations"
          value={form.equity_expectation}
          onChange={(v) => update("equity_expectation", v)}
          maxLength={500}
          placeholder="How you prefer to split equity"
          required
          error={errors.equity_expectation}
        />

        <RichTextArea
          label="Life story"
          value={form.life_story}
          onChange={(v) => update("life_story", v)}
          maxLength={2000}
          rows={3}
          error={errors.life_story}
        />

        <RichTextArea
          label="Hobbies"
          value={form.hobbies}
          onChange={(v) => update("hobbies", v)}
          maxLength={1000}
          rows={2}
          error={errors.hobbies}
        />
      </div>

      <div className="flex gap-3 mt-8">
        <Link href="/onboarding/basics" className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
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
