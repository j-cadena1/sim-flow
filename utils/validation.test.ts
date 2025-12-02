import { describe, it, expect } from 'vitest';
import {
  validateRequired,
  validateLength,
  validateNumber,
  validateNewRequest,
  validateEstimatedHours,
  validateComment,
} from './validation';

describe('validation utilities', () => {
  describe('validateRequired', () => {
    it('should pass for non-empty strings', () => {
      const result = validateRequired('test', 'Field');
      expect(result.isValid).toBe(true);
    });

    it('should fail for empty strings', () => {
      const result = validateRequired('', 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Field is required');
    });

    it('should fail for whitespace-only strings', () => {
      const result = validateRequired('   ', 'Field');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateLength', () => {
    it('should pass when length is within bounds', () => {
      const result = validateLength('hello', 'Field', 3, 10);
      expect(result.isValid).toBe(true);
    });

    it('should fail when too short', () => {
      const result = validateLength('hi', 'Field', 3, 10);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at least 3 characters');
    });

    it('should fail when too long', () => {
      const result = validateLength('this is a very long string', 'Field', 3, 10);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('no more than 10 characters');
    });
  });

  describe('validateNumber', () => {
    it('should pass for valid numbers within range', () => {
      const result = validateNumber(5, 'Hours', 1, 10);
      expect(result.isValid).toBe(true);
    });

    it('should fail for NaN', () => {
      const result = validateNumber(NaN, 'Hours');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be a valid number');
    });

    it('should fail when below minimum', () => {
      const result = validateNumber(0, 'Hours', 1, 10);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at least 1');
    });

    it('should fail when above maximum', () => {
      const result = validateNumber(15, 'Hours', 1, 10);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('no more than 10');
    });
  });

  describe('validateNewRequest', () => {
    it('should pass for valid request data', () => {
      const errors = validateNewRequest(
        'Valid Title',
        'This is a valid description with enough characters'
      );
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should return errors for empty title', () => {
      const errors = validateNewRequest('', 'Valid description here');
      expect(errors.title).toBeTruthy();
    });

    it('should return errors for short title', () => {
      const errors = validateNewRequest('ab', 'Valid description here');
      expect(errors.title).toBeTruthy();
    });

    it('should return errors for empty description', () => {
      const errors = validateNewRequest('Valid Title', '');
      expect(errors.description).toBeTruthy();
    });

    it('should return errors for short description', () => {
      const errors = validateNewRequest('Valid Title', 'short');
      expect(errors.description).toBeTruthy();
    });
  });

  describe('validateEstimatedHours', () => {
    it('should pass for valid hours', () => {
      const result = validateEstimatedHours(40);
      expect(result.isValid).toBe(true);
    });

    it('should fail for hours less than 1', () => {
      const result = validateEstimatedHours(0);
      expect(result.isValid).toBe(false);
    });

    it('should fail for hours greater than 1000', () => {
      const result = validateEstimatedHours(1001);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateComment', () => {
    it('should pass for valid comments', () => {
      const result = validateComment('This is a valid comment');
      expect(result.isValid).toBe(true);
    });

    it('should fail for empty comments', () => {
      const result = validateComment('');
      expect(result.isValid).toBe(false);
    });

    it('should fail for comments over 500 characters', () => {
      const longComment = 'a'.repeat(501);
      const result = validateComment(longComment);
      expect(result.isValid).toBe(false);
    });
  });
});
