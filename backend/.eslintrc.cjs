module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    // Existing codebase uses `any` in a few integration points (payments, migrations, Prisma edge cases).
    // Keep lint useful without blocking on large refactors.
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // Start with warnings for style/safety rules and tighten later.
    '@typescript-eslint/no-var-requires': 'warn',
    'no-case-declarations': 'warn',
    'no-mixed-spaces-and-tabs': 'off',
    'no-useless-escape': 'warn',
    'prefer-const': 'warn',
  },
  env: {
    node: true,
    es2020: true,
    jest: true,
  },
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
  },
  ignorePatterns: ['dist/', 'node_modules/', 'uploads/', 'backups/'],
};
