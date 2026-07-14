import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const distDir = path.resolve('dist');
const assetsDir = path.join(distDir, 'assets');

if (!fs.existsSync(assetsDir)) {
  console.error('Bundle audit requires a production build. Run npm run build first.');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir).map(name => ({
  name,
  bytes: fs.statSync(path.join(assetsDir, name)).size
}));
const javascript = files.filter(file => file.name.endsWith('.js'));
const styles = files.filter(file => file.name.endsWith('.css'));
const entry = javascript
  .filter(file => file.name.startsWith('index-'))
  .sort((left, right) => right.bytes - left.bytes)[0];
const largestJs = [...javascript].sort((left, right) => right.bytes - left.bytes)[0];
const entryCss = styles
  .filter(file => file.name.startsWith('index-'))
  .sort((left, right) => right.bytes - left.bytes)[0];
const totalCss = styles.reduce((sum, file) => sum + file.bytes, 0);

const budgets = {
  entryJs: 450 * 1024,
  entryGzip: 150 * 1024,
  largestJs: 500 * 1024,
  entryCss: 310 * 1024,
  totalCss: 350 * 1024,
  dist: 25 * 1024 * 1024
};

function directorySize(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((sum, entry) => {
    const target = path.join(directory, entry.name);
    return sum + (entry.isDirectory() ? directorySize(target) : fs.statSync(target).size);
  }, 0);
}

const measurements = {
  entryJs: entry?.bytes || 0,
  entryGzip: entry ? gzipSync(fs.readFileSync(path.join(assetsDir, entry.name))).byteLength : 0,
  largestJs: largestJs?.bytes || 0,
  entryCss: entryCss?.bytes || 0,
  totalCss,
  dist: directorySize(distDir)
};

const failures = Object.entries(measurements).filter(([key, value]) => value > budgets[key]);
console.log('Bundle budget audit');
Object.entries(measurements).forEach(([key, value]) => {
  console.log(`  ${key}: ${(value / 1024).toFixed(1)} KB / ${(budgets[key] / 1024).toFixed(1)} KB`);
});

if (failures.length > 0) {
  failures.forEach(([key]) => console.error(`Budget exceeded: ${key}`));
  process.exit(1);
}

console.log('Bundle budgets passed.');
