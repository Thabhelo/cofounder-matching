"use client"

import { cn } from "@/lib/utils"

interface LoaderProps {
  size?: "sm" | "md" | "lg"
  label?: string
  className?: string
}

export function Loader({ size = "md", label, className }: LoaderProps) {
  const sizes = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  }

  const dotSizes = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
    lg: "h-2.5 w-2.5",
  }

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)} role="status">
      <div className={cn("relative", sizes[size])}>
        {/* Outer ring */}
        <div
          className={cn(
            "absolute inset-0 rounded-full border-2 border-muted-foreground/10",
            sizes[size]
          )}
        />
        {/* Spinning arc */}
        <div
          className={cn(
            "absolute inset-0 rounded-full border-2 border-transparent border-t-foreground animate-spin",
            sizes[size]
          )}
          style={{ animationDuration: "0.8s" }}
        />
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn("rounded-full bg-foreground animate-pulse", dotSizes[size])}
            style={{ animationDuration: "1.5s" }}
          />
        </div>
      </div>
      {label && (
        <p className="text-sm text-muted-foreground animate-pulse" style={{ animationDuration: "2s" }}>
          {label}
        </p>
      )}
      <span className="sr-only">{label || "Loading..."}</span>
    </div>
  )
}

/** Full-page centered loader */
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh]">
      <Loader size="lg" label={label} />
    </div>
  )
}
