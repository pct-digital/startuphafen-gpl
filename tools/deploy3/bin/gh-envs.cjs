#!/usr/bin/env node

/*
	gh-envs.cjs

	A lightweight Node.js CLI to manage GitHub Environments using the GitHub CLI (gh).

	- Auth is stateless via GITHUB_TOKEN env var.
  - Subcommands:
      create <EnvName>
      copy <SourceEnv> <TargetEnv>
      delete <EnvName>
      list <EnvName>
      exists <EnvName>
      print <EnvName> <VarName>
		Common required flag: --repo owner/name
		Repeated flags: --secret NAME VALUE, --env NAME VALUE
		copy extras: --overwrite-env NAME KEY VALUE, --overwrite-json NAME JSON
		Global flags: --dry-run, --verbose, -h|--help
	- Escape decoding: values with literal "\\n" become newlines (secrets & env vars, but NOT overwrite-env VALUE per spec)
	- JSON validation: env values beginning with { or [ must be valid JSON; overwrite-json requires valid JSON.
	- No external deps (except shared helpers).
*/

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { env } = process;

// Import shared helpers
const { fail, createLogger, runGh } = require('./lib/gh-helpers.cjs');

// Create local logger with [gh-envs] prefix
const logVerbose = createLogger('[gh-envs]');

function ensureGhInstalled(verbose) {
  const res = spawnSync('gh', ['--version'], { encoding: 'utf8' });
  if (res.error || res.status !== 0) {
    fail(
      'Error: GitHub CLI (gh) is not installed or not found in PATH. Install: https://github.com/cli/cli/blob/trunk/docs/install_linux.md#debian'
    );
  }
  logVerbose(verbose, 'gh version:', (res.stdout || '').trim());
}

function isPlainObject(x) {
  return Object.prototype.toString.call(x) === '[object Object]';
}

function cloneDeep(x) {
  if (Array.isArray(x)) return x.map(cloneDeep);
  if (isPlainObject(x)) {
    const out = {};
    for (const k of Object.keys(x)) out[k] = cloneDeep(x[k]);
    return out;
  }
  return x;
}

function mergeExceptArrays(dest, source) {
  if (Array.isArray(source)) {
    return cloneDeep(source); // replace arrays
  }
  if (isPlainObject(source) && isPlainObject(dest)) {
    const out = { ...dest };
    for (const key of Object.keys(source)) {
      out[key] = mergeExceptArrays(dest[key], source[key]);
    }
    return out;
  }
  if (isPlainObject(source)) {
    // dest not object, source is object => clone source
    return cloneDeep(source);
  }
  // primitives or different types => replace
  return source;
}

// Convenience wrapper for GitHub REST API calls via gh api.
// NOTE: This local version returns res.data directly for backward compatibility.
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
  // NOTE: GitHub CLI 'gh api' prints only the response body (no HTTP status code field by default).
  // We therefore cannot rely on a status property inside the JSON body. If exit status is non-zero, treat as failure unless allowFail.
  const res = runGh(args, { verbose, parseJson: true, allowFail, input });
  if (!allowFail && res.status !== 0) {
    fail(`gh api call failed: ${method} ${path} ${res.stdout} ${res.stderr}`);
  }
  return res.data; // return parsed body directly
}

function printHelp() {
  console.log(`Usage:
  ./gh-envs.cjs create <EnvName> --repo owner/name [--vars-from-stdin] [--secret NAME VALUE ...] [--env NAME VALUE ...] [--exclude-var NAME ...] [--dry-run] [--verbose]
  ./gh-envs.cjs copy <SourceEnv> <TargetEnv> --repo owner/name [--secret NAME VALUE ...] [--env NAME VALUE ...] [--exclude-var NAME ...] [--overwrite-env NAME KEY VALUE] [--overwrite-json NAME JSON] [--dry-run] [--verbose]
  ./gh-envs.cjs delete <EnvName> --repo owner/name [--dry-run] [--verbose]
  ./gh-envs.cjs list <EnvName> --repo owner/name [--dry-run] [--verbose]
  ./gh-envs.cjs exists <EnvName> --repo owner/name [--dry-run] [--verbose]
  ./gh-envs.cjs print <EnvName> <VarName> --repo owner/name [--dry-run] [--verbose]
  ./gh-envs.cjs set <EnvName> <VarName> <Value> --repo owner/name [--dry-run] [--verbose]

Stdin flag (create command only):
  --vars-from-stdin
    Read base variables from stdin in gh-envs list JSON format. Variables from stdin are
    loaded first, then --env-dir and --env flags can override. Enables pipe pattern:
      gh-envs.cjs list SOURCE | gh-envs.cjs create TARGET --vars-from-stdin

Directory flags (may be repeated; processed before CLI key/value flags so CLI wins on conflicts):
  --secrets-dir PATH
    Load each regular, non-dot file in PATH as a secret. The filename (no extension stripping) becomes the secret name and the file content (verbatim) becomes the value.
  --env-dir PATH
    Load each regular, non-dot file in PATH as an environment variable. Filename becomes variable name. File content may be plain text or JSON. If it starts with { or [ it must be valid JSON or parsing error is recorded.
  --overwrite-env-dir PATH
    Each file name is treated as the variable name whose value is a dotenv-style blob. Each non-comment, KEY=VALUE line in the file becomes an overwrite to that KEY inside the variable's textual (non-JSON) value. (If the source variable is JSON this is rejected.) Values containing literal \\n or actual newlines are rejected as with --overwrite-env.
  --overwrite-json-dir PATH
    Each file name is treated as the variable name. File content must be valid JSON (object or array). Content is deep-merged into existing JSON variable using object merge with arrays replaced wholesale. If the variable does not yet exist it is created with this JSON.

Precedence & de-duplication:
  1. Directory-derived entries are loaded first.
  2. Explicit CLI flags (--secret/--env/--overwrite-env/--overwrite-json) are applied after and override directory entries.
  3. Dedupe rules keep the LAST occurrence: secrets by name; env vars by name; overwrite-json by name; overwrite-env by (variable name, key).
  4. Cannot specify both overwrite-env and overwrite-json for the same variable name (error). Also cannot mix --env for a variable that also has overwrite-* applied.

File rules / validation:
  - Empty files are rejected.
  - Dot files (starting with '.') are ignored.
  - JSON detection is optimistic: only values starting with { or [ are parsed.
  - Newline escape decoding (\\n -> real newline) ONLY happens for CLI --secret/--env flags, not directory sources (they are taken verbatim).
  - overwrite-env(-dir) values must NOT contain literal \\n or actual newline characters.

Exclusion flag (create and copy commands):
  --exclude-var NAME
    Exclude a variable by name from the final output. May be repeated. Applied after all other
    processing (stdin, directories, overwrites). Useful for removing variables that should not
    be copied to new environments.

Notes:
	- Secrets values and --env values support \\n which will be converted to newlines.
	- --overwrite-env uses three args: NAME KEY VALUE. VALUE must not contain literal \\n.
	- JSON-ish env/overwrite-json values are validated. Invalid JSON aborts (currently: collected as errors and printed).
	- --verbose causes to print all communication with gh
	- --dry-run causes it to not actually send any commands at all to gh and just summarize what it would do
`);
}

