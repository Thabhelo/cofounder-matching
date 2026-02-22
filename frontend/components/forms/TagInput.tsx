"use client"

import { useId, useState } from "react"

type TagInputProps = {
  options: readonly string[] | string[]
  value: string[]
  onChange: (value: string[]) => void
  label?: string
  placeholder?: string
  error?: string
  minSelection?: number
  className?: string
}

export function TagInput({
  options,
  value,
  onChange,
  label,
  placeholder = "Select or type to add",
  error,
  minSelection,
  className = "",
}: TagInputProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const optList = options as string[]

  const add = (v: string) => {
    if (!value.includes(v)) onChange([...value, v])
    setOpen(false)
  }

  const remove = (v: string) => {
    onChange(value.filter((x) => x !== v))
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {minSelection != null && minSelection > 0 && (
            <span className="text-gray-500 ml-1">(at least {minSelection})</span>
          )}
        </label>
      )}
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-100 text-zinc-900 text-sm"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              className="hover:text-red-600"
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <button
          type="button"
          id={id}
          onClick={() => setOpen(!open)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-left bg-white focus:ring-2 focus:ring-zinc-900"
        >
          {placeholder}
        </button>
        {open && (
          <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-auto border border-gray-200 rounded-lg bg-white shadow-lg">
            {optList
              .filter((o) => !value.includes(o))
              .map((o) => (
                <li key={o}>
                  <button
                    type="button"
                    className="w-full px-4 py-2 text-left hover:bg-gray-100"
                    onClick={() => add(o)}
                  >
                    {o}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
