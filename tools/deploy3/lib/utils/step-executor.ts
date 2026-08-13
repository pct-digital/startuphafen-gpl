/**
 * Generic step execution and reporting utility
 *
 * Provides a reusable pattern for executing operations in discrete steps,
 * tracking timing and status, and building structured reports.
 */

import { Logger } from './logger';

// =============================================================================
// Types
// =============================================================================

/**
 * Status of an individual step
 */
export interface StepResult {
  step: string;
  status: 'passed' | 'failed' | 'skipped';
  message?: string;
  durationMs?: number;
}

/**
 * Final execution report
 */
export interface Report {
  success: boolean;
  steps: StepResult[];
  failedAt?: string;
  error?: string;
  totalDurationMs: number;
  customProperties?: Record<string, string | number | undefined>;
}

// =============================================================================
// StepExecutor
// =============================================================================

/**
 * StepExecutor - Manages step-by-step execution with automatic timing,
 * logging, and report generation.
 *
 * Usage:
 * ```typescript
 * const executor = new StepExecutor(logger);
 *
 * try {
 *   await executor.runStep('initialize', () => {
 *     // do work
 *     return 'Initialization complete';
 *   });
 *
 *   const report = executor.buildReport(true, { appName: 'my-app' });
 * } catch (error) {
 *   const report = executor.buildReport(false, { appName: 'my-app' }, error.message);
 * }
 * ```
 */
export class StepExecutor {
  private readonly logger: Logger;
  private readonly stepResults: StepResult[] = [];
  private startTime?: number;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Start timing (call this before executing any steps)
   */
  start(): void {
    this.startTime = Date.now();
  }

  /**
   * Execute a step with automatic timing, logging, and error handling
   *
   * @param step - The step name/identifier
   * @param action - The action to execute (must return a success message string)
   * @throws The original error if the step fails
   */
  async runStep(
    step: string,
    action: () => string | Promise<string>
  ): Promise<void> {
    const stepStart = Date.now();
    this.logger.info(`\n▶ ${formatStepName(step)}`);

    try {
      const message = await action();
      const durationMs = Date.now() - stepStart;

      this.stepResults.push({
        step,
        status: 'passed',
        message,
        durationMs,
      });

      this.logger.info(`✓ ${formatStepName(step)} (${durationMs}ms)`);
      if (message) {
        this.logger.info(`  ${message}`);
      }
    } catch (error) {
      const durationMs = Date.now() - stepStart;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.stepResults.push({
        step,
        status: 'failed',
        message: errorMessage,
        durationMs,
      });

      this.logger.error(`✗ ${formatStepName(step)} failed (${durationMs}ms)`);
      this.logger.error('Error details:', error);

      throw error;
    }
  }

  /**
   * Build the final report
   *
   * @param success - Whether the overall operation succeeded
   * @param customProperties - Optional custom properties to include in the report
   * @param error - Optional error message (typically for failed reports)
   * @returns The complete report
   */
  buildReport(
    success: boolean,
    customProperties?: Record<string, string | number | undefined>,
    error?: string
  ): Report {
    const totalDurationMs = this.startTime ? Date.now() - this.startTime : 0;
    const failedStep = this.stepResults.find((s) => s.status === 'failed');

    return {
      success,
      steps: this.stepResults,
      failedAt: failedStep?.step,
      error,
      totalDurationMs,
      customProperties,
    };
  }

}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Format a step name for display (converts kebab-case to Title Case)
 *
 * @example
 * formatStepName('run-smoke-tests') // => 'Run Smoke Tests'
 */
export function formatStepName(step: string): string {
  return step
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