// Utility: decode literal \n into newlines.
function decodeEscapes(str) {
  return str.replace(/\\n/g, '\n');
}

// Try parse JSON if looks like JSON. Returns {isJson, parsed, error}
function tryParseJsonMaybe(value) {
  const trimmed = value.trim();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
    return { isJson: false };
  }
  try {
    return { isJson: true, parsed: JSON.parse(trimmed) };
  } catch (e) {
    return { isJson: true, error: e.message };
  }
}

function parseArgs(argv) {
  const out = {
    command: null, // create|copy|delete|list|exists|print|set
    repo: null,
    envName: null, // for create/delete/list/set
    sourceEnv: null,
    targetEnv: null,
    varName: null, // for print/set
    varValue: null, // for set
    secrets: [], // {name,value}
    envVars: [], // {name,value,isJson,parsedJson?}
    overwriteEnv: [], // {name,key,value}
    overwriteJson: [], // {name,raw,isJson:true,parsedJson?,error?}
    excludeVars: [], // variable names to exclude from final output
    flags: { dryRun: false, verbose: false, help: false, varsFromStdin: false },
    errors: [],
    unknown: [],
  };

  const args = argv.slice(2);
  if (args.length === 0) {
    out.flags.help = true;
    out.errors.push('No command provided');
    return out;
  }

  const command = args.shift();
  if (
    [
      'create',
      'copy',
      'delete',
      'list',
      'exists',
      'print',
      'set',
      '-h',
      '--help',
    ].includes(command)
  ) {
    if (command === '-h' || command === '--help') {
      out.flags.help = true;
      return out;
    }
    out.command = command;
  } else {
    out.errors.push(`Unknown command: ${command}`);
    out.flags.help = true;
    return out;
  }

  // Positional handling based on command
  function shiftOrErr(label) {
    if (args.length === 0) {
      out.errors.push(`Missing required positional: ${label}`);
      return null;
    }
    return args.shift();
  }

  if (out.command === 'create') {
    out.envName = shiftOrErr('EnvName');
  } else if (out.command === 'copy') {
    out.sourceEnv = shiftOrErr('SourceEnv');
    out.targetEnv = shiftOrErr('TargetEnv');
  } else if (
    out.command === 'delete' ||
    out.command === 'list' ||
    out.command === 'exists'
  ) {
    out.envName = shiftOrErr('EnvName');
  } else if (out.command === 'print') {
    out.envName = shiftOrErr('EnvName');
    out.varName = shiftOrErr('VarName');
  } else if (out.command === 'set') {
    out.envName = shiftOrErr('EnvName');
    out.varName = shiftOrErr('VarName');
    out.varValue = shiftOrErr('Value');
  }

  // Flag parsing
  // Collect directory flags first; process after full flag parse so --verbose precedence known
  const secretsDirs = []; // aggregate
  const envDirs = [];
  const overwriteEnvDirs = [];
  const overwriteJsonDirs = [];
  while (args.length) {
    const tok = args.shift();
    if (!tok.startsWith('--')) {
      out.unknown.push(tok);
      continue;
    }
    switch (tok) {
      case '--repo': {
        const v = args.shift();
        if (!v) {
          out.errors.push('--repo requires value');
        } else {
          out.repo = v;
        }
        break;
      }
      case '--secrets-dir': {
        const dir = args.shift();
        if (!dir) {
          out.errors.push('--secrets-dir requires a path');
        } else {
          secretsDirs.push(dir);
        }
        break;
      }
      case '--env-dir': {
        const dir = args.shift();
        if (!dir) {
          out.errors.push('--env-dir requires a path');
        } else {
          envDirs.push(dir);
        }
        break;
      }
      case '--overwrite-env-dir': {
        const dir = args.shift();
        if (!dir) {
          out.errors.push('--overwrite-env-dir requires a path');
        } else {
          overwriteEnvDirs.push(dir);
        }
        break;
      }
      case '--overwrite-json-dir': {
        const dir = args.shift();
        if (!dir) {
          out.errors.push('--overwrite-json-dir requires a path');
        } else {
          overwriteJsonDirs.push(dir);
        }
        break;
      }
      case '--secret': {
        const name = args.shift();
        const value = args.shift();
        if (!name || !value) {
          out.errors.push('--secret requires NAME and VALUE');
        } else {
          out.secrets.push({ name, value: decodeEscapes(value) });
        }
        break;
      }
      case '--env': {
        const name = args.shift();
        const value = args.shift();
        if (!name || value === undefined) {
          out.errors.push('--env requires NAME and VALUE');
        } else {
          const decoded = decodeEscapes(value);
          const jp = tryParseJsonMaybe(decoded);
          out.envVars.push({
            name,
            value: decoded,
            isJson: jp.isJson,
            parsedJson: jp.parsed,
            jsonError: jp.error,
          });
          if (jp.error)
            out.errors.push(`Invalid JSON for env ${name}: ${jp.error}`);
        }
        break;
      }
      case '--overwrite-env': {
        const name = args.shift();
        const key = args.shift();
        const value = args.shift();
        if (!name || !key || value === undefined) {
          out.errors.push('--overwrite-env requires NAME KEY VALUE');
        } else if (value.includes('\\n') || value.includes('\n')) {
          // Reject if contains literal sequence \n OR actual newline character
          out.errors.push(
            '--overwrite-env VALUE must not contain newline (literal \\n or actual newline character)'
          );
          out.overwriteEnv.push({ name, key, value, rejected: true });
        } else {
          out.overwriteEnv.push({ name, key, value });
        }
        break;
      }
      case '--overwrite-json': {
        const name = args.shift();
        const raw = args.shift();
        if (!name || raw === undefined) {
          out.errors.push('--overwrite-json requires NAME JSON');
        } else {
          const jp = tryParseJsonMaybe(raw);
          if (!jp.isJson) {
            out.errors.push(
              `--overwrite-json value for ${name} must look like JSON (start with { or [)`
            );
            out.overwriteJson.push({ name, raw, isJson: false });
          } else if (jp.error) {
            out.errors.push(
              `Invalid JSON for overwrite-json ${name}: ${jp.error}`
            );
            out.overwriteJson.push({
              name,
              raw,
              isJson: true,
              error: jp.error,
            });
          } else {
            out.overwriteJson.push({
              name,
              raw,
              isJson: true,
              parsedJson: jp.parsed,
            });
          }
        }
        break;
      }
      case '--exclude-var': {
        const name = args.shift();
        if (!name) {
          out.errors.push('--exclude-var requires NAME');
        } else {
          out.excludeVars.push(name);
        }
        break;
      }
      case '--dry-run':
        out.flags.dryRun = true;
        break;
      case '--verbose':
        out.flags.verbose = true;
        break;
      case '--vars-from-stdin':
        out.flags.varsFromStdin = true;
        break;
      case '--help':
        out.flags.help = true;
        break;
      default:
        out.unknown.push(tok);
    }
  }

  // After parsing all flags, process directory-based inputs.
  function readImmediateFiles(dirPath) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries.filter((d) => d.isFile()).map((d) => d.name);
    } catch (e) {
      out.errors.push(`Failed to read directory ${dirPath}: ${e.message}`);
      return [];
    }
  }

  // Accumulators from directories (will be merged before CLI entries for precedence: CLI wins due to later dedupe pass)
  const dirSecrets = [];
  const dirEnvVars = [];
  const dirOverwriteEnv = [];
  const dirOverwriteJson = [];

  // Validation helpers
  function ensureDirExists(p, flag) {
    if (!fs.existsSync(p)) {
      out.errors.push(`${flag} path does not exist: ${p}`);
      return false;
    }
    const st = fs.statSync(p);
    if (!st.isDirectory()) {
      out.errors.push(`${flag} path is not a directory: ${p}`);
      return false;
    }
    return true;
  }

  // secrets-dir processing
  for (const dir of secretsDirs) {
    if (!ensureDirExists(dir, '--secrets-dir')) continue;
    for (const fileName of readImmediateFiles(dir)) {
      if (fileName.startsWith('.')) continue; // ignore dot files
      const filePath = path.join(dir, fileName);
      let content;
      try {
        content = fs.readFileSync(filePath, 'utf8'); // UTF-8 assumed
      } catch (e) {
        out.errors.push(`Failed to read secret file ${filePath}: ${e.message}`);
        continue;
      }
      if (content.length === 0) {
        out.errors.push(`Empty secret file not allowed: ${filePath}`);
        continue;
      }
      dirSecrets.push({ name: fileName, value: content }); // raw content, no escape decoding
      if (out.flags.verbose)
        console.error('[gh-envs] loaded secret from dir', filePath);
    }
  }

  // env-dir processing
  for (const dir of envDirs) {
    if (!ensureDirExists(dir, '--env-dir')) continue;
    for (const fileName of readImmediateFiles(dir)) {
      if (fileName.startsWith('.')) continue;
      const filePath = path.join(dir, fileName);
      let content;
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch (e) {
        out.errors.push(`Failed to read env file ${filePath}: ${e.message}`);
        continue;
      }
      if (content.length === 0) {
        out.errors.push(`Empty env file not allowed: ${filePath}`);
        continue;
      }
      const jp = tryParseJsonMaybe(content);
      if (jp.error)
        out.errors.push(
          `Invalid JSON for env (from file) ${fileName}: ${jp.error}`
        );
      dirEnvVars.push({
        name: fileName,
        value: content,
        isJson: jp.isJson,
        parsedJson: jp.parsed,
        jsonError: jp.error,
      });
      if (out.flags.verbose)
        console.error(
          '[gh-envs] loaded env var from dir',
          filePath,
          'isJson=',
          jp.isJson && !jp.error
        );
    }
  }

  // overwrite-env-dir processing (dotenv style content, each KEY=VALUE pair -> overwriteEnv entry)
  for (const dir of overwriteEnvDirs) {
    if (!ensureDirExists(dir, '--overwrite-env-dir')) continue;
    for (const fileName of readImmediateFiles(dir)) {
      if (fileName.startsWith('.')) continue;
      const filePath = path.join(dir, fileName);
      let content;
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch (e) {
        out.errors.push(
          `Failed to read overwrite-env file ${filePath}: ${e.message}`
        );
        continue;
      }
      if (content.length === 0) {
        out.errors.push(`Empty overwrite-env file not allowed: ${filePath}`);
        continue;
      }
      const lines = content.split(/\r?\n/);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const idx = line.indexOf('=');
        if (idx === -1) {
          out.errors.push(
            `Malformed line in overwrite-env file ${filePath}: ${line}`
          );
          continue;
        }
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1); // preserve as-is (no decode, no trimming)
        if (!key) {
          out.errors.push(
            `Empty key in overwrite-env file ${filePath}: ${line}`
          );
          continue;
        }
        if (value.includes('\\n') || value.includes('\n')) {
          out.errors.push(
            `--overwrite-env-dir produced value with disallowed newline sequence for ${fileName}:${key}`
          );
          dirOverwriteEnv.push({ name: fileName, key, value, rejected: true });
          continue;
        }
        dirOverwriteEnv.push({ name: fileName, key, value });
        if (out.flags.verbose)
          console.error(
            '[gh-envs] loaded overwrite-env from dir',
            filePath,
            key
          );
      }
    }
  }

  // overwrite-json-dir processing
  for (const dir of overwriteJsonDirs) {
    if (!ensureDirExists(dir, '--overwrite-json-dir')) continue;
    for (const fileName of readImmediateFiles(dir)) {
      if (fileName.startsWith('.')) continue;
      const filePath = path.join(dir, fileName);
      let content;
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch (e) {
        out.errors.push(
          `Failed to read overwrite-json file ${filePath}: ${e.message}`
        );
        continue;
      }
      if (content.length === 0) {
        out.errors.push(`Empty overwrite-json file not allowed: ${filePath}`);
        continue;
      }
      const jp = tryParseJsonMaybe(content);
      if (!jp.isJson) {
        out.errors.push(
          `overwrite-json-dir file must look like JSON (start with { or [): ${filePath}`
        );
        dirOverwriteJson.push({ name: fileName, raw: content, isJson: false });
      } else if (jp.error) {
        out.errors.push(
          `Invalid JSON in overwrite-json file ${filePath}: ${jp.error}`
        );
        dirOverwriteJson.push({
          name: fileName,
          raw: content,
          isJson: true,
          error: jp.error,
        });
      } else {
        dirOverwriteJson.push({
          name: fileName,
          raw: content,
          isJson: true,
          parsedJson: jp.parsed,
        });
        if (out.flags.verbose)
          console.error('[gh-envs] loaded overwrite-json from dir', filePath);
      }
    }
  }

  // Merge directory-derived entries BEFORE existing (CLI) entries, then dedupe with CLI precedence.
  // Precedence order (lowest -> highest): directory -> CLI base definitions -> CLI overwrites.
  out.secrets = [...dirSecrets, ...out.secrets];
  out.envVars = [...dirEnvVars, ...out.envVars];
  out.overwriteEnv = [...dirOverwriteEnv, ...out.overwriteEnv];
  out.overwriteJson = [...dirOverwriteJson, ...out.overwriteJson];

  // Dedupe helpers keeping LAST occurrence (CLI wins because appended later above)
  function dedupeBy(arr, keyFn) {
    const map = new Map();
    for (const item of arr) map.set(keyFn(item), item);
    return Array.from(map.values());
  }
  out.secrets = dedupeBy(out.secrets, (s) => s.name);
  out.envVars = dedupeBy(out.envVars, (e) => e.name);
  out.overwriteJson = dedupeBy(out.overwriteJson, (o) => o.name);
  out.overwriteEnv = dedupeBy(
    out.overwriteEnv,
    (o) => `${o.name}\u0000${o.key}`
  );

  // Basic validation
  if (!out.flags.help) {
    if (!out.repo) out.errors.push('Missing required --repo');
    if (out.command === 'create' && !out.envName)
      out.errors.push('Missing environment name');
    if (out.command === 'copy' && (!out.sourceEnv || !out.targetEnv))
      out.errors.push('Missing source or target environment');
    if (
      (out.command === 'delete' ||
        out.command === 'list' ||
        out.command === 'exists') &&
      !out.envName
    )
      out.errors.push('Missing environment name');
    if (out.command === 'print' && (!out.envName || !out.varName))
      out.errors.push('Missing environment or variable name');
    if (
      out.command === 'set' &&
      (!out.envName || !out.varName || !out.varValue)
    )
      out.errors.push('Missing environment, variable name, or value');
  }

  return out;
}

