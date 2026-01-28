"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser } from "@clerk/nextjs"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { api } from "@/lib/api"

const onboardingSchema = z.object({
  // Name and email are NOT in schema - backend extracts them from Clerk token
  // This prevents any validation issues and ensures seamless OAuth onboarding
  role_intent: z.enum(["founder", "cofounder", "early_employee"]),
  stage_preference: z.enum(["idea", "mvp", "revenue", "growth"]).optional().or(z.literal("")),
  commitment: z.enum(["full_time", "part_time", "exploratory"]).optional().or(z.literal("")),
  location: z.string().max(255).optional().or(z.literal("")),
  working_style: z.enum(["structured", "chaotic", "flexible"]).optional().or(z.literal("")),
  communication_preference: z.enum(["async", "sync", "mixed"]).optional().or(z.literal("")),
  experience_years: z.coerce.number().min(0).max(70).optional().nullable(),
  previous_startups: z.coerce.number().min(0).max(50).optional().default(0),
  // URL fields: backend only validates max length (500), not URL format
  github_url: z.string().max(500).optional().or(z.literal("")),
  portfolio_url: z.string().max(500).optional().or(z.literal("")),
  linkedin_url: z.string().max(500).optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
})

type OnboardingFormData = z.infer<typeof onboardingSchema>

