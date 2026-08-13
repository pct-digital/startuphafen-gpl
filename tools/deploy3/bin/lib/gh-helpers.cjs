#!/usr/bin/env node

/**
 * Shared GitHub CLI helpers for deploy3 scripts.
 * No external dependencies - uses only Node.js built-ins and the `gh` CLI.
 */

const { spawnSync } = require('child_process');

/**
 * Print error message and exit with given code.
 * @param {string} msg
 * @param {number} code
 */
function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

/**
 * Log to stderr if verbose mode is enabled.
 * @param {boolean} verbose
 * @param {string} [prefix='[gh]'] - Prefix for log messages
 * @param {...any} msgs
 */
function logVerbose(verbose, ...msgs) {
  if (verbose) {
    console.error('[gh]', ...msgs);
  }
}

/**
 * Create a logger with a custom prefix.
 * @param {string} prefix
 * @returns {(verbose: boolean, ...msgs: any[]) => void}
 */
function createLogger(prefix) {
  return (verbose, ...msgs) => {
    if (verbose) {
      console.error(prefix, ...msgs);
    }
  };
}

/**
 * Low-level wrapper to invoke the GitHub CLI.
 * @param {string[]} args
 * @param {{verbose?: boolean, parseJson?: boolean, input?: string|null}} options
 * @returns {{status: number, stdout: string, stderr: string, data?: any}}
 */
function runGh(args, { verbose = false, parseJson = true, input = null } = {}) {
  logVerbose(verbose, 'Running', ['gh', ...args].join(' '));
  const res = spawnSync('gh', args, {
    encoding: 'utf8',
    env: { ...process.env },
    input: input == null ? undefined : input,
  });
  const out = (res.stdout || '').trim();
  const err = (res.stderr || '').trim();
  if (out) {
    logVerbose(verbose, 'gh stdout:', out);
  } else {
    logVerbose(verbose, 'gh stdout: <empty>');
  }
  if (err) {
    logVerbose(verbose, 'gh stderr:', err);
  }

  if (!parseJson) return { status: res.status, stdout: out, stderr: err };
  if (out === '') return { status: res.status, data: null, stderr: err };
  try {
    return { status: res.status, data: JSON.parse(out), stderr: err };
  } catch (e) {
    logVerbose(verbose, 'Parsing gh json output failed', e);
    return { status: res.status, data: out, stderr: err };
  }
}

/**
 * Convenience wrapper for GitHub REST API calls via gh api.
 * @param {string} method - HTTP method (GET, POST, PATCH, DELETE, etc.)
 * @param {string} path - API path (e.g., /repos/{owner}/{repo}/environments)
 * @param {{verbose?: boolean, data?: any, allowFail?: boolean, paginate?: boolean}} options
 * @returns {any} - Parsed JSON response body
 */
function ghApi(
  method,
  path,
  { verbose = false, data = null, allowFail = false, paginate = false } = {}
) {
  const args = [
    'api',
    '-X',
    method,
    path,
    '-H',
    'Accept: application/vnd.github+json',
    '-H',
    'X-GitHub-Api-Version: 2022-11-28',
  ];
  if (paginate) {
    args.push('--paginate');
    args.push('--slurp');
  }
  let input = null;
  if (data != null) {
    args.push('-H', 'Content-Type: application/json', '--input', '-');
    input = JSON.stringify(data);
    logVerbose(verbose, 'Sending JSON body via stdin:', input);
  }
  const res = runGh(args, { verbose, parseJson: true, input });
  if (!allowFail && res.status !== 0) {
    fail(
      `gh api call failed: ${method} ${path}\nstdout: ${
        res.stdout || res.data
      }\nstderr: ${res.stderr}`
    );
  }
  return { data: res.data, status: res.status, stderr: res.stderr };
}

/**
 * Check that gh CLI is installed and accessible.
 * @param {boolean} verbose
 */
function ensureGhInstalled(verbose) {
  const res = spawnSync('gh', ['--version'], { encoding: 'utf8' });
  if (res.error || res.status !== 0) {
    fail(
      'Error: GitHub CLI (gh) is not installed or not found in PATH. Install: https://github.com/cli/cli/blob/trunk/docs/install_linux.md#debian'
    );
  }
  logVerbose(verbose, 'gh version:', (res.stdout || '').trim());
}

/**
 * Parse a simple flag from argv.
 * @param {string[]} args - Remaining args array (will be mutated)
 * @param {string} flag - Flag name including dashes (e.g., '--repo')
 * @returns {string|null} - Flag value or null if not found
 */
function parseFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  const value = args[idx + 1];
  args.splice(idx, 2);
  return value || null;
}

/**
 * Check if a boolean flag is present and remove it.
 * @param {string[]} args
 * @param {string} flag
 * @returns {boolean}
 */
function parseBoolFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return false;
  args.splice(idx, 1);
  return true;
}

/**
 * Parse common flags (--verbose, --dry-run, --help, -h) from args.
 * @param {string[]} args - Will be mutated to remove parsed flags
 * @returns {{verbose: boolean, dryRun: boolean, help: boolean}}
 */
function parseCommonFlags(args) {
  return {
    verbose: parseBoolFlag(args, '--verbose'),
    dryRun: parseBoolFlag(args, '--dry-run'),
    help: parseBoolFlag(args, '--help') || parseBoolFlag(args, '-h'),
  };
}

module.exports = {
  fail,
  logVerbose,
  createLogger,
  runGh,
  ghApi,
  ensureGhInstalled,
  parseFlag,
  parseBoolFlag,
  parseCommonFlags,
};
