import { OnboardingForm } from "@/components/forms/OnboardingForm"

export default function OnboardingPage() {
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
