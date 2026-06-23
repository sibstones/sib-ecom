module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/**/types/**',
    '!src/**/routes/**',
    '!src/**/controllers/**',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // otplib / @scure ship ESM; transform them for Jest
  transformIgnorePatterns: ['/node_modules/(?!(otplib|@otplib|@scure|@scure/base)/)'],
  setupFiles: ['<rootDir>/src/__tests__/jest.env.js'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 30000,
  maxWorkers: 1, // Run tests sequentially to avoid DB conflicts
};
