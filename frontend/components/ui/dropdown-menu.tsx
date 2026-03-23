import * as React from "react"

import { cn } from "@/lib/utils"

export const DropdownMenu = ({ children }: { children?: React.ReactNode }) => <>{children}</>

export const DropdownMenuTrigger = ({
  children,
  asChild: _asChild,
}: {
  children?: React.ReactNode
  asChild?: boolean
}) => <>{children}</>

export const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" }
>(
  ({ className, align: _align, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("z-50 min-w-[10rem] rounded-md border bg-white p-1 shadow-sm", className)}
      {...props}
    />
  ),
)
DropdownMenuContent.displayName = "DropdownMenuContent"

export const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("cursor-pointer select-none rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-muted", inset && "pl-8", className)}
    {...props}
  />
))
DropdownMenuItem.displayName = "DropdownMenuItem"

export const DropdownMenuLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props} />
  ),
)
DropdownMenuLabel.displayName = "DropdownMenuLabel"

export const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("my-1 h-px bg-muted", className)} {...props} />
  ),
)
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