function loadDotEnvIfPresent(verbose) {
  const dotenvPath = path.join(__dirname, '.env');
  if (!fs.existsSync(dotenvPath)) {
    logVerbose(verbose, 'No .env file found next to script.');
    return;
  }
  try {
    const content = fs.readFileSync(dotenvPath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue; // skip malformed
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1);
      // Remove optional surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // Expand escaped newlines like conventional .env? We'll keep literal unless user adds \n themselves.
      if (!(key in env)) {
        // don't override existing real env vars
        env[key] = value;
      }
    }
    logVerbose(verbose, `Loaded .env from ${dotenvPath}`);
  } catch (e) {
    logVerbose(verbose, 'Failed to read .env file:', e.message);
  }
}

function ensureTokenPresent() {
  if (!env.GITHUB_TOKEN) {
    throw new Error('Error: GITHUB_TOKEN environment variable must be set.');
  }
}

function parseRepoString(repo) {
  if (!repo || !/^[^/]+\/[^/]+$/.test(repo))
    fail('Invalid --repo, expected owner/name');
  const [owner, name] = repo.split('/');
  return { owner, name };
}

function ghGet(path, verbose, paginate = false) {
  return ghApi('GET', path, { verbose, paginate });
}

// Normalize the GitHub environment variables API response so code can treat
// both the single-object and the paginated array-of-objects forms uniformly.
// GitHub CLI with --paginate --slurp produces: [ { variables:[...] }, { variables:[...] } ]
// Without pagination it yields: { variables:[...], total_count:n }
// This helper returns { variables: [...], total_count:number, pages:number, raw:any }
function normalizeVariablesResponse(data) {
  if (!data) return { variables: [], total_count: 0, pages: 0, raw: data };
  if (Array.isArray(data)) {
    const merged = [];
    let reportedTotal = 0;
    for (const page of data) {
      if (page && Array.isArray(page.variables)) merged.push(...page.variables);
      if (page && typeof page.total_count === 'number') {
        // Keep the max seen (GitHub may repeat total_count each page)
        reportedTotal = Math.max(reportedTotal, page.total_count);
      }
    }
    return {
      variables: merged,
      total_count: reportedTotal || merged.length,
      pages: data.length,
      raw: data,
    };
  }
  if (Array.isArray(data.variables)) {
    return {
      variables: data.variables,
      total_count:
        typeof data.total_count === 'number'
          ? data.total_count
          : data.variables.length,
      pages: 1,
      raw: data,
    };
  }
  // Unexpected shape
  return { variables: [], total_count: 0, pages: 1, raw: data };
}

