import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE_COMMIT = 'e03f8af274ad97c327d4863432c406e33a4062fa';
const SOURCE_ROOT = `https://raw.githubusercontent.com/beyond-all-reason/Beyond-All-Reason/${SOURCE_COMMIT}`;
const VIEWER_ORIGIN = 'https://pub-6bd55f3ce081404a8ed10246598d1b21.r2.dev';
const VIEWER_MODEL_ROOT = `${VIEWER_ORIGIN}/glb`;
const PUBLIC_MODEL_ROOT = '/bar-model-cdn/glb';
const OUTPUT_ROOT = path.resolve('public/bar-models');
const STAGING_ROOT = path.resolve('public/bar-models-staging');
const DATA_MANIFEST = path.resolve('src/data/bar-model-manifest.json');
const UNIT_DEFAULTS = path.resolve('src/data/unit-defaults.json');
const UNIT_CATEGORIES = path.resolve('src/data/unit-categories.json');
const UNIT_METADATA = path.resolve('src/data/units.json');
const TEXTURE_SIZE = 512;
const MAX_LIBRARY_BYTES = 3_000_000;
const DISCOVERY_CONCURRENCY = 12;

const TEXTURE_FAMILIES = Object.freeze({
  arm: { color: 'unittextures/Arm_color.dds', material: 'unittextures/Arm_other.dds', normal: 'unittextures/Arm_normal.dds' },
  cor: { color: 'unittextures/cor_color.dds', material: 'unittextures/cor_other.dds', normal: 'unittextures/cor_normal.dds' },
  leg: {
    color: 'unittextures/leg_color.dds',
    material: 'unittextures/leg_shader.dds',
    normal: `${VIEWER_ORIGIN}/tex/leg_normal.png`,
  },
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizeModelPath(value) {
  return String(value || '').trim().replace(/\\/g, '/').toLowerCase();
}

function inferFaction(unitId) {
  const normalized = String(unitId || '').toLowerCase().replace(/^scav_/, '');
  if (normalized.startsWith('arm')) return 'arm';
  if (normalized.startsWith('cor')) return 'cor';
  if (normalized.startsWith('leg')) return 'leg';
  if (normalized.startsWith('raptor')) return 'raptor';
  return 'other';
}

function inferRole(categories = [], unitId = '', name = '') {
  const values = new Set(categories.map(value => String(value).toLowerCase()));
  if (/commander/i.test(name) || /(?:^|_)(?:arm|cor|leg)(?:de)?com(?:lvl\d+|con|econ|t2def)?$/i.test(unitId)) return 'Commander';
  if (values.has('commanders')) return 'Commander';
  if (values.has('factories')) return 'Factory';
  if (values.has('builders')) return 'Builder';
  if (values.has('aircraft')) return 'Aircraft';
  if (values.has('ships')) return 'Ship';
  if (values.has('hovercraft')) return 'Hovercraft';
  if (values.has('vehicles')) return 'Vehicle';
  if (values.has('bots')) return 'Bot';
  if (values.has('buildings')) return 'Building';
  return 'Unit';
}

function representativeScore(unitId) {
  const id = String(unitId).toLowerCase();
  let score = 0;
  if (id.startsWith('scav_')) score += 100;
  if (id.startsWith('raptor_')) score += 80;
  if (/test|dummy|spawner|loot/.test(id)) score += 30;
  score += id.length / 100;
  return score;
}

async function downloadUrl(url, label = url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 250));
    }
  }
  throw new Error(`Failed to download ${label}: ${lastError?.message || 'unknown error'}`);
}

async function inspectRemoteModel(unitId) {
  const sourceUrl = `${VIEWER_MODEL_ROOT}/${unitId}.glb`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, { method: 'HEAD' });
      if (response.ok) {
        return {
          sourceUrl,
          bytes: Number(response.headers.get('content-length')) || 0,
        };
      }
      if (response.status === 404) return null;
    } catch {
      // Retry transient network failures before marking a candidate unavailable.
    }
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 200));
  }
  return null;
}

