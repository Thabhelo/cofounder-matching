"use client"

import { useId } from "react"

type RichTextAreaProps = {
  value: string
  onChange: (value: string) => void
  label?: string
  name?: string
  placeholder?: string
  error?: string
  minLength?: number
  maxLength?: number
  rows?: number
  className?: string
  required?: boolean
}

export function RichTextArea({
  value,
  onChange,
  label,
  name,
  placeholder,
  error,
  minLength,
  maxLength = 2000,
  rows = 4,
  className = "",
  required,
}: RichTextAreaProps) {
  const id = useId()
  const slugId = label ? label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : id
  const errorId = `${slugId}-error`
  const countId = `${slugId}-count`
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {minLength != null && <span className="text-gray-500 ml-1">(min {minLength} characters)</span>}
        </label>
      )}
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : countId}
        aria-required={required}
        className={`w-full px-4 py-2 border rounded-lg ${error ? "border-red-500" : "border-gray-300"} focus:ring-2 focus:ring-zinc-900 focus:border-transparent`}
      />
      <p className="mt-1 text-sm text-gray-500 text-right">
        {error && <span id={errorId} role="alert" className="text-red-600 float-left">{error}</span>}
        <span id={countId} aria-live="polite" aria-atomic="true">{value.length} / {maxLength}</span>
      </p>
    </div>
  )
}
