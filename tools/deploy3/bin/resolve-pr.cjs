#!/usr/bin/env node

/**
 * resolve-pr.cjs
 *
 * Usage: node resolve-pr.cjs --tag <release-tag> --repo owner/name [--verbose]
 *
 * Behavior:
 *   - Fetch SHA for the release tag via: GET /repos/{owner}/{repo}/git/ref/tags/{tag}
 *   - Find associated PR via: GET /repos/{owner}/{repo}/commits/{sha}/pulls
 *   - Output to stdout: PR number (just the number, e.g. "123") or empty string if not found
 *
 * Exit code: 0 always (empty output = no PR found)
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
  node resolve-pr.cjs --tag <release-tag> --repo owner/name [--verbose]

Options:
  --tag <tag>       The release tag to resolve (required)
  --repo <repo>     Repository in owner/name format (required)
  --verbose         Print debug information to stderr
  -h, --help        Show this help message

Output:
  PR number to stdout, or empty string if no PR found.
  Exit code is always 0.
`);
}

function main() {
  const args = process.argv.slice(2);
  const flags = parseCommonFlags(args);

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  const tag = parseFlag(args, '--tag');
  const repo = parseFlag(args, '--repo');

  if (!tag) {
    console.error('Error: --tag is required');
    printHelp();
    process.exit(1);
  }

  if (!repo) {
    console.error('Error: --repo is required');
    printHelp();
    process.exit(1);
  }

  ensureGhInstalled(flags.verbose);

  // Step 1: Fetch the SHA for the tag
  logVerbose(flags.verbose, `Fetching SHA for tag: ${tag}`);
  const refResult = ghApi('GET', `/repos/${repo}/git/ref/tags/${tag}`, {
    verbose: flags.verbose,
    allowFail: true,
  });

  if (refResult.status !== 0 || !refResult.data) {
    logVerbose(
      flags.verbose,
      'Tag not found or API error, outputting empty string'
    );
    console.log('');
    process.exit(0);
  }

  let sha = refResult.data.object?.sha;
  const objectType = refResult.data.object?.type;

  // If it's an annotated tag, we need to dereference to get the commit SHA
  if (objectType === 'tag') {
    logVerbose(flags.verbose, `Tag is annotated, dereferencing to commit...`);
    const tagResult = ghApi('GET', `/repos/${repo}/git/tags/${sha}`, {
      verbose: flags.verbose,
      allowFail: true,
    });
    if (tagResult.status === 0 && tagResult.data?.object?.sha) {
      sha = tagResult.data.object.sha;
    }
  }

  if (!sha) {
    logVerbose(
      flags.verbose,
      'Could not determine commit SHA, outputting empty string'
    );
    console.log('');
    process.exit(0);
  }

  logVerbose(flags.verbose, `Resolved tag to SHA: ${sha}`);

  // Step 2: Find associated PR for this commit
  logVerbose(flags.verbose, `Finding PRs associated with commit: ${sha}`);
  const prResult = ghApi('GET', `/repos/${repo}/commits/${sha}/pulls`, {
    verbose: flags.verbose,
    allowFail: true,
  });

  if (
    prResult.status !== 0 ||
    !prResult.data ||
    !Array.isArray(prResult.data) ||
    prResult.data.length === 0
  ) {
    logVerbose(
      flags.verbose,
      'No PRs found for this commit, outputting empty string'
    );
    console.log('');
    process.exit(0);
  }

  // Return the first (most relevant) PR number
  const prNumber = prResult.data[0].number;
  logVerbose(flags.verbose, `Found PR: #${prNumber}`);
  console.log(prNumber);
  process.exit(0);
}

main();
