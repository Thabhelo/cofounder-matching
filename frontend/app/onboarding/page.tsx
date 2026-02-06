"use client"

import { useEffect } from "react"
import { useAuth, useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { OnboardingForm } from "@/components/forms/OnboardingForm"
import { api } from "@/lib/api"

export default function OnboardingPage() {
  const { getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const router = useRouter()

  useEffect(() => {
    async function checkExistingUser() {
      try {
        const token = await getToken()
        if (!token) {
          return // Not authenticated, show onboarding form
        }

        // Check if user already has a profile
        const userData = await api.users.getMe(token)
        if (userData) {
          // User already exists, redirect to dashboard
          router.push("/dashboard")
        }
      } catch (error) {
        // User doesn't exist yet or error fetching, show onboarding form
        // This is expected for new users
      }
    }

    if (clerkUser) {
      checkExistingUser()
    }
  }, [clerkUser, getToken, router])

  return (
    <div className="min-h-screen bg-white py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-semibold text-zinc-900 mb-3 tracking-tight">
              Welcome to CoFounder Match
            </h1>
            <p className="text-lg text-zinc-600 leading-relaxed">
              Let&apos;s get your profile set up so we can find your perfect match
            </p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl shadow-soft p-8">
            <OnboardingForm />
          </div>
        </div>
      </div>
    </div>
  )
}
