import * as React from "react"

import { cn } from "@/lib/utils"

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | (string & {})
  size?: "default" | "sm" | "md" | "lg" | "icon" | (string & {})
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type, asChild: _asChild, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn("inline-flex items-center justify-center rounded-md font-medium", className)}
        data-variant={variant}
        data-size={size}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

