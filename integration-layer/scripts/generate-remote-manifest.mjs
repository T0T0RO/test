// integration-layer/scripts/generate-remote-manifest.mjs

import { readFile, writeFile, access, mkdir, readdir, stat } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCb);

// Resolve integration-layer root based on this script location
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INTEGRATION_LAYER_ROOT = path.resolve(__dirname, '..');

const CONFIG_PATH = path.join(INTEGRATION_LAYER_ROOT, 'remote-configs', 'mfe.config.json');
const DIST_OUTPUT_DIR = path.join(INTEGRATION_LAYER_ROOT, 'dist');
const MANIFEST_OUTPUT_PATH = path.join(DIST_OUTPUT_DIR, 'remote-manifest.js');
const SHELL_MANIFEST_PATH = path.join(
  INTEGRATION_LAYER_ROOT,
  'shell',
  'src',
  'remote-manifest.js'
);

async function main() {
  const { env } = parseArgs(process.argv.slice(2));

  log(`Running generate-remote-manifest.mjs with env="${env}".`);

  const config = await loadConfig(CONFIG_PATH);
  const remotes = normalizeRemotes(config);

  if (!Array.isArray(remotes) || remotes.length === 0) {
    throw new Error('No remotes defined in mfe.config.json.');
  }

  const manifest = {};

  for (const remote of remotes) {
    const result = await processRemote(remote);
    manifest[remote.name] = result;
  }

  await writeManifestFiles(manifest);

  log('Remote manifest generation completed.');
}

/**
 * Parse CLI arguments.
 * Supported:
 *   --env=local|ci|<string>
 * There is no mode concept; the script always attempts to repair when possible.
 */
function parseArgs(argv) {
  let env = 'local';

  for (const arg of argv) {
    if (arg.startsWith('--env=')) {
      env = arg.substring('--env='.length).trim();
    }
  }

  return { env };
}

/**
 * Load and parse mfe.config.json.
 */
