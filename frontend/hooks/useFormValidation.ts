import { useState, useCallback, useMemo } from "react"
import { z } from "zod"
import { FormValidator, ValidationErrors } from "@/lib/validation"

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
 * React hook for form validation using Zod schemas
 *
 * @param schema - Zod schema to validate against
 * @param options - Configuration options
 * @returns Validation utilities and state
 */
export function useFormValidation<T>(
  schema: z.ZodSchema<T>,
  options: {
    validateOnChange?: boolean
    validateOnBlur?: boolean
    showErrorsOnlyAfterTouch?: boolean
  } = {}
): UseFormValidationResult<T> {
  const {
    validateOnChange = false,
    validateOnBlur = true,
    showErrorsOnlyAfterTouch = true,
  } = options

  // Create validator instance
  const validator = useMemo(() => new FormValidator(schema), [schema])

  // Force re-render when validation state changes
  const [, setUpdateTrigger] = useState({})
  const triggerUpdate = useCallback(() => setUpdateTrigger({}), [])

  // Validation methods
  const validateField = useCallback((fieldName: string, value: any, fullData: any = {}) => {
    const error = validator.validateField(fieldName, value, fullData)
    triggerUpdate()
    return error
  }, [validator, triggerUpdate])

  const validateAll = useCallback((data: any): boolean => {
    validator.validateAll(data)
    triggerUpdate()
    return validator.isValid()
  }, [validator, triggerUpdate])

  const validateAndGetErrors = useCallback((data: any): ValidationErrors => {
    const errors = validator.validateAll(data)
    triggerUpdate()
    return errors
  }, [validator, triggerUpdate])

  const setBackendErrors = useCallback((backendErrors: any) => {
    validator.setBackendErrors(backendErrors)
    triggerUpdate()
  }, [validator, triggerUpdate])

  const getFieldError = useCallback((fieldName: string): string | undefined => {
    const error = validator.getFieldError(fieldName)
    const isFieldTouched = validator.isFieldTouched(fieldName)

    // Only show error if field has been touched (when enabled)
    if (showErrorsOnlyAfterTouch && !isFieldTouched) {
      return undefined
    }

    return error
  }, [validator, showErrorsOnlyAfterTouch])

  const isFieldTouched = useCallback((fieldName: string): boolean => {
    return validator.isFieldTouched(fieldName)
  }, [validator])

  const clearFieldError = useCallback((fieldName: string) => {
    validator.clearFieldError(fieldName)
    triggerUpdate()
  }, [validator, triggerUpdate])

  const clearErrors = useCallback(() => {
    validator.clearErrors()
    triggerUpdate()
  }, [validator, triggerUpdate])

  const reset = useCallback(() => {
    validator.reset()
    triggerUpdate()
  }, [validator, triggerUpdate])

  // Current validation state
  const errors = validator.getErrors()
  const isValid = validator.isValid()
  const hasErrors = Object.keys(errors).length > 0

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

/**
 * Higher-order function to create field handlers with built-in validation
 */
export function createValidatedFieldHandlers<T>(
  validation: UseFormValidationResult<T>,
  formData: any,
  setFormData: (data: any) => void
) {
  const handleChange = (fieldName: string) => (value: any) => {
    const newData = { ...formData, [fieldName]: value }
    setFormData(newData)

    // Validate on change if enabled
    validation.validateField(fieldName, value, newData)
  }

  const handleBlur = (fieldName: string) => () => {
    // Validate on blur
    validation.validateField(fieldName, formData[fieldName], formData)
  }

  return {
    handleChange,
    handleBlur,
  }
}