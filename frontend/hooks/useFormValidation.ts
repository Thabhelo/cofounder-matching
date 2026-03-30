import { useState, useCallback } from "react"
import { validateForm, validators, type ValidationErrors } from "@/lib/validation"

export interface UseFormValidationResult<T> {
  // Validation state
  errors: ValidationErrors
  isValid: boolean
  hasErrors: boolean

  // Field-level validation
  validateField: (fieldName: string, value: any, fullData?: any) => string | undefined
  getFieldError: (fieldName: string) => string | undefined
  isFieldTouched: (fieldName: string) => boolean
  clearFieldError: (fieldName: string) => void

  // Form-level validation
  validateAll: (data: any) => boolean
  validateAndGetErrors: (data: any) => ValidationErrors

  // Backend error handling
  setBackendErrors: (backendErrors: any) => void

  // Utility functions
  clearErrors: () => void
  reset: () => void
}

/**
 * React hook for form validation using simple validators
 * @deprecated - Use direct validateForm calls instead for simpler approach
 */
export function useFormValidation<T>(
  _schema: any, // Ignored, kept for compatibility
  options: {
    validateOnChange?: boolean
    validateOnBlur?: boolean
    showErrorsOnlyAfterTouch?: boolean
  } = {}
): UseFormValidationResult<T> {
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set())

  const {
    showErrorsOnlyAfterTouch = true,
  } = options

  // Field-level validation - basic implementation
  const validateField = useCallback((fieldName: string, value: any, _fullData: any = {}) => {
    // Mark field as touched
    setTouchedFields(prev => new Set([...prev, fieldName]))

    // Simple validation - can be extended based on field requirements
    let error: string | undefined
    if (fieldName.includes('required') && !value) {
      error = `${fieldName} is required`
    }

    setErrors(prev => ({ ...prev, [fieldName]: error || '' }))
    return error
  }, [])

  const validateAll = useCallback((data: any): boolean => {
    // This is a stub - actual validation should be done with validateForm from validation.ts
    const hasErrors = Object.values(errors).some(error => error)
    return !hasErrors
  }, [errors])

  const validateAndGetErrors = useCallback((data: any): ValidationErrors => {
    return errors
  }, [errors])

  const setBackendErrors = useCallback((backendErrors: any) => {
    // Handle backend errors
    if (backendErrors && typeof backendErrors === 'object') {
      setErrors(prev => ({ ...prev, ...backendErrors }))
    }
  }, [])

  const getFieldError = useCallback((fieldName: string): string | undefined => {
    const error = errors[fieldName]
    const isFieldTouched = touchedFields.has(fieldName)

    if (showErrorsOnlyAfterTouch && !isFieldTouched) {
      return undefined
    }

    return error || undefined
  }, [errors, touchedFields, showErrorsOnlyAfterTouch])

  const isFieldTouched = useCallback((fieldName: string): boolean => {
    return touchedFields.has(fieldName)
  }, [touchedFields])

  const clearFieldError = useCallback((fieldName: string) => {
    setErrors(prev => ({ ...prev, [fieldName]: '' }))
  }, [])

  const clearErrors = useCallback(() => {
    setErrors({})
  }, [])

  const reset = useCallback(() => {
    setErrors({})
    setTouchedFields(new Set())
  }, [])

  const isValid = Object.values(errors).every(error => !error)
  const hasErrors = Object.values(errors).some(error => error)

  return {
    // State
    errors,
    isValid,
    hasErrors,

    // Field-level
    validateField,
    getFieldError,
    isFieldTouched,
    clearFieldError,

    // Form-level
    validateAll,
    validateAndGetErrors,

    // Backend errors
    setBackendErrors,

    // Utilities
    clearErrors,
    reset,
  }
}