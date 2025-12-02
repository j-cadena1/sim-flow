import { describe, it, expect } from 'vitest';
import { sanitizeInput, sanitizeHtml, validateAndSanitize } from './sanitize';

describe('sanitize utilities', () => {
  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      const result = sanitizeInput('<script>alert("xss")</script>Hello');
      expect(result).toBe('Hello');
    });

    it('should remove dangerous attributes', () => {
      const result = sanitizeInput('<img src="x" onerror="alert(1)">');
      expect(result).not.toContain('onerror');
    });

    it('should preserve plain text', () => {
      const result = sanitizeInput('This is plain text');
      expect(result).toBe('This is plain text');
    });

    it('should trim whitespace', () => {
      const result = sanitizeInput('  text  ');
      expect(result).toBe('text');
    });
  });

  describe('sanitizeHtml', () => {
    it('should allow safe formatting tags', () => {
      const result = sanitizeHtml('Text with <strong>bold</strong>');
      expect(result).toContain('<strong>');
    });

    it('should remove dangerous tags', () => {
      const result = sanitizeHtml('<script>alert("xss")</script>Safe text');
      expect(result).not.toContain('<script>');
      expect(result).toContain('Safe text');
    });

    it('should allow br and p tags', () => {
      const result = sanitizeHtml('<p>Paragraph</p><br>');
      expect(result).toContain('<p>');
      expect(result).toContain('<br>');
    });
  });

  describe('validateAndSanitize', () => {
    it('should sanitize and return the value', () => {
      const result = validateAndSanitize('<b>Text</b>', 100);
      expect(result).toBe('Text');
    });

    it('should truncate if exceeds maxLength', () => {
      const result = validateAndSanitize('This is a long text', 10);
      expect(result).toHaveLength(10);
      expect(result).toBe('This is a ');
    });

    it('should handle no maxLength', () => {
      const longText = 'a'.repeat(1000);
      const result = validateAndSanitize(longText);
      expect(result).toHaveLength(1000);
    });
  });
});
