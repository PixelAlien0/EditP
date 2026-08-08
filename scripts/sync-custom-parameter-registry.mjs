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

function consumerLayer(sourcePath) {
  if (sourcePath.startsWith('luarules/gadgets/')) return 'runtime-gadget';
  if (sourcePath.startsWith('luaui/')) return 'interface';
  if (sourcePath.startsWith('gamedata/')) return 'definition-transform';
  if (sourcePath.startsWith('common/')) return 'shared-runtime';
  return 'source';
}

function inferConsumerScope(owner) {
  const normalized = String(owner || '').toLowerCase();
  if (/weapon|wdef|^wd$/.test(normalized)) return 'weapon';
  if (/unit|udef|^ud$/.test(normalized)) return 'unit';
  return '';
}

function addConsumer(store, { key, scope, sourcePath, line, access, confidence, operation = 'read' }) {
  const normalizedKey = String(key || '').toLowerCase();
  if (!scope || !/^[a-z_][a-z0-9_]*$/.test(normalizedKey)) return false;
  const id = `${scope}:${normalizedKey}`;
  const record = store.get(id) || {
    key: normalizedKey,
    scope,
    readCount: 0,
    writeCount: 0,
    paths: new Map(),
  };
  if (operation === 'write') record.writeCount += 1;
  else record.readCount += 1;
  const pathRecord = record.paths.get(sourcePath) || {
    path: sourcePath,
    layer: consumerLayer(sourcePath),
    confidence,
    readCount: 0,
    writeCount: 0,
    lines: new Set(),
    access: new Set(),
  };
  if (operation === 'write') pathRecord.writeCount += 1;
  else pathRecord.readCount += 1;
  if (line) pathRecord.lines.add(line);
  if (access) pathRecord.access.add(access);
  if (confidence === 'high') pathRecord.confidence = 'high';
  record.paths.set(sourcePath, pathRecord);
  store.set(id, record);
  return true;
}

function resolveConsumerScope({ explicitScope, key, unitKeys, weaponKeys }) {
  if (explicitScope) return { scope: explicitScope, confidence: 'high' };
  const inUnit = unitKeys.has(key);
  const inWeapon = weaponKeys.has(key);
  if (inUnit !== inWeapon) return { scope: inUnit ? 'unit' : 'weapon', confidence: 'medium' };
  return { scope: '', confidence: 'unresolved' };
}

function accessOperation(line, match) {
  const remainder = line.slice((match.index || 0) + match[0].length);
  return /^\s*=(?!=)/.test(remainder) ? 'write' : 'read';
}

function discoverConsumers(repository, { unitKeys, weaponKeys }) {
  const consumers = new Map();
  const unresolved = new Map();
  const consumerRoots = ['common', 'gamedata', 'luarules', 'luaui', 'scripts'];
  const files = consumerRoots
    .flatMap(directory => walk(path.join(repository, directory)))
    .sort((left, right) => left.localeCompare(right, 'en'));

  for (const file of files) {
    const sourcePath = path.relative(repository, file).replaceAll('\\', '/').toLowerCase();
    const aliases = new Map();
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((sourceLine, index) => {
      const trimmed = sourceLine.trim();
      if (!trimmed || trimmed.startsWith('--')) return;
      const line = sourceLine.replace(/--.*$/, '');
      const alias = line.match(/\blocal\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^\n]+?)\.custom[Pp]arams\b/);
      if (alias) {
        const scope = inferConsumerScope(alias[2]);
        if (scope) aliases.set(alias[1], scope);
      }

      const directPattern = /(?:\b([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*)?custom[Pp]arams\s*(?:\.\s*([A-Za-z_][A-Za-z0-9_]*)|\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\])/g;
      for (const match of line.matchAll(directPattern)) {
        const key = String(match[2] || match[3] || '').toLowerCase();
        const explicitScope = aliases.get(match[1]) || inferConsumerScope(match[1]);
        const resolved = resolveConsumerScope({ explicitScope, key, unitKeys, weaponKeys });
        if (addConsumer(consumers, {
          key, scope: resolved.scope, sourcePath, line: index + 1,
          access: match[1] ? `${match[1]}.customParams` : 'customParams',
          confidence: resolved.confidence,
          operation: accessOperation(line, match),
        })) continue;
        if (accessOperation(line, match) === 'write') continue;
        const unresolvedRecord = unresolved.get(key) || { key, occurrences: 0, sourcePaths: new Set() };
        unresolvedRecord.occurrences += 1;
        unresolvedRecord.sourcePaths.add(sourcePath);
        unresolved.set(key, unresolvedRecord);
      }

      for (const [aliasName, explicitScope] of aliases) {
        if (/^customparams$/i.test(aliasName)) continue;
        const escapedAlias = aliasName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const aliasPattern = new RegExp(`\\b${escapedAlias}\\s*(?:\\.\\s*([A-Za-z_][A-Za-z0-9_]*)|\\[\\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\\s*\\])`, 'g');
        for (const match of line.matchAll(aliasPattern)) {
          const key = String(match[1] || match[2] || '').toLowerCase();
          addConsumer(consumers, {
            key, scope: explicitScope, sourcePath, line: index + 1,
            access: aliasName, confidence: 'high',
            operation: accessOperation(line, match),
          });
        }
      }
    });
  }

  return { consumers, unresolved, scannedFiles: files.length };
}

