/**
 * Unit Tests for Validation Utilities
 *
 * Tests input validation logic used across controllers
 */

import { describe, it, expect } from 'vitest';

// Validation helper functions (inline for testing)
const validateTitle = (title: string | undefined): string | null => {
  if (title === undefined || title === null) {
    return 'Title is required';
  }
  if (typeof title !== 'string') {
    return 'Title is required';
  }
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return 'Title cannot be empty';
  }
  if (trimmed.length > 255) {
    return 'Title must be 255 characters or less';
  }
  return null;
};

const validateDescription = (description: string | undefined): string | null => {
  if (description === undefined || description === null) {
    return 'Description is required';
  }
  if (typeof description !== 'string') {
    return 'Description is required';
  }
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return 'Description cannot be empty';
  }
  if (trimmed.length > 5000) {
    return 'Description must be 5000 characters or less';
  }
  return null;
};

const validateHours = (hours: number | undefined): string | null => {
  if (hours === undefined || hours === null) {
    return 'Hours is required';
  }
  if (typeof hours !== 'number' || isNaN(hours)) {
    return 'Hours must be a number';
  }
  if (hours <= 0) {
    return 'Hours must be greater than 0';
  }
  if (hours > 10000) {
    return 'Hours cannot exceed 10000';
  }
  return null;
};

const validatePriority = (priority: string | undefined): string | null => {
  const validPriorities = ['Low', 'Medium', 'High'];
  if (!priority) {
    return 'Priority is required';
  }
  if (!validPriorities.includes(priority)) {
    return `Priority must be one of: ${validPriorities.join(', ')}`;
  }
  return null;
};

const validateVendor = (vendor: string | undefined): string | null => {
  const validVendors = ['FANUC', 'Siemens', 'ABB', 'KUKA', 'Universal Robots', 'Other'];
  if (!vendor) {
    return 'Vendor is required';
  }
  if (!validVendors.includes(vendor)) {
    return `Vendor must be one of: ${validVendors.join(', ')}`;
  }
  return null;
};

const validateUUID = (id: string | undefined): string | null => {
  if (!id) {
    return 'ID is required';
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return 'Invalid UUID format';
  }
  return null;
};

const validateEmail = (email: string | undefined): string | null => {
  if (!email) {
    return 'Email is required';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Invalid email format';
  }
  return null;
};

describe('Validation Utilities', () => {
  describe('validateTitle', () => {
    it('should accept valid title', () => {
      expect(validateTitle('Valid Title')).toBeNull();
    });

    it('should accept title with max length', () => {
      expect(validateTitle('A'.repeat(255))).toBeNull();
    });

    it('should reject empty title', () => {
      expect(validateTitle('')).toBe('Title cannot be empty');
    });

    it('should reject whitespace-only title', () => {
      expect(validateTitle('   ')).toBe('Title cannot be empty');
    });

    it('should reject undefined title', () => {
      expect(validateTitle(undefined)).toBe('Title is required');
    });

    it('should reject title exceeding max length', () => {
      expect(validateTitle('A'.repeat(256))).toBe('Title must be 255 characters or less');
    });
  });

  describe('validateDescription', () => {
    it('should accept valid description', () => {
      expect(validateDescription('Valid description')).toBeNull();
    });

    it('should accept long description within limits', () => {
      expect(validateDescription('A'.repeat(5000))).toBeNull();
    });

    it('should reject empty description', () => {
      expect(validateDescription('')).toBe('Description cannot be empty');
    });

    it('should reject undefined description', () => {
      expect(validateDescription(undefined)).toBe('Description is required');
    });

    it('should reject description exceeding max length', () => {
      expect(validateDescription('A'.repeat(5001))).toBe('Description must be 5000 characters or less');
    });
  });

  describe('validateHours', () => {
    it('should accept valid hours', () => {
      expect(validateHours(10)).toBeNull();
    });

    it('should accept decimal hours', () => {
      expect(validateHours(2.5)).toBeNull();
    });

    it('should accept max hours', () => {
      expect(validateHours(10000)).toBeNull();
    });

    it('should reject zero hours', () => {
      expect(validateHours(0)).toBe('Hours must be greater than 0');
    });

    it('should reject negative hours', () => {
      expect(validateHours(-5)).toBe('Hours must be greater than 0');
    });

    it('should reject undefined hours', () => {
      expect(validateHours(undefined)).toBe('Hours is required');
    });

    it('should reject hours exceeding max', () => {
      expect(validateHours(10001)).toBe('Hours cannot exceed 10000');
    });
  });

  describe('validatePriority', () => {
    it('should accept Low priority', () => {
      expect(validatePriority('Low')).toBeNull();
    });

    it('should accept Medium priority', () => {
      expect(validatePriority('Medium')).toBeNull();
    });

    it('should accept High priority', () => {
      expect(validatePriority('High')).toBeNull();
    });

    it('should reject invalid priority', () => {
      expect(validatePriority('Critical')).toContain('must be one of');
    });

    it('should reject undefined priority', () => {
      expect(validatePriority(undefined)).toBe('Priority is required');
    });
  });

  describe('validateVendor', () => {
    it('should accept FANUC vendor', () => {
      expect(validateVendor('FANUC')).toBeNull();
    });

    it('should accept Siemens vendor', () => {
      expect(validateVendor('Siemens')).toBeNull();
    });

    it('should reject invalid vendor', () => {
      expect(validateVendor('Unknown')).toContain('must be one of');
    });

    it('should reject undefined vendor', () => {
      expect(validateVendor(undefined)).toBe('Vendor is required');
    });
  });

  describe('validateUUID', () => {
    it('should accept valid UUID', () => {
      expect(validateUUID('123e4567-e89b-12d3-a456-426614174000')).toBeNull();
    });

    it('should accept uppercase UUID', () => {
      expect(validateUUID('123E4567-E89B-12D3-A456-426614174000')).toBeNull();
    });

    it('should reject invalid UUID', () => {
      expect(validateUUID('not-a-uuid')).toBe('Invalid UUID format');
    });

    it('should reject empty UUID', () => {
      expect(validateUUID('')).toBe('ID is required');
    });

    it('should reject undefined UUID', () => {
      expect(validateUUID(undefined)).toBe('ID is required');
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email', () => {
      expect(validateEmail('user@example.com')).toBeNull();
    });

    it('should accept email with subdomain', () => {
      expect(validateEmail('user@mail.example.com')).toBeNull();
    });

    it('should reject email without @', () => {
      expect(validateEmail('userexample.com')).toBe('Invalid email format');
    });

    it('should reject email without domain', () => {
      expect(validateEmail('user@')).toBe('Invalid email format');
    });

    it('should reject undefined email', () => {
      expect(validateEmail(undefined)).toBe('Email is required');
    });
  });
});

