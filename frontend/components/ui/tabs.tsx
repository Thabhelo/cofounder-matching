import * as React from "react"

import { cn } from "@/lib/utils"

export type TabsProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  children?: React.ReactNode
}

export function Tabs({ value: _value, defaultValue: _defaultValue, onValueChange: _onValueChange, className, children }: TabsProps) {
  return <div className={cn(className)}>{children}</div>
}

export const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("inline-flex items-center gap-2", className)} {...props} />
  ),
)
TabsList.displayName = "TabsList"

export const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value: _value, type, ...props }, ref) => (
  <button ref={ref} type={type ?? "button"} className={cn("px-3 py-1 rounded", className)} {...props} />
))
TabsTrigger.displayName = "TabsTrigger"

export const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(className)} {...props} />
))
TabsContent.displayName = "TabsContent"

