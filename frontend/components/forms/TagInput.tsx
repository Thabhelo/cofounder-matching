"use client"

import { useId, useState, useRef, useEffect } from "react"

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
  placeholder = "Type to search or add...",
  error,
  minSelection,
  className = "",
}: TagInputProps) {
  const id = useId()
  const slugId = label ? label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : id
  const listboxId = `${slugId}-listbox`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const optList = options as string[]

  const filtered = optList.filter(
    (o) => !value.includes(o) && o.toLowerCase().includes(query.toLowerCase())
  )

  const add = (v: string) => {
    if (!value.includes(v)) onChange([...value, v])
    setQuery("")
    setOpen(false)
  }

  const addCustom = () => {
    const trimmed = query.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setQuery("")
    setOpen(false)
  }

  const remove = (v: string) => {
    onChange(value.filter((x) => x !== v))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (filtered.length > 0) {
        add(filtered[0])
      } else if (query.trim()) {
        addCustom()
      }
    } else if (e.key === "Escape") {
      setOpen(false)
      setQuery("")
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className={className} ref={containerRef}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
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
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          autoComplete="off"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
        />
        {open && (filtered.length > 0 || query.trim()) && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="absolute z-10 mt-1 w-full max-h-48 overflow-auto border border-gray-200 rounded-lg bg-white shadow-lg"
          >
            {filtered.map((o) => (
              <li key={o} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left hover:bg-gray-100"
                  onClick={() => add(o)}
                >
                  {o}
                </button>
              </li>
            ))}
            {query.trim() && !optList.some((o) => o.toLowerCase() === query.trim().toLowerCase()) && (
              <li role="option" aria-selected={false}>
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 text-zinc-600 italic"
                  onClick={addCustom}
                >
                  Add &ldquo;{query.trim()}&rdquo;
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
