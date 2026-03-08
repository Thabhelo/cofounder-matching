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
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Spacer for mobile fixed top header */}
        <div className="h-14 md:hidden shrink-0" />
        <div className="flex-1 min-w-0">
          {children}
        </div>
        {/* Spacer for mobile fixed bottom nav */}
        <div className="h-16 md:hidden shrink-0" />
      </div>
    </div>
  )
}
