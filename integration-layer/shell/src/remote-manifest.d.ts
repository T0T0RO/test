// integration-layer/shell/src/remote-manifest.d.ts
// Type declarations for the generated remote-manifest.js

export interface RemoteManifestEntry {
  entry: string | null;
  framework: string;
  version: string;
  status: "available" | "missing";
  builtByOrchestrator?: boolean;
  fallbackUsed?: boolean;
}

// This matches the shape emitted by generate-remote-manifest.mjs
export const remoteManifest: Record<string, RemoteManifestEntry>;
