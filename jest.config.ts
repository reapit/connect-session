import { pathsToModuleNameMapper, JestConfigWithTsJest } from 'ts-jest'
import { compilerOptions } from './tsconfig.json'
import { jestGlobalConfig } from '@reapit/ts-scripts'

const config: JestConfigWithTsJest = {
  ...jestGlobalConfig,
  coverageReporters: ['json-summary', 'text', 'lcov'],
  projects: undefined,
  verbose: undefined,
  reporters: ['default'],
  modulePathIgnorePatterns: ['<rootDir>[/\\\\](node_modules|public|dist)[/\\\\]'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths, {
      prefix: '<rootDir>/',
    }),
  },
  coveragePathIgnorePatterns: [
    '<rootDir>[/\\\\](node_modules|src/tests|src/__mocks__)[/\\\\]',
    '<rootDir>/src/types.ts',
    '<rootDir>/src/index.ts',
    '.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 69,
      functions: 96,
      lines: 91,
      statements: 91,
    },
  },
}

export default config
