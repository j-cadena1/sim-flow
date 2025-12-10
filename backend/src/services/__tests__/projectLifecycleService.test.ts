import { describe, it, expect, vi } from 'vitest';

// Mock the database module
vi.mock('../../db', () => ({
  default: {
    query: vi.fn(),
  },
  query: vi.fn(),
  getClient: vi.fn(),
}));

// Mock the logger
vi.mock('../../middleware/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  isValidTransition,
  requiresReason,
  canAllocateHours,
  canCreateRequests,
  isTerminalStatus,
  VALID_TRANSITIONS,
  ACTIVE_STATES,
  ALLOWS_NEW_REQUESTS,
  TERMINAL_STATES,
} from '../projectLifecycleService';
import { ProjectStatus } from '../../types';

describe('ProjectLifecycleService', () => {
  describe('Constants', () => {
    it('should have valid transitions defined for all statuses', () => {
      const allStatuses: ProjectStatus[] = [
        'Pending',
        'Active',
        'On Hold',
        'Suspended',
        'Completed',
        'Cancelled',
        'Expired',
        'Archived',
      ];

      allStatuses.forEach((status) => {
        expect(VALID_TRANSITIONS[status]).toBeDefined();
        expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
      });
    });

    it('should define Archived as terminal with no outgoing transitions', () => {
      expect(VALID_TRANSITIONS['Archived']).toEqual([]);
    });

    it('should allow Pending to transition to Active, Cancelled, or Archived', () => {
      expect(VALID_TRANSITIONS['Pending']).toContain('Active');
      expect(VALID_TRANSITIONS['Pending']).toContain('Cancelled');
      expect(VALID_TRANSITIONS['Pending']).toContain('Archived');
    });

    it('should only allow Active status to allocate hours', () => {
      expect(ACTIVE_STATES).toEqual(['Active']);
    });

    it('should only allow Active status to create new requests', () => {
      expect(ALLOWS_NEW_REQUESTS).toEqual(['Active']);
    });

    it('should define terminal states correctly', () => {
      expect(TERMINAL_STATES).toContain('Completed');
      expect(TERMINAL_STATES).toContain('Cancelled');
      expect(TERMINAL_STATES).toContain('Expired');
      expect(TERMINAL_STATES).toContain('Archived');
    });
  });

  describe('isValidTransition', () => {
    it('should allow valid Pending → Active transition', () => {
      expect(isValidTransition('Pending', 'Active')).toBe(true);
    });

    it('should allow valid Active → Completed transition', () => {
      expect(isValidTransition('Active', 'Completed')).toBe(true);
    });

    it('should allow valid Completed → Archived transition', () => {
      expect(isValidTransition('Completed', 'Archived')).toBe(true);
    });

    it('should allow valid Expired → Active transition (reactivation)', () => {
      expect(isValidTransition('Expired', 'Active')).toBe(true);
    });

    it('should reject invalid Pending → Completed transition', () => {
      expect(isValidTransition('Pending', 'Completed')).toBe(false);
    });

    it('should reject invalid Archived → Active transition', () => {
      expect(isValidTransition('Archived', 'Active')).toBe(false);
    });

    it('should reject any transition from Archived (terminal state)', () => {
      const targets: ProjectStatus[] = ['Active', 'Pending', 'Completed', 'On Hold'];
      targets.forEach((target) => {
        expect(isValidTransition('Archived', target)).toBe(false);
      });
    });

    it('should allow On Hold ↔ Active bidirectional transition', () => {
      expect(isValidTransition('Active', 'On Hold')).toBe(true);
      expect(isValidTransition('On Hold', 'Active')).toBe(true);
    });

    it('should allow Active → Suspended transition', () => {
      expect(isValidTransition('Active', 'Suspended')).toBe(true);
    });

    it('should allow Suspended → Active transition', () => {
      expect(isValidTransition('Suspended', 'Active')).toBe(true);
    });
  });

  describe('requiresReason', () => {
    it('should require reason for On Hold status', () => {
      expect(requiresReason('On Hold')).toBe(true);
    });

    it('should require reason for Suspended status', () => {
      expect(requiresReason('Suspended')).toBe(true);
    });

    it('should require reason for Cancelled status', () => {
      expect(requiresReason('Cancelled')).toBe(true);
    });

    it('should require reason for Expired status', () => {
      expect(requiresReason('Expired')).toBe(true);
    });

    it('should not require reason for Active status', () => {
      expect(requiresReason('Active')).toBe(false);
    });

    it('should not require reason for Pending status', () => {
      expect(requiresReason('Pending')).toBe(false);
    });

    it('should not require reason for Completed status', () => {
      expect(requiresReason('Completed')).toBe(false);
    });

    it('should not require reason for Archived status', () => {
      expect(requiresReason('Archived')).toBe(false);
    });
  });

  describe('canAllocateHours', () => {
    it('should allow hour allocation for Active status', () => {
      expect(canAllocateHours('Active')).toBe(true);
    });

    it('should not allow hour allocation for Pending status', () => {
      expect(canAllocateHours('Pending')).toBe(false);
    });

    it('should not allow hour allocation for On Hold status', () => {
      expect(canAllocateHours('On Hold')).toBe(false);
    });

    it('should not allow hour allocation for Suspended status', () => {
      expect(canAllocateHours('Suspended')).toBe(false);
    });

    it('should not allow hour allocation for Completed status', () => {
      expect(canAllocateHours('Completed')).toBe(false);
    });

    it('should not allow hour allocation for Cancelled status', () => {
      expect(canAllocateHours('Cancelled')).toBe(false);
    });

    it('should not allow hour allocation for Expired status', () => {
      expect(canAllocateHours('Expired')).toBe(false);
    });

    it('should not allow hour allocation for Archived status', () => {
      expect(canAllocateHours('Archived')).toBe(false);
    });
  });

  describe('canCreateRequests', () => {
    it('should allow request creation for Active status', () => {
      expect(canCreateRequests('Active')).toBe(true);
    });

    it('should not allow request creation for Pending status', () => {
      expect(canCreateRequests('Pending')).toBe(false);
    });

    it('should not allow request creation for On Hold status', () => {
      expect(canCreateRequests('On Hold')).toBe(false);
    });

    it('should not allow request creation for Suspended status', () => {
      expect(canCreateRequests('Suspended')).toBe(false);
    });

    it('should not allow request creation for Completed status', () => {
      expect(canCreateRequests('Completed')).toBe(false);
    });

    it('should not allow request creation for Cancelled status', () => {
      expect(canCreateRequests('Cancelled')).toBe(false);
    });

    it('should not allow request creation for Expired status', () => {
      expect(canCreateRequests('Expired')).toBe(false);
    });

    it('should not allow request creation for Archived status', () => {
      expect(canCreateRequests('Archived')).toBe(false);
    });
  });

  describe('isTerminalStatus', () => {
    it('should identify Completed as terminal', () => {
      expect(isTerminalStatus('Completed')).toBe(true);
    });

    it('should identify Cancelled as terminal', () => {
      expect(isTerminalStatus('Cancelled')).toBe(true);
    });

    it('should identify Expired as terminal', () => {
      expect(isTerminalStatus('Expired')).toBe(true);
    });

    it('should identify Archived as terminal', () => {
      expect(isTerminalStatus('Archived')).toBe(true);
    });

    it('should not identify Active as terminal', () => {
      expect(isTerminalStatus('Active')).toBe(false);
    });

    it('should not identify Pending as terminal', () => {
      expect(isTerminalStatus('Pending')).toBe(false);
    });

    it('should not identify On Hold as terminal', () => {
      expect(isTerminalStatus('On Hold')).toBe(false);
    });

    it('should not identify Suspended as terminal', () => {
      expect(isTerminalStatus('Suspended')).toBe(false);
    });
  });

  describe('State Machine Completeness', () => {
    it('should have symmetric transitions where appropriate', () => {
      // Active ↔ On Hold
      expect(VALID_TRANSITIONS['Active']).toContain('On Hold');
      expect(VALID_TRANSITIONS['On Hold']).toContain('Active');

      // Active ↔ Suspended
      expect(VALID_TRANSITIONS['Active']).toContain('Suspended');
      expect(VALID_TRANSITIONS['Suspended']).toContain('Active');

      // On Hold ↔ Suspended
      expect(VALID_TRANSITIONS['On Hold']).toContain('Suspended');
      expect(VALID_TRANSITIONS['Suspended']).toContain('On Hold');
    });

    it('should only allow terminal states to transition to Archived', () => {
      const terminalStates: ProjectStatus[] = ['Completed', 'Cancelled', 'Expired'];
      terminalStates.forEach((status) => {
        expect(VALID_TRANSITIONS[status]).toContain('Archived');
      });
    });

    it('should allow all non-terminal states to be cancelled or archived', () => {
      const nonTerminal: ProjectStatus[] = ['Pending', 'Active', 'On Hold', 'Suspended'];
      nonTerminal.forEach((status) => {
        const transitions = VALID_TRANSITIONS[status];
        expect(transitions).toContain('Cancelled');
        expect(transitions).toContain('Archived');
      });
    });
  });
});