async function handleList(parsed) {
  const { repo, dryRun, verbose } = {
    repo: parsed.repo,
    dryRun: parsed.flags.dryRun,
    verbose: parsed.flags.verbose,
  };
  const envName = parsed.envName;
  if (!repo) fail('Missing --repo');
  if (!envName) fail('Missing environment name');

  if (dryRun) {
    console.log(
      `[dry-run] Would list GitHub environment '${envName}' in repo ${repo}`
    );
    console.log('[dry-run] Planned read operations:');
    console.log('  - Fetch environment metadata');
    console.log('  - Fetch environment variables');
    console.log(
      '  - Fetch environment secrets (names only; values are never retrievable)'
    );
    console.log('[dry-run] No calls were made to GitHub.');
    return;
  }

  const { owner, name } = parseRepoString(repo);

  // Fetch repository to get id
  const repoMeta = ghGet(`repos/${owner}/${name}`, verbose);
  const repoId = repoMeta.id;
  // Fetch environment details (single object, no pagination expected)
  const environment = ghGet(
    `repos/${owner}/${name}/environments/${encodeURIComponent(envName)}`,
    verbose
  );
  // Fetch variables (may need pagination if > default page size)
  let variables = null;
  try {
    const rawVariables = ghGet(
      `repositories/${repoId}/environments/${encodeURIComponent(
        envName
      )}/variables`,
      verbose,
      true /* paginate */
    );
    const norm = normalizeVariablesResponse(rawVariables);
    variables = {
      variables: norm.variables,
      total_count: norm.total_count,
      pages: norm.pages,
    };
  } catch (e) {
    variables = { error: e.message };
  }
  // Fetch secrets list (names only — values are not retrievable)
  let secrets = null;
  try {
    secrets = ghGet(
      `repos/${owner}/${name}/environments/${encodeURIComponent(
        envName
      )}/secrets`,
      verbose
    );
  } catch (e) {
    secrets = { error: e.message };
  }

  const output = {
    command: 'list',
    repo,
    envName,
    environment,
    variables,
    secrets,
  };
  console.log(JSON.stringify(output, null, 2));
}

