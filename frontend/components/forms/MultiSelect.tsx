"use client"

import { useId } from "react"

export type Option = { value: string; label: string }

type MultiSelectProps = {
  options: readonly Option[] | Option[]
  value: string[]
  onChange: (value: string[]) => void
  label?: string
  name?: string
  error?: string
  minSelection?: number
  className?: string
}

export function MultiSelect({
  options,
  value,
  onChange,
  label,
  name,
  error,
  minSelection,
  className = "",
}: MultiSelectProps) {
  const id = useId()
  const slugId = label ? label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : id
  const errorId = `${slugId}-error`

  const toggle = (v: string) => {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v))
    } else {
      onChange([...value, v])
    }
  }

  return (
    <div className={className} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {minSelection != null && minSelection > 0 && (
            <span className="text-gray-500 ml-1">(select at least {minSelection})</span>
          )}
        </label>
      )}
      <div
        className="space-y-2"
        role="group"
        aria-labelledby={label ? id : undefined}
      >
        {(options as Option[]).map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name={name}
              checked={value.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              className="rounded border-gray-300 text-zinc-900 focus:ring-zinc-900"
            />
            <span className="text-gray-900">{opt.label}</span>
          </label>
        ))}
      </div>
      {error && <p id={errorId} className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
