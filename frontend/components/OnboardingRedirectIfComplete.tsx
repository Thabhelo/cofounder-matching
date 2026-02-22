"use client"

import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"
import { api } from "@/lib/api"

export function OnboardingRedirectIfComplete({ children }: { children: ReactNode }) {
  const { getToken, isLoaded } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return

    async function check() {
      const token = await getToken()
      if (!token) return
      try {
        const user = await api.users.getMe(token)
        if (user?.behavior_agreement_accepted_at) {
          router.replace("/dashboard")
        }
      } catch {
        // Not logged in or API error; stay on onboarding
      }
    }

    check()
  }, [isLoaded, getToken, router])

  return <>{children}</>
}
