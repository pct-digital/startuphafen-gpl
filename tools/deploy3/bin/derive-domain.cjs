#!/usr/bin/env node

/**
 * derive-domain.cjs
 *
 * Usage: node derive-domain.cjs --release-tag <tag> --base-domain <domain> [--pr-number <num>] [--verbose]
 *
 * Behavior:
 *   - Extract timestamp part from release tag (e.g., "25.0109.1714.54_PCTI-1234-abc" -> "25.0109.1714.54")
 *   - Extract task ID from release tag suffix (e.g., "_PCTI-1234-abc" -> "pcti-1234")
 *   - Convert dots to dashes for DNS compatibility -> "25-0109-1714-54"
 *   - Build subdomain: [pct(i)-<taskNum>-][pr-<prNum>-]<timestamp>
 *   - Output to stdout: full domain (e.g., "pcti-1234-pr42-v25-0109-1714-54.example.com")
 *
 * Exit code: 0 on success, 1 on invalid input
 */

const {
  parseFlag,
  parseCommonFlags,
  logVerbose,
} = require('./lib/gh-helpers.cjs');

function printHelp() {
  console.log(`Usage:
  node derive-domain.cjs --release-tag <tag> --base-domain <domain> [--pr-number <num>] [--verbose]

Options:
  --release-tag <tag>     The release tag (e.g., "25.0109.1714.54_PCTI-1234-abc") (required)
  --base-domain <domain>  The base domain to append (e.g., "example.com") (required)
  --pr-number <num>       The PR number to include in the domain (optional)
  --verbose               Print debug information to stderr
  -h, --help              Show this help message

Output:
  Full domain to stdout (e.g., "pcti-1234-pr42-v25-0109-1714-54.example.com")
  Exit code: 0 on success, 1 on invalid input
`);
}

/**
 * Extract the timestamp part from a release tag.
 * Expected format: "YY.MMDD.HHmm.SS_TICKET-hash" or just "YY.MMDD.HHmm.SS"
 * @param {string} tag
 * @returns {string|null} - Timestamp part or null if invalid
 */
function extractTimestamp(tag) {
  // Match pattern: two digits, dot, four digits, dot, four digits, dot, two digits
  // e.g., "25.0109.1714.54"
  const match = tag.match(/^(\d{2}\.\d{4}\.\d{4}\.\d{2})/);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * Convert timestamp to DNS-safe subdomain by replacing dots with dashes.
 * @param {string} timestamp
 * @returns {string}
 */
function timestampToSubdomain(timestamp) {
  return "v" + timestamp.replace(/\./g, '-');
}

/**
 * Extracts and normalizes the task ID from the release tag.
 * Handles formats like:
 * - 25.0109.1714.54_PCTI-12344-abc → pcti-12344
 * - 25.0109.1714.54_PCT-121-xyz → pct-121
 * - 25.0109.1714.54_pcti_232-abc → pcti-232
 *
 * @param {string} tag - The release tag
 * @returns {string|null} - Lowercase task ID (e.g., "pcti-1234") or null if not found
 */
function extractTaskId(tag) {
  // Pattern to match task IDs: PCT(I)?[-_]?\d+
  // This matches: PCTI-123, PCT_123, pcti_123, pct-123, etc.
  const taskIdPattern = /(pcti?)([-_]?)(\d+)/i;
  const match = tag.match(taskIdPattern);

  if (match) {
    const prefix = match[1].toLowerCase(); // pcti or pct
    const number = match[3];
    return `${prefix}${number}`;
  }

  return null;
}

function main() {
  const args = process.argv.slice(2);
  const flags = parseCommonFlags(args);

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  const releaseTag = parseFlag(args, '--release-tag');
  const baseDomain = parseFlag(args, '--base-domain');
  const prNumber = parseFlag(args, '--pr-number');

  if (!releaseTag) {
    console.error('Error: --release-tag is required');
    printHelp();
    process.exit(1);
  }

  if (!baseDomain) {
    console.error('Error: --base-domain is required');
    printHelp();
    process.exit(1);
  }

  logVerbose(flags.verbose, `Processing release tag: ${releaseTag}`);

  const timestamp = extractTimestamp(releaseTag);
  if (!timestamp) {
    console.error(
      `Error: Could not extract timestamp from release tag: ${releaseTag}`
    );
    console.error(
      'Expected format: YY.MMDD.HHmm.SS (e.g., "25.0109.1714.54_PCTI-1234-abc")'
    );
    process.exit(1);
  }

  logVerbose(flags.verbose, `Extracted timestamp: ${timestamp}`);

  const timestampSubdomain = timestampToSubdomain(timestamp);
  logVerbose(flags.verbose, `Timestamp subdomain: ${timestampSubdomain}`);

  // Extract task ID from release tag
  const taskId = extractTaskId(releaseTag);
  logVerbose(flags.verbose, `Task ID: ${taskId || '(none)'}`);
  logVerbose(flags.verbose, `PR number: ${prNumber || '(none)'}`);

  // Build subdomain parts: [pct(i)-<num>-][pr-<prNum>-]<timestamp>
  const parts = [];
  if (taskId) {
    parts.push(taskId);
  }
  if (prNumber) {
    parts.push(`pr${prNumber}`);
  }
  parts.push(timestampSubdomain);

  const subdomain = parts.join('-');
  logVerbose(flags.verbose, `Full subdomain: ${subdomain}`);

  const fullDomain = `${subdomain}.${baseDomain}`;
  logVerbose(flags.verbose, `Full domain: ${fullDomain}`);

  console.log(fullDomain);
  process.exit(0);
}

main();
