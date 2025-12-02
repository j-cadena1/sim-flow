import { SimRequest } from '../types';
import { STORAGE_KEYS } from '../constants';

/**
 * Validates if data matches the SimRequest array structure
 */
function isValidRequestArray(data: unknown): data is SimRequest[] {
  if (!Array.isArray(data)) return false;

  return data.every(item =>
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    'title' in item &&
    'status' in item &&
    'createdAt' in item &&
    'createdBy' in item &&
    Array.isArray(item.comments)
  );
}

/**
 * Safely loads requests from localStorage with error handling and validation
 */
export function loadRequestsFromStorage(): SimRequest[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.REQUESTS);

    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);

    if (!isValidRequestArray(parsed)) {
      console.warn('Invalid data structure in localStorage, resetting to empty array');
      return [];
    }

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('Failed to parse localStorage data:', error);
    } else if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded');
    } else {
      console.error('Failed to load requests from localStorage:', error);
    }
    return [];
  }
}

/**
 * Safely saves requests to localStorage with error handling
 */
export function saveRequestsToStorage(requests: SimRequest[]): boolean {
  try {
    const serialized = JSON.stringify(requests);
    localStorage.setItem(STORAGE_KEYS.REQUESTS, serialized);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded. Cannot save data.');
      // Could trigger a user notification here
    } else {
      console.error('Failed to save requests to localStorage:', error);
    }
    return false;
  }
}

/**
 * Clears all app data from localStorage
 */
export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.REQUESTS);
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
  }
}
