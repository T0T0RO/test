#!/usr/bin/env node
// integration-layer/scripts/build-remotes.mjs
// Build all enabled remotes declared in remote-configs/mfe.config.json.
// - Uses "buildCommand" from the SSOT if present.
// - Otherwise falls back to "npm run build".
// - Dist-only consumption remains intact.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const integrationRoot = resolve(__dirname, "..");

async function loadRemotesConfig() {
  const configPath = resolve(
    integrationRoot,
    "remote-configs",
    "mfe.config.json"
  );

  const raw = await readFile(configPath, "utf-8");
  const config = JSON.parse(raw);

  const remotes = Array.isArray(config) ? config : config.remotes ?? [];
  if (!Array.isArray(remotes)) {
    throw new Error(
      `[build-remotes] Invalid config format in ${configPath}. Expected "remotes" array.`
    );
  }

  return remotes.filter((r) => r && r.enabled !== false);
}

function runCommand(cmd, args, cwd, label) {
  return new Promise((resolve, reject) => {
    console.log(`[build-remotes] Building "${label}" via: ${cmd} ${args.join(" ")}`);
    console.log(`[build-remotes] cwd: ${cwd}`);

    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        console.log(`[build-remotes] OK "${label}"`);
        resolve();
      } else {
        reject(
          new Error(`[build-remotes] "${label}" exited with code ${code}`)
        );
      }
    });

    child.on("error", (err) => {
      reject(
        new Error(`[build-remotes] Failed to start "${label}": ${err.message}`)
      );
    });
  });
}

async function main() {
  console.log("[build-remotes] Loading remote config...");
  const remotes = await loadRemotesConfig();

  if (!remotes.length) {
    console.log("[build-remotes] No enabled remotes found. Nothing to do.");
    return;
  }

  console.log(
    "[build-remotes] Remotes to build:",
    remotes.map((r) => r.name || r.id || "<?>").join(", ")
  );

  for (const remote of remotes) {
    const name = remote.name || remote.id || "<?>";

    const rootKey =
      remote.root ?? remote.rootPath ?? remote.projectRoot ?? remote.cwd;

    if (!rootKey) {
      console.warn(
        `[build-remotes] Remote "${name}" has no root path (root/rootPath/projectRoot/cwd). Skipping.`
      );
      continue;
    }

    const cwd = resolve(integrationRoot, rootKey);
    const buildCommand =
      typeof remote.buildCommand === "string"
        ? remote.buildCommand.trim()
        : "npm run build";

    // Parse "npm run xyz" → cmd + args
    const [cmd, ...args] = buildCommand.split(" ");

    await runCommand(cmd, args, cwd, name);
  }

  console.log("[build-remotes] All remote builds finished successfully.");
}

main().catch((err) => {
  console.error("[build-remotes] FATAL:", err.message);
  process.exit(1);
});
