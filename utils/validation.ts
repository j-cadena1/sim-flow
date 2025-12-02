/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a required text field
 */
export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return {
      isValid: false,
      error: `${fieldName} is required`,
    };
  }
  return { isValid: true };
}

/**
 * Validates text length
 */
export function validateLength(
  value: string,
  fieldName: string,
  min?: number,
  max?: number
): ValidationResult {
  const length = value.trim().length;

  if (min !== undefined && length < min) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${min} characters`,
    };
  }

  if (max !== undefined && length > max) {
    return {
      isValid: false,
      error: `${fieldName} must be no more than ${max} characters`,
    };
  }

  return { isValid: true };
}

/**
 * Validates a number field
 */
export function validateNumber(
  value: number,
  fieldName: string,
  min?: number,
  max?: number
): ValidationResult {
  if (isNaN(value)) {
    return {
      isValid: false,
      error: `${fieldName} must be a valid number`,
    };
  }

  if (min !== undefined && value < min) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${min}`,
    };
  }

  if (max !== undefined && value > max) {
    return {
      isValid: false,
      error: `${fieldName} must be no more than ${max}`,
    };
  }

  return { isValid: true };
}

/**
 * Validates form data for new request
 */
export function validateNewRequest(
  title: string,
  description: string
): Record<string, string | undefined> {
  const errors: Record<string, string | undefined> = {};

  const titleValidation = validateRequired(title, 'Title');
  if (!titleValidation.isValid) {
    errors.title = titleValidation.error;
  } else {
    const lengthValidation = validateLength(title, 'Title', 3, 100);
    if (!lengthValidation.isValid) {
      errors.title = lengthValidation.error;
    }
  }

  const descValidation = validateRequired(description, 'Description');
  if (!descValidation.isValid) {
    errors.description = descValidation.error;
  } else {
    const lengthValidation = validateLength(description, 'Description', 10, 2000);
    if (!lengthValidation.isValid) {
      errors.description = lengthValidation.error;
    }
  }

  return errors;
}

/**
 * Validates estimated hours
 */
export function validateEstimatedHours(hours: number): ValidationResult {
  return validateNumber(hours, 'Estimated hours', 1, 1000);
}

/**
 * Validates comment content
 */
export function validateComment(content: string): ValidationResult {
  const requiredCheck = validateRequired(content, 'Comment');
  if (!requiredCheck.isValid) return requiredCheck;

  return validateLength(content, 'Comment', 1, 500);
}
