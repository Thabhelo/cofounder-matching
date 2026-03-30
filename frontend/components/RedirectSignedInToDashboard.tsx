"use client"

import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"

export function RedirectSignedInToDashboard({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/dashboard")
    }
  }, [isLoaded, isSignedIn, router])

  if (isLoaded && isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto" />
          <p className="mt-4 text-gray-600">Taking you to dashboard...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
