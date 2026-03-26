import { z } from "zod"

/**
 * Form validation utilities for integrating Zod schemas with form components
 */

export type ValidationErrors = Record<string, string>

/**
 * Parse backend validation errors into a format suitable for form fields
 */
export function parseValidationErrors(error: any): ValidationErrors {
  const errors: ValidationErrors = {}

  if (error?.detail && Array.isArray(error.detail)) {
    // FastAPI/Pydantic validation errors
    error.detail.forEach((err: any) => {
      const field = err.loc?.slice(-1)[0] // Get the field name from location
      const message = err.msg
      if (field && message) {
        errors[field] = message
      }
    })
  } else if (error?.errors && Array.isArray(error.errors)) {
    // Generic validation errors array
    error.errors.forEach((err: any) => {
      if (err.field && err.message) {
        errors[err.field] = err.message
      }
    })
  } else if (error?.message && typeof error.message === "string") {
    // Generic error message
    errors._form = error.message
  }

  return errors
}

/**
 * Validate form data against a Zod schema and return errors
 */
export function validateForm<T>(schema: z.ZodSchema<T>, data: any): ValidationErrors {
  const result = schema.safeParse(data)
  const errors: ValidationErrors = {}

  if (!result.success) {
    result.error.issues.forEach((err: any) => {
      const field = err.path.join(".")
      errors[field] = err.message
    })
  }

  return errors
}

/**
 * Validate a single field against a Zod schema
 */
export function validateField<T>(schema: z.ZodSchema<T>, fieldName: string, value: any, fullData: any = {}): string | undefined {
  try {
    // Try to validate just this field by creating a partial schema
    const schemaAny = schema as any
    const fieldSchema = schemaAny.shape?.[fieldName]
    if (fieldSchema) {
      fieldSchema.parse(value)
    } else {
      // Fallback: validate the full object and extract this field's error
      const result = schema.safeParse({ ...fullData, [fieldName]: value })
      if (!result.success) {
        const fieldError = result.error.issues.find((err: any) => err.path[0] === fieldName)
        if (fieldError) {
          return fieldError.message
        }
      }
    }
    return undefined
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.issues[0]?.message
    }
    return "Invalid value"
  }
}

/**
 * Hook-like utility for managing form validation state
 */
export class FormValidator<T> {
  private schema: z.ZodSchema<T>
  private errors: ValidationErrors = {}
  private touchedFields: Set<string> = new Set()

  constructor(schema: z.ZodSchema<T>) {
    this.schema = schema
  }

  /**
   * Validate the entire form
   */
  validateAll(data: any): ValidationErrors {
    this.errors = validateForm(this.schema, data)
    // Mark all fields as touched
    Object.keys(data).forEach(key => this.touchedFields.add(key))
    return this.errors
  }

  /**
   * Validate a single field
   */
  validateField(fieldName: string, value: any, fullData: any = {}): string | undefined {
    this.touchedFields.add(fieldName)
    const error = validateField(this.schema, fieldName, value, fullData)

    if (error) {
      this.errors[fieldName] = error
    } else {
      delete this.errors[fieldName]
    }

    return error
  }

  /**
   * Set backend validation errors
   */
  setBackendErrors(backendErrors: any): void {
    const parsed = parseValidationErrors(backendErrors)
    this.errors = { ...this.errors, ...parsed }
    // Mark all error fields as touched
    Object.keys(parsed).forEach(key => this.touchedFields.add(key))
  }

  /**
   * Get error for a specific field
   */
  getFieldError(fieldName: string): string | undefined {
    return this.errors[fieldName]
  }

  /**
   * Get all errors
   */
  getErrors(): ValidationErrors {
    return this.errors
  }

  /**
   * Check if a field has been touched
   */
  isFieldTouched(fieldName: string): boolean {
    return this.touchedFields.has(fieldName)
  }

  /**
   * Check if form is valid
   */
  isValid(): boolean {
    return Object.keys(this.errors).length === 0
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors = {}
  }

  /**
   * Clear errors for a specific field
   */
  clearFieldError(fieldName: string): void {
    delete this.errors[fieldName]
  }

  /**
   * Reset validation state
   */
  reset(): void {
    this.errors = {}
    this.touchedFields.clear()
  }
}