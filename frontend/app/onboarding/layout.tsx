"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { OnboardingRedirectIfComplete } from "@/components/OnboardingRedirectIfComplete"

const STEPS = [
  { path: "/onboarding/agreement", label: "Agreement" },
  { path: "/onboarding/basics", label: "Basics" },
  { path: "/onboarding/you", label: "You" },
  { path: "/onboarding/preferences", label: "Preferences" },
  { path: "/onboarding/preview", label: "Preview" },
]

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const currentIndex = STEPS.findIndex((s) => pathname === s.path)
  const progress = currentIndex >= 0 ? ((currentIndex + 1) / STEPS.length) * 100 : 0

  return (
    <OnboardingRedirectIfComplete>
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-xl font-bold text-zinc-900">
              CoFounder Match
            </Link>
            <span className="text-sm text-gray-600">Onboarding</span>
          </div>
          <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-zinc-900 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <ul className="flex gap-4 mt-2 text-xs text-gray-500">
            {STEPS.map((step, i) => (
              <li
                key={step.path}
                className={pathname === step.path ? "font-medium text-zinc-900" : ""}
              >
                {i + 1}. {step.label}
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8 max-w-2xl">{children}</main>
    </div>
    </OnboardingRedirectIfComplete>
  )
}
