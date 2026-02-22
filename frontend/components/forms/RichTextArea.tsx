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
}: RichTextAreaProps) {
  const id = useId()
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
        className={`w-full px-4 py-2 border rounded-lg ${error ? "border-red-500" : "border-gray-300"} focus:ring-2 focus:ring-zinc-900 focus:border-transparent`}
      />
      <p className="mt-1 text-sm text-gray-500 text-right">
        {error && <span className="text-red-600 float-left">{error}</span>}
        {value.length} / {maxLength}
      </p>
    </div>
  )
}
