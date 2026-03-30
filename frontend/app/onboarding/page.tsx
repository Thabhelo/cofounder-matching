"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { PageLoader } from "@/components/ui/loader"

export default function OnboardingPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/onboarding/agreement")
  }, [router])

  return (
    <PageLoader label="Taking you to onboarding..." />
  )
}
