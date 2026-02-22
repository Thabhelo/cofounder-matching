"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { RichTextArea } from "@/components/forms/RichTextArea"
import { ImportanceSelector } from "@/components/forms/ImportanceSelector"
import { MultiSelect } from "@/components/forms/MultiSelect"
import { AREAS_OF_OWNERSHIP, PREF_IDEA_STATUSES, PREF_LOCATION_TYPES } from "@/lib/constants/enums"
import { getDraft, setDraft } from "@/hooks/useOnboardingDraft"

export default function PreferencesPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    looking_for_description: "",
    pref_idea_status: "",
    pref_idea_importance: "" as string,
    pref_technical: null as boolean | null,
    pref_technical_importance: "" as string,
    pref_match_timing: false,
    pref_timing_importance: "" as string,
    pref_location_type: "",
    pref_location_distance_miles: "" as string,
    pref_location_importance: "" as string,
    pref_age_min: "" as string,
    pref_age_max: "" as string,
    pref_age_importance: "" as string,
    pref_cofounder_areas: [] as string[],
    pref_areas_importance: "" as string,
    pref_shared_interests: false,
    pref_interests_importance: "" as string,
    alert_on_new_matches: false,
  })

  useEffect(() => {
    const draft = getDraft() as Record<string, unknown>
    setForm((prev) => ({
      ...prev,
      looking_for_description: (draft.looking_for_description as string) ?? "",
      pref_idea_status: (draft.pref_idea_status as string) ?? "",
      pref_idea_importance: (draft.pref_idea_importance as string) ?? "",
      pref_technical: draft.pref_technical as boolean | null ?? null,
      pref_technical_importance: (draft.pref_technical_importance as string) ?? "",
      pref_match_timing: (draft.pref_match_timing as boolean) ?? false,
      pref_timing_importance: (draft.pref_timing_importance as string) ?? "",
      pref_location_type: (draft.pref_location_type as string) ?? "",
      pref_location_distance_miles: String(draft.pref_location_distance_miles ?? ""),
      pref_location_importance: (draft.pref_location_importance as string) ?? "",
      pref_age_min: String(draft.pref_age_min ?? ""),
      pref_age_max: String(draft.pref_age_max ?? ""),
      pref_age_importance: (draft.pref_age_importance as string) ?? "",
      pref_cofounder_areas: (draft.pref_cofounder_areas as string[]) ?? [],
      pref_areas_importance: (draft.pref_areas_importance as string) ?? "",
      pref_shared_interests: (draft.pref_shared_interests as boolean) ?? false,
      pref_interests_importance: (draft.pref_interests_importance as string) ?? "",
      alert_on_new_matches: (draft.alert_on_new_matches as boolean) ?? false,
    }))
  }, [])

  const update = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDraft({ [key]: value })
  }

  const handleNext = () => {
    setDraft(form)
    router.push("/onboarding/preview")
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Co-founder preferences</h1>

      <div className="space-y-6">
        <RichTextArea
          label="What are you looking for? *"
          value={form.looking_for_description}
          onChange={(v) => update("looking_for_description", v)}
          minLength={50}
          maxLength={1000}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Idea preference</label>
          <select
            value={form.pref_idea_status}
            onChange={(e) => update("pref_idea_status", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
          >
            <option value="">No preference</option>
            {PREF_IDEA_STATUSES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <ImportanceSelector
            value={form.pref_idea_importance}
            onChange={(v) => update("pref_idea_importance", v)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Want a technical co-founder?</label>
          <div className="flex gap-4 mb-2">
            <label className="flex items-center gap-2">
              <input type="radio" name="pref_technical" checked={form.pref_technical === true} onChange={() => update("pref_technical", true)} className="rounded border-gray-300" />
              Yes
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="pref_technical" checked={form.pref_technical === false} onChange={() => update("pref_technical", false)} className="rounded border-gray-300" />
              No
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="pref_technical" checked={form.pref_technical === null} onChange={() => update("pref_technical", null)} className="rounded border-gray-300" />
              No preference
            </label>
          </div>
          <ImportanceSelector value={form.pref_technical_importance} onChange={(v) => update("pref_technical_importance", v)} />
        </div>

        <div>
          <label className="flex items-center gap-2 mb-1">
            <input type="checkbox" checked={form.pref_match_timing} onChange={(e) => update("pref_match_timing", e.target.checked)} className="rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700">Want co-founder who matches my timing</span>
          </label>
          {form.pref_match_timing && (
            <div className="ml-6 mt-2">
              <span className="block text-xs text-gray-500 mb-1">How important?</span>
              <ImportanceSelector value={form.pref_timing_importance} onChange={(v) => update("pref_timing_importance", v)} />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location preference</label>
          <select
            value={form.pref_location_type}
            onChange={(e) => update("pref_location_type", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
          >
            <option value="">No preference</option>
            {PREF_LOCATION_TYPES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {form.pref_location_type === "within_distance" && (
            <div className="mb-2">
              <input
                type="number"
                min={1}
                max={5000}
                value={form.pref_location_distance_miles}
                onChange={(e) => update("pref_location_distance_miles", e.target.value)}
                placeholder="Miles"
                className="w-32 px-4 py-2 border border-gray-300 rounded-lg"
              />
              <span className="ml-2 text-sm text-gray-600">miles</span>
            </div>
          )}
          <ImportanceSelector value={form.pref_location_importance} onChange={(v) => update("pref_location_importance", v)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Age range</label>
          <div className="flex gap-2 items-center mb-2">
            <input
              type="number"
              min={18}
              max={100}
              value={form.pref_age_min}
              onChange={(e) => update("pref_age_min", e.target.value)}
              placeholder="Min"
              className="w-24 px-4 py-2 border border-gray-300 rounded-lg"
            />
            <span>-</span>
            <input
              type="number"
              min={18}
              max={100}
              value={form.pref_age_max}
              onChange={(e) => update("pref_age_max", e.target.value)}
              placeholder="Max"
              className="w-24 px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <ImportanceSelector value={form.pref_age_importance} onChange={(v) => update("pref_age_importance", v)} />
        </div>

        <MultiSelect
          options={AREAS_OF_OWNERSHIP}
          value={form.pref_cofounder_areas}
          onChange={(v) => update("pref_cofounder_areas", v)}
          label="Areas co-founder should handle"
        />
        <ImportanceSelector value={form.pref_areas_importance} onChange={(v) => update("pref_areas_importance", v)} />

        <div>
          <label className="flex items-center gap-2 mb-1">
            <input type="checkbox" checked={form.pref_shared_interests} onChange={(e) => update("pref_shared_interests", e.target.checked)} className="rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700">Match only with shared topics</span>
          </label>
          {form.pref_shared_interests && (
            <div className="ml-6 mt-2">
              <span className="block text-xs text-gray-500 mb-1">How important?</span>
              <ImportanceSelector value={form.pref_interests_importance} onChange={(v) => update("pref_interests_importance", v)} />
            </div>
          )}
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.alert_on_new_matches} onChange={(e) => update("alert_on_new_matches", e.target.checked)} className="rounded border-gray-300" />
          <span className="text-sm font-medium text-gray-700">Alert me when new profiles match my preferences</span>
        </label>
      </div>

      <div className="flex gap-3 mt-8">
        <Link href="/onboarding/you" className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          Back
        </Link>
        <button type="button" onClick={handleNext} className="px-6 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800">
          Save & Continue
        </button>
      </div>
    </div>
  )
}
