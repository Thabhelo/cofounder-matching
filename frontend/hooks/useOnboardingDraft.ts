/**
 * Shared draft state for onboarding flow (sessionStorage).
 * Use getDraft/setDraft to persist form progress across steps.
 */
export const DRAFT_KEY = "onboarding_draft"

export function getDraft(): Record<string, unknown> {
  if (typeof window === "undefined") return {}
  try {
    const s = sessionStorage.getItem(DRAFT_KEY)
    return s ? JSON.parse(s) : {}
  } catch {
    return {}
  }
}

export function setDraft(data: Record<string, unknown>) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...getDraft(), ...data }))
  } catch {
    //
  }
}
