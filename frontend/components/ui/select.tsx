import * as React from "react"

import { cn } from "@/lib/utils"

export type SelectProps = {
  value?: string
  onValueChange?: (value: string) => void
  children?: React.ReactNode
  className?: string
}

export function Select({ children, className }: SelectProps) {
  return <div className={cn(className)}>{children}</div>
}

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button ref={ref} className={cn("inline-flex items-center rounded-md border px-3 py-2", className)} {...props} />
))
SelectTrigger.displayName = "SelectTrigger"

export const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("z-50 mt-1 rounded-md border bg-white p-1", className)} {...props} />
))
SelectContent.displayName = "SelectContent"

export const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: string }
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("cursor-pointer rounded-sm px-2 py-1 hover:bg-muted", className)} {...props} />
))
SelectItem.displayName = "SelectItem"

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return <span>{placeholder ?? ""}</span>
}

