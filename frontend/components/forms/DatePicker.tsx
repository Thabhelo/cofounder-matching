"use client"

import { useId } from "react"

type DatePickerProps = {
  value?: string
  onChange: (value: string) => void
  label?: string
  error?: string
  className?: string
  max?: string
}

export function DatePicker({ value, onChange, label, error, className = "", max }: DatePickerProps) {
  const id = useId()

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <input
        id={id}
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        max={max}
        className={`w-full px-4 py-2 border rounded-lg ${error ? "border-red-500" : "border-gray-300"} focus:ring-2 focus:ring-zinc-900 focus:border-transparent`}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
