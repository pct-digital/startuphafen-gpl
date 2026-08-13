import type { Config } from 'jest';

const config: Config = {
  displayName: 'deploy3',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js'],
};

export default config;
