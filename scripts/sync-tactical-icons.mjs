import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repository = process.env.BAR_REPOSITORY || path.join(os.tmpdir(), 'bar-parameter-audit');
const outputDirectory = path.resolve('public/tactical-icons/assets');
const manifestFile = path.resolve('src/data/tactical-icon-manifest.json');
const assetManifestFile = path.resolve('src/data/bar-asset-manifest.json');
const requestedRef = process.env.BAR_SOURCE_REF;

function git(args, options = {}) {
  return execFileSync('git', ['-C', repository, ...args], {
    maxBuffer: 32 * 1024 * 1024,
    ...options
  });
}

function resolveSourceRef() {
  const candidates = [requestedRef, 'FETCH_HEAD', 'HEAD'].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const commit = git(['rev-parse', `${candidate}^{commit}`], { encoding: 'utf8' }).trim();
      return { ref: candidate, commit };
    } catch {
      // Try the next local ref.
    }
  }
  throw new Error(`No usable BAR source ref was found under ${repository}. Set BAR_REPOSITORY and optionally BAR_SOURCE_REF.`);
}

function readBlob(ref, filePath, encoding) {
  return git(['show', `${ref}:${filePath}`], encoding ? { encoding } : {});
}

const { ref, commit } = resolveSourceRef();
const source = readBlob(ref, 'gamedata/icontypes.lua', 'utf8');
const entryPattern = /^\s*([A-Za-z0-9_]+)\s*=\s*\{\s*bitmap\s*=\s*["']([^"']+)["']\s*,?\s*size\s*=\s*([0-9.]+)/gm;
const entries = [...source.matchAll(entryPattern)].map(match => ({
  name: match[1],
  bitmap: match[2].replace(/\\/g, '/'),
  size: Number(match[3])
}));

if (entries.length < 100) {
  throw new Error(`Only ${entries.length} tactical icon definitions were parsed; refusing to replace the current library.`);
}

const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'editp-tactical-icons-'));
const stagingAssets = path.join(stagingRoot, 'assets');
fs.mkdirSync(stagingAssets, { recursive: true });

const assetUrls = new Map();
const icons = {};

try {
  for (const entry of entries) {
    const bitmapKey = entry.bitmap.toLowerCase();
    let url = assetUrls.get(bitmapKey);
    if (!url) {
      const bytes = readBlob(ref, entry.bitmap);
      const extension = path.extname(entry.bitmap).toLowerCase() || '.png';
      const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 20);
      const fileName = `${hash}${extension}`;
      fs.writeFileSync(path.join(stagingAssets, fileName), bytes);
      url = `/tactical-icons/assets/${fileName}`;
      assetUrls.set(bitmapKey, url);
    }
    icons[entry.name] = { bitmap: entry.bitmap, size: entry.size, url };
  }

  const missing = Object.values(icons).filter(icon => !fs.existsSync(path.join(stagingRoot, icon.url.replace('/tactical-icons/', ''))));
  if (missing.length) throw new Error(`${missing.length} tactical icon previews were not generated.`);

  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(outputDirectory), { recursive: true });
  fs.renameSync(stagingAssets, outputDirectory);

  const manifest = {
    version: 1,
    sourceRepository: 'beyond-all-reason/Beyond-All-Reason',
    sourceCommit: commit,
    icons: Object.fromEntries(Object.entries(icons).sort(([left], [right]) => left.localeCompare(right, 'en')))
  };
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

  const assetManifest = JSON.parse(fs.readFileSync(assetManifestFile, 'utf8'));
  assetManifest.categories ||= {};
  assetManifest.categories.iconType = Object.keys(manifest.icons);
  fs.writeFileSync(assetManifestFile, `${JSON.stringify(assetManifest, null, 2)}\n`);

  const totalBytes = fs.readdirSync(outputDirectory)
    .reduce((sum, fileName) => sum + fs.statSync(path.join(outputDirectory, fileName)).size, 0);
  console.log(`Wrote ${entries.length} tactical icon types using ${assetUrls.size} unique previews (${(totalBytes / 1024 / 1024).toFixed(2)} MB).`);
  console.log(`Source: ${commit}`);
} finally {
  fs.rmSync(stagingRoot, { recursive: true, force: true });
}
