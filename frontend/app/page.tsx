import Link from "next/link"
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs"

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-zinc-200">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-zinc-900">CoFounder Match</h1>
          <div className="flex gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 transition-colors">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-5 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors shadow-sm">
                  Get Started
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="px-5 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors shadow-sm"
                >
                  Dashboard
                </Link>
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          {/* Hero Content */}
          <div className="text-center py-20 md:py-32">
            <h2 className="text-4xl md:text-6xl font-semibold text-zinc-900 mb-6 tracking-tight leading-tight">
              Find Your Perfect<br />Co-Founder
            </h2>
            <p className="text-lg md:text-xl text-zinc-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Connect with complementary co-founders, discover entrepreneurial resources,
              and navigate the startup ecosystem with confidence.
            </p>

            <div className="flex justify-center gap-4">
              <SignedOut>
                <SignUpButton mode="modal">
                  <button className="px-8 py-3 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors shadow-soft">
                    Start Matching Today
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/onboarding"
                  className="inline-block px-8 py-3 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors shadow-soft"
                >
                  Complete Your Profile
                </Link>
              </SignedIn>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 pb-20 md:pb-32">
            <div className="p-8 bg-white border border-zinc-200 rounded-xl hover:shadow-soft transition-shadow">
              <div className="w-12 h-12 bg-zinc-100 rounded-lg flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-zinc-900 mb-3">Smart Matching</h3>
              <p className="text-zinc-600 leading-relaxed">
                Find co-founders with complementary skills and aligned goals through intelligent matching algorithms.
              </p>
            </div>

            <div className="p-8 bg-white border border-zinc-200 rounded-xl hover:shadow-soft transition-shadow">
              <div className="w-12 h-12 bg-zinc-100 rounded-lg flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-zinc-900 mb-3">Resources</h3>
              <p className="text-zinc-600 leading-relaxed">
                Access curated funding opportunities, expert mentorship, legal support, and essential startup tools.
              </p>
            </div>

            <div className="p-8 bg-white border border-zinc-200 rounded-xl hover:shadow-soft transition-shadow">
              <div className="w-12 h-12 bg-zinc-100 rounded-lg flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-zinc-900 mb-3">Events</h3>
              <p className="text-zinc-600 leading-relaxed">
                Network at curated workshops, pitch competitions, and industry conferences to grow your network.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-zinc-600">
            &copy; 2026 TechStars - CoFounder Matching. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
