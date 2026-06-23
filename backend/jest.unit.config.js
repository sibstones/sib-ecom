/** Unit tests only: no Prisma / DB (see jest.config.js for integration suite). */
const base = require('./jest.config.js');

module.exports = {
  ...base,
  setupFilesAfterEnv: [],
  testMatch: [
    '<rootDir>/src/__tests__/utils/**/*.test.ts',
    '<rootDir>/src/__tests__/middleware/**/*.test.ts',
  ],
};
