#!/usr/bin/env node

/**
 * find-release-for-sha.cjs
 *
 * Usage: node find-release-for-sha.cjs --sha <commit-sha> --repo owner/name [--verbose]
 *
 * Behavior:
 *   - List tags via: GET /repos/{owner}/{repo}/tags
 *   - Find a tag that points to the given SHA
 *   - Output to stdout: release tag name or empty string if not found
 *
 * Exit code: 0 always (empty output = no release found)
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
  node find-release-for-sha.cjs --sha <commit-sha> --repo owner/name [--verbose]

Options:
  --sha <sha>       The commit SHA to find a release for (required)
  --repo <repo>     Repository in owner/name format (required)
  --verbose         Print debug information to stderr
  -h, --help        Show this help message

Output:
  Release tag name to stdout, or empty string if no release found.
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

  const sha = parseFlag(args, '--sha');
  const repo = parseFlag(args, '--repo');

  if (!sha) {
    console.error('Error: --sha is required');
    printHelp();
    process.exit(1);
  }

  if (!repo) {
    console.error('Error: --repo is required');
    printHelp();
    process.exit(1);
  }

  ensureGhInstalled(flags.verbose);

  // Fetch tags (paginated to handle repos with many tags)
  logVerbose(flags.verbose, `Fetching tags for repo: ${repo}`);
  const tagsResult = ghApi('GET', `/repos/${repo}/tags?per_page=100`, {
    verbose: flags.verbose,
    allowFail: true,
  });

  if (
    tagsResult.status !== 0 ||
    !tagsResult.data ||
    !Array.isArray(tagsResult.data)
  ) {
    logVerbose(flags.verbose, 'Failed to fetch tags or no tags found');
    console.log('');
    process.exit(0);
  }

  logVerbose(flags.verbose, `Found ${tagsResult.data.length} tags`);

  // Find tag matching the SHA
  const matchingTag = tagsResult.data.find((tag) => tag.commit?.sha === sha);

  if (!matchingTag) {
    logVerbose(flags.verbose, `No tag found pointing to SHA: ${sha}`);
    console.log('');
    process.exit(0);
  }

  logVerbose(flags.verbose, `Found matching tag: ${matchingTag.name}`);
  console.log(matchingTag.name);
  process.exit(0);
}

main();
