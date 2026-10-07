import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

const typescript = {
  languageOptions: {
    parser: tsparser,
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  },
  plugins: { '@typescript-eslint': tseslint },
  rules: {
    ...tseslint.configs.recommended.rules,
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    'no-control-regex': 'off',
    'no-undef': 'off',
  },
};

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', 'packages/plugin/.claude-plugin/types/**'] },
  js.configs.recommended,
  {
    ...typescript,
    files: ['packages/core/src/**/*.ts'],
    languageOptions: { ...typescript.languageOptions, globals: { ...globals.browser } },
    rules: { ...typescript.rules, 'no-console': ['error', { allow: ['error'] }] },
  },
  {
    ...typescript,
    files: ['packages/cli/src/**/*.ts', 'packages/cli/scripts/**/*.ts'],
    languageOptions: { ...typescript.languageOptions, globals: { ...globals.node, Bun: 'readonly' } },
  },
  {
    ...typescript,
    files: ['packages/editor/src/**/*.{ts,tsx}'],
    languageOptions: { ...typescript.languageOptions, globals: { ...globals.browser } },
    rules: { ...typescript.rules, 'no-console': ['warn', { allow: ['warn', 'error'] }] },
  },
  {
    ...typescript,
    files: ['packages/plugin/**/*.ts'],
  },
];
