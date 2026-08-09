import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE_COMMIT = 'e03f8af274ad97c327d4863432c406e33a4062fa';
const SOURCE_ROOT = `https://raw.githubusercontent.com/beyond-all-reason/Beyond-All-Reason/${SOURCE_COMMIT}`;
const OUTPUT_DIR = path.resolve('public/bar-models/corak');
const TEXTURE_SIZE = 1024;

async function download(relativePath) {
  const response = await fetch(`${SOURCE_ROOT}/${relativePath}`);
  if (!response.ok) throw new Error(`Failed to download ${relativePath}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

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
  if (fourCC !== 'DXT5') throw new Error(`Only DXT5 prototype textures are supported, received ${fourCC}.`);

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

async function writeTextureChannels(colorDds, materialDds) {
  const color = decodeDxt5(colorDds);
  const material = decodeDxt5(materialDds);
  const base = Buffer.alloc(color.width * color.height * 3);
  const team = Buffer.alloc(color.width * color.height);
  const emissive = Buffer.alloc(material.width * material.height);

  for (let pixel = 0; pixel < color.width * color.height; pixel += 1) {
    const source = pixel * 4;
    const target = pixel * 3;
    base[target] = color.pixels[source];
    base[target + 1] = color.pixels[source + 1];
    base[target + 2] = color.pixels[source + 2];
    team[pixel] = color.pixels[source + 3];
    emissive[pixel] = material.pixels[source];
  }

  const resize = { width: TEXTURE_SIZE, height: TEXTURE_SIZE, fit: 'fill', kernel: sharp.kernel.lanczos3 };
  await Promise.all([
    sharp(base, { raw: { width: color.width, height: color.height, channels: 3 } }).resize(resize).webp({ quality: 84, effort: 6 }).toFile(path.join(OUTPUT_DIR, 'cor_color.webp')),
    sharp(team, { raw: { width: color.width, height: color.height, channels: 1 } }).resize(resize).webp({ lossless: true, effort: 6 }).toFile(path.join(OUTPUT_DIR, 'cor_team.webp')),
    sharp(emissive, { raw: { width: material.width, height: material.height, channels: 1 } }).resize(resize).webp({ quality: 82, effort: 6 }).toFile(path.join(OUTPUT_DIR, 'cor_emissive.webp')),
  ]);
}

await mkdir(OUTPUT_DIR, { recursive: true });
const [model, color, material] = await Promise.all([
  download('objects3d/Units/corak.s3o'),
  download('unittextures/cor_color.dds'),
  download('unittextures/cor_other.dds'),
]);
await writeFile(path.join(OUTPUT_DIR, 'corak.s3o'), model);
await writeTextureChannels(color, material);
await writeFile(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify({
  version: 1,
  sourceRepository: 'beyond-all-reason/Beyond-All-Reason',
  sourceCommit: SOURCE_COMMIT,
  unitId: 'corak',
  model: '/bar-models/corak/corak.s3o',
  textures: {
    color: '/bar-models/corak/cor_color.webp',
    teamMask: '/bar-models/corak/cor_team.webp',
    emissive: '/bar-models/corak/cor_emissive.webp',
  },
  textureSize: TEXTURE_SIZE,
  sourceHash: createHash('sha256').update(model).update(color).update(material).digest('hex'),
}, null, 2)}\n`);

console.log(`Prepared CORAK reference model prototype at ${OUTPUT_DIR}`);
