"use client"

import { useEffect, useState } from "react"
import { useAuth, useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AppShell } from "@/components/layout/AppShell"
import { api } from "@/lib/api"
import type { User } from "@/lib/types"
import { PageLoader } from "@/components/ui/loader"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Search,
  Star,
  Users,
  ArrowRight,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  XCircle,
  X,
  SlidersHorizontal,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"

type ProfileCounts = {
  discover_count: number
  saved_count: number
  matches_count: number
}

export default function DashboardPage() {
  const { getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [counts, setCounts] = useState<ProfileCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [approvedBannerDismissed, setApprovedBannerDismissed] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const token = await getToken()
        if (!token) {
          router.push("/")
          return
        }

        const [userData, countsData] = await Promise.all([
          api.users.getMe(token),
          api.profiles.getCounts(token),
        ])
        setUser(userData)
        setCounts(countsData)
        const profileComplete = userData.profile_status && userData.profile_status !== "incomplete"
        if (!userData.behavior_agreement_accepted_at && !profileComplete) {
          router.push("/onboarding/agreement")
          return
        }
      } catch (error) {
        console.error("Failed to load data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [getToken, router])

  if (loading) {
    return (
      <PageLoader label="Loading..." />
    )
  }

  const formatFilters = () => {
    if (!user) return "No filters set"

    const parts: string[] = []
    if (user.idea_status) {
      parts.push(`idea status: ${user.idea_status.replace(/_/g, " ")}`)
    }
    if (user.commitment) {
      parts.push(`who is ${user.commitment.replace("_", " ")}`)
    }
    if (user.location) {
      parts.push(`in ${user.location}`)
    }

    return parts.length > 0 ? parts.join(", ") : "No filters set"
  }

  const statusBadge = (status: string | undefined) => {
    switch (status) {
      case "pending_review":
        return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Pending Review</Badge>
      case "approved":
        return <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">Approved</Badge>
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return null
    }
  }

  return (
    <AppShell>
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 md:mb-10">
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
                Dashboard
              </h1>
              {statusBadge(user?.profile_status)}
            </div>
          </div>

          {/* Alert Banners */}
          {user?.profile_status === "pending_review" && (
            <div role="alert" className="mb-8 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">Your profile is pending review.</p>
                <p className="mt-1 text-amber-800">
                  We&apos;ll let you know once it&apos;s approved. In the meantime you can still review your profile and preferences on the{" "}
                  <Link href="/profile" className="font-medium underline underline-offset-2 hover:text-amber-950">
                    Profile
                  </Link>{" "}
                  page.
                </p>
              </div>
            </div>
          )}

          {user?.profile_status === "approved" && !approvedBannerDismissed && (
            <div role="status" className="mb-8 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div className="flex-1">
                <p className="font-medium">Your profile has been approved.</p>
                <p className="mt-1 text-emerald-800">
                  You&apos;re now visible to other founders in the matching pool. Head to{" "}
                  <Link href="/discover" className="font-medium underline underline-offset-2 hover:text-emerald-950">
                    Discover
                  </Link>{" "}
                  to start meeting potential co-founders.
                </p>
              </div>
              <button
                onClick={() => setApprovedBannerDismissed(true)}
                className="shrink-0 rounded-md p-0.5 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-900 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {user?.profile_status === "rejected" && (
            <div role="alert" className="mb-8 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="font-medium">Your profile was not approved yet.</p>
                <p className="mt-1 text-red-800">
                  Please review and update your profile on the{" "}
                  <Link href="/profile" className="font-medium underline underline-offset-2 hover:text-red-950">
                    Profile
                  </Link>{" "}
                  page, then resubmit so we can take another look.
                </p>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-8 md:mb-10">
            <Card className="transition-shadow hover:shadow-soft">
              <CardContent className="pt-2">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100">
                    <Search className="h-5 w-5 text-zinc-900" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-3xl font-semibold tracking-tight text-zinc-900">
                      {counts?.discover_count || 0}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      founders in your queue
                    </p>
                  </div>
                  <Link
                    href="/discover"
                    className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-1 gap-1.5")}
                  >
                    View Profiles
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="transition-shadow hover:shadow-soft">
              <CardContent className="pt-2">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100">
                    <Star className="h-5 w-5 text-zinc-900" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-3xl font-semibold tracking-tight text-zinc-900">
                      {counts?.saved_count || 0}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      saved profile{counts?.saved_count !== 1 ? "s" : ""} awaiting invite
                    </p>
                  </div>
                  <Link
                    href="/revisit?tab=saved"
                    className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-1 gap-1.5")}
                  >
                    View Saved
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="transition-shadow hover:shadow-soft">
              <CardContent className="pt-2">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100">
                    <Users className="h-5 w-5 text-zinc-900" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-3xl font-semibold tracking-tight text-zinc-900">
                      {counts?.matches_count || 0}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      match{counts?.matches_count !== 1 ? "es" : ""} to meet
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed max-w-[220px]">
                    Most successful teams meet within a week of matching.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator className="mb-8 md:mb-10" />

          {/* Main Grid */}
          <div className="grid md:grid-cols-3 gap-4 md:gap-8">
            {/* Left Column */}
            <div className="md:col-span-2 space-y-6">
              {/* How It Works */}
              <Card className="transition-shadow hover:shadow-soft">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold tracking-tight">
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-zinc-500" />
                      How It Works
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-4">
                    {[
                      "When you go to the candidates page, you will be shown one profile at a time.",
                      "If you choose to send a message request to someone, they will receive an email with your profile.",
                      "If they accept your request, we\u2019ll match the two of you!",
                      "To ensure that founders have a good experience on this platform, you are limited to sending 20 invites per week.",
                    ].map((step, i) => (
                      <li key={i} className="flex gap-4 text-sm text-zinc-700">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-900">
                          {i + 1}
                        </span>
                        <span className="pt-0.5 leading-relaxed border-l border-zinc-100 pl-4">
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>

              {/* Your Matches */}
              <Card className="transition-shadow hover:shadow-soft">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold tracking-tight">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-zinc-500" />
                      Your Matches
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {counts && counts.matches_count > 0 ? (
                    <div className="space-y-4">
                      <p className="text-sm text-zinc-700 leading-relaxed">
                        You have {counts.matches_count} active match{counts.matches_count !== 1 ? "es" : ""}! Go to your inbox to review them and set up meetings.
                      </p>
                      <Link
                        href="/inbox"
                        className={cn(buttonVariants({ variant: "default", size: "default" }), "gap-1.5")}
                      >
                        View your matches
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500 leading-relaxed">
                      You don&apos;t have any active matches yet. Start browsing profiles to find your co-founder!
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Your Filters */}
              <Card className="transition-shadow hover:shadow-soft">
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <CardTitle className="text-lg font-semibold tracking-tight">
                      <span className="flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
                        Your filters
                      </span>
                    </CardTitle>
                    <Link
                      href="/profile"
                      className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
                    >
                      Edit
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-700 leading-relaxed">
                    {formatFilters()}
                  </p>
                  {user?.areas_of_ownership && user.areas_of_ownership.length > 0 && (
                    <>
                      <Separator className="my-3" />
                      <p className="text-sm text-zinc-700">
                        Areas I want a co-founder to handle:{" "}
                        <span className="font-medium text-zinc-900">
                          {user.areas_of_ownership.join(", ")}
                        </span>
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Community Trust */}
              <Card className="transition-shadow hover:shadow-soft">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold tracking-tight">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-zinc-500" />
                      Community Trust
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-700 leading-relaxed mb-3">
                    Community trust is very important to us. If anyone harasses you, uses the co-founder matching platform to sell services or do anything other than find a co-founder, or contacts you without consent outside of Startup School, please report it to us.
                  </p>
                  <p className="text-sm text-zinc-700">
                    We&apos;re always trying to improve your experience. If you have any feedback,{" "}
                    <a href="mailto:support@cofoundermatch.com" className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700">
                      let us know!
                    </a>
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
