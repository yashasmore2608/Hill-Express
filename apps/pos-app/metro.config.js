const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: Metro must watch the workspace root (for packages/*) AND the pnpm
// virtual store, because node_modules is only symlinks — the real files live in
// the store.
//
// On Windows that store is parked OUTSIDE OneDrive at C:\pnpm\hill-express
// (see .npmrc), so it is not under workspaceRoot and has to be watched
// explicitly. Everywhere else the store is the default
// <workspaceRoot>/node_modules/.pnpm, already covered. Listing a folder that
// does not exist is not harmless: Metro fails to start its transformer with
// "Cannot read properties of undefined (reading 'transformFile')", so the path
// is included only when it is really there.
//
// NOTE: this also watches apps/*/dist. Do NOT run `expo export` (or delete its
// dist/) while a dev server is running — the watcher dies with
// `ENOENT: watch .../dist/_expo/static/js`. Stop the dev server first.
// Narrowing watchFolders to individual subpaths is NOT a fix: entries must be
// directories that contain every resolved file, and trimming them breaks
// resolution of the workspace root's own node_modules.
const externalStore = 'C:\\pnpm\\hill-express';
config.watchFolders = [workspaceRoot, ...(fs.existsSync(externalStore) ? [externalStore] : [])];
// pnpm's isolated linker keeps undeclared transitive deps out of both
// node_modules trees above and puts them in the store's private fallback layer
// instead (see .npmrc). NativeWind's babel preset rewrites JSX to import
// react-native-css-interop/jsx-runtime, which this app never declares, so that
// layer has to be resolvable or every screen fails to bundle.
const storeFallbacks = [
  path.resolve(workspaceRoot, 'node_modules/.pnpm/node_modules'),
  'C:\\pnpm\\hill-express\\node_modules',
].filter((dir) => fs.existsSync(dir));

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
  ...storeFallbacks,
];

module.exports = withNativeWind(config, { input: './src/global.css' });
