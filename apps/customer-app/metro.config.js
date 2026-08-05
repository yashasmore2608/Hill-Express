const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: Metro must watch the workspace root (for packages/*) AND the
// external pnpm virtual store (real files live there; node_modules is symlinks).
//
// NOTE: this also watches apps/*/dist. Do NOT run `expo export` (or delete its
// dist/) while a dev server is running — the watcher dies with
// `ENOENT: watch .../dist/_expo/static/js`. Stop the dev server first.
// Narrowing watchFolders to individual subpaths is NOT a fix: entries must be
// directories that contain every resolved file, and trimming them breaks
// resolution of the workspace root's own node_modules.
config.watchFolders = [workspaceRoot, 'C:\\pnpm\\hill-express'];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './src/global.css' });
