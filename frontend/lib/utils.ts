import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/** Sanitize user-supplied URLs — only allow http/https protocols. */
export function safeHref(url: string | null | undefined): string {
  if (!url) return "#"
  try {
    const u = new URL(url)
    if (u.protocol === "https:" || u.protocol === "http:") return url
  } catch {
    // Relative URLs are safe
    if (url.startsWith("/")) return url
  }
  return "#"
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
