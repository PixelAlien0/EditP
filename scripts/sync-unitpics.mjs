import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { DDSLoader } from 'three/examples/jsm/loaders/DDSLoader.js';
import {
  MANIFEST_PATH,
  MAX_LIBRARY_BYTES,
  PLACEHOLDER_URL,
  ROOT,
  UNITPICS_DIR,
  formatBytes,
  readJson,
} from './unitpics-shared.mjs';

const REPOSITORY = 'beyond-all-reason/Beyond-All-Reason';
const BRANCH = 'master';
const PRIMARY_QUALITY = 80;
const FALLBACK_QUALITY = 76;
const SIZE = 192;
const CONCURRENCY = 20;
const STAGING_ROOT = path.join(ROOT, '.unitpics-staging');
const RAW_CACHE_ROOT = path.join(ROOT, '.cache', 'unitpics');
const LEGACY_MAP_PATH = path.join(ROOT, 'src', 'data', 'unitpic-map.json');
const RAPTOR_MAP_PATH = path.join(ROOT, 'src', 'data', 'raptor-pics.json');
const UNITS_PATH = path.join(ROOT, 'src', 'data', 'units.json');

const unitsDb = readJson(UNITS_PATH);
const legacyMap = readJson(LEGACY_MAP_PATH);
const raptorMap = readJson(RAPTOR_MAP_PATH);
const unitIds = Object.keys(unitsDb.names || unitsDb).map(id => id.toLowerCase()).sort();

function normalizeSourceName(value) {
  return String(value || '')
    .replaceAll('\\', '/')
    .replace(/^unitpics\//i, '')
    .replace(/\.(dds|png|tga)$/i, '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchBuffer(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'BAR-Editor-unitpic-sync' },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(400 * (2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

async function fetchJson(url) {
  return JSON.parse((await fetchBuffer(url)).toString('utf8'));
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function consume() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, consume));
  return results;
}

function createSourceResolver(ddsPaths) {
  const exact = new Map();
  const byBasename = new Map();
  for (const sourcePath of ddsPaths) {
    const relative = normalizeSourceName(sourcePath);
    exact.set(relative, sourcePath);
    const basename = path.posix.basename(relative);
    if (!byBasename.has(basename)) byBasename.set(basename, []);
    byBasename.get(basename).push(sourcePath);
  }

  return logicalName => {
    const logical = normalizeSourceName(logicalName);
    if (!logical) return null;
    if (exact.has(logical)) return exact.get(logical);
    if (logical.startsWith('scav_')) {
      const scavenger = `scavengers/${logical.slice(5)}`;
      if (exact.has(scavenger)) return exact.get(scavenger);
    }
    const matches = byBasename.get(path.posix.basename(logical)) || [];
    if (matches.length === 0) return null;
    if (logical.startsWith('scav_')) {
      return matches.find(item => item.toLowerCase().includes('/scavengers/')) || matches[0];
    }
    return matches.find(item => !item.slice('unitpics/'.length).includes('/'))
      || matches.find(item => !item.toLowerCase().includes('/scavengers/'))
      || matches[0];
  };
}

function fallbackLogicalName(unitId) {
  if (raptorMap[unitId]) return raptorMap[unitId];
  if (legacyMap[unitId]) return legacyMap[unitId];
  if (unitId.startsWith('scav_')) {
    const baseId = unitId.slice(5);
    return legacyMap[baseId] || raptorMap[baseId] || baseId;
  }
  return unitId;
}

async function collectBuildpicMappings(unitLuaPaths) {
  const wanted = new Set(unitIds);
  const relevant = unitLuaPaths.filter(sourcePath => {
    const id = path.posix.basename(sourcePath, '.lua').toLowerCase();
    return wanted.has(id);
  });
  let completed = 0;
  const entries = await mapLimit(relevant, CONCURRENCY, async sourcePath => {
    const id = path.posix.basename(sourcePath, '.lua').toLowerCase();
    try {
      const url = `https://raw.githubusercontent.com/${REPOSITORY}/${BRANCH}/${sourcePath}`;
      const text = (await fetchBuffer(url)).toString('utf8');
      const match = text.match(/buildpic\s*=\s*(?:\[\[([^\]]+)\]\]|"([^"]+)"|'([^']+)')/i);
      const value = normalizeSourceName(match?.[1] || match?.[2] || match?.[3]);
      return value ? [id, value] : null;
    } catch {
      return null;
    } finally {
      completed += 1;
      if (completed % 200 === 0 || completed === relevant.length) {
        process.stdout.write(`\rResolved unit definitions: ${completed}/${relevant.length}`);
      }
    }
  });
  process.stdout.write('\n');
  return new Map(entries.filter(Boolean));
}

function decodeDds(buffer) {
  const parsed = new DDSLoader().parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), true);
  const image = parsed.mipmaps?.[0];
  if (!image?.data || !image.width || !image.height) throw new Error('DDS has no base mipmap');
  const raw = Buffer.from(image.data);
  const expectedLength = image.width * image.height * 4;
  if (raw.length === Math.ceil(image.width / 4) * Math.ceil(image.height / 4) * 8) {
    return { data: decodeBc1(raw, image.width, image.height), width: image.width, height: image.height };
  }
  if (raw.length !== expectedLength) throw new Error(`Unsupported compressed DDS (${raw.length} bytes, expected ${expectedLength})`);
  return { data: raw, width: image.width, height: image.height };
}

function decodeBc1(data, width, height) {
  const output = Buffer.alloc(width * height * 4);
  const blockWidth = Math.ceil(width / 4);
  const blockHeight = Math.ceil(height / 4);
  const unpack565 = value => [
    Math.round(((value >> 11) & 31) * 255 / 31),
    Math.round(((value >> 5) & 63) * 255 / 63),
    Math.round((value & 31) * 255 / 31),
    255,
  ];

  for (let blockY = 0; blockY < blockHeight; blockY += 1) {
    for (let blockX = 0; blockX < blockWidth; blockX += 1) {
      const offset = (blockY * blockWidth + blockX) * 8;
      const color0Value = data.readUInt16LE(offset);
      const color1Value = data.readUInt16LE(offset + 2);
      const color0 = unpack565(color0Value);
      const color1 = unpack565(color1Value);
      const colors = [color0, color1];
      if (color0Value > color1Value) {
        colors.push(
          color0.map((value, channel) => channel === 3 ? 255 : Math.round((2 * value + color1[channel]) / 3)),
          color0.map((value, channel) => channel === 3 ? 255 : Math.round((value + 2 * color1[channel]) / 3)),
        );
      } else {
        colors.push(
          color0.map((value, channel) => channel === 3 ? 255 : Math.round((value + color1[channel]) / 2)),
          [0, 0, 0, 0],
        );
      }
      const indices = data.readUInt32LE(offset + 4);
      for (let pixelY = 0; pixelY < 4; pixelY += 1) {
        for (let pixelX = 0; pixelX < 4; pixelX += 1) {
          const x = blockX * 4 + pixelX;
          const y = blockY * 4 + pixelY;
          if (x >= width || y >= height) continue;
          const color = colors[(indices >>> (2 * (pixelY * 4 + pixelX))) & 3];
          const target = (y * width + x) * 4;
          output[target] = color[0];
          output[target + 1] = color[1];
          output[target + 2] = color[2];
          output[target + 3] = color[3];
        }
      }
    }
  }
  return output;
}

async function encodeWebp(ddsBuffer, quality) {
  const image = decodeDds(ddsBuffer);
  return sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .resize(SIZE, SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality, alphaQuality: 90, effort: 6, smartSubsample: true })
    .toBuffer();
}

async function generateAtQuality({ quality, sourcePaths, cacheDir, outputDir }) {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  const sourceToAsset = new Map();
  const failures = [];
  let completed = 0;

  await mapLimit(sourcePaths, Math.min(12, CONCURRENCY), async sourcePath => {
    const cachePath = path.join(cacheDir, `${sha256(Buffer.from(sourcePath))}.dds`);
    try {
      let ddsBuffer;
      if (fs.existsSync(cachePath)) {
        ddsBuffer = fs.readFileSync(cachePath);
      } else {
        const url = `https://raw.githubusercontent.com/${REPOSITORY}/${BRANCH}/${sourcePath}`;
        ddsBuffer = await fetchBuffer(url);
        fs.writeFileSync(cachePath, ddsBuffer);
      }
      const webp = await encodeWebp(ddsBuffer, quality);
      const hash = sha256(webp).slice(0, 20);
      const fileName = `${hash}.webp`;
      const destination = path.join(outputDir, fileName);
      if (!fs.existsSync(destination)) fs.writeFileSync(destination, webp);
      sourceToAsset.set(sourcePath, `/unitpics/assets/${fileName}`);
    } catch (error) {
      failures.push({ sourcePath, error: error.message });
    } finally {
      completed += 1;
      if (completed % 100 === 0 || completed === sourcePaths.length) {
        process.stdout.write(`\rGenerated WebP assets (q${quality}): ${completed}/${sourcePaths.length}`);
      }
    }
  });
  process.stdout.write('\n');
  const files = fs.readdirSync(outputDir).map(name => path.join(outputDir, name));
  const bytes = files.reduce((total, filePath) => total + fs.statSync(filePath).size, 0);
  return { sourceToAsset, failures, files, bytes };
}

async function main() {
  console.log('Fetching BAR repository metadata…');
  const [commit, tree] = await Promise.all([
    fetchJson(`https://api.github.com/repos/${REPOSITORY}/commits/${BRANCH}`),
    fetchJson(`https://api.github.com/repos/${REPOSITORY}/git/trees/${BRANCH}?recursive=1`),
  ]);
  if (!tree.tree || tree.truncated) throw new Error('GitHub returned an incomplete repository tree');

  const ddsPaths = tree.tree.map(item => item.path).filter(item => /^unitpics\/.*\.dds$/i.test(item));
  const unitLuaPaths = tree.tree.map(item => item.path).filter(item => /^units\/.*\.lua$/i.test(item));
  const resolveSource = createSourceResolver(ddsPaths);
  const buildpics = await collectBuildpicMappings(unitLuaPaths);
  const unitSources = new Map();

  for (const unitId of unitIds) {
    const logicalName = buildpics.get(unitId) || fallbackLogicalName(unitId);
    const sourcePath = resolveSource(logicalName);
    if (sourcePath) unitSources.set(unitId, sourcePath);
  }

  // Some generated Scavenger variants do not have their own unit Lua/buildpic,
  // even though their base unit already resolved to valid artwork. Reuse that
  // canonical source instead of emitting a logo placeholder.
  const inheritedScavengerSourceIds = [];
  for (const unitId of unitIds) {
    if (unitSources.has(unitId) || !unitId.startsWith('scav_')) continue;
    const baseSource = unitSources.get(unitId.slice(5));
    if (!baseSource) continue;
    unitSources.set(unitId, baseSource);
    inheritedScavengerSourceIds.push(unitId);
  }
  const unresolvedSourceIds = unitIds.filter(unitId => !unitSources.has(unitId));

  const sourcePaths = [...new Set(unitSources.values())].sort();
  const cacheDir = path.join(RAW_CACHE_ROOT, commit.sha.slice(0, 12));
  const stagedAssets = path.join(STAGING_ROOT, 'unitpics', 'assets');
  fs.rmSync(STAGING_ROOT, { recursive: true, force: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(stagedAssets, { recursive: true });

  console.log(`Resolved ${unitSources.size}/${unitIds.length} units to ${sourcePaths.length} source images.`);
  let generated = await generateAtQuality({ quality: PRIMARY_QUALITY, sourcePaths, cacheDir, outputDir: stagedAssets });
  let quality = PRIMARY_QUALITY;
  if (generated.bytes > MAX_LIBRARY_BYTES) {
    console.log(`${formatBytes(generated.bytes)} exceeds the 75 MB budget; rebuilding at q${FALLBACK_QUALITY}.`);
    quality = FALLBACK_QUALITY;
    generated = await generateAtQuality({ quality, sourcePaths, cacheDir, outputDir: stagedAssets });
  }
  if (generated.bytes > MAX_LIBRARY_BYTES) {
    throw new Error(`Generated library is ${formatBytes(generated.bytes)}, above the 75 MB budget`);
  }

  const failedSources = new Set(generated.failures.map(item => item.sourcePath));
  const manifestUnits = {};
  const placeholders = [];
  for (const unitId of unitIds) {
    const sourcePath = unitSources.get(unitId);
    const assetUrl = sourcePath && !failedSources.has(sourcePath) ? generated.sourceToAsset.get(sourcePath) : null;
    manifestUnits[unitId] = assetUrl || PLACEHOLDER_URL;
    if (!assetUrl) placeholders.push(unitId);
  }
  const scavengerUnitIds = unitIds.filter(unitId => unitId.startsWith('scav_'));
  const scavengerResolvedIds = scavengerUnitIds.filter(unitId => manifestUnits[unitId] !== PLACEHOLDER_URL);
  const scavengerUniqueAssets = new Set(scavengerResolvedIds.map(unitId => manifestUnits[unitId]));

  const manifest = {
    version: 1,
    sourceCommit: commit.sha,
    sourceDate: commit.commit?.committer?.date || null,
    settings: {
      size: SIZE,
      format: 'webp',
      quality,
      alphaQuality: 90,
      effort: 6,
      fit: 'contain',
    },
    stats: {
      unitCount: unitIds.length,
      sourceCount: sourcePaths.length,
      uniqueAssetCount: generated.files.length,
      assetBytes: generated.bytes,
      unresolvedSourceCount: unresolvedSourceIds.length,
      failedSourceCount: generated.failures.length,
      scavengerUnitCount: scavengerUnitIds.length,
      scavengerResolvedCount: scavengerResolvedIds.length,
      scavengerInheritedCount: inheritedScavengerSourceIds.length,
      scavengerUniqueAssetCount: scavengerUniqueAssets.size,
      scavengerPlaceholderCount: scavengerUnitIds.length - scavengerResolvedIds.length,
    },
    units: manifestUnits,
    placeholders,
  };
  const stagedManifest = path.join(STAGING_ROOT, 'unitpic-manifest.json');
  fs.writeFileSync(stagedManifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  fs.rmSync(UNITPICS_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(UNITPICS_DIR), { recursive: true });
  fs.cpSync(path.join(STAGING_ROOT, 'unitpics'), UNITPICS_DIR, { recursive: true, force: true });
  const copiedAssetCount = fs.readdirSync(path.join(UNITPICS_DIR, 'assets')).length;
  if (copiedAssetCount !== generated.files.length) {
    throw new Error(`Asset copy verification failed (${copiedAssetCount}/${generated.files.length})`);
  }
  fs.copyFileSync(stagedManifest, MANIFEST_PATH);
  fs.rmSync(STAGING_ROOT, { recursive: true, force: true });

  console.log(`\nUnit artwork synchronized from ${commit.sha.slice(0, 12)}.`);
  console.log(`  Units: ${unitIds.length}`);
  console.log(`  Unique sources: ${sourcePaths.length}`);
  console.log(`  Unique WebPs: ${generated.files.length}`);
  console.log(`  Library size: ${formatBytes(generated.bytes)}`);
  console.log(`  Placeholders: ${placeholders.length}`);
  console.log(`  Scavenger pictures: ${scavengerResolvedIds.length}/${scavengerUnitIds.length} (${inheritedScavengerSourceIds.length} inherited)`);
  if (generated.failures.length > 0) {
    console.warn('  Failed sources:');
    generated.failures.slice(0, 20).forEach(item => console.warn(`    ${item.sourcePath}: ${item.error}`));
  }
}

main().catch(error => {
  console.error(`\nUnitpic sync failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
