const remoteCache = new Map();

export async function loadRemote(url: string) {
  if (remoteCache.has(url)) return remoteCache.get(url);
  const m = await import(/* @vite-ignore */ url);
  // expect m.mount and m.unmount
  if (!m.mount) throw new Error("Remote missing mount function: " + url);
  remoteCache.set(url, m);
  return m;
}
