"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { MultiSelect } from "@/components/forms/MultiSelect"
import { TagInput } from "@/components/forms/TagInput"
import { RichTextArea } from "@/components/forms/RichTextArea"
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
    setDraft(form)
    router.push("/onboarding/preferences")
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">You & your startup</h1>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Are you working on an idea?</label>
          <div className="space-y-2">
            {IDEA_STATUSES.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="idea_status"
                  value={opt.value}
                  checked={form.idea_status === opt.value}
                  onChange={() => update("idea_status", opt.value)}
                  className="rounded border-gray-300 text-zinc-900"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Can you build the product without outside help? (Technical)</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="is_technical"
                checked={form.is_technical === true}
                onChange={() => update("is_technical", true)}
                className="rounded border-gray-300 text-zinc-900"
              />
              Yes
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="is_technical"
                checked={form.is_technical === false}
                onChange={() => update("is_technical", false)}
                className="rounded border-gray-300 text-zinc-900"
              />
              No
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">When are you ready to go full-time?</label>
          <div className="space-y-2">
            {READY_TO_START.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="ready_to_start"
                  value={opt.value}
                  checked={form.ready_to_start === opt.value}
                  onChange={() => update("ready_to_start", opt.value)}
                  className="rounded border-gray-300 text-zinc-900"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Commitment</label>
          <select
            value={form.commitment}
            onChange={(e) => update("commitment", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            {COMMITMENT_LEVELS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Work location preference</label>
          <select
            value={form.work_location_preference}
            onChange={(e) => update("work_location_preference", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Select</option>
            {WORK_LOCATION_PREFERENCES.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
        </div>

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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Progress</label>
              <select
                value={form.startup_progress}
                onChange={(e) => update("startup_progress", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select</option>
                {STARTUP_PROGRESS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Funding status</label>
              <select
                value={form.startup_funding}
                onChange={(e) => update("startup_funding", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select</option>
                {STARTUP_FUNDING.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <MultiSelect
          options={AREAS_OF_OWNERSHIP}
          value={form.areas_of_ownership}
          onChange={(v) => update("areas_of_ownership", v)}
          label="Which areas will you own?"
          minSelection={1}
        />

        <TagInput
          options={TOPICS_OF_INTEREST}
          value={form.topics_of_interest}
          onChange={(v) => update("topics_of_interest", v)}
          label="Topics of interest"
          minSelection={1}
        />

        <RichTextArea
          label="Equity expectations *"
          value={form.equity_expectation}
          onChange={(v) => update("equity_expectation", v)}
          maxLength={500}
          placeholder="How you prefer to split equity"
        />

        <RichTextArea
          label="Life story"
          value={form.life_story}
          onChange={(v) => update("life_story", v)}
          maxLength={2000}
          rows={3}
        />
        <RichTextArea
          label="Hobbies"
          value={form.hobbies}
          onChange={(v) => update("hobbies", v)}
          maxLength={1000}
          rows={2}
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