async function mapConcurrent(values, concurrency, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

const downloadSource = relativePath => downloadUrl(`${SOURCE_ROOT}/${relativePath}`, relativePath);
const downloadTexture = source => source.startsWith('https://') ? downloadUrl(source) : downloadSource(source);

function rgb565(value) {
  return [
    Math.round(((value >>> 11) & 31) * 255 / 31),
    Math.round(((value >>> 5) & 63) * 255 / 63),
    Math.round((value & 31) * 255 / 31),
  ];
}

function decodeDxt5(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(0, true) !== 0x20534444) throw new Error('Expected a DDS texture.');
  const height = view.getUint32(12, true);
  const width = view.getUint32(16, true);
  const fourCC = String.fromCharCode(buffer[84], buffer[85], buffer[86], buffer[87]);
  if (fourCC !== 'DXT5') throw new Error(`Only DXT5 BAR textures are supported, received ${fourCC}.`);

  const pixels = Buffer.alloc(width * height * 4);
  let offset = 128;
  for (let blockY = 0; blockY < Math.ceil(height / 4); blockY += 1) {
    for (let blockX = 0; blockX < Math.ceil(width / 4); blockX += 1) {
      const alpha0 = buffer[offset];
      const alpha1 = buffer[offset + 1];
      const alphaBits = buffer.subarray(offset + 2, offset + 8);
      const alphas = [alpha0, alpha1];
      if (alpha0 > alpha1) {
        for (let index = 1; index <= 6; index += 1) alphas.push(Math.round(((7 - index) * alpha0 + index * alpha1) / 7));
      } else {
        for (let index = 1; index <= 4; index += 1) alphas.push(Math.round(((5 - index) * alpha0 + index * alpha1) / 5));
        alphas.push(0, 255);
      }

      const color0 = view.getUint16(offset + 8, true);
      const color1 = view.getUint16(offset + 10, true);
      const c0 = rgb565(color0);
      const c1 = rgb565(color1);
      const colors = [
        c0,
        c1,
        c0.map((channel, index) => Math.round((2 * channel + c1[index]) / 3)),
        c0.map((channel, index) => Math.round((channel + 2 * c1[index]) / 3)),
      ];
      const colorBits = view.getUint32(offset + 12, true);
      let alphaIndexBits = 0n;
      for (let index = 0; index < 6; index += 1) alphaIndexBits |= BigInt(alphaBits[index]) << BigInt(index * 8);

      for (let pixel = 0; pixel < 16; pixel += 1) {
        const x = blockX * 4 + (pixel % 4);
        const y = blockY * 4 + Math.floor(pixel / 4);
        if (x >= width || y >= height) continue;
        const color = colors[(colorBits >>> (pixel * 2)) & 3];
        const alpha = alphas[Number((alphaIndexBits >> BigInt(pixel * 3)) & 7n)];
        const target = (y * width + x) * 4;
        pixels[target] = color[0];
        pixels[target + 1] = color[1];
        pixels[target + 2] = color[2];
        pixels[target + 3] = alpha;
      }
      offset += 16;
    }
  }
  return { pixels, width, height };
}

async function decodeTexture(buffer) {
  if (buffer.subarray(0, 4).toString('ascii') === 'DDS ') return decodeDxt5(buffer);
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { pixels: data, width: info.width, height: info.height };
}