export function OnboardingForm() {
  const router = useRouter()
  const { getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    watch,
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    mode: "onSubmit", // Only validate on submit, not on change
    defaultValues: {
      // Don't set name/email defaults - backend will extract from Clerk token
      // This prevents empty strings from being sent and causing validation errors
      previous_startups: 0,
    },
  })

  // Get Clerk user info for display
  const clerkName = clerkUser?.fullName || clerkUser?.firstName || "User"
  const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress || ""
  const clerkAvatar = clerkUser?.imageUrl || ""

  const onSubmit = async (data: OnboardingFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Validate required field
      if (!data.role_intent) {
        throw new Error("Please select what you're looking for (founder, cofounder, or early employee)")
      }

      const token = await getToken()
      if (!token) {
        throw new Error("Not authenticated. Please sign in again.")
      }

      // Name and email are NOT in the schema, so they won't be in data
      // Backend will extract them from Clerk JWT token automatically
      const submitData = { ...data }
      
      // Clean up empty URL strings
      if (!submitData.github_url || submitData.github_url.trim() === "") {
        delete submitData.github_url
      }
      if (!submitData.portfolio_url || submitData.portfolio_url.trim() === "") {
        delete submitData.portfolio_url
      }
      if (!submitData.linkedin_url || submitData.linkedin_url.trim() === "") {
        delete submitData.linkedin_url
      }
      
      // Clean up empty optional strings
      if (!submitData.bio || submitData.bio.trim() === "") {
        delete submitData.bio
      }
      if (!submitData.location || submitData.location.trim() === "") {
        delete submitData.location
      }
      
      // Remove NaN/null/undefined values from number fields
      if (submitData.experience_years == null || isNaN(submitData.experience_years)) {
        delete submitData.experience_years
      }
      if (submitData.previous_startups == null || isNaN(submitData.previous_startups)) {
        submitData.previous_startups = 0 // Default to 0
      }

      console.log("Submitting onboarding data:", submitData) // Debug log

      // clerk_id, name, email, and avatar_url are extracted from the JWT token by the backend
      const result = await api.users.onboarding(submitData, token)
      console.log("Onboarding successful:", result)
      router.push("/dashboard")
    } catch (err) {
      console.error("Onboarding error:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to complete onboarding"
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const nextStep = async () => {
    const fieldsToValidate: (keyof OnboardingFormData)[] = []

    if (step === 1) {
      fieldsToValidate.push("role_intent", "bio")
    } else if (step === 2) {
      fieldsToValidate.push("experience_years", "previous_startups", "stage_preference")
    } else if (step === 3) {
      fieldsToValidate.push("location", "commitment", "working_style", "communication_preference")
    }

    const isValid = await trigger(fieldsToValidate)
    if (isValid) {
      setStep(s => Math.min(s + 1, 4))
    }
  }

  const prevStep = () => setStep(s => Math.max(s - 1, 1))

  const onError = (errors: any) => {
    console.error("Form validation errors:", errors)
    // Show first error message
    const firstError = Object.values(errors)[0] as any
    if (firstError?.message) {
      setError(`Please fix the form errors: ${firstError.message}`)
    } else {
      setError("Please fill in all required fields correctly")
    }
    // Scroll to first error
    const firstErrorField = Object.keys(errors)[0]
    const element = document.querySelector(`[name="${firstErrorField}"]`)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onError)} className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className={`h-2 flex-1 mx-1 rounded transition-colors ${
                i <= step ? "bg-zinc-900" : "bg-zinc-200"
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-zinc-600">Step {step} of 4</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold text-zinc-900 tracking-tight">Tell us about yourself</h2>

          {/* Display Clerk-provided info (from OAuth) */}
          {(clerkName || clerkEmail) && (
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
              <p className="text-sm font-medium text-zinc-700 mb-3">Your account information</p>
              <div className="space-y-2">
                {clerkName && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-600">Name:</span>
                    <span className="text-sm font-medium text-zinc-900">{clerkName}</span>
                    <span className="text-xs text-zinc-500">(from {clerkUser?.primaryEmailAddress?.verification?.strategy || "your account"})</span>
                  </div>
                )}
                {clerkEmail && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-600">Email:</span>
                    <span className="text-sm font-medium text-zinc-900">{clerkEmail}</span>
                    {clerkUser?.primaryEmailAddress?.verification?.status === "verified" && (
                      <span className="text-xs text-green-600">✓ Verified</span>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-3">
                This information is automatically used from your account. No need to re-enter it!
              </p>
            </div>
          )}

          <div>
            <label htmlFor="role_intent" className="block text-sm font-medium text-zinc-700 mb-2">
              What are you looking for? *
            </label>
            <select
              id="role_intent"
              {...register("role_intent")}
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
            >
              <option value="">Select your role</option>
              <option value="founder">I&apos;m a founder looking for a co-founder</option>
              <option value="cofounder">I want to be a co-founder</option>
              <option value="early_employee">I want to join as an early employee</option>
            </select>
            {errors.role_intent && (
              <p className="text-red-500 text-sm mt-1">{errors.role_intent.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Tell us about yourself
            </label>
            <textarea
              {...register("bio")}
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
              rows={5}
              placeholder="Share your background, interests, and what you're passionate about building..."
            />
            {errors.bio && (
              <p className="text-red-500 text-sm mt-1">{errors.bio.message}</p>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold text-zinc-900 tracking-tight">Your experience</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Years of experience
            </label>
            <input
              {...register("experience_years")}
              type="number"
              min="0"
              max="70"
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
              placeholder="5"
            />
            {errors.experience_years && (
              <p className="text-red-500 text-sm mt-1">{errors.experience_years.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Previous startups
            </label>
            <input
              {...register("previous_startups")}
              type="number"
              min="0"
              max="50"
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
              placeholder="0"
            />
            {errors.previous_startups && (
              <p className="text-red-500 text-sm mt-1">{errors.previous_startups.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Stage preference
            </label>
            <select
              {...register("stage_preference")}
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
            >
              <option value="">Select preferred stage</option>
              <option value="idea">Idea stage - Just getting started</option>
              <option value="mvp">MVP stage - Building the product</option>
              <option value="revenue">Revenue stage - Growing customers</option>
              <option value="growth">Growth stage - Scaling up</option>
            </select>
            {errors.stage_preference && (
              <p className="text-red-500 text-sm mt-1">{errors.stage_preference.message}</p>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold text-zinc-900 tracking-tight">Working preferences</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Location
            </label>
            <input
              {...register("location")}
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
              placeholder="e.g., San Francisco, CA or Remote"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Format: City, State/Province (e.g., &quot;San Francisco, CA&quot;, &quot;New York, NY&quot;, &quot;London, UK&quot;) or &quot;Remote&quot;
            </p>
            {errors.location && (
              <p className="text-red-500 text-sm mt-1">{errors.location.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Commitment level
            </label>
            <select
              {...register("commitment")}
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
            >
              <option value="">Select commitment level</option>
              <option value="full_time">Full-time - Ready to dive in</option>
              <option value="part_time">Part-time - Nights and weekends</option>
              <option value="exploratory">Exploratory - Just exploring options</option>
            </select>
            {errors.commitment && (
              <p className="text-red-500 text-sm mt-1">{errors.commitment.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Working style
            </label>
            <select
              {...register("working_style")}
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
            >
              <option value="">Select working style</option>
              <option value="structured">Structured - Plans and schedules</option>
              <option value="chaotic">Chaotic - Move fast and break things</option>
              <option value="flexible">Flexible - Adaptable to the situation</option>
            </select>
            {errors.working_style && (
              <p className="text-red-500 text-sm mt-1">{errors.working_style.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Communication preference
            </label>
            <select
              {...register("communication_preference")}
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
            >
              <option value="">Select preference</option>
              <option value="async">Async - Slack, email, Loom</option>
              <option value="sync">Sync - Calls, meetings, in-person</option>
              <option value="mixed">Mixed - Best of both worlds</option>
            </select>
            {errors.communication_preference && (
              <p className="text-red-500 text-sm mt-1">{errors.communication_preference.message}</p>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold text-zinc-900 tracking-tight">Social links (optional)</h2>
          <p className="text-zinc-600 leading-relaxed">
            Help others learn more about you by sharing your work
          </p>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              GitHub URL
            </label>
            <input
              {...register("github_url")}
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
              placeholder="https://github.com/username"
            />
            {errors.github_url && (
              <p className="text-red-500 text-sm mt-1">{errors.github_url.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Portfolio URL
            </label>
            <input
              {...register("portfolio_url")}
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
              placeholder="https://yourportfolio.com"
            />
            {errors.portfolio_url && (
              <p className="text-red-500 text-sm mt-1">{errors.portfolio_url.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              LinkedIn URL
            </label>
            <input
              {...register("linkedin_url")}
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
              placeholder="https://linkedin.com/in/username"
            />
            {errors.linkedin_url && (
              <p className="text-red-500 text-sm mt-1">{errors.linkedin_url.message}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-6 border-t border-zinc-200">
        {step > 1 && (
          <button
            type="button"
            onClick={prevStep}
            className="px-6 py-3 border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors font-medium"
          >
            Back
          </button>
        )}

        {step < 4 ? (
          <button
            type="button"
            onClick={nextStep}
            className="ml-auto px-6 py-3 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors shadow-sm font-medium"
          >
            Next
          </button>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting}
            className="ml-auto px-6 py-3 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm font-medium"
          >
            {isSubmitting ? "Submitting..." : "Complete Onboarding"}
          </button>
        )}
      </div>
    </form>
  )
}