// Exists: prints 1 if environment exists, 0 otherwise. No JSON wrapper; stdout is only the digit.
async function handleExists(parsed) {
  const { repo, dryRun, verbose } = {
    repo: parsed.repo,
    dryRun: parsed.flags.dryRun,
    verbose: parsed.flags.verbose,
  };
  const envName = parsed.envName;
  if (!repo) fail('Missing --repo');
  if (!envName) fail('Missing environment name');

  if (dryRun) {
    console.log('[dry-run] Would check existence of environment');
    return; // exit code 0
  }

  const { owner, name } = parseRepoString(repo);
  const res = runGh(
    [
      'api',
      '-X',
      'GET',
      `repos/${owner}/${name}/environments/${encodeURIComponent(envName)}`,
      '-H',
      'Accept: application/vnd.github+json',
      '-H',
      'X-GitHub-Api-Version: 2022-11-28',
    ],
    { verbose, parseJson: true }
  );

  if (res.status === 0) {
    console.log('1');
    return;
  }

  // Treat 404 as non-existence, anything else fail.
  if (/404|Not Found/i.test(res.stderr || '')) {
    console.log('0');
    return;
  }
  fail(`Failed to check environment existence (exit ${res.status})`);
}

// Print: outputs the value of a single environment variable (if found) to stdout with no extra formatting.
async function handlePrint(parsed) {
  const { repo, dryRun, verbose } = {
    repo: parsed.repo,
    dryRun: parsed.flags.dryRun,
    verbose: parsed.flags.verbose,
  };
  const envName = parsed.envName;
  const varName = parsed.varName;
  if (!repo) fail('Missing --repo');
  if (!envName) fail('Missing environment name');
  if (!varName) fail('Missing variable name');

  if (dryRun) {
    console.log(
      `[dry-run] Would print variable '${varName}' from environment '${envName}' in repo ${repo}`
    );
    return;
  }

  const { owner, name } = parseRepoString(repo);
  // Ensure repo exists & get id
  const repoMeta = ghGet(`repos/${owner}/${name}`, verbose);
  const repoId = repoMeta.id;
  // Fetch variables (paginate for safety)
  let variablesData;
  try {
    const raw = ghGet(
      `repositories/${repoId}/environments/${encodeURIComponent(
        envName
      )}/variables`,
      verbose,
      true
    );
    variablesData = normalizeVariablesResponse(raw);
  } catch (e) {
    fail(
      `Failed to fetch variables for environment '${envName}': ${e.message}`
    );
  }
  const found = (variablesData.variables || []).find(
    (v) => v && v.name === varName
  );
  if (found && Object.prototype.hasOwnProperty.call(found, 'value')) {
    process.stdout.write(String(found.value));
  }
  // If not found, output nothing (exit 0 so caller can treat empty output as not found)
}

