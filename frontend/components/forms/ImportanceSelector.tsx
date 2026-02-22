"use client"

import { useId } from "react"
import { IMPORTANCE_LEVELS } from "@/lib/constants/enums"

type ImportanceSelectorProps = {
  value?: string | null
  onChange: (value: string) => void
  label?: string
  name?: string
  error?: string
  className?: string
}

export function ImportanceSelector({
  value,
  onChange,
  label,
  name,
  error,
  className = "",
}: ImportanceSelectorProps) {
  const id = useId()

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="flex flex-wrap gap-4" role="radiogroup" aria-labelledby={label ? id : undefined}>
        {IMPORTANCE_LEVELS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={(value ?? "") === opt.value}
              onChange={() => onChange(opt.value)}
              className="border-gray-300 text-zinc-900 focus:ring-zinc-900"
            />
            <span className="text-gray-900">{opt.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
