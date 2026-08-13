import { TestRunner } from '../../utils/test-runner';

/**
 * Helper for creating test runners in hooks.
 * Useful for smoke tests in pre-down.js and post-up.js hooks.
 */
export class TestRunnerHelper {
  /**
   * Create a new test runner for a suite of tests.
   *
   * @param suiteName - Name of the test suite (shown in logs)
   * @returns A TestRunner instance
   *
   * @example
   * const runner = context.helpers.testRunner.create('Pre-deployment Smoke Tests');
   * runner.run([
   *   () => ({ name: 'Check secrets', passed: !!env.APP_BACKEND_SECRETS, message: 'APP_BACKEND_SECRETS present' }),
   *   () => ({ name: 'Check domain', passed: !!env.DEPLOY_DOMAIN, message: 'DEPLOY_DOMAIN present' }),
   * ]);
   */
  create(suiteName: string): TestRunner {
    return new TestRunner({ suiteName });
  }
}