// Create a GitHub environment (idempotent) and optionally add secrets & environment variables.
async function handleCreate(parsed) {
  const { repo, dryRun, verbose } = {
    repo: parsed.repo,
    dryRun: parsed.flags.dryRun,
    verbose: parsed.flags.verbose,
  };
  const envName = parsed.envName;
  if (!repo) fail('Missing --repo');
  if (!envName) fail('Missing environment name');

  // Build final variables map: stdin vars (lowest priority) -> dir vars -> CLI vars (highest)
  const finalVars = new Map(); // name -> {value, isJson, parsedJson}

  // 1. Read vars from stdin if --vars-from-stdin
  if (parsed.flags.varsFromStdin) {
    logVerbose(verbose, 'Reading variables from stdin...');
    const stdinData = fs.readFileSync(0, 'utf8'); // fd 0 = stdin
    if (!stdinData.trim()) {
      fail('--vars-from-stdin specified but stdin is empty');
    }
    let stdinJson;
    try {
      stdinJson = JSON.parse(stdinData);
    } catch (e) {
      fail(`Failed to parse stdin JSON: ${e.message}`);
    }
    // Support gh-envs list format: { variables: { variables: [...] } }
    let varsArray = [];
    if (
      stdinJson.variables?.variables &&
      Array.isArray(stdinJson.variables.variables)
    ) {
      varsArray = stdinJson.variables.variables;
      logVerbose(
        verbose,
        `Detected gh-envs list format, ${varsArray.length} variables`
      );
    } else if (Array.isArray(stdinJson)) {
      varsArray = stdinJson;
    } else if (typeof stdinJson === 'object') {
      // Flat object format: { KEY: "value", ... }
      varsArray = Object.entries(stdinJson).map(([name, value]) => ({
        name,
        value: String(value),
      }));
      logVerbose(
        verbose,
        `Detected flat object format, ${varsArray.length} variables`
      );
    }
    for (const v of varsArray) {
      if (v && v.name != null && v.value != null) {
        const jp = tryParseJsonMaybe(String(v.value));
        finalVars.set(v.name, {
          value: String(v.value),
          isJson: jp.isJson,
          parsedJson: jp.parsed,
          jsonError: jp.error,
        });
      }
    }
    logVerbose(verbose, `Loaded ${finalVars.size} variables from stdin`);
  }

  // 2. Apply parsed.envVars (from --env-dir and --env flags, already merged with CLI priority)
  for (const v of parsed.envVars) {
    finalVars.set(v.name, {
      value: v.value,
      isJson: v.isJson,
      parsedJson: v.parsedJson,
      jsonError: v.jsonError,
    });
  }

  // 3. Apply overwrite-json merges (for stdin-sourced vars that need JSON patching)
  for (const oj of parsed.overwriteJson) {
    if (oj.error)
      fail(`Invalid JSON for overwrite-json ${oj.name}: ${oj.error}`);
    const existing = finalVars.get(oj.name);
    if (!existing) {
      // Create new variable with provided JSON
      finalVars.set(oj.name, {
        value: JSON.stringify(oj.parsedJson, null, 2),
        isJson: true,
        parsedJson: oj.parsedJson,
      });
    } else {
      let existingParsed;
      try {
        existingParsed = JSON.parse(existing.value);
      } catch (e) {
        fail(`Cannot apply --overwrite-json to non-JSON variable ${oj.name}`);
      }
      const merged = mergeExceptArrays(existingParsed, oj.parsedJson);
      finalVars.set(oj.name, {
        value: JSON.stringify(merged, null, 2),
        isJson: true,
        parsedJson: merged,
      });
    }
  }

  // 4. Apply overwrite-env (for stdin-sourced vars that need dotenv-style patching)
  for (const ow of parsed.overwriteEnv) {
    if (ow.rejected)
      fail(
        `Rejected overwrite-env for ${ow.name}:${ow.key} due to newline in VALUE`
      );
    const existing = finalVars.get(ow.name);
    if (!existing)
      fail(`Cannot apply --overwrite-env: variable ${ow.name} not found`);
    const trimmed = (existing.value || '').trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('['))
      fail(`Cannot apply --overwrite-env on JSON variable ${ow.name}`);
    const updated = applyDotEnvLineOverwrite(existing.value, ow.key, ow.value);
    finalVars.set(ow.name, { value: updated, isJson: false });
  }

  // 5. Apply exclusions (remove variables by name)
  for (const excludeName of parsed.excludeVars) {
    if (finalVars.has(excludeName)) {
      logVerbose(verbose, `Excluding variable: ${excludeName}`);
      finalVars.delete(excludeName);
    }
  }

  const secretNames = parsed.secrets.map((s) => s.name);
  const varNames = Array.from(finalVars.keys());

  if (dryRun) {
    console.log(
      `[dry-run] Would create (or update) GitHub environment '${envName}' in repo ${repo}`
    );
    console.log('[dry-run] Planned operations:');
    console.log('  - PUT environment definition');
    if (parsed.flags.varsFromStdin)
      console.log('  - Read base variables from stdin');
    if (parsed.excludeVars.length)
      console.log('  - Exclude variables: ' + parsed.excludeVars.join(', '));
    if (secretNames.length)
      console.log('  - Set secrets: ' + secretNames.join(', '));
    if (varNames.length)
      console.log('  - Create variables: ' + varNames.join(', '));
    if (!secretNames.length && !varNames.length)
      console.log('  - No secrets or variables to add');
    console.log('[dry-run] No calls were made to GitHub.');
    return;
  }

  const { owner, name } = parseRepoString(repo);

  // Ensure repository exists & get id for variables endpoint
  const repoMeta = ghGet(`repos/${owner}/${name}`, verbose);
  const repoId = repoMeta.id;

  // Existence check: if environment already exists, abort without changes
  if (!dryRun) {
    const envCheck = runGh(
      [
        'api',
        '-X',
        'GET',
        `repos/${owner}/${name}/environments/${encodeURIComponent(envName)}`,
        '-H',
        'Accept: application/vnd.github+json',
        '-H',
        'X-GitHub-Api-Version: 2022-11-28',
      ],
      { verbose, parseJson: true }
    );
    if (envCheck.status === 0 || envCheck.data?.status !== '404') {
      fail(
        `Environment '${envName}' already exists in ${repo} or could not be checked for existence, http code ` +
          (envCheck.data.status ?? '200')
      );
    }
  }

  // Create environment
  ghApi(
    'PUT',
    `repos/${owner}/${name}/environments/${encodeURIComponent(envName)}`,
    { verbose, data: {} }
  );

  // Add secrets via gh secret set (lets gh handle encryption)
  for (const sec of parsed.secrets) {
    logVerbose(verbose, `Setting secret ${sec.name}`);
    const res = runGh(
      [
        'secret',
        'set',
        sec.name,
        '--body',
        sec.value,
        '--env',
        envName,
        '--repo',
        repo,
      ],
      { verbose, parseJson: false }
    );
    if (res.status !== 0) fail(`Failed to set secret ${sec.name}`);
  }

  // Add environment variables via API (from finalVars map built above)
  for (const [varName, varData] of finalVars.entries()) {
    logVerbose(verbose, `Creating variable ${varName}`);
    try {
      const valueForApi =
        varData.isJson && !varData.jsonError
          ? JSON.stringify(varData.parsedJson, null, 2)
          : varData.value;
      ghApi(
        'POST',
        `repositories/${repoId}/environments/${encodeURIComponent(
          envName
        )}/variables`,
        {
          verbose,
          data: { name: varName, value: valueForApi },
        }
      );
    } catch (e) {
      console.log('Failed to create variable', e);
      fail(`Failed to create variable ${varName}`);
    }
  }
}

// Delete a GitHub environment. If it does not exist the GitHub API will 404 and we surface that failure.
async function handleDelete(parsed) {
  const { repo, dryRun, verbose } = {
    repo: parsed.repo,
    dryRun: parsed.flags.dryRun,
    verbose: parsed.flags.verbose,
  };
  const envName = parsed.envName;
  if (!repo) fail('Missing --repo');
  if (!envName) fail('Missing environment name');

  if (dryRun) {
    console.log(
      `[dry-run] Would delete GitHub environment '${envName}' in repo ${repo}`
    );
    console.log('[dry-run] Planned operations:');
    console.log('  - DELETE environment');
    console.log('[dry-run] No calls were made to GitHub.');
    return;
  }

  const { owner, name } = parseRepoString(repo);
  ghApi(
    'DELETE',
    `repos/${owner}/${name}/environments/${encodeURIComponent(envName)}`,
    { verbose }
  );
}

