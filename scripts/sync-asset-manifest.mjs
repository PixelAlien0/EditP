import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repository = process.env.BAR_REPOSITORY || path.join(os.tmpdir(), 'bar-parameter-audit');
const outputFile = path.resolve('src/data/bar-asset-manifest.json');
const sourceRoots = [path.join(repository, 'units'), path.join(repository, 'weapons')];

if (!sourceRoots.every(root => fs.existsSync(root))) {
  throw new Error(`BAR unit and weapon sources were not found under ${repository}. Set BAR_REPOSITORY to a BAR checkout.`);
}

const ASSIGNMENTS = Object.freeze({
  objectname: 'unitModel',
  script: 'unitScript',
  buildpic: 'buildPicture',
  icontype: 'iconType',
  collisionvolumetype: 'collisionVolumeType',
  model: 'projectileModel',
  soundstart: 'sound',
  soundhit: 'sound',
  soundhitwet: 'sound',
  soundhitdry: 'sound',
  cegtag: 'ceg',
  explosiongenerator: 'ceg',
  texture1: 'texture',
  texture2: 'texture',
  texture3: 'texture'
});

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, files);
    else if (entry.name.endsWith('.lua')) files.push(absolute);
  }
  return files;
}

const categories = Object.fromEntries([...new Set(Object.values(ASSIGNMENTS))].map(category => [category, new Set()]));
const assignmentPattern = /\b([A-Za-z][A-Za-z0-9_]*)\s*=\s*(["'])(.*?)\2/g;

for (const file of sourceRoots.flatMap(root => walk(root))) {
  const source = fs.readFileSync(file, 'utf8').replace(/--\[\[[\s\S]*?\]\]/g, '').replace(/--[^\r\n]*/g, '');
  for (const match of source.matchAll(assignmentPattern)) {
    const category = ASSIGNMENTS[match[1].toLowerCase()];
    const value = match[3].trim();
    if (category && value && !/[\r\n]/.test(value)) categories[category].add(value);
  }
}

const sourceCommit = (() => {
  try {
    return execFileSync('git', ['-C', repository, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
})();

const manifest = {
  version: 1,
  sourceRepository: 'beyond-all-reason/Beyond-All-Reason',
  sourceCommit,
  categories: Object.fromEntries(Object.entries(categories).map(([category, values]) => [
    category,
    [...new Map([...values].map(value => [value.toLowerCase(), value])).values()]
      .sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }))
  ]))
};

fs.writeFileSync(outputFile, `${JSON.stringify(manifest, null, 2)}\n`);
const total = Object.values(manifest.categories).reduce((count, values) => count + values.length, 0);
console.log(`Wrote ${total} validated BAR asset references to ${outputFile}.`);
