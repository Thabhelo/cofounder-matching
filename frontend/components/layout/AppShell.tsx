import { Sidebar } from "./Sidebar"

export function AppShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-zinc-900 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex-1 min-w-0">
        {/* Spacer for mobile fixed top header */}
        <div className="h-14 md:hidden" />
        <div
          id="main-content"
          className="flex flex-col min-h-[calc(100vh-3.5rem-4rem)] md:min-h-screen"
        >
          {children}
        </div>
        {/* Spacer for mobile fixed bottom nav */}
        <div className="h-16 md:hidden" />
      </div>
    </div>
  )
}
