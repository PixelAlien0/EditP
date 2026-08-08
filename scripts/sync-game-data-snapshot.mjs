import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const repository = process.env.BAR_REPOSITORY || path.join(os.tmpdir(), 'bar-parameter-audit');
const requestedRef = process.env.BAR_SOURCE_REF || 'FETCH_HEAD';

function git(args, options = {}) {
  return execFileSync('git', ['-C', repository, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  }).trim();
}

function runNode(script, environment, args = []) {
  execFileSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    env: environment,
    stdio: 'inherit',
  });
}

if (!fs.existsSync(path.join(repository, '.git'))) {
  throw new Error(`BAR checkout not found at ${repository}. Set BAR_REPOSITORY to a local clone.`);
}

const sourceCommit = [requestedRef, 'FETCH_HEAD', 'origin/master', 'HEAD']
  .filter(Boolean)
  .map(candidate => {
    try {
      return git(['rev-parse', `${candidate}^{commit}`]);
    } catch {
      return '';
    }
  })
  .find(candidate => /^[a-f0-9]{40}$/i.test(candidate));
if (!/^[a-f0-9]{40}$/i.test(sourceCommit)) throw new Error(`Unable to resolve ${requestedRef}.`);

const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'editp-bar-snapshot-'));
const worktree = path.join(stagingRoot, 'checkout');
const environment = {
  ...process.env,
  BAR_REPOSITORY: worktree,
  BAR_SOURCE_COMMIT: sourceCommit,
  BAR_SOURCE_REF: sourceCommit,
};

console.log(`Synchronizing every BAR dataset from ${sourceCommit}.`);
try {
  execFileSync('git', ['-C', repository, 'worktree', 'add', '--detach', worktree, sourceCommit], {
    stdio: 'inherit',
  });

  runNode('sync_github_data.js', environment);
  runNode('scripts/sync-parameter-defaults.mjs', environment);
  runNode('scripts/sync-custom-parameter-registry.mjs', environment);
  runNode('scripts/sync-explosion-profiles.mjs', environment);
  runNode('scripts/sync-asset-manifest.mjs', environment);
  runNode('scripts/sync-tactical-icons.mjs', environment);
  runNode('scripts/sync-unitpics.mjs', environment);
  runNode('scripts/finalize-game-data-snapshot.mjs', environment, ['--write']);
  runNode('scripts/audit-game-data.mjs', environment);
  runNode('scripts/audit-unitpics.mjs', environment);
} finally {
  try {
    execFileSync('git', ['-C', repository, 'worktree', 'remove', '--force', worktree], {
      stdio: 'ignore',
    });
  } catch {
    fs.rmSync(worktree, { recursive: true, force: true });
  }
  fs.rmSync(stagingRoot, { recursive: true, force: true });
}
