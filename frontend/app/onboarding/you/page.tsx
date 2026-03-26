"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useFormValidation } from "@/hooks/useFormValidation"
import { onboardingSchema } from "@/lib/validations/profileSchema"
import {
  SelectField,
  RadioGroupField,
  ValidatedRichTextArea,
  ValidatedMultiSelect,
} from "@/components/forms/FormField"
import { TagInput } from "@/components/forms/TagInput"
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

export default function YouPage() {
  const router = useRouter()
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Initialize form validation
  const validation = useFormValidation(onboardingSchema, {
    validateOnBlur: true,
    showErrorsOnlyAfterTouch: true,
  })

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
  }

  const handleNext = () => {
    // Validate the form before allowing navigation
    const isValid = validation.validateAll(form)

    if (!isValid) {
      const errors = validation.errors
      const errorMessages = Object.entries(errors).map(([field, message]) => `${field}: ${message}`)
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
    router.push("/onboarding/preferences")
  }

  return (
    <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">You & your startup</h1>

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

      <div className="space-y-6">
        <RadioGroupField
          name="idea_status"
          label="Are you working on an idea?"
          value={form.idea_status}
          onChange={(v) => update("idea_status", v as string)}
          options={IDEA_STATUSES.map(opt => ({ value: opt.value, label: opt.label }))}
          required
          validation={validation}
        />

        <RadioGroupField
          name="is_technical"
          label="Can you build the product without outside help? (Technical)"
          value={form.is_technical}
          onChange={(v) => update("is_technical", v as boolean)}
          options={[
            { value: true, label: "Yes" },
            { value: false, label: "No" }
          ]}
          required
          validation={validation}
        />

        <RadioGroupField
          name="ready_to_start"
          label="When are you ready to go full-time?"
          value={form.ready_to_start}
          onChange={(v) => update("ready_to_start", v as string)}
          options={READY_TO_START.map(opt => ({ value: opt.value, label: opt.label }))}
          required
          validation={validation}
        />

        <SelectField
          name="commitment"
          label="Commitment"
          value={form.commitment}
          onChange={(v) => update("commitment", v)}
          options={COMMITMENT_LEVELS}
          validation={validation}
        />

        <SelectField
          name="work_location_preference"
          label="Work location preference"
          value={form.work_location_preference}
          onChange={(v) => update("work_location_preference", v)}
          options={WORK_LOCATION_PREFERENCES}
          placeholder="Select"
          validation={validation}
        />

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
            <ValidatedRichTextArea
              name="startup_description"
              label="What are you building?"
              value={form.startup_description}
              onChange={(v) => update("startup_description", v)}
              maxLength={2000}
              rows={3}
              validation={validation}
            />
            <SelectField
              name="startup_progress"
              label="Progress"
              value={form.startup_progress}
              onChange={(v) => update("startup_progress", v)}
              options={STARTUP_PROGRESS}
              placeholder="Select"
              validation={validation}
            />
            <SelectField
              name="startup_funding"
              label="Funding status"
              value={form.startup_funding}
              onChange={(v) => update("startup_funding", v)}
              options={STARTUP_FUNDING}
              placeholder="Select"
              validation={validation}
            />
          </>
        )}

        <ValidatedMultiSelect
          name="areas_of_ownership"
          label="Which areas will you own?"
          options={AREAS_OF_OWNERSHIP}
          value={form.areas_of_ownership}
          onChange={(v) => update("areas_of_ownership", v)}
          minSelection={1}
          required
          validation={validation}
        />

        <div>
          <TagInput
            options={TOPICS_OF_INTEREST}
            value={form.topics_of_interest}
            onChange={(v) => update("topics_of_interest", v)}
            label="Topics of interest"
            minSelection={1}
            error={validation.getFieldError("topics_of_interest")}
          />
        </div>

        <ValidatedRichTextArea
          name="equity_expectation"
          label="Equity expectations"
          value={form.equity_expectation}
          onChange={(v) => update("equity_expectation", v)}
          maxLength={500}
          placeholder="How you prefer to split equity"
          required
          validation={validation}
        />

        <ValidatedRichTextArea
          name="life_story"
          label="Life story"
          value={form.life_story}
          onChange={(v) => update("life_story", v)}
          maxLength={2000}
          rows={3}
          validation={validation}
        />

        <ValidatedRichTextArea
          name="hobbies"
          label="Hobbies"
          value={form.hobbies}
          onChange={(v) => update("hobbies", v)}
          maxLength={1000}
          rows={2}
          validation={validation}
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
