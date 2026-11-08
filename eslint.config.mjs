import js from '@eslint/js';
import ts from 'typescript-eslint';

export default ts.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/generated/**',
      '.local-testing/**',
      'backups/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TryStatement',
          message:
            'Use tc/tca from @itsezz/try-catch and explicit cleanup results (test cleanup belongs in lifecycle hooks).',
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='catch']",
          message:
            'Capture failures with tc/tca from @itsezz/try-catch and inspect the result.',
        },
      ],
    },
  },
  {
    files: ['apps/api/test/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  // Express uses declaration merging to add our shared public user type.
  {
    files: ['apps/api/src/types.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
    },
  },
  {
    files: ['apps/api/src/snippets/service.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@snippet/database', 'express', '../http/*'] },
      ],
    },
  },
);
