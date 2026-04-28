module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir:              '.',
  testRegex:            '.*\\.spec\\.ts$',
  transform:            { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom:  ['apps/**/*.ts', 'shared/**/*.ts', '!**/*.module.ts', '!**/main.ts'],
  coverageDirectory:    './coverage',
  testEnvironment:      'node',
  roots:                ['<rootDir>/apps', '<rootDir>/shared'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
};
