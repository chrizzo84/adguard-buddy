const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you based on your tsconfig.json paths)
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/*.spec.{js,jsx,ts,tsx}',
    '!src/types/**/*.ts', // Exclude type definitions
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 60,    // Aktuell: 61.95%
      functions: 61,   // Aktuell: 61.82% (Pipeline niedrig)
      lines: 74,       // Aktuell: 74.76% (Pipeline niedrig)
      statements: 71,  // Aktuell: 71.83% (Pipeline niedrig)
    },
    './src/app/components/': {
      branches: 80,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    './src/lib/': {
      branches: 90,
      functions: 90,
      lines: 95,
      statements: 95,
    },
    './src/app/lib/': {
      branches: 65,    // Aktuell: 67.74-73%
      functions: 90,   // Aktuell: 90.9% (adjusted after extracting getConnectionId to shared utility)
      lines: 80,       // Aktuell: 81.76-83%
      statements: 80,  // Aktuell: 81.72-83%
    },
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!(@testing-library|react-markdown|remark|unified|bail|is-plain-obj|trough|vfile|vfile-message|unist-util-stringify-position|unist-util-visit|unist-util-visit-parents|mdast-util-to-string|micromark|decode-named-character-reference|character-entities|property-information|hast-util-whitespace|space-separated-tokens|comma-separated-tokens|zwitch|longest-streak))/',
  ],
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testTimeout: 10000,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
