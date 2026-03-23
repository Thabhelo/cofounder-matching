import * as React from "react"

import { cn } from "@/lib/utils"

export type SeparatorProps = React.HTMLAttributes<HTMLHRElement> & {
  orientation?: "horizontal" | "vertical"
}

export const Separator = React.forwardRef<HTMLHRElement, SeparatorProps>(
  ({ className, orientation = "horizontal", ...props }, ref) => (
    <hr
      ref={ref}
      className={cn(
        orientation === "horizontal" ? "-mx-1 my-2" : "h-10 w-px",
        "shrink-0 border-input",
        className,
      )}
      {...props}
    />
  ),
)
Separator.displayName = "Separator"

