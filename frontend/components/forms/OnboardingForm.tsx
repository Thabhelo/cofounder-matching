"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser } from "@clerk/nextjs"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { api } from "@/lib/api"

const onboardingSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role_intent: z.enum(["founder", "cofounder", "early_employee"]),
  stage_preference: z.enum(["idea", "mvp", "revenue", "growth"]).optional(),
  commitment: z.enum(["full_time", "part_time", "exploratory"]).optional(),
  location: z.string().optional(),
  working_style: z.enum(["structured", "chaotic", "flexible"]).optional(),
  communication_preference: z.enum(["async", "sync", "mixed"]).optional(),
  experience_years: z.coerce.number().min(0).max(70).optional(),
  previous_startups: z.coerce.number().min(0).max(50).optional(),
  github_url: z.string().url().optional().or(z.literal("")),
  portfolio_url: z.string().url().optional().or(z.literal("")),
  linkedin_url: z.string().url().optional().or(z.literal("")),
  bio: z.string().max(2000).optional(),
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
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: clerkUser?.fullName || "",
      email: clerkUser?.primaryEmailAddress?.emailAddress || "",
      previous_startups: 0,
    },
  })

  const onSubmit = async (data: OnboardingFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const token = await getToken()
      if (!token) {
        throw new Error("Not authenticated")
      }

      // clerk_id is now extracted from the JWT token by the backend
      await api.users.onboarding(data, token)
      router.push("/dashboard")
    } catch (err) {
      console.error("Onboarding error:", err)
      setError(err instanceof Error ? err.message : "Failed to complete onboarding")
    } finally {
      setIsSubmitting(false)
    }
  }

  const nextStep = async () => {
    const fieldsToValidate: (keyof OnboardingFormData)[] = []

    if (step === 1) {
      fieldsToValidate.push("name", "email", "role_intent", "bio")
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className={`h-2 flex-1 mx-1 rounded transition-colors ${
                i <= step ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-gray-600">Step {step} of 4</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-gray-900">Tell us about yourself</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name *
            </label>
            <input
              {...register("name")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Your name"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              {...register("email")}
              type="email"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="your@email.com"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What are you looking for? *
            </label>
            <select
              {...register("role_intent")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select your role</option>
              <option value="founder">I'm a founder looking for a co-founder</option>
              <option value="cofounder">I want to be a co-founder</option>
              <option value="early_employee">I want to join as an early employee</option>
            </select>
            {errors.role_intent && (
              <p className="text-red-500 text-sm mt-1">{errors.role_intent.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tell us about yourself
            </label>
            <textarea
              {...register("bio")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <h2 className="text-3xl font-bold text-gray-900">Your experience</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Years of experience
            </label>
            <input
              {...register("experience_years")}
              type="number"
              min="0"
              max="70"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="5"
            />
            {errors.experience_years && (
              <p className="text-red-500 text-sm mt-1">{errors.experience_years.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Previous startups
            </label>
            <input
              {...register("previous_startups")}
              type="number"
              min="0"
              max="50"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0"
            />
            {errors.previous_startups && (
              <p className="text-red-500 text-sm mt-1">{errors.previous_startups.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stage preference
            </label>
            <select
              {...register("stage_preference")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <h2 className="text-3xl font-bold text-gray-900">Working preferences</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <input
              {...register("location")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., San Francisco, CA or Remote"
            />
            {errors.location && (
              <p className="text-red-500 text-sm mt-1">{errors.location.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Commitment level
            </label>
            <select
              {...register("commitment")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Working style
            </label>
            <select
              {...register("working_style")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Communication preference
            </label>
            <select
              {...register("communication_preference")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <h2 className="text-3xl font-bold text-gray-900">Social links (optional)</h2>
          <p className="text-gray-600">
            Help others learn more about you by sharing your work
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GitHub URL
            </label>
            <input
              {...register("github_url")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://github.com/username"
            />
            {errors.github_url && (
              <p className="text-red-500 text-sm mt-1">{errors.github_url.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Portfolio URL
            </label>
            <input
              {...register("portfolio_url")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://yourportfolio.com"
            />
            {errors.portfolio_url && (
              <p className="text-red-500 text-sm mt-1">{errors.portfolio_url.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              LinkedIn URL
            </label>
            <input
              {...register("linkedin_url")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://linkedin.com/in/username"
            />
            {errors.linkedin_url && (
              <p className="text-red-500 text-sm mt-1">{errors.linkedin_url.message}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-6 border-t">
        {step > 1 && (
          <button
            type="button"
            onClick={prevStep}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
        )}

        {step < 4 ? (
          <button
            type="button"
            onClick={nextStep}
            className="ml-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Next
          </button>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting}
            className="ml-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Submitting..." : "Complete Onboarding"}
          </button>
        )}
      </div>
    </form>
  )
}
