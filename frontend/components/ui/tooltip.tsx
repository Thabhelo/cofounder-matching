import * as React from "react"

import { cn } from "@/lib/utils"

export const TooltipProvider = ({ children }: { children?: React.ReactNode }) => <>{children}</>

export const Tooltip = ({ children }: { children?: React.ReactNode }) => <>{children}</>

export const TooltipTrigger = ({
  children,
  asChild: _asChild,
}: {
  children?: React.ReactNode
  asChild?: boolean
}) => <>{children}</>

export const TooltipContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-md border bg-white px-2 py-1 text-xs text-black", className)}
      {...props}
    />
  ),
)
TooltipContent.displayName = "TooltipContent"

