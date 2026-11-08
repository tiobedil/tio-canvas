// Asking npm whether a newer version of the package exists.
export const PACKAGE_NAME = '@tio-canvas/canvas';
const LATEST_URL = 'https://registry.npmjs.org/@tio-canvas%2Fcanvas/latest';
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

// 1 when a is newer than b, -1 when older, 0 when equal. Anything that is not
// major.minor.patch counts as equal, so a odd value never raises a false alert.
export function compareVersions(a, b) {
  const left = SEMVER.exec(a), right = SEMVER.exec(b);
  if (!left || !right) return 0;
  for (let i = 1; i <= 3; i++) if (left[i] !== right[i]) return Number(left[i]) > Number(right[i]) ? 1 : -1;
  return 0;
}

// Only a canvas running on the developer's own machine asks npm. A published
// canvas must not contact anyone when a visitor opens it.
export const isLocalHost = hostname => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname) || hostname.endsWith('.localhost');

export async function fetchLatestVersion(fetchImpl = fetch) {
  const response = await fetchImpl(LATEST_URL, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`npm answered ${response.status}`);
  const { version } = await response.json();
  if (!SEMVER.test(version)) throw new Error('npm sent an unexpected version');
  return version;
}
