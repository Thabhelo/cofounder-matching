import * as React from "react"

import { cn } from "@/lib/utils"

export type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number
  indicatorClassName?: string
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, indicatorClassName, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        className={indicatorClassName ? indicatorClassName : "h-full w-full flex-1 bg-primary transition-[width] duration-300"}
        style={{ width: value == null ? "0%" : `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  ),
)
Progress.displayName = "Progress"

