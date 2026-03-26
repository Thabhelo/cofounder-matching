import { useId } from "react"
import { UseFormValidationResult } from "@/hooks/useFormValidation"

/**
 * Base validated form field props
 */
interface BaseFormFieldProps {
  name: string
  label?: string
  required?: boolean
  validation?: UseFormValidationResult<any>
  className?: string
}

/**
 * Validated text input field
 */
interface TextFieldProps extends BaseFormFieldProps {
  type?: "text" | "email" | "url" | "password"
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  minLength?: number
}

export function TextField({
  name,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  validation,
  maxLength,
  minLength,
  className = "",
}: TextFieldProps) {
  const id = useId()
  const error = validation?.getFieldError(name)
  const isTouched = validation?.isFieldTouched(name)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)

    // Validate on change if field has been touched
    if (validation && isTouched) {
      validation.validateField(name, newValue)
    }
  }

  const handleBlur = () => {
    if (validation) {
      validation.validateField(name, value)
    }
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        minLength={minLength}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-transparent ${
          error ? "border-red-500" : "border-gray-300"
        }`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Validated select field
 */
interface SelectFieldProps extends BaseFormFieldProps {
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[] | Array<{ value: string; label: string }>
  placeholder?: string
}

export function SelectField({
  name,
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  validation,
  className = "",
}: SelectFieldProps) {
  const id = useId()
  const error = validation?.getFieldError(name)
  const isTouched = validation?.isFieldTouched(name)

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value
    onChange(newValue)

    // Validate on change if field has been touched
    if (validation && isTouched) {
      validation.validateField(name, newValue)
    }
  }

  const handleBlur = () => {
    if (validation) {
      validation.validateField(name, value)
    }
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-transparent ${
          error ? "border-red-500" : "border-gray-300"
        }`}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Validated radio group field
 */
interface RadioGroupFieldProps extends BaseFormFieldProps {
  value: string | boolean
  onChange: (value: string | boolean) => void
  options: Array<{ value: string | boolean; label: string }>
}

export function RadioGroupField({
  name,
  label,
  value,
  onChange,
  options,
  required,
  validation,
  className = "",
}: RadioGroupFieldProps) {
  const id = useId()
  const error = validation?.getFieldError(name)
  const isTouched = validation?.isFieldTouched(name)

  const handleChange = (newValue: string | boolean) => {
    onChange(newValue)

    // Validate on change if field has been touched
    if (validation && isTouched) {
      validation.validateField(name, newValue)
    }
  }

  const handleBlur = () => {
    if (validation) {
      validation.validateField(name, value)
    }
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div
        className="space-y-2"
        role="radiogroup"
        aria-labelledby={label ? `${id}-label` : undefined}
        onBlur={handleBlur}
      >
        {options.map((option, index) => (
          <label key={String(option.value)} className="flex items-center gap-2">
            <input
              type="radio"
              name={name}
              value={String(option.value)}
              checked={value === option.value}
              onChange={() => handleChange(option.value)}
              required={required}
              aria-describedby={error ? `${id}-error` : undefined}
              className="rounded border-gray-300 text-zinc-900 focus:ring-zinc-900"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Enhanced form components that wrap existing components with validation
 */
import { RichTextArea as BaseRichTextArea } from "./RichTextArea"
import { LocationPicker as BaseLocationPicker } from "./LocationPicker"
import { MultiSelect as BaseMultiSelect } from "./MultiSelect"
import { TagInput as BaseTagInput } from "./TagInput"

interface ValidatedRichTextAreaProps extends BaseFormFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minLength?: number
  maxLength?: number
  rows?: number
}

export function ValidatedRichTextArea({
  name,
  label,
  value,
  onChange,
  validation,
  ...props
}: ValidatedRichTextAreaProps) {
  const error = validation?.getFieldError(name)
  const isTouched = validation?.isFieldTouched(name)

  const handleChange = (newValue: string) => {
    onChange(newValue)

    // Validate on change if field has been touched
    if (validation && isTouched) {
      validation.validateField(name, newValue)
    }
  }

  const handleBlur = () => {
    if (validation) {
      validation.validateField(name, value)
    }
  }

  return (
    <div onBlur={handleBlur}>
      <BaseRichTextArea
        {...props}
        label={label}
        value={value}
        onChange={handleChange}
        error={error}
      />
    </div>
  )
}

interface ValidatedLocationPickerProps extends BaseFormFieldProps {
  value: string
  onChange: (value: string, components?: any) => void
  placeholder?: string
}

export function ValidatedLocationPicker({
  name,
  value,
  onChange,
  validation,
  ...props
}: ValidatedLocationPickerProps) {
  const error = validation?.getFieldError(name)

  const handleChange = (newValue: string, components?: any) => {
    onChange(newValue, components)

    if (validation) {
      validation.validateField(name, newValue)
    }
  }

  return (
    <BaseLocationPicker
      {...props}
      value={value}
      onChange={handleChange}
      error={error}
    />
  )
}

interface ValidatedMultiSelectProps extends BaseFormFieldProps {
  value: string[]
  onChange: (value: string[]) => void
  options: readonly { value: string; label: string }[] | Array<{ value: string; label: string }>
  minSelection?: number
}

export function ValidatedMultiSelect({
  name,
  label,
  value,
  onChange,
  validation,
  ...props
}: ValidatedMultiSelectProps) {
  const error = validation?.getFieldError(name)
  const isTouched = validation?.isFieldTouched(name)

  const handleChange = (newValue: string[]) => {
    onChange(newValue)

    // Validate on change if field has been touched
    if (validation && isTouched) {
      validation.validateField(name, newValue)
    }
  }

  const handleBlur = () => {
    if (validation) {
      validation.validateField(name, value)
    }
  }

  return (
    <div onBlur={handleBlur}>
      <BaseMultiSelect
        {...props}
        label={label}
        value={value}
        onChange={handleChange}
        error={error}
      />
    </div>
  )
}