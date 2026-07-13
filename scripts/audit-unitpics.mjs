import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  ASSET_DIR,
  MANIFEST_PATH,
  MAX_DIST_BYTES,
  MAX_FILE_BYTES,
  MAX_LIBRARY_BYTES,
  MAX_P95_BYTES,
  PLACEHOLDER_URL,
  ROOT,
  UNITPICS_DIR,
  formatBytes,
  isWebp,
  percentile,
  readJson,
  walkFiles,
} from './unitpics-shared.mjs';

const manifest = readJson(MANIFEST_PATH);
const unitsDb = readJson(path.join(ROOT, 'src', 'data', 'units.json'));
const expectedUnitIds = Object.keys(unitsDb.names || unitsDb).map(id => id.toLowerCase()).sort();
const assetFiles = walkFiles(ASSET_DIR);
const allUnitpicFiles = walkFiles(UNITPICS_DIR);
const errors = [];
const hashes = new Map();
const sizes = [];
let totalBytes = 0;

for (const filePath of assetFiles) {
  const buffer = fs.readFileSync(filePath);
  const relative = path.relative(ASSET_DIR, filePath).replaceAll('\\', '/');
  if (!/^[a-f0-9]{20}\.webp$/.test(relative)) errors.push(`Unexpected asset filename: ${relative}`);
  if (!isWebp(buffer)) errors.push(`Invalid WebP signature: ${relative}`);
  else {
    const metadata = await sharp(buffer).metadata();
    if (metadata.width !== 192 || metadata.height !== 192) {
      errors.push(`Unexpected dimensions: ${relative} (${metadata.width}×${metadata.height})`);
    }
  }
  if (buffer.length > MAX_FILE_BYTES) errors.push(`Asset exceeds 100 KB: ${relative} (${formatBytes(buffer.length)})`);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (hashes.has(hash)) errors.push(`Duplicate asset content: ${relative} and ${hashes.get(hash)}`);
  else hashes.set(hash, relative);
  sizes.push(buffer.length);
  totalBytes += buffer.length;
}

for (const filePath of allUnitpicFiles) {
  if (path.extname(filePath).toLowerCase() !== '.webp') {
    errors.push(`Non-WebP file in unitpic library: ${path.relative(UNITPICS_DIR, filePath)}`);
  }
}

const referencedAssets = new Set();
const manifestPlaceholders = new Set(manifest.placeholders || []);
for (const unitId of expectedUnitIds) {
  const assetUrl = manifest.units?.[unitId];
  if (!assetUrl) {
    errors.push(`Manifest entry missing for ${unitId}`);
    continue;
  }
  if (assetUrl === PLACEHOLDER_URL) {
    if (!manifestPlaceholders.has(unitId)) errors.push(`Placeholder list is missing ${unitId}`);
    continue;
  }
  if (manifestPlaceholders.has(unitId)) errors.push(`Placeholder list incorrectly contains ${unitId}`);
  const match = assetUrl.match(/^\/unitpics\/assets\/([a-f0-9]{20}\.webp)$/);
  if (!match) {
    errors.push(`Unsafe or invalid asset URL for ${unitId}: ${assetUrl}`);
    continue;
  }
  referencedAssets.add(match[1]);
  if (!fs.existsSync(path.join(ASSET_DIR, match[1]))) errors.push(`Missing asset for ${unitId}: ${match[1]}`);
}

for (const filePath of assetFiles) {
  const name = path.basename(filePath);
  if (!referencedAssets.has(name)) errors.push(`Orphaned asset: ${name}`);
}

const unexpectedManifestUnits = Object.keys(manifest.units || {}).filter(id => !expectedUnitIds.includes(id));
if (unexpectedManifestUnits.length > 0) errors.push(`${unexpectedManifestUnits.length} manifest units are not present in units.json`);
if (totalBytes > MAX_LIBRARY_BYTES) errors.push(`Library exceeds 75 MB: ${formatBytes(totalBytes)}`);
const p95Bytes = percentile(sizes, 0.95);
if (p95Bytes > MAX_P95_BYTES) errors.push(`p95 asset exceeds 50 KB: ${formatBytes(p95Bytes)}`);

let distBytes = null;
if (process.argv.includes('--dist')) {
  const distDir = path.join(ROOT, 'dist');
  if (!fs.existsSync(distDir)) errors.push('dist does not exist; run the production build first');
  else {
    distBytes = walkFiles(distDir).reduce((total, filePath) => total + fs.statSync(filePath).size, 0);
    if (distBytes > MAX_DIST_BYTES) errors.push(`dist exceeds 80 MB: ${formatBytes(distBytes)}`);
  }
}

console.log('Unit artwork audit');
console.log(`  Source commit: ${manifest.sourceCommit || 'unknown'}`);
console.log(`  Units: ${expectedUnitIds.length}`);
console.log(`  Placeholders: ${manifest.placeholders?.length || 0}`);
console.log(`  Unique assets: ${assetFiles.length}`);
console.log(`  Library size: ${formatBytes(totalBytes)}`);
console.log(`  Largest asset: ${formatBytes(Math.max(0, ...sizes))}`);
console.log(`  p95 asset: ${formatBytes(p95Bytes)}`);
if (distBytes !== null) console.log(`  Production build: ${formatBytes(distBytes)}`);

if (errors.length > 0) {
  console.error(`\nAudit failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`);
  errors.slice(0, 100).forEach(error => console.error(`  - ${error}`));
  process.exitCode = 1;
} else {
  console.log('\nAudit passed.');
}
