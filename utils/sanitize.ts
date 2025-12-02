import DOMPurify from 'dompurify';

/**
 * Sanitizes user input to prevent XSS attacks
 * Removes potentially dangerous HTML/JavaScript while preserving safe content
 */
export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // Strip all HTML tags
    ALLOWED_ATTR: [], // Strip all attributes
    KEEP_CONTENT: true, // Keep text content
  }).trim();
}

/**
 * Sanitizes HTML content while allowing safe formatting tags
 * Use this when you want to preserve basic formatting like line breaks
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['br', 'p', 'strong', 'em', 'u'],
    ALLOWED_ATTR: [],
  });
}

/**
 * Validates and sanitizes form field values
 */
export function validateAndSanitize(value: string, maxLength?: number): string {
  const sanitized = sanitizeInput(value);

  if (maxLength && sanitized.length > maxLength) {
    return sanitized.substring(0, maxLength);
  }

  return sanitized;
}
