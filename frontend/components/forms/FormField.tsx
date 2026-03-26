import React from 'react'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: string
  error?: string | null
  required?: boolean
  children: React.ReactNode
  className?: string
}

/**
 * Form field wrapper with label and inline error display
 */
export function FormField({ label, error, required, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        {children}
      </div>

      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | null
}

/**
 * Input component with error state styling
 */
export function FormInput({ error, className, ...props }: FormInputProps) {
  return (
    <input
      className={cn(
        "w-full px-4 py-2 border rounded-lg transition-colors",
        error
          ? "border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500"
          : "border-gray-300 focus:outline-none focus:ring-zinc-500 focus:border-zinc-500",
        className
      )}
      aria-invalid={error ? 'true' : 'false'}
      aria-describedby={error ? `${props.name}-error` : undefined}
      {...props}
    />
  )
}

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string | null
}

/**
 * Textarea component with error state styling
 */
export function FormTextarea({ error, className, ...props }: FormTextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full px-4 py-2 border rounded-lg transition-colors",
        error
          ? "border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500"
          : "border-gray-300 focus:outline-none focus:ring-zinc-500 focus:border-zinc-500",
        className
      )}
      aria-invalid={error ? 'true' : 'false'}
      aria-describedby={error ? `${props.name}-error` : undefined}
      {...props}
    />
  )
}

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string | null
  options: readonly { value: string; label: string }[]
  placeholder?: string
}

/**
 * Select component with error state styling
 */
export function FormSelect({ error, options, placeholder, className, ...props }: FormSelectProps) {
  return (
    <select
      className={cn(
        "w-full px-4 py-2 border rounded-lg transition-colors bg-white",
        error
          ? "border-red-300 text-red-900 focus:outline-none focus:ring-red-500 focus:border-red-500"
          : "border-gray-300 focus:outline-none focus:ring-zinc-500 focus:border-zinc-500",
        className
      )}
      aria-invalid={error ? 'true' : 'false'}
      aria-describedby={error ? `${props.name}-error` : undefined}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}