module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleNameMapper: { '^obsidian$': '<rootDir>/tests/obsidian-mock.js' },
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true
};
