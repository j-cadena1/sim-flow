/**
 * Converts object keys from snake_case to camelCase recursively
 * @param obj - Object with snake_case keys
 * @returns Object with camelCase keys
 */
export const toCamelCase = <T>(obj: unknown): T => {
  if (Array.isArray(obj)) {
    return obj.map(v => toCamelCase(v)) as T;
  }
  if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
    const record = obj as Record<string, unknown>;
    return Object.keys(record).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
      (result as Record<string, unknown>)[camelKey] = toCamelCase(record[key]);
      return result;
    }, {} as T);
  }
  return obj as T;
};

/**
 * Converts object keys from camelCase to snake_case recursively
 * @param obj - Object with camelCase keys
 * @returns Object with snake_case keys
 */
export const toSnakeCase = <T>(obj: unknown): T => {
  if (Array.isArray(obj)) {
    return obj.map(v => toSnakeCase(v)) as T;
  }
  if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
    const record = obj as Record<string, unknown>;
    return Object.keys(record).reduce((result, key) => {
      const snakeKey = key.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`);
      (result as Record<string, unknown>)[snakeKey] = toSnakeCase(record[key]);
      return result;
    }, {} as T);
  }
  return obj as T;
};
