/**
 * Password complexity validation utility
 * Enforces strong password requirements for production security
 */

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

/**
 * Validates password complexity
 * @param password - The password to validate
 * @returns Validation result with error messages
 */
export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];

  // Check minimum length
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
  }

  // Check for uppercase letter
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letter
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for number
  if (PASSWORD_REQUIREMENTS.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for special character
  if (PASSWORD_REQUIREMENTS.requireSpecialChars) {
    const specialCharsRegex = new RegExp(`[${PASSWORD_REQUIREMENTS.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
    if (!specialCharsRegex.test(password)) {
      errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
    }
  }

  // Check for common weak passwords
  const weakPasswords = ['password', '12345678', 'qwerty', 'admin', 'welcome', 'letmein'];
  if (weakPasswords.some(weak => password.toLowerCase().includes(weak))) {
    errors.push('Password contains common weak patterns');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Get password requirements as a human-readable string
 */
export const getPasswordRequirementsText = (): string => {
  const requirements = [
    `At least ${PASSWORD_REQUIREMENTS.minLength} characters`,
    'At least one uppercase letter',
    'At least one lowercase letter',
    'At least one number',
    'At least one special character',
    'No common weak patterns',
  ];

  return requirements.join(', ');
};
