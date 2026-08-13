#!/usr/bin/env node

/**
 * post-pr-comment.cjs
 *
 * Usage: node post-pr-comment.cjs --repo owner/name --pr <number> --type <type> [type-specific args] [--verbose] [--dry-run]
 *
 * Types:
 *   --type temp-deploy --release <tag> --domain <domain> --expires <iso8601> --source <env>
 *   --type release-created --release <tag>
 *
 * Behavior:
 *   - Format inline markdown template based on type
 *   - Post comment via: POST /repos/{owner}/{repo}/issues/{pr}/comments
 *   - German time formatting for expires date (e.g., "15.01.2026 18:14 Uhr")
 *
 * Exit code: 0 on success, 1 on failure
 */

const {
  ghApi,
  ensureGhInstalled,
  parseFlag,
  parseCommonFlags,
  logVerbose,
  fail,
} = require('./lib/gh-helpers.cjs');

function printHelp() {
  console.log(`Usage:
  node post-pr-comment.cjs --repo owner/name --pr <number> --type <type> [options] [--verbose] [--dry-run]

Types:
  temp-deploy     Post a temporary deployment notification
  release-created Post a release created notification
  temp-expired    Post a temporary deployment expiration notification

Options for temp-deploy:
  --release <tag>      The release tag
  --domain <domain>    The deployment domain
  --expires <iso8601>  Expiration date in ISO 8601 format
  --source <env>       Source environment name

Options for release-created:
  --release <tag>      The release tag

Options for temp-expired:
  --domain <domain>    The deployment domain that expired

Common options:
  --repo <repo>        Repository in owner/name format (required)
  --pr <number>        PR number (required)
  --verbose            Print debug information to stderr
  --dry-run            Print what would be posted without actually posting
  -h, --help           Show this help message

Exit code: 0 on success, 1 on failure
`);
}

/**
 * Format an ISO 8601 date to German format: "DD.MM.YYYY HH:MM Uhr"
 * @param {string} isoDate
 * @returns {string}
 */
function formatGermanDateTime(isoDate) {
  try {
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes} Uhr`;
  } catch {
    return isoDate; // Fallback to original if parsing fails
  }
}

/**
 * Generate markdown comment for temp-deploy type.
 * @param {{release: string, domain: string, expires: string, source: string}} params
 * @returns {string}
 */
function generateTempDeployComment({ release, domain, expires, source }) {
  const expiresFormatted = formatGermanDateTime(expires);
  return `## 🚀 Temporäres Deployment erstellt

| | |
|---|---|
| **Release** | \`${release}\` |
| **URL** | https://${domain} |
| **Quelle** | ${source} |
| **Gültig bis** | ${expiresFormatted} |

Das Deployment wird nach Ablauf automatisch gelöscht.
`;
}

/**
 * Generate markdown comment for release-created type.
 * @param {{release: string}} params
 * @returns {string}
 */
function generateReleaseCreatedComment({ release }) {
  const repo = process.env.GITHUB_REPOSITORY ?? '<owner>/<repo>';
  return `## 📦 Release erstellt

Release \`${release}\` wurde erfolgreich aus diesem PR erstellt.

### Nächste Schritte

Um dieses Release zu deployen, öffne den [**Temp Deploy Workflow**](https://github.com/${repo}/actions/workflows/temp_deploy.yml):

1. Klicke auf "Run workflow"
2. Gib das Release-Tag ein: \`${release}\`
3. Starte das Deployment

Das Release wird dann auf einer temporären Domain bereitgestellt und nach Ablaufe automatisch gelöscht.
Es wird automatisch ein Kommentar in diesem PR angelegt um darüber zu informieren.
`;
}

/**
 * Generate markdown comment for temp-expired type.
 * @param {{domain: string}} params
 * @returns {string}
 */
function generateTempExpiredComment({ domain }) {
  return `## ⏰ Temporäres Deployment abgelaufen

Das temporäre Deployment unter \`${domain}\` ist abgelaufen und wurde automatisch gelöscht.

Falls du das Deployment weiterhin benötigst, kannst du es erneut über den [**Temp Deploy Workflow**](https://github.com/${process.env.GITHUB_REPOSITORY ?? '<owner>/<repo>'}/actions/workflows/temp_deploy.yml) starten.
`;
}

function main() {
  const args = process.argv.slice(2);
  const flags = parseCommonFlags(args);

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  const repo = parseFlag(args, '--repo');
  const pr = parseFlag(args, '--pr');
  const type = parseFlag(args, '--type');

  if (!repo) {
    fail('Error: --repo is required');
  }

  if (!pr) {
    fail('Error: --pr is required');
  }

  if (!type) {
    fail('Error: --type is required');
  }

  const prNumber = parseInt(pr, 10);
  if (isNaN(prNumber)) {
    fail(`Error: --pr must be a number, got: ${pr}`);
  }

  let commentBody;

  if (type === 'temp-deploy') {
    const release = parseFlag(args, '--release');
    const domain = parseFlag(args, '--domain');
    const expires = parseFlag(args, '--expires');
    const source = parseFlag(args, '--source');

    if (!release) fail('Error: --release is required for temp-deploy');
    if (!domain) fail('Error: --domain is required for temp-deploy');
    if (!expires) fail('Error: --expires is required for temp-deploy');
    if (!source) fail('Error: --source is required for temp-deploy');

    commentBody = generateTempDeployComment({
      release,
      domain,
      expires,
      source,
    });
  } else if (type === 'release-created') {
    const release = parseFlag(args, '--release');

    if (!release) fail('Error: --release is required for release-created');

    commentBody = generateReleaseCreatedComment({ release });
  } else if (type === 'temp-expired') {
    const domain = parseFlag(args, '--domain');

    if (!domain) fail('Error: --domain is required for temp-expired');

    commentBody = generateTempExpiredComment({ domain });
  } else {
    fail(
      `Error: Unknown type: ${type}. Supported types: temp-deploy, release-created, temp-expired`
    );
  }

  logVerbose(flags.verbose, 'Generated comment body:');
  logVerbose(flags.verbose, commentBody);

  if (flags.dryRun) {
    console.error('[dry-run] Would post comment to PR #' + prNumber);
    console.error('[dry-run] Comment body:');
    console.error(commentBody);
    process.exit(0);
  }

  ensureGhInstalled(flags.verbose);

  // Post the comment
  logVerbose(flags.verbose, `Posting comment to PR #${prNumber}`);
  const result = ghApi('POST', `/repos/${repo}/issues/${prNumber}/comments`, {
    verbose: flags.verbose,
    data: { body: commentBody },
    allowFail: true,
  });

  if (result.status !== 0) {
    fail(`Failed to post comment: ${result.stderr}`);
  }

  logVerbose(flags.verbose, 'Comment posted successfully');
  if (result.data?.html_url) {
    logVerbose(flags.verbose, `Comment URL: ${result.data.html_url}`);
  }

  process.exit(0);
}

main();