// Set (create or update) an environment variable. Tries PATCH first, falls back to POST on 404.
async function handleSet(parsed) {
  const { repo, dryRun, verbose } = {
    repo: parsed.repo,
    dryRun: parsed.flags.dryRun,
    verbose: parsed.flags.verbose,
  };
  const envName = parsed.envName;
  const varName = parsed.varName;
  let varValue = parsed.varValue;

  if (!repo) fail('Missing --repo');
  if (!envName) fail('Missing environment name');
  if (!varName) fail('Missing variable name');
  if (varValue === null) fail('Missing value');

  if (dryRun) {
    console.log(
      `[dry-run] Would set variable '${varName}' in environment '${envName}' in repo ${repo}`
    );
    console.log(`[dry-run] Value: ${varValue}`);
    console.log('[dry-run] Planned operations:');
    console.log(
      '  - PATCH /repos/{owner}/{repo}/environments/{env}/variables/{name} (update)'
    );
    console.log('  - or POST to create if not found');
    console.log('[dry-run] No calls were made to GitHub.');
    return;
  }

  const { owner, name } = parseRepoString(repo);
  const repoId = ghGet(`repos/${owner}/${name}`, verbose).id;

  // Validate and potentially reformat JSON values
  const jp = tryParseJsonMaybe(varValue);
  if (jp.error) {
    fail(`Invalid JSON value: ${jp.error}`);
  }
  const valueForApi =
    jp.isJson && !jp.error ? JSON.stringify(jp.parsed, null, 2) : varValue;

  logVerbose(verbose, `Setting variable ${varName} in environment ${envName}`);

  // Try PATCH first (update), fall back to POST on 404
  const patchRes = runGh(
    [
      'api',
      '-X',
      'PATCH',
      `repos/${owner}/${name}/environments/${encodeURIComponent(
        envName
      )}/variables/${encodeURIComponent(varName)}`,
      '-H',
      'Accept: application/vnd.github+json',
      '-H',
      'X-GitHub-Api-Version: 2022-11-28',
      '-H',
      'Content-Type: application/json',
      '--input',
      '-',
    ],
    {
      verbose,
      parseJson: true,
      allowFail: true,
      input: JSON.stringify({ value: valueForApi }),
    }
  );

  if (
    patchRes.status === 404 ||
    (patchRes.data && patchRes.data.status === '404')
  ) {
    // Not found, create it via POST
    logVerbose(verbose, `Variable ${varName} not found, creating it`);
    ghApi(
      'POST',
      `repositories/${repoId}/environments/${encodeURIComponent(
        envName
      )}/variables`,
      {
        verbose,
        data: { name: varName, value: valueForApi },
      }
    );
  } else if (patchRes.status !== 0) {
    fail(
      `Failed to set variable ${varName}: ${patchRes.stderr || patchRes.stdout}`
    );
  }
  // else: PATCH succeeded, nothing more to do
}

