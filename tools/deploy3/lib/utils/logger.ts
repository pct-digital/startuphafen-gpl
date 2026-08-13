/**
 * Simple structured logger
 */

import { Report } from './step-executor';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

function formatTimestamp(): string {
  return new Date().toLocaleString('de-DE');
}

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  const timestamp = formatTimestamp();
  const levelStr = level.toUpperCase().padEnd(5);
  // Indent DEBUG logs by 4 spaces for visual hierarchy
  const indent = level === 'debug' ? '    ' : '';
  console.log(`[${timestamp}] ${levelStr} ${indent}${message}`, ...args);
}

export const logger: Logger = {
  info: (message: string, ...args: unknown[]) => log('info', message, ...args),
  warn: (message: string, ...args: unknown[]) => log('warn', message, ...args),
  error: (message: string, ...args: unknown[]) =>
    log('error', message, ...args),
  debug: (message: string, ...args: unknown[]) =>
    log('debug', message, ...args),
};

/**
 * Pretty-print a step execution report
 */
export function logReport(
  logger: Logger,
  report: Report,
  operationName = 'Operation'
): void {
  logger.info('');
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info(
    `${operationName} ${report.success ? '✅ SUCCEEDED' : '❌ FAILED'}`
  );
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('');

  // Log custom properties
  if (report.customProperties) {
    for (const [key, value] of Object.entries(report.customProperties)) {
      if (value !== undefined) {
        logger.info(`${key}: ${value}`);
      }
    }
  }

  logger.info(`Total Duration: ${(report.totalDurationMs / 1000).toFixed(2)}s`);
  logger.info('');

  // Log steps
  logger.info('Steps:');
  for (const step of report.steps) {
    const statusIcon =
      step.status === 'passed' ? '✅' : step.status === 'skipped' ? '⊘' : '❌';
    const duration = step.durationMs
      ? ` (${(step.durationMs / 1000).toFixed(2)}s)`
      : '';
    logger.info(`  ${statusIcon} ${step.step}${duration}`);
    if (step.message) {
      logger.info(`     └─ ${step.message}`);
    }
  }

  logger.info('');

  // Log failure details
  if (!report.success) {
    logger.info(`Failed At: ${report.failedAt}`);
    if (report.error) {
      logger.info(`Error: ${report.error}`);
    }
    logger.info('');
  }
}
