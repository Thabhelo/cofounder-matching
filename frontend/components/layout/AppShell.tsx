import { Sidebar } from "./Sidebar"
import { cn } from "@/lib/utils"

export function AppShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="h-screen bg-background flex overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col h-screen">
        {/* Spacer for mobile fixed top header */}
        <div className="h-14 md:hidden shrink-0" />
        <main
          id="main-content"
          className={cn(
            "flex-1 flex flex-col overflow-y-auto",
            className
          )}
        >
          {children}
        </main>
        {/* Spacer for mobile fixed bottom nav */}
        <div className="h-16 md:hidden shrink-0" />
      </div>
    </div>
  )
}