// Helper: apply overwrite-env to a variable that represents a .env file content.
function applyDotEnvLineOverwrite(existingValue, key, value) {
  const lines = existingValue.split(/\n/);
  let found = false;
  const out = lines.map((line) => {
    if (!line || line.startsWith('#') || !line.includes('=')) return line; // leave untouched
    const idx = line.indexOf('=');
    const k = line.slice(0, idx).trim();
    if (k === key) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) out.push(`${key}=${value}`);
  return out.join('\n');
}

async function handleCopy(parsed) {
  const { repo, dryRun, verbose } = {
    repo: parsed.repo,
    dryRun: parsed.flags.dryRun,
    verbose: parsed.flags.verbose,
  };
  const sourceEnv = parsed.sourceEnv;
  const targetEnv = parsed.targetEnv;
  if (!repo) fail('Missing --repo');
  if (!sourceEnv || !targetEnv) fail('Missing source or target environment');

  // Validate no conflict between overwrites and --env definitions (would make overwrites pointless)
  const envVarNames = new Set(parsed.envVars.map((v) => v.name));
  for (const ow of parsed.overwriteEnv) {
    if (envVarNames.has(ow.name))
      fail(
        `Invalid: --overwrite-env for ${ow.name} plus --env ${ow.name}. Remove one.`
      );
  }
  for (const oj of parsed.overwriteJson) {
    if (envVarNames.has(oj.name))
      fail(
        `Invalid: --overwrite-json for ${oj.name} plus --env ${oj.name}. Remove one.`
      );
  }
  // Disallow simultaneous overwrite-env and overwrite-json on same variable (ambiguous semantics)
  const overwriteEnvNames = new Set(parsed.overwriteEnv.map((o) => o.name));
  for (const oj of parsed.overwriteJson) {
    if (overwriteEnvNames.has(oj.name))
      fail(
        `Invalid: both --overwrite-env and --overwrite-json specified for variable ${oj.name}`
      );
  }

  const { owner, name } = parseRepoString(repo);

  if (dryRun) {
    console.log(
      `[dry-run] Would copy GitHub environment '${sourceEnv}' -> '${targetEnv}' in repo ${repo}`
    );
    console.log('[dry-run] Planned operations:');
    console.log('  - Ensure target environment does NOT already exist');
    console.log('  - Create target environment');
    console.log('  - Copy all variables from source environment');
    if (parsed.excludeVars.length)
      console.log('  - Exclude variables: ' + parsed.excludeVars.join(', '));
    if (parsed.overwriteEnv.length)
      console.log(
        '  - Apply overwrite-env to: ' +
          parsed.overwriteEnv.map((o) => `${o.name}:${o.key}`).join(', ')
      );
    if (parsed.overwriteJson.length)
      console.log(
        '  - Apply overwrite-json merges to: ' +
          parsed.overwriteJson.map((o) => o.name).join(', ')
      );
    if (parsed.secrets.length)
      console.log(
        '  - Set secrets: ' + parsed.secrets.map((s) => s.name).join(', ')
      );
    if (parsed.envVars.length)
      console.log(
        '  - Add/override environment variables: ' +
          parsed.envVars.map((v) => v.name).join(', ')
      );
    console.log('[dry-run] No calls were made to GitHub.');
    return;
  }

  // Fetch repo id
  const repoMeta = ghGet(`repos/${owner}/${name}`, verbose);
  const repoId = repoMeta.id;

  // Check target existence (must not exist)
  const targetCheck = runGh(
    [
      'api',
      '-X',
      'GET',
      `repos/${owner}/${name}/environments/${encodeURIComponent(targetEnv)}`,
      '-H',
      'Accept: application/vnd.github+json',
      '-H',
      'X-GitHub-Api-Version: 2022-11-28',
    ],
    { verbose, parseJson: true }
  );
  if (targetCheck.status === 0) {
    fail(`Environment '${targetEnv}' already exists in ${repo}`);
  }

  // Fetch source variables list (paginate to allow > default page size)
  let sourceVariablesData;
  try {
    const raw = ghGet(
      `repositories/${repoId}/environments/${encodeURIComponent(
        sourceEnv
      )}/variables`,
      verbose,
      true /* paginate */
    );
    sourceVariablesData = normalizeVariablesResponse(raw);
  } catch (e) {
    console.log('error', e);
    fail(
      `Failed to fetch variables from source environment '${sourceEnv}': ${e.message}`
    );
  }

  // Consolidated list of variables regardless of pagination form
  const sourceVars = Array.isArray(sourceVariablesData?.variables)
    ? sourceVariablesData.variables
    : [];
  const finalVars = new Map(); // name -> string value

  for (const v of sourceVars) {
    if (v && v.name != null && v.value != null) {
      finalVars.set(v.name, v.value);
    }
  }

  // Apply overwrite-env (only for non-JSON, treat value as .env file content)
  for (const ow of parsed.overwriteEnv) {
    if (ow.rejected)
      fail(
        `Rejected overwrite-env for ${ow.name}:${ow.key} due to newline in VALUE`
      );
    if (!finalVars.has(ow.name))
      fail(
        `Cannot apply --overwrite-env: variable ${ow.name} not found in source environment`
      );
    const current = finalVars.get(ow.name);
    const trimmed = (current || '').trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('['))
      fail(`Cannot apply --overwrite-env on JSON variable ${ow.name}`);
    const updated = applyDotEnvLineOverwrite(current, ow.key, ow.value);
    finalVars.set(ow.name, updated);
  }

  // Apply overwrite-json merges
  for (const oj of parsed.overwriteJson) {
    if (oj.error)
      fail(`Invalid JSON for overwrite-json ${oj.name}: ${oj.error}`);
    const existing = finalVars.get(oj.name);
    if (existing == null) {
      // Create new variable with provided JSON
      // New JSON variable: pretty-print
      finalVars.set(oj.name, JSON.stringify(oj.parsedJson, null, 2));
    } else {
      let existingParsed;
      try {
        existingParsed = JSON.parse(existing);
      } catch (e) {
        console.log('JSON parse failure', e);
        fail(`Cannot apply --overwrite-json to non-JSON variable ${oj.name}`);
      }
      const merged = mergeExceptArrays(existingParsed, oj.parsedJson);
      finalVars.set(oj.name, JSON.stringify(merged, null, 2));
    }
  }

  // Apply user-provided env vars (override completely or add)
  for (const nv of parsed.envVars) {
    if (nv.jsonError) fail(`Invalid JSON for env ${nv.name}: ${nv.jsonError}`); // already validated earlier
    finalVars.set(nv.name, nv.value);
  }

  // Apply exclusions (remove variables by name)
  for (const excludeName of parsed.excludeVars) {
    if (finalVars.has(excludeName)) {
      logVerbose(verbose, `Excluding variable: ${excludeName}`);
      finalVars.delete(excludeName);
    }
  }

  // Create target environment & populate (with rollback on failure)
  ghApi(
    'PUT',
    `repos/${owner}/${name}/environments/${encodeURIComponent(targetEnv)}`,
    { verbose, data: {} }
  );
  const targetEnvPath = `repos/${owner}/${name}/environments/${encodeURIComponent(
    targetEnv
  )}`;
  try {
    // Create variables (environment is new so all are creations)
    // Final pass: pretty-print any JSON-looking values
    for (const [k, val] of Array.from(finalVars.entries())) {
      const jp = tryParseJsonMaybe(val);
      if (jp.isJson && !jp.error) {
        finalVars.set(k, JSON.stringify(jp.parsed, null, 2));
      }
    }

    for (const [varName, value] of finalVars.entries()) {
      try {
        ghApi(
          'POST',
          `repositories/${repoId}/environments/${encodeURIComponent(
            targetEnv
          )}/variables`,
          {
            verbose,
            data: { name: varName, value },
          }
        );
      } catch (e) {
        throw new Error(
          `Failed to create variable ${varName}: ${e.message || e}`
        );
      }
    }
    // Add secrets via gh secret set (provided explicitly only)
    for (const sec of parsed.secrets) {
      logVerbose(verbose, `Setting secret ${sec.name}`);
      const res = runGh(
        [
          'secret',
          'set',
          sec.name,
          '--body',
          sec.value,
          '--env',
          targetEnv,
          '--repo',
          repo,
        ],
        {
          verbose,
          parseJson: false,
        }
      );
      if (res.status !== 0) throw new Error(`Failed to set secret ${sec.name}`);
    }
  } catch (e) {
    logVerbose(
      verbose,
      `Error during copy; rolling back by deleting target environment '${targetEnv}':`,
      e.message || String(e)
    );
    try {
      ghApi('DELETE', targetEnvPath, { verbose, allowFail: true });
      logVerbose(verbose, 'Rollback delete attempt issued.');
    } catch (delErr) {
      logVerbose(
        verbose,
        'Rollback deletion failed:',
        delErr.message || String(delErr)
      );
    }
    fail(e.message || String(e));
  }
}

function main() {
  const parsed = parseArgs(process.argv);
  if (parsed.flags.help) {
    printHelp();
    return; // successful help display
  }

  // If parsing errors, print structure & exit non-zero
  if (parsed.errors.length) {
    console.log(
      'Failed to parse your command!\n',
      JSON.stringify(parsed, null, 2)
    );
    process.exit(1);
  }

  loadDotEnvIfPresent(parsed.flags.verbose);
  ensureGhInstalled(parsed.flags.verbose);
  ensureTokenPresent();

  if (parsed.command === 'list') {
    return handleList(parsed).catch((err) => {
      fail(err.message || String(err));
    });
  }

  if (parsed.command === 'exists') {
    return handleExists(parsed).catch((err) => {
      fail(err.message || String(err));
    });
  }

  if (parsed.command === 'print') {
    return handlePrint(parsed).catch((err) => {
      fail(err.message || String(err));
    });
  }

  if (parsed.command === 'create') {
    return handleCreate(parsed).catch((err) => {
      fail(err.message || String(err));
    });
  }

  if (parsed.command === 'delete') {
    return handleDelete(parsed).catch((err) => {
      fail(err.message || String(err));
    });
  }

  if (parsed.command === 'set') {
    return handleSet(parsed).catch((err) => {
      fail(err.message || String(err));
    });
  }

  if (parsed.command === 'copy') {
    return handleCopy(parsed).catch((err) => {
      fail(err.message || String(err));
    });
  }

  fail('command not implemented: ' + parsed.command);
}

if (require.main === module) {
  main();
}

