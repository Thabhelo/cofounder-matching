/**
 * Validation error handling utilities for inline field-level errors
 */

export type ValidationErrors = Record<string, string>

/**
 * Parse API validation errors into field-level error map
 * @param error - API error response
 * @returns Object mapping field names to error messages
 */
export function parseValidationErrors(error: any): ValidationErrors {
  const errors: ValidationErrors = {}

  if (error?.detail && Array.isArray(error.detail)) {
    // FastAPI validation errors: [{ loc: [..., "field_name"], msg: "error message" }]
    error.detail.forEach((err: any) => {
      const field = err.loc?.slice(-1)[0]
      const message = err.msg
      if (field && message) {
        errors[field] = message
      }
    })
  } else if (typeof error?.detail === 'string') {
    // Generic error - apply to a general field
    errors._general = error.detail
  }

  return errors
}

/**
 * Client-side validation functions
 */
export const validators = {
  required: (value: string, fieldName = 'Field') => {
    if (!value || value.trim() === '') {
      return `${fieldName} is required`
    }
    return null
  },

  email: (value: string) => {
    if (!value) return null
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address'
    }
    return null
  },

  url: (value: string, fieldName = 'URL') => {
    if (!value) return null
    try {
      new URL(value)
      return null
    } catch {
      return `Please enter a valid ${fieldName}`
    }
  },

  linkedinUrl: (value: string) => {
    if (!value) return 'LinkedIn URL is required'
    const urlError = validators.url(value, 'LinkedIn URL')
    if (urlError) return urlError

    if (!value.includes('linkedin.com')) {
      return 'Please enter a valid LinkedIn URL (must contain linkedin.com)'
    }
    return null
  },

  minLength: (value: string, min: number, fieldName = 'Field') => {
    if (!value) return null
    if (value.trim().length < min) {
      return `${fieldName} must be at least ${min} characters`
    }
    return null
  },

  maxLength: (value: string, max: number, fieldName = 'Field') => {
    if (!value) return null
    if (value.length > max) {
      return `${fieldName} must be no more than ${max} characters`
    }
    return null
  }
}

/**
 * Validate a single field with multiple validators
 */
export function validateField(value: string, validatorFunctions: Array<(value: string) => string | null>): string | null {
  for (const validate of validatorFunctions) {
    const error = validate(value)
    if (error) return error
  }
  return null
}

/**
 * Validate an entire form object
 * @param formData - Form data object
 * @param fieldValidators - Map of field names to validator functions (partial - only validates specified fields)
 * @returns ValidationErrors object with any errors found
 */
export function validateForm<T extends Record<string, any>>(
  formData: T,
  fieldValidators: Partial<Record<keyof T, Array<(value: any) => string | null>>>
): ValidationErrors {
  const errors: ValidationErrors = {}

  for (const [field, validators] of Object.entries(fieldValidators)) {
    if (validators) {
      const value = formData[field]
      const error = validateField(String(value || ''), validators)
      if (error) {
        errors[field] = error
      }
    }
  }

  return errors
}