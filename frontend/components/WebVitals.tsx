"use client"

import { useReportWebVitals } from "next/web-vitals"

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[Web Vitals] ${metric.name}:`, Math.round(metric.value), metric.rating)
    }
    // Forward to analytics endpoint when available
    if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        navigationType: metric.navigationType,
      })
      navigator.sendBeacon?.("/api/vitals", body)
    }
  })
  return null
}
