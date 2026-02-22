"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function OnboardingPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/onboarding/agreement")
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto" />
        <p className="mt-4 text-gray-600">Taking you to onboarding...</p>
      </div>
    </div>
  )
}
