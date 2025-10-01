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
      branches: 60,    // Erhöht von 55 (aktuell: 61.91%)
      functions: 65,   // Erhöht von 55 (aktuell: 66.47%)
      lines: 75,       // Erhöht von 65 (aktuell: 76.38%)
      statements: 73,  // Erhöht von 65 (aktuell: 73.81%)
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
      branches: 65,    // Erhöht von 10 (aktuell: 72.38%)
      functions: 92,   // Erhöht von 10 (aktuell: 93.93%)
      lines: 80,       // Erhöht von 10 (aktuell: 83.66%)
      statements: 80,  // Erhöht von 10 (aktuell: 83.88%)
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
