import fs from 'node:fs';
import path from 'node:path';

export const ROOT = process.cwd();
export const UNITPICS_DIR = path.join(ROOT, 'public', 'unitpics');
export const ASSET_DIR = path.join(UNITPICS_DIR, 'assets');
export const MANIFEST_PATH = path.join(ROOT, 'src', 'data', 'unitpic-manifest.json');
export const PLACEHOLDER_URL = '/logo.svg';
export const MAX_LIBRARY_BYTES = 75 * 1024 * 1024;
export const MAX_FILE_BYTES = 100 * 1024;
export const MAX_P95_BYTES = 50 * 1024;
export const MAX_DIST_BYTES = 80 * 1024 * 1024;

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(filePath) : [filePath];
  });
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function isWebp(buffer) {
  return buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
}

export function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}