async function writeAsset(bytes, extension) {
  const hash = sha256(bytes).slice(0, 20);
  const fileName = `${hash}.${extension}`;
  const destination = path.join(STAGING_ROOT, 'assets', fileName);
  try {
    const existing = await readFile(destination);
    if (!existing.equals(bytes)) throw new Error(`Content hash collision for ${fileName}.`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(destination, bytes);
  }
  return `/bar-models/assets/${fileName}`;
}

async function encodeTextureFamily(family) {
  const source = TEXTURE_FAMILIES[family];
  const [colorDds, materialDds, normalDds] = await Promise.all([
    downloadTexture(source.color),
    downloadTexture(source.material),
    downloadTexture(source.normal),
  ]);
  const [color, material, normal] = await Promise.all([
    decodeTexture(colorDds),
    decodeTexture(materialDds),
    decodeTexture(normalDds),
  ]);
  const base = Buffer.alloc(color.width * color.height * 3);
  const team = Buffer.alloc(color.width * color.height);
  const emissive = Buffer.alloc(material.width * material.height * 3);
  const pbr = Buffer.alloc(material.width * material.height * 3);
  const normalMap = Buffer.alloc(normal.width * normal.height * 3);

  for (let pixel = 0; pixel < color.width * color.height; pixel += 1) {
    const sourceIndex = pixel * 4;
    const target = pixel * 3;
    base[target] = color.pixels[sourceIndex];
    base[target + 1] = color.pixels[sourceIndex + 1];
    base[target + 2] = color.pixels[sourceIndex + 2];
    team[pixel] = color.pixels[sourceIndex + 3];
    const glow = material.pixels[sourceIndex] / 255;
    emissive[target] = Math.round(color.pixels[sourceIndex] * glow);
    emissive[target + 1] = Math.round(color.pixels[sourceIndex + 1] * glow);
    emissive[target + 2] = Math.round(color.pixels[sourceIndex + 2] * glow);
    pbr[target] = 255;
    pbr[target + 1] = material.pixels[sourceIndex + 2];
    pbr[target + 2] = material.pixels[sourceIndex + 1];
    normalMap[target] = normal.pixels[sourceIndex];
    normalMap[target + 1] = normal.pixels[sourceIndex + 1];
    normalMap[target + 2] = normal.pixels[sourceIndex + 2];
  }

  const resize = { width: TEXTURE_SIZE, height: TEXTURE_SIZE, fit: 'fill', kernel: sharp.kernel.lanczos3 };
  const encoded = await Promise.all([
    sharp(base, { raw: { width: color.width, height: color.height, channels: 3 } }).resize(resize).webp({ quality: 82, effort: 6 }).toBuffer(),
    sharp(team, { raw: { width: color.width, height: color.height, channels: 1 } }).resize(resize).webp({ lossless: true, effort: 6 }).toBuffer(),
    sharp(emissive, { raw: { width: material.width, height: material.height, channels: 3 } }).resize(resize).webp({ quality: 82, effort: 6 }).toBuffer(),
    sharp(pbr, { raw: { width: material.width, height: material.height, channels: 3 } }).resize(resize).webp({ quality: 86, effort: 6 }).toBuffer(),
    sharp(normalMap, { raw: { width: normal.width, height: normal.height, channels: 3 } }).resize(resize).webp({ quality: 88, effort: 6 }).toBuffer(),
  ]);

  const [colorUrl, teamUrl, emissiveUrl, pbrUrl, normalUrl] = await Promise.all(encoded.map(bytes => writeAsset(bytes, 'webp')));
  return {
    color: colorUrl,
    teamMask: teamUrl,
    emissive: emissiveUrl,
    pbr: pbrUrl,
    normal: normalUrl,
    sourceHash: sha256(Buffer.concat([colorDds, materialDds, normalDds])),
  };
}

const [defaultsDb, categoryDb, unitMetadata] = await Promise.all([
  readFile(UNIT_DEFAULTS, 'utf8').then(JSON.parse),
  readFile(UNIT_CATEGORIES, 'utf8').then(JSON.parse),
  readFile(UNIT_METADATA, 'utf8').then(JSON.parse),
]);

const modelGroups = new Map();
for (const [unitId, definition] of Object.entries(defaultsDb)) {
  const modelPath = normalizeModelPath(definition.objectname);
  if (!modelPath) continue;
  const group = modelGroups.get(modelPath) || [];
  group.push(unitId.toLowerCase());
  modelGroups.set(modelPath, group);
}

await rm(STAGING_ROOT, { recursive: true, force: true });
await mkdir(path.join(STAGING_ROOT, 'assets'), { recursive: true });

const textureFamilies = {};
for (const family of Object.keys(TEXTURE_FAMILIES).sort()) textureFamilies[family] = await encodeTextureFamily(family);

const groupedModels = [...modelGroups.entries()].sort(([left], [right]) => left.localeCompare(right));
const discoveries = await mapConcurrent(groupedModels, DISCOVERY_CONCURRENCY, async ([modelPath, unitIds]) => {
  const candidates = [...unitIds].sort((left, right) => representativeScore(left) - representativeScore(right) || left.localeCompare(right));
  for (const unitId of candidates) {
    const remote = await inspectRemoteModel(unitId);
    if (remote) return { modelPath, unitIds, unitId, remote };
  }
  return { modelPath, unitIds, unitId: candidates[0], remote: null };
});

const entries = {};
const aliases = {};
const unitAliases = {};
const unsupported = {};
let remoteModelBytes = 0;
let nativeMaterialModels = 0;

for (const discovery of discoveries) {
  const { modelPath, unitIds, unitId, remote } = discovery;
  if (!remote) {
    unsupported[modelPath] = { modelPath, unitIds, reason: 'official_web_model_unavailable' };
    continue;
  }
  const faction = inferFaction(unitId);
  const textures = textureFamilies[faction] || null;
  if (!textures) nativeMaterialModels += 1;
  remoteModelBytes += remote.bytes;
  entries[unitId] = {
    name: unitMetadata.names?.[unitId] || unitId,
    role: inferRole(categoryDb[unitId], unitId, unitMetadata.names?.[unitId]),
    faction,
    modelPath,
    textureFamily: textures ? faction : null,
    modelBytes: remote.bytes,
  };
  aliases[modelPath] = unitId;
  unitIds.forEach(alias => { unitAliases[alias] = unitId; });
}

const assetNames = new Set();
Object.values(textureFamilies).forEach(set => Object.values(set)
  .filter(value => typeof value === 'string' && value.startsWith('/'))
  .forEach(value => assetNames.add(value)));
let localAssetBytes = 0;
for (const assetUrl of assetNames) localAssetBytes += (await readFile(path.join(STAGING_ROOT, assetUrl.replace('/bar-models/', '')))).byteLength;
if (localAssetBytes > MAX_LIBRARY_BYTES) throw new Error(`Reference model materials are ${localAssetBytes} bytes; budget is ${MAX_LIBRARY_BYTES}.`);

const manifest = {
  version: 5,
  sourceRepository: 'beyond-all-reason/Beyond-All-Reason',
  sourceCommit: SOURCE_COMMIT,
  delivery: {
    mode: 'lazy-official-proxy',
    publicPrefix: PUBLIC_MODEL_ROOT,
    upstreamOrigin: VIEWER_ORIGIN,
  },
  settings: {
    textureSize: TEXTURE_SIZE,
    maxLibraryBytes: MAX_LIBRARY_BYTES,
    discoveryConcurrency: DISCOVERY_CONCURRENCY,
  },
  coverage: {
    totalUnits: Object.keys(defaultsDb).length,
    unitsWithModels: Object.keys(unitAliases).length,
    uniqueModelPaths: modelGroups.size,
    supported: Object.keys(entries).length,
    unsupported: Object.keys(unsupported).length,
    nativeMaterialModels,
    uniqueLocalAssets: assetNames.size,
    localAssetBytes,
    remoteModelBytes,
  },
  materials: textureFamilies,
  entries,
  aliases,
  unitAliases,
  unsupported,
};
const serializedManifest = `${JSON.stringify(manifest, null, 2)}\n`;
await writeFile(path.join(STAGING_ROOT, 'manifest.json'), serializedManifest);

await rm(OUTPUT_ROOT, { recursive: true, force: true });
await cp(STAGING_ROOT, OUTPUT_ROOT, { recursive: true, force: true });
await rm(STAGING_ROOT, { recursive: true, force: true });
await writeFile(DATA_MANIFEST, serializedManifest);

console.log(`Prepared ${manifest.coverage.supported}/${manifest.coverage.uniqueModelPaths} unique BAR models for lazy viewing.`);
console.log(`Mapped ${manifest.coverage.unitsWithModels}/${manifest.coverage.totalUnits} units; ${manifest.coverage.unsupported} model paths use artwork fallback.`);
console.log(`Local PBR materials: ${manifest.coverage.uniqueLocalAssets} assets (${manifest.coverage.localAssetBytes} bytes). Remote model catalog: ${manifest.coverage.remoteModelBytes} bytes.`);
