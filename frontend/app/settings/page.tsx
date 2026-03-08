"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth, useUser, useClerk } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { api } from "@/lib/api"
import type { UserSettings, UserSettingsUpdate } from "@/lib/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: UserSettings = {
  notifications: {
    email_new_match: true,
    email_new_message: true,
    email_intro_request: true,
    email_profile_approved: true,
    email_weekly_digest: false,
    email_marketing: false,
    frequency: "immediate",
  },
  privacy: {
    profile_visibility: "public",
    show_email_to_connections: false,
    show_location: true,
    show_proof_of_work: true,
    search_visible: true,
  },
  communication: {
    who_can_send_intros: "everyone",
    auto_accept_intros: false,
  },
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 ${
          checked ? "bg-zinc-900" : "bg-zinc-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-6">
      <h2 className="text-base font-semibold text-zinc-900 mb-4">{title}</h2>
      <div className="divide-y divide-zinc-100">{children}</div>
    </div>
  )
}

function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
}: {
  dirty: boolean
  saving: boolean
  onSave: () => void
  onDiscard: () => void
}) {
  if (!dirty) return null
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-200 px-6 py-3 flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onDiscard}
        className="px-4 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-900"
      >
        Discard
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save changes"}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const { openUserProfile } = useClerk()
  const router = useRouter()

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Display preference: dark mode stored in localStorage only
  const [darkMode, setDarkMode] = useState(false)

  // Confirm dialogs
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePhrase, setDeletePhrase] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("theme")
    setDarkMode(stored === "dark")
  }, [])

  useEffect(() => {
    let cancelled = false
    getToken()
      .then((token) => {
        if (!token || cancelled) return
        return api.users.getSettings(token)
      })
      .then((res) => {
        if (!res || cancelled) return
        const merged: UserSettings = {
          notifications: { ...DEFAULT_SETTINGS.notifications, ...res.settings.notifications },
          privacy: { ...DEFAULT_SETTINGS.privacy, ...res.settings.privacy },
          communication: { ...DEFAULT_SETTINGS.communication, ...res.settings.communication },
        }
        setSettings(merged)
        setSaved(merged)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [getToken])

  const dirty = JSON.stringify(settings) !== JSON.stringify(saved)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error("Not authenticated")
      const payload: UserSettingsUpdate = {
        notifications: settings.notifications,
        privacy: settings.privacy,
        communication: settings.communication,
      }
      const res = await api.users.updateSettings(payload, token)
      const merged: UserSettings = {
        notifications: { ...DEFAULT_SETTINGS.notifications, ...res.settings.notifications },
        privacy: { ...DEFAULT_SETTINGS.privacy, ...res.settings.privacy },
        communication: { ...DEFAULT_SETTINGS.communication, ...res.settings.communication },
      }
      setSettings(merged)
      setSaved(merged)
      setSuccessMsg("Settings saved.")
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }, [getToken, settings])

  const handleDiscard = useCallback(() => {
    setSettings(saved)
  }, [saved])

  const handleToggleDarkMode = (v: boolean) => {
    setDarkMode(v)
    localStorage.setItem("theme", v ? "dark" : "light")
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const token = await getToken()
      if (!token) throw new Error("Not authenticated")
      const data = await api.users.exportData(token)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `cofounder-match-data-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deletePhrase !== "delete my account") return
    setDeleting(true)
    try {
      const token = await getToken()
      if (!token) throw new Error("Not authenticated")
      await api.users.deleteAccount(token)
      router.push("/")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Deletion failed")
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-zinc-500 text-sm">Loading settings...</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your notifications, privacy, and account preferences.</p>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {successMsg && (
        <div role="status" aria-live="polite" className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* Notification Preferences */}
      <Section title="Email Notifications">
        <Toggle
          checked={settings.notifications.email_new_match}
          onChange={(v) =>
            setSettings((s) => ({ ...s, notifications: { ...s.notifications, email_new_match: v } }))
          }
          label="New match"
          description="Email me when I have a new co-founder match"
        />
        <Toggle
          checked={settings.notifications.email_new_message}
          onChange={(v) =>
            setSettings((s) => ({ ...s, notifications: { ...s.notifications, email_new_message: v } }))
          }
          label="New message"
          description="Email me when I receive a new message"
        />
        <Toggle
          checked={settings.notifications.email_intro_request}
          onChange={(v) =>
            setSettings((s) => ({ ...s, notifications: { ...s.notifications, email_intro_request: v } }))
          }
          label="Introduction requests"
          description="Email me when someone sends an intro request"
        />
        <Toggle
          checked={settings.notifications.email_profile_approved}
          onChange={(v) =>
            setSettings((s) => ({ ...s, notifications: { ...s.notifications, email_profile_approved: v } }))
          }
          label="Profile status updates"
          description="Email me when my profile is approved or reviewed"
        />
        <Toggle
          checked={settings.notifications.email_weekly_digest}
          onChange={(v) =>
            setSettings((s) => ({ ...s, notifications: { ...s.notifications, email_weekly_digest: v } }))
          }
          label="Weekly digest"
          description="Weekly summary of new matches and activity"
        />
        <Toggle
          checked={settings.notifications.email_marketing}
          onChange={(v) =>
            setSettings((s) => ({ ...s, notifications: { ...s.notifications, email_marketing: v } }))
          }
          label="Product updates and tips"
          description="Occasional emails about new features and co-founder advice"
        />
        <div className="py-3">
          <p className="text-sm font-medium text-zinc-900 mb-2">Notification frequency</p>
          <div className="flex gap-3">
            {(["immediate", "daily", "weekly"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={settings.notifications.frequency === f}
                onClick={() =>
                  setSettings((s) => ({ ...s, notifications: { ...s.notifications, frequency: f } }))
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  settings.notifications.frequency === f
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "text-zinc-600 border-zinc-200 hover:border-zinc-400"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Privacy Settings */}
      <Section title="Privacy">
        <div className="py-3">
          <p className="text-sm font-medium text-zinc-900 mb-1">Profile visibility</p>
          <p className="text-xs text-zinc-500 mb-2">Who can view your full profile</p>
          <div className="flex gap-3">
            {(["public", "connections_only"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={settings.privacy.profile_visibility === v}
                onClick={() =>
                  setSettings((s) => ({ ...s, privacy: { ...s.privacy, profile_visibility: v } }))
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  settings.privacy.profile_visibility === v
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "text-zinc-600 border-zinc-200 hover:border-zinc-400"
                }`}
              >
                {v === "public" ? "Public" : "Connections only"}
              </button>
            ))}
          </div>
        </div>
        <Toggle
          checked={settings.privacy.search_visible}
          onChange={(v) => setSettings((s) => ({ ...s, privacy: { ...s.privacy, search_visible: v } }))}
          label="Appear in search and discovery"
          description="When off, your profile is hidden from Discover and search results"
        />
        <Toggle
          checked={settings.privacy.show_location}
          onChange={(v) => setSettings((s) => ({ ...s, privacy: { ...s.privacy, show_location: v } }))}
          label="Show location on profile"
        />
        <Toggle
          checked={settings.privacy.show_proof_of_work}
          onChange={(v) => setSettings((s) => ({ ...s, privacy: { ...s.privacy, show_proof_of_work: v } }))}
          label="Show GitHub, LinkedIn, and portfolio links"
        />
        <Toggle
          checked={settings.privacy.show_email_to_connections}
          onChange={(v) =>
            setSettings((s) => ({ ...s, privacy: { ...s.privacy, show_email_to_connections: v } }))
          }
          label="Share email with connections"
          description="Allow matched co-founders to see your email address"
        />
      </Section>

      {/* Communication Preferences */}
      <Section title="Communication">
        <div className="py-3">
          <p className="text-sm font-medium text-zinc-900 mb-1">Who can send introduction requests</p>
          <div className="flex gap-3 mt-2">
            {(["everyone", "verified_only"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={settings.communication.who_can_send_intros === v}
                onClick={() =>
                  setSettings((s) => ({ ...s, communication: { ...s.communication, who_can_send_intros: v } }))
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  settings.communication.who_can_send_intros === v
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "text-zinc-600 border-zinc-200 hover:border-zinc-400"
                }`}
              >
                {v === "everyone" ? "Everyone" : "Verified profiles only"}
              </button>
            ))}
          </div>
        </div>
        <Toggle
          checked={settings.communication.auto_accept_intros}
          onChange={(v) =>
            setSettings((s) => ({ ...s, communication: { ...s.communication, auto_accept_intros: v } }))
          }
          label="Auto-accept introduction requests"
          description="Automatically match with anyone who sends you an intro request"
        />
      </Section>

      {/* Display Preferences */}
      <Section title="Display">
        <Toggle
          checked={darkMode}
          onChange={handleToggleDarkMode}
          label="Dark mode"
          description="Stored locally in your browser"
        />
        <div className="py-3">
          <p className="text-sm font-medium text-zinc-500">Timezone</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {Intl.DateTimeFormat().resolvedOptions().timeZone} (detected from browser)
          </p>
        </div>
      </Section>

      {/* Account Settings */}
      <Section title="Account">
        <div className="py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900">Signed in as</p>
            <p className="text-xs text-zinc-500 mt-0.5">{clerkUser?.primaryEmailAddress?.emailAddress}</p>
          </div>
        </div>
        <div className="py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900">Password, 2FA, and connected accounts</p>
            <p className="text-xs text-zinc-500 mt-0.5">Managed through Clerk</p>
          </div>
          <button
            type="button"
            onClick={() => openUserProfile()}
            className="text-sm text-zinc-700 underline hover:text-zinc-900"
          >
            Manage
          </button>
        </div>
        <div className="py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900">Edit profile</p>
            <p className="text-xs text-zinc-500 mt-0.5">Update your co-founder profile information</p>
          </div>
          <a href="/profile" className="text-sm text-zinc-700 underline hover:text-zinc-900">
            Go to profile
          </a>
        </div>
      </Section>

      {/* Data & Privacy */}
      <Section title="Data and Privacy">
        <div className="py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900">Download your data</p>
            <p className="text-xs text-zinc-500 mt-0.5">Export your profile, matches, and messages as JSON (GDPR Art. 20)</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="text-sm text-zinc-700 underline hover:text-zinc-900 disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export"}
          </button>
        </div>
        <div className="py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Delete account</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Permanently anonymize all your data. This cannot be undone (GDPR Art. 17).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm text-red-600 underline hover:text-red-800"
            >
              Delete
            </button>
          </div>
          {showDeleteConfirm && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
              <p id="delete-confirm-warning" className="text-sm text-red-700 font-medium">
                Type <span className="font-bold">delete my account</span> to confirm.
              </p>
              <label htmlFor="delete-confirm" className="sr-only">Type DELETE to confirm</label>
              <input
                id="delete-confirm"
                type="text"
                value={deletePhrase}
                onChange={(e) => setDeletePhrase(e.target.value)}
                placeholder="delete my account"
                aria-describedby="delete-confirm-warning"
                className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deletePhrase !== "delete my account" || deleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Confirm delete"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeletePhrase("")
                  }}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </Section>

      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={handleDiscard} />
    </div>
    </AppShell>
  )
}
