"use client"

import { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { api } from "@/lib/api"

export default function AgreementPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [agree1, setAgree1] = useState(false)
  const [agree2, setAgree2] = useState(false)
  const [agree3, setAgree3] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const allChecked = agree1 && agree2 && agree3

  const handleAccept = async () => {
    if (!allChecked) return
    setSubmitting(true)
    setError("")
    try {
      const token = await getToken()
      if (!token) {
        router.push("/")
        return
      }
      await api.users.acceptBehaviorAgreement(token)
      router.push("/onboarding/basics")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Behavior Agreement</h1>
      <p className="text-gray-600 mb-6">
        Before you create your profile, please read and accept the following.
      </p>

      <ul className="space-y-4 mb-8">
        <li className="flex gap-3">
          <input
            type="checkbox"
            id="a1"
            checked={agree1}
            onChange={(e) => setAgree1(e.target.checked)}
            className="rounded border-gray-300 text-zinc-900 focus:ring-zinc-900 mt-1"
          />
          <label htmlFor="a1" className="text-gray-800">
            I will use this platform only to find co-founders, not for hiring or selling services.
          </label>
        </li>
        <li className="flex gap-3">
          <input
            type="checkbox"
            id="a2"
            checked={agree2}
            onChange={(e) => setAgree2(e.target.checked)}
            className="rounded border-gray-300 text-zinc-900 focus:ring-zinc-900 mt-1"
          />
          <label htmlFor="a2" className="text-gray-800">
            I will treat other participants respectfully and communicate through the platform unless we agree otherwise.
          </label>
        </li>
        <li className="flex gap-3">
          <input
            type="checkbox"
            id="a3"
            checked={agree3}
            onChange={(e) => setAgree3(e.target.checked)}
            className="rounded border-gray-300 text-zinc-900 focus:ring-zinc-900 mt-1"
          />
          <label htmlFor="a3" className="text-gray-800">
            I will not share other users&apos; profiles outside the platform and will abide by community rules.
          </label>
        </li>
      </ul>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleAccept}
          disabled={!allChecked || submitting}
          className="px-6 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving..." : "I agree"}
        </button>
        <Link
          href="/"
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </Link>
      </div>
    </div>
  )
}