function serializeConsumer(record) {
  if (!record) return { consumerCount: 0, writerCount: 0, consumerLayers: [], consumerEvidence: [] };
  const readablePaths = [...record.paths.values()]
    .filter(item => item.readCount > 0)
    .sort((left, right) => left.path.localeCompare(right.path, 'en'));
  // The generated snapshot ships with the editor, so retain representative
  // evidence instead of every matching location. Aggregate counts and layers
  // still describe the complete scan and the registry remains traceable.
  const consumerEvidence = readablePaths
    .slice(0, 1)
    .map(item => ({
      path: item.path,
      layer: item.layer,
      confidence: item.confidence,
      line: [...item.lines].sort((left, right) => left - right)[0] || 0,
      access: [...item.access].sort((left, right) => left.localeCompare(right, 'en'))[0] || '',
    }));
  return {
    consumerCount: record.readCount,
    writerCount: record.writeCount,
    consumerLayers: [...new Set(readablePaths.map(item => item.layer))].sort(),
    consumerEvidence,
  };
}

function serializeObservations(store, consumers, scope) {
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
      ...serializeConsumer(consumers.get(`${scope}:${record.key}`)),
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

  const consumerDiscovery = discoverConsumers(repository, {
    unitKeys: new Set(unitParameters.keys()),
    weaponKeys: new Set(weaponParameters.keys()),
  });
  const unit = serializeObservations(unitParameters, consumerDiscovery.consumers, 'unit');
  const weapon = serializeObservations(weaponParameters, consumerDiscovery.consumers, 'weapon');
  const consumerOnly = [...consumerDiscovery.consumers.values()]
    .filter(record => record.readCount > 0 && (
      record.scope === 'unit' ? !unitParameters.has(record.key) : !weaponParameters.has(record.key)
    ))
    .sort((left, right) => left.scope.localeCompare(right.scope) || left.key.localeCompare(right.key, 'en'))
    .map(record => ({
      key: record.key,
      scope: record.scope,
      declared: false,
      ...serializeConsumer(record),
    }));
  const unresolvedConsumers = [...consumerDiscovery.unresolved.values()]
    .sort((left, right) => left.key.localeCompare(right.key, 'en'))
    .map(record => ({
      key: record.key,
      occurrences: record.occurrences,
      sourcePaths: [...record.sourcePaths].sort().slice(0, 8),
    }));
  return {
    version: 2,
    sourceRepository: 'beyond-all-reason/Beyond-All-Reason',
    sourceCommit,
    counts: {
      scannedUnitFiles: files.length,
      unitParameters: unit.length,
      weaponParameters: weapon.length,
      totalParameters: unit.length + weapon.length,
      scannedConsumerFiles: consumerDiscovery.scannedFiles,
      unitParametersWithConsumers: unit.filter(parameter => parameter.consumerCount > 0).length,
      weaponParametersWithConsumers: weapon.filter(parameter => parameter.consumerCount > 0).length,
      unresolvedConsumerKeys: unresolvedConsumers.length,
      consumerOnlyParameters: consumerOnly.length,
    },
    parameters: { unit, weapon },
    consumerOnly,
    unresolvedConsumers,
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
  console.log(`  Consumer-backed keys: ${discovery.counts.unitParametersWithConsumers} unit / ${discovery.counts.weaponParametersWithConsumers} weapon`);
  console.log(`  Consumer-only keys: ${discovery.counts.consumerOnlyParameters}`);
  console.log(`  Unresolved consumer keys: ${discovery.counts.unresolvedConsumerKeys}`);
}
