import { OnboardingForm } from "@/components/forms/OnboardingForm"

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Welcome to CoFounder Match
            </h1>
            <p className="text-lg text-gray-600">
              Let's get your profile set up so we can find your perfect match
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-8">
            <OnboardingForm />
          </div>
        </div>
      </div>
    </div>
  )
}
