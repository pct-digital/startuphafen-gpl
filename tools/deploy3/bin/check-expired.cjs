#!/usr/bin/env node

/**
 * check-expired.cjs
 *
 * Usage: node check-expired.cjs --repo owner/name [--verbose]
 *
 * Behavior:
 *   - List all GitHub environments via: GET /repos/{owner}/{repo}/environments
 *   - For each environment, fetch variables
 *   - Check if EXPIRE_AT variable exists AND is in the past AND DEPLOY_ENVIRONMENT != 'production'
 *   - Output to stdout: JSON array of expired environment objects, e.g.
 *     [{"domain": "25-0109-1714-54.example.com", "pr_number": "123"}, ...]
 *     (pr_number may be empty string if not set)
 *
 * Exit code: 0 always (empty array = nothing expired)
 */

const {
  ghApi,
  ensureGhInstalled,
  parseFlag,
  parseCommonFlags,
  logVerbose,
} = require('./lib/gh-helpers.cjs');

function printHelp() {
  console.log(`Usage:
  node check-expired.cjs --repo owner/name [--verbose]

Options:
  --repo <repo>     Repository in owner/name format (required)
  --verbose         Print debug information to stderr
  -h, --help        Show this help message

Output:
  JSON array of expired environment objects to stdout.
  Each object has: {domain: string, pr_number: string}
  Exit code is always 0.
`);
}

/**
 * Fetch all variables for a given environment.
 * @param {string} repo
 * @param {string} envName
 * @param {boolean} verbose
 * @returns {Map<string, string>} - Map of variable name to value
 */
function getEnvironmentVariables(repo, envName, verbose) {
  const vars = new Map();

  const result = ghApi(
    'GET',
    `/repos/${repo}/environments/${encodeURIComponent(envName)}/variables`,
    {
      verbose,
      allowFail: true,
      paginate: true,
    }
  );

  if (result.status !== 0 || !result.data) {
    logVerbose(
      verbose,
      `Could not fetch variables for environment: ${envName}`
    );
    return vars;
  }

  // Handle paginated response (slurped into array of pages)
  const pages = Array.isArray(result.data) ? result.data : [result.data];
  for (const page of pages) {
    const variables = page.variables || [];
    for (const v of variables) {
      vars.set(v.name, v.value);
    }
  }

  return vars;
}

/**
 * Check if an ISO 8601 date string is in the past.
 * @param {string} isoDate
 * @returns {boolean}
 */
function isExpired(isoDate) {
  try {
    const expireDate = new Date(isoDate);
    const now = new Date();
    return expireDate < now;
  } catch {
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const flags = parseCommonFlags(args);

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  const repo = parseFlag(args, '--repo');

  if (!repo) {
    console.error('Error: --repo is required');
    printHelp();
    process.exit(1);
  }

  ensureGhInstalled(flags.verbose);

  // Step 1: List all environments
  logVerbose(flags.verbose, `Fetching environments for repo: ${repo}`);
  const envResult = ghApi('GET', `/repos/${repo}/environments`, {
    verbose: flags.verbose,
    allowFail: true,
    paginate: true,
  });

  if (envResult.status !== 0 || !envResult.data) {
    logVerbose(
      flags.verbose,
      'Could not fetch environments, outputting empty array'
    );
    console.log('[]');
    process.exit(0);
  }

  // Handle paginated response
  const pages = Array.isArray(envResult.data)
    ? envResult.data
    : [envResult.data];
  const environments = [];
  for (const page of pages) {
    if (page.environments) {
      environments.push(...page.environments);
    }
  }

  logVerbose(flags.verbose, `Found ${environments.length} environments`);

  const expiredEnvironments = [];

  // Step 2: Check each environment
  for (const env of environments) {
    const envName = env.name;
    logVerbose(flags.verbose, `Checking environment: ${envName}`);

    const vars = getEnvironmentVariables(repo, envName, flags.verbose);

    // Check DEPLOY_ENVIRONMENT - skip if production
    const deployEnv = vars.get('DEPLOY_ENVIRONMENT');
    if (deployEnv === 'production') {
      logVerbose(
        flags.verbose,
        `  Skipping ${envName}: DEPLOY_ENVIRONMENT is production`
      );
      continue;
    }

    // Check EXPIRE_AT
    const expireAt = vars.get('EXPIRE_AT');
    if (!expireAt) {
      logVerbose(flags.verbose, `  Skipping ${envName}: no EXPIRE_AT variable`);
      continue;
    }

    logVerbose(flags.verbose, `  EXPIRE_AT: ${expireAt}`);

    if (isExpired(expireAt)) {
      logVerbose(flags.verbose, `  Environment ${envName} is EXPIRED`);
      const prNumber = vars.get('PR_NUMBER') || '';
      logVerbose(flags.verbose, `  PR_NUMBER: ${prNumber || '(not set)'}`);
      expiredEnvironments.push({ domain: envName, pr_number: prNumber });
    } else {
      logVerbose(flags.verbose, `  Environment ${envName} is not yet expired`);
    }
  }

  logVerbose(
    flags.verbose,
    `Found ${expiredEnvironments.length} expired environments`
  );
  console.log(JSON.stringify(expiredEnvironments));
  process.exit(0);
}

main();
