// integration-layer/shell/src/remote-manifest.d.ts
export type RemoteStatus = "available" | "missing" | "disabled";

export interface RemoteManifestEntry {
  entry: string | null;
  framework: string;
  version: string;
  status: RemoteStatus;
}

export const remoteManifest: Record<string, RemoteManifestEntry>;
