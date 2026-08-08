import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultRepository = path.join(os.tmpdir(), 'bar-parameter-audit');
const defaultOutput = path.join(root, 'src', 'data', 'custom-parameter-discovery.json');

function walk(directory, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, result);
    else if (entry.name.endsWith('.lua')) result.push(absolute);
  }
  return result;
}

function normalizedLines(source) {
  return source.split(/\r?\n/).map(line => {
    const indentation = line.match(/^[\t ]*/)?.[0] || '';
    const columns = [...indentation].reduce((count, character) => (
      count + (character === '\t' ? 4 : 1)
    ), 0);
    return `${'\t'.repeat(Math.floor(columns / 4))}${line.slice(indentation.length)}`;
  });
}

function parseValue(source) {
  const raw = String(source || '').replace(/,\s*(?:--.*)?$/, '').trim();
  if (raw === 'true' || raw === 'false') return { type: 'boolean', sample: raw };
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) return { type: 'number', sample: raw };
  const string = raw.match(/^(["'])(.*)\1$/);
  if (string) return { type: 'string', sample: string[2] };
  return { type: 'dynamic', sample: '' };
}

function addObservation(store, { key, type, sample, unitId, weaponDef, sourcePath }) {
  const normalizedKey = String(key || '').toLowerCase();
  if (!/^[a-z_][a-z0-9_]*$/.test(normalizedKey)) return;
  const record = store.get(normalizedKey) || {
    key: normalizedKey,
    occurrences: 0,
    valueTypes: new Set(),
    sampleValues: new Set(),
    sampleUnitIds: new Set(),
    sampleWeaponDefs: new Set(),
    sourcePaths: new Set(),
  };
  record.occurrences += 1;
  record.valueTypes.add(type);
  if (sample !== '') record.sampleValues.add(String(sample).slice(0, 120));
  if (unitId) record.sampleUnitIds.add(unitId);
  if (weaponDef) record.sampleWeaponDefs.add(weaponDef);
  if (sourcePath) record.sourcePaths.add(sourcePath);
  store.set(normalizedKey, record);
}

function serializeObservations(store) {
  const limited = (values, maximum) => [...values].sort((left, right) => left.localeCompare(right, 'en')).slice(0, maximum);
  return [...store.values()]
    .sort((left, right) => left.key.localeCompare(right.key, 'en'))
    .map(record => ({
      key: record.key,
      occurrences: record.occurrences,
      valueTypes: limited(record.valueTypes, 8),
      sampleValues: limited(record.sampleValues, 3),
      sampleUnitIds: limited(record.sampleUnitIds, 3),
      sampleWeaponDefs: limited(record.sampleWeaponDefs, 3),
      sourcePaths: limited(record.sourcePaths, 1),
    }));
}

export function discoverCustomParameters({ repository, sourceCommit = '' }) {
  const unitsRoot = path.join(repository, 'units');
  if (!fs.existsSync(unitsRoot)) throw new Error(`BAR unit sources were not found at ${unitsRoot}.`);

  const unitParameters = new Map();
  const weaponParameters = new Map();
  const files = walk(unitsRoot).sort((left, right) => left.localeCompare(right, 'en'));

  for (const file of files) {
    const sourcePath = path.relative(repository, file).replaceAll('\\', '/');
    const lines = normalizedLines(fs.readFileSync(file, 'utf8'));
    const unitId = lines.map(line => line.match(/^\t([A-Za-z0-9_]+)\s*=\s*\{/i)?.[1]).find(Boolean)?.toLowerCase() || '';
    let inWeaponDefs = false;
    let currentWeapon = '';
    let customScope = '';

    for (const line of lines) {
      if (/^\t\tweapondefs\s*=\s*\{/i.test(line)) {
        inWeaponDefs = true;
        currentWeapon = '';
        continue;
      }
      if (inWeaponDefs && /^\t\t\},?/.test(line)) {
        inWeaponDefs = false;
        currentWeapon = '';
        customScope = '';
        continue;
      }
      if (inWeaponDefs) {
        const weapon = line.match(/^\t\t\t(?:\[?["']?)([A-Za-z0-9_-]+)(?:["']?\]?)\s*=\s*\{/);
        if (weapon) {
          currentWeapon = weapon[1].toLowerCase();
          customScope = '';
          continue;
        }
      }

      if (!inWeaponDefs && /^\t\tcustomparams\s*=\s*\{/i.test(line)) {
        customScope = 'unit';
        continue;
      }
      if (inWeaponDefs && /^\t\t\t\tcustomparams\s*=\s*\{/i.test(line)) {
        customScope = 'weapon';
        continue;
      }
      if (customScope === 'unit' && /^\t\t\},?/.test(line)) {
        customScope = '';
        continue;
      }
      if (customScope === 'weapon' && /^\t\t\t\t\},?/.test(line)) {
        customScope = '';
        continue;
      }
      if (!customScope) continue;

      const expression = customScope === 'weapon'
        ? line.match(/^\t\t\t\t\t(?:\[?["']?)([A-Za-z_][A-Za-z0-9_]*)(?:["']?\]?)\s*=\s*(.+)$/)
        : line.match(/^\t\t\t(?:\[?["']?)([A-Za-z_][A-Za-z0-9_]*)(?:["']?\]?)\s*=\s*(.+)$/);
      if (!expression) continue;
      const parsed = parseValue(expression[2]);
      addObservation(customScope === 'weapon' ? weaponParameters : unitParameters, {
        key: expression[1],
        ...parsed,
        unitId,
        weaponDef: customScope === 'weapon' ? currentWeapon : '',
        sourcePath,
      });
    }
  }

  const unit = serializeObservations(unitParameters);
  const weapon = serializeObservations(weaponParameters);
  return {
    version: 1,
    sourceRepository: 'beyond-all-reason/Beyond-All-Reason',
    sourceCommit,
    counts: {
      scannedUnitFiles: files.length,
      unitParameters: unit.length,
      weaponParameters: weapon.length,
      totalParameters: unit.length + weapon.length,
    },
    parameters: { unit, weapon },
  };
}

export function writeCustomParameterDiscovery({ repository, sourceCommit, outputFile = defaultOutput }) {
  const discovery = discoverCustomParameters({ repository, sourceCommit });
  fs.writeFileSync(outputFile, `${JSON.stringify(discovery, null, 2)}\n`, 'utf8');
  return discovery;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const repository = process.env.BAR_REPOSITORY || defaultRepository;
  const sourceCommit = String(process.env.BAR_SOURCE_COMMIT || '').trim();
  if (!/^[a-f0-9]{40}$/i.test(sourceCommit)) {
    throw new Error('BAR_SOURCE_COMMIT must identify the exact source used for parameter discovery.');
  }
  const discovery = writeCustomParameterDiscovery({ repository, sourceCommit });
  console.log('Discovered BAR custom parameters');
  console.log(`  Unit keys: ${discovery.counts.unitParameters}`);
  console.log(`  Weapon keys: ${discovery.counts.weaponParameters}`);
  console.log(`  Scanned files: ${discovery.counts.scannedUnitFiles}`);
}
