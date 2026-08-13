/**
 * Test Runner
 *
 * Generic utility for running a suite of tests, logging results,
 * and throwing on failures. Used by smoke tests and validation tests.
 */

import { logger } from './logger';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export type TestFunction = () => TestResult;

export interface TestRunnerConfig {
  /** Name of the test suite (used in log messages) */
  suiteName: string;
}

/**
 * Test Runner - Executes tests and handles result logging
 */
export class TestRunner {
  private readonly suiteName: string;

  constructor(config: TestRunnerConfig) {
    this.suiteName = config.suiteName;
  }

  /**
   * Run all provided tests
   *
   * @param tests - Array of test functions to execute
   * @throws Error if any test fails
   */
  run(tests: TestFunction[]): void {
    logger.info(`Running ${this.suiteName}...`);

    const results: TestResult[] = [];

    for (const test of tests) {
      const result = test();
      results.push(result);

      if (result.passed) {
        logger.info(`  ✓ ${result.name}: ${result.message}`);
      } else {
        logger.error(`  ✗ ${result.name}: ${result.message}`);
      }
    }

    const failed = results.filter((r) => !r.passed);
    if (failed.length > 0) {
      throw new Error(
        `${this.suiteName} failed:\n${failed
          .map((f) => `  - ${f.name}: ${f.message}`)
          .join('\n')}`
      );
    }

    logger.info(`All ${this.suiteName.toLowerCase()} passed`);
  }
}
