const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const importPlugin = require('eslint-plugin-import');
const promisePlugin = require('eslint-plugin-promise');

module.exports = [
  // Global ignores (must be in a separate config object for flat config)
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'vitest.config.ts'],
  },
  {
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
      promise: promisePlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.eslint.json',
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // Allow unused vars prefixed with underscore (common pattern for Express middleware)
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      // Allow namespaces for Express type augmentation
      '@typescript-eslint/no-namespace': 'off',
      // Warn instead of error for explicit any (to be fixed incrementally)
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