describe('Request Validation', () => {
  const validateRequest = (data: {
    title?: string;
    description?: string;
    vendor?: string;
    priority?: string;
    projectId?: string;
  }): Record<string, string> => {
    const errors: Record<string, string> = {};

    const titleError = validateTitle(data.title);
    if (titleError) errors.title = titleError;

    const descError = validateDescription(data.description);
    if (descError) errors.description = descError;

    const vendorError = validateVendor(data.vendor);
    if (vendorError) errors.vendor = vendorError;

    const priorityError = validatePriority(data.priority);
    if (priorityError) errors.priority = priorityError;

    const projectError = validateUUID(data.projectId);
    if (projectError) errors.projectId = projectError;

    return errors;
  };

  it('should pass with valid request data', () => {
    const errors = validateRequest({
      title: 'Test Request',
      description: 'Test description',
      vendor: 'FANUC',
      priority: 'Medium',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('should return multiple errors for invalid data', () => {
    const errors = validateRequest({
      title: '',
      description: '',
      vendor: 'Invalid',
      priority: 'Invalid',
      projectId: 'not-a-uuid',
    });
    expect(Object.keys(errors).length).toBeGreaterThan(0);
    expect(errors.title).toBeDefined();
    expect(errors.description).toBeDefined();
    expect(errors.vendor).toBeDefined();
    expect(errors.priority).toBeDefined();
    expect(errors.projectId).toBeDefined();
  });
});

describe('Project Validation', () => {
  const validateProject = (data: {
    name?: string;
    totalHours?: number;
    priority?: string;
  }): Record<string, string> => {
    const errors: Record<string, string> = {};

    const nameError = validateTitle(data.name);
    if (nameError) errors.name = nameError.replace('Title', 'Name');

    const hoursError = validateHours(data.totalHours);
    if (hoursError) errors.totalHours = hoursError;

    if (data.priority) {
      const priorityError = validatePriority(data.priority);
      if (priorityError) errors.priority = priorityError;
    }

    return errors;
  };

  it('should pass with valid project data', () => {
    const errors = validateProject({
      name: 'Test Project',
      totalHours: 100,
      priority: 'High',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('should require name and hours', () => {
    const errors = validateProject({});
    expect(errors.name).toBeDefined();
    expect(errors.totalHours).toBeDefined();
  });

  it('should reject invalid hours', () => {
    const errors = validateProject({
      name: 'Test',
      totalHours: -50,
    });
    expect(errors.totalHours).toBeDefined();
  });
});
