/**
 * Shell utilities for command execution and path handling.
 */

/**
 * Safely escape a path for use in shell commands.
 *
 * This function escapes single quotes by ending the single-quoted string,
 * adding an escaped single quote, and starting a new single-quoted string.
 * This prevents path injection.
 *
 * @param path - The path to escape
 * @returns - The escaped path, suitable for wrapping in single quotes
 */
export function escapePath(path: string): string {
  // Replace each ' with '\'' (end quote, escaped quote, start quote)
  return path.replace(/'/g, "'\\''");
}

/**
 * Quote a path for safe use in shell commands.
 *
 * Wraps the path in single quotes and escapes any single quotes within it.
 *
 * @param path - The path to quote
 * @returns - The quoted and escaped path
 */
export function quotePath(path: string): string {
  return `'${escapePath(path)}'`;
}

/**
 * Safely escape a value for use in shell commands.
 * Uses single quotes and escapes embedded single quotes.
 * (Alias for quotePath for general shell arguments)
 */
export function quoteShellArg(value: string): string {
  return quotePath(value);
}

/**
 * Escape a string for use as a sed pattern (plain text, not regex).
 * Escapes characters that have special meaning in sed patterns.
 */
export function escapeSedPattern(value: string): string {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Escape a string for use as a sed replacement (plain text).
 * Escapes characters that have special meaning in sed replacements.
 */
export function escapeSedReplacement(value: string): string {
  return value.replace(/[/\\&]/g, '\\$&');
}