async function loadConfig(configPath) {
  try {
    const content = await readFile(configPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read or parse config at "${configPath}": ${error.message}`);
  }
}

/**
 * Normalize configuration shape.
 * Supports:
 *   - { "remotes": [ ... ] }
 *   - [ ... ] directly
 */
function normalizeRemotes(config) {
  const remotes = Array.isArray(config) ? config : config.remotes;

  if (!Array.isArray(remotes)) {
    throw new Error(
      'Invalid mfe.config.json format. Expected an array or an object with "remotes" array.'
    );
  }

  return remotes.map(validateRemoteConfig);
}

/**
 * Validate and normalize a single remote configuration entry.
 */
function validateRemoteConfig(remote, index) {
  if (typeof remote !== 'object' || remote === null) {
    throw new Error(`Invalid remote config at index ${index}: must be an object.`);
  }

  const { name, root, framework, version } = remote;

  if (!name || typeof name !== 'string') {
    throw new Error(`Remote at index ${index} is missing a valid "name".`);
  }

  if (!root || typeof root !== 'string') {
    throw new Error(`Remote "${name}" is missing a valid "root" path.`);
  }

  if (!framework || typeof framework !== 'string') {
    throw new Error(`Remote "${name}" is missing a valid "framework".`);
  }

  if (!version || typeof version !== 'string') {
    throw new Error(`Remote "${name}" is missing a valid "version".`);
  }

  const normalizedRoot = path.isAbsolute(root)
    ? root
    : path.resolve(INTEGRATION_LAYER_ROOT, root);

  return {
    ...remote,
    root: normalizedRoot
  };
}

/**
 * Full processing pipeline for a single remote:
 *   1. Try to resolve existing remoteEntry.js.
 *   2. If missing: attempt build (buildCommand or npm run build).
 *   3. If still missing: attempt esbuild fallback when allowed.
 *   4. Never throw for individual failures; always return a manifest entry.
 */
async function processRemote(remote) {
  const baseInfo = {
    framework: remote.framework,
    version: remote.version
  };

  // 1. Initial lookup
  let entry = await resolveRemoteEntry(remote);
  let builtByOrchestrator = false;
  let fallbackUsed = false;

  if (entry) {
    log(`Remote "${remote.name}": found remoteEntry.js at "${entry}".`);
    return {
      entry,
      ...baseInfo,
      status: 'available'
    };
  }

  log(`Remote "${remote.name}": remoteEntry.js not found. Starting recovery attempts.`);

  // 2. Try build
  const buildOk = await tryBuildRemote(remote);
  if (buildOk) {
    builtByOrchestrator = true;
    entry = await resolveRemoteEntry(remote);
    if (entry) {
      log(`Remote "${remote.name}": remoteEntry.js available after build at "${entry}".`);
      return {
        entry,
        ...baseInfo,
        status: 'available',
        builtByOrchestrator: true
      };
    }
    log(
      `Remote "${remote.name}": build completed but remoteEntry.js is still missing. Checking fallback.`
    );
  }

  // 3. Try esbuild fallback (non-Angular, opt-in via bootstrap)
  const fallbackOk = await tryEsbuildFallback(remote);
  if (fallbackOk) {
    builtByOrchestrator = true;
    fallbackUsed = true;
    entry = await resolveRemoteEntry(remote);
    if (entry) {
      log(
        `Remote "${remote.name}": remoteEntry.js synthesized via esbuild fallback at "${entry}".`
      );
      return {
        entry,
        ...baseInfo,
        status: 'available',
        builtByOrchestrator: true,
        fallbackUsed: true
      };
    }
    log(
      `Remote "${remote.name}": esbuild fallback reported success but remoteEntry.js is not resolvable.`
    );
  }

  // 4. Still missing: do not throw, report as missing.
  log(
    `Remote "${remote.name}": remoteEntry.js missing after all attempts. Marking status="missing".`
  );

  const result = {
    entry: null,
    ...baseInfo,
    status: 'missing'
  };

  if (builtByOrchestrator) {
    result.builtByOrchestrator = true;
  }
  if (fallbackUsed) {
    result.fallbackUsed = true;
  }

  return result;
}

/**
 * Resolve the remoteEntry.js file for a given remote.
 * Rules:
 *   - Look under <remote.root>/dist/remoteEntry.js
 *   - If not found, search one nested directory level under dist/ for remoteEntry.js
 *   - Return the entry path as POSIX-style relative path from integration-layer root.
 *   - If not found, return null.
 */
async function resolveRemoteEntry(remote) {
  const distDir = path.join(remote.root, 'dist');

  if (!(await exists(distDir))) {
    return null;
  }

  // Direct dist/remoteEntry.js
  const directEntry = path.join(distDir, 'remoteEntry.js');
  if (await exists(directEntry)) {
    return toPosixRelative(INTEGRATION_LAYER_ROOT, directEntry);
  }

  // One-level nested search
  const children = await safeReadDir(distDir);
  for (const child of children) {
    const childPath = path.join(distDir, child);
    if (await isDirectory(childPath)) {
      const nestedEntry = path.join(childPath, 'remoteEntry.js');
      if (await exists(nestedEntry)) {
        return toPosixRelative(INTEGRATION_LAYER_ROOT, nestedEntry);
      }
    }
  }

  return null;
}

/**
 * Attempt to build a remote:
 *   - If remote.buildCommand is set, use it.
 *   - Otherwise, if package.json exists, run "npm run build".
 *   - Only operates in remote.root.
 *   - Never modifies source; only triggers the remote's own build.
 * Returns true on success, false on failure.
 */
async function tryBuildRemote(remote) {
  const cwd = remote.root;
  const hasPackageJson = await exists(path.join(cwd, 'package.json'));

  const command =
    typeof remote.buildCommand === 'string' && remote.buildCommand.trim().length > 0
      ? remote.buildCommand
      : hasPackageJson
      ? 'npm run build'
      : null;

  if (!command) {
    log(
      `Remote "${remote.name}": no buildCommand and no package.json detected. Skipping build step.`
    );
    return false;
  }

  log(`Remote "${remote.name}": running build command "${command}" in "${cwd}".`);

  try {
    await exec(command, { cwd });
    log(`Remote "${remote.name}": build completed successfully.`);
    return true;
  } catch (error) {
    log(
      `Remote "${remote.name}": build failed with error: ${sanitizeErrorMessage(
        error
      )}. Continuing with other remotes.`
    );
    return false;
  }
}

/**
 * Attempt esbuild-based fallback generation of remoteEntry.js.
 * Constraints:
 *   - Only for non-Angular remotes.
 *   - Requires remote.bootstrap (entry file relative to remote.root or absolute).
 *   - Uses optional remote.external array for externals.
 *   - Writes to <remote.root>/dist/remoteEntry.js.
 *   - If esbuild is not installed or build fails, logs and returns false.
 */
async function tryEsbuildFallback(remote) {
  if (!remote.bootstrap) {
    return false;
  }

  if (String(remote.framework).toLowerCase() === 'angular') {
    log(
      `Remote "${remote.name}": esbuild fallback is disabled for Angular remotes. Skipping fallback.`
    );
    return false;
  }

  let esbuild;
  try {
    esbuild = await import('esbuild');
  } catch {
    log(
      `Remote "${remote.name}": esbuild not available in integration-layer. ` +
        'Install "esbuild" to enable fallback bundling.'
    );
    return false;
  }

  const distDir = path.join(remote.root, 'dist');
  const bootstrapPath = path.isAbsolute(remote.bootstrap)
    ? remote.bootstrap
    : path.resolve(remote.root, remote.bootstrap);
  const external = Array.isArray(remote.external) ? remote.external : [];

  try {
    await mkdir(distDir, { recursive: true });

    log(
      `Remote "${remote.name}": attempting esbuild fallback from "${bootstrapPath}" to dist/remoteEntry.js.`
    );

    await esbuild.build({
      entryPoints: [bootstrapPath],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      outfile: path.join(distDir, 'remoteEntry.js'),
      external
    });

    log(`Remote "${remote.name}": esbuild fallback completed successfully.`);
    return true;
  } catch (error) {
    log(
      `Remote "${remote.name}": esbuild fallback failed with error: ${sanitizeErrorMessage(
        error
      )}.`
    );
    return false;
  }
}

/**
 * Write manifest module to integration-layer/dist and copy to shell/src.
 * Adds provenance header with ISO timestamp.
 */
async function writeManifestFiles(manifest) {
  const timestamp = new Date().toISOString();

  const headerLines = [
    '// Auto-generated by generate-remote-manifest.mjs',
    `// Generated at: ${timestamp}`,
    '// Do not edit manually.',
    ''
  ];

  const source =
    headerLines.join('\n') +
    'export const remoteManifest = ' +
    JSON.stringify(manifest, null, 2) +
    ';\n';

  await mkdir(DIST_OUTPUT_DIR, { recursive: true });
  await writeFile(MANIFEST_OUTPUT_PATH, source, 'utf8');

  const shellDir = path.dirname(SHELL_MANIFEST_PATH);
  await mkdir(shellDir, { recursive: true });
  await writeFile(SHELL_MANIFEST_PATH, source, 'utf8');

  log(`Wrote manifest to "${MANIFEST_OUTPUT_PATH}".`);
  log(`Copied manifest to "${SHELL_MANIFEST_PATH}".`);
}

/**
 * Check if a file or directory exists.
 */
async function exists(p) {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely read directory entries, returning an empty array on failure.
 */
async function safeReadDir(dirPath) {
  try {
    return await readdir(dirPath);
  } catch {
    return [];
  }
}

/**
 * Check if path is a directory.
 */
async function isDirectory(p) {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Convert an absolute path to a POSIX-style relative path from base.
 * Keeps manifest entries stable across platforms.
 */
function toPosixRelative(base, target) {
  return path.relative(base, target).split(path.sep).join('/');
}

/**
 * Deterministic, concise logging for CI and local runs.
 */
function log(message) {
  // eslint-disable-next-line no-console
  console.log(`[generate-remote-manifest] ${message}`);
}

/**
 * Normalize and shorten error output for logs.
 */
function sanitizeErrorMessage(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return String(error);
}

// Execute
main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[generate-remote-manifest] Fatal error:', error.message);
  process.exitCode = 1;
});
