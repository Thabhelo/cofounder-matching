import * as React from "react"

import { cn } from "@/lib/utils"

export const AlertDialog = ({ children }: { children?: React.ReactNode }) => <>{children}</>

export const AlertDialogTrigger = ({
  children,
  asChild: _asChild,
}: {
  children?: React.ReactNode
  asChild?: boolean
}) => <>{children}</>

export const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("fixed left-1/2 top-1/2 z-50 w-[90%] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-white p-4", className)}
      {...props}
    />
  ),
)
AlertDialogContent.displayName = "AlertDialogContent"

export const AlertDialogHeader = ({ children }: { children?: React.ReactNode }) => (
  <div className="mb-2 flex flex-col space-y-1.5 text-center">{children}</div>
)

export const AlertDialogFooter = ({ children }: { children?: React.ReactNode }) => (
  <div className="mt-4 flex items-center justify-end gap-2">{children}</div>
)

export const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
  ),
)
AlertDialogTitle.displayName = "AlertDialogTitle"

export const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
)
AlertDialogDescription.displayName = "AlertDialogDescription"

export const AlertDialogAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button ref={ref} className={cn("rounded-md border px-3 py-2 text-sm font-medium", className)} {...props} />
  ),
)
AlertDialogAction.displayName = "AlertDialogAction"

export const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button ref={ref} className={cn("rounded-md border px-3 py-2 text-sm font-medium", className)} {...props} />
  ),
)
AlertDialogCancel.displayName = "AlertDialogCancel"

