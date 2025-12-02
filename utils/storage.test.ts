import { describe, it, expect, beforeEach } from 'vitest';
import { loadRequestsFromStorage, saveRequestsToStorage, clearStorage } from './storage';
import { SimRequest, RequestStatus } from '../types';

describe('storage utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadRequestsFromStorage', () => {
    it('should return empty array when localStorage is empty', () => {
      const result = loadRequestsFromStorage();
      expect(result).toEqual([]);
    });

    it('should load valid requests from localStorage', () => {
      const mockRequests: SimRequest[] = [
        {
          id: '123',
          title: 'Test Request',
          description: 'Test Description',
          vendor: 'FANUC',
          status: RequestStatus.SUBMITTED,
          priority: 'High',
          createdBy: 'user1',
          createdByName: 'John Doe',
          createdAt: new Date().toISOString(),
          comments: [],
        },
      ];

      localStorage.setItem('sim-flow-requests', JSON.stringify(mockRequests));
      const result = loadRequestsFromStorage();
      expect(result).toEqual(mockRequests);
    });

    it('should return empty array for invalid JSON', () => {
      localStorage.setItem('sim-flow-requests', 'invalid json');
      const result = loadRequestsFromStorage();
      expect(result).toEqual([]);
    });

    it('should return empty array for invalid data structure', () => {
      localStorage.setItem('sim-flow-requests', JSON.stringify({ invalid: 'data' }));
      const result = loadRequestsFromStorage();
      expect(result).toEqual([]);
    });
  });

  describe('saveRequestsToStorage', () => {
    it('should save requests to localStorage', () => {
      const mockRequests: SimRequest[] = [
        {
          id: '123',
          title: 'Test Request',
          description: 'Test Description',
          vendor: 'FANUC',
          status: RequestStatus.SUBMITTED,
          priority: 'Medium',
          createdBy: 'user1',
          createdByName: 'Jane Doe',
          createdAt: new Date().toISOString(),
          comments: [],
        },
      ];

      const result = saveRequestsToStorage(mockRequests);
      expect(result).toBe(true);

      const saved = localStorage.getItem('sim-flow-requests');
      expect(saved).toBeTruthy();
      expect(JSON.parse(saved!)).toEqual(mockRequests);
    });
  });

  describe('clearStorage', () => {
    it('should clear all app data from localStorage', () => {
      localStorage.setItem('sim-flow-requests', JSON.stringify([]));
      clearStorage();
      expect(localStorage.getItem('sim-flow-requests')).toBeNull();
    });
  });
});
