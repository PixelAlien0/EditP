import { buildAiCompatibilityReport } from './barbarianAiCompatibilityReport.js';

export const AI_SMOKE_TEST_RECORD_VERSION = 1;

const RESULT_VALUES = new Set(['pending', 'passed', 'failed', 'skipped']);

const TEST_PROTOCOL = Object.freeze([
  {
    id: 'package-discovery',
    label: 'Package discovery',
    description: 'BAR lists the audited AI under its expected short name and version after restart.',
    critical: true,
  },
  {
    id: 'lobby-options',
    label: 'Lobby options',
    description: 'Recognized package options appear, accept valid values, and retain their selections.',
    critical: false,
  },
  {
    id: 'match-start',
    label: 'Match startup',
    description: 'A small offline skirmish reaches live gameplay without an AI initialization failure.',
    critical: true,
  },
  {
    id: 'opening-orders',
    label: 'Opening behavior',
    description: 'The AI issues orders, constructs units, and advances beyond its initial state.',
    critical: true,
  },
  {
    id: 'profile-overlay',
    label: 'Profile overlay',
    description: 'Edited profile values load from their preserved relative paths and visibly affect behavior.',
    critical: false,
    profileOnly: true,
  },
  {
    id: 'engine-log',
    label: 'Engine log review',
    description: 'The test produces no package-load, native-runtime, or repeated script errors.',
    critical: true,
  },
  {
    id: 'restart-repeat',
    label: 'Restart repeatability',
    description: 'A second BAR launch discovers the same package and reproduces the tested setup.',
    critical: false,
  },
]);

function cleanText(value, limit = 4000) {
  const cleaned = Array.from(String(value || ''), character => {
    const code = character.codePointAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127) ? character : '';
  }).join('');
  return cleaned.trim().slice(0, limit);
}

function normalizeResult(value) {
  return RESULT_VALUES.has(value) ? value : 'pending';
}

export function buildAiSmokeTestProtocol(audit) {
  if (!audit) throw new Error('An AI package audit is required.');
  const report = buildAiCompatibilityReport(audit);
  const includeProfileTest = (audit.parsedProfileCount || 0) > 0;

  return {
    package: {
      name: report.package.name,
      shortName: report.package.shortName,
      version: report.package.version,
      fingerprint: report.package.fingerprint,
    },
    tests: TEST_PROTOCOL
      .filter(test => !test.profileOnly || includeProfileTest)
      .map(({ profileOnly: _profileOnly, ...test }) => ({ ...test })),
  };
}

export function createAiSmokeTestRecord(audit) {
  const protocol = buildAiSmokeTestProtocol(audit);
  return {
    environment: {
      platform: '',
      barVersion: '',
      engineVersion: '',
      mapName: '',
    },
    results: Object.fromEntries(protocol.tests.map(test => [test.id, { status: 'pending', note: '' }])),
    notes: '',
  };
}

export function normalizeAiSmokeTestRecord(audit, input = {}) {
  const empty = createAiSmokeTestRecord(audit);
  const sourceEnvironment = input.environment || {};
  const sourceResults = input.results || {};

  return {
    environment: {
      platform: cleanText(sourceEnvironment.platform, 40),
      barVersion: cleanText(sourceEnvironment.barVersion, 120),
      engineVersion: cleanText(sourceEnvironment.engineVersion, 120),
      mapName: cleanText(sourceEnvironment.mapName, 160),
    },
    results: Object.fromEntries(Object.keys(empty.results).map(id => [id, {
      status: normalizeResult(sourceResults[id]?.status),
      note: cleanText(sourceResults[id]?.note, 1000),
    }])),
    notes: cleanText(input.notes, 4000),
  };
}

export function summarizeAiSmokeTestRecord(audit, input = {}) {
  const protocol = buildAiSmokeTestProtocol(audit);
  const record = normalizeAiSmokeTestRecord(audit, input);
  const totals = { total: protocol.tests.length, pending: 0, passed: 0, failed: 0, skipped: 0 };
  let criticalFailures = 0;

  protocol.tests.forEach(test => {
    const status = record.results[test.id].status;
    totals[status] += 1;
    if (test.critical && status === 'failed') criticalFailures += 1;
  });

  const verdict = criticalFailures > 0 || totals.failed > 0
    ? 'failed'
    : totals.pending > 0
      ? 'incomplete'
      : 'passed';

  return { verdict, criticalFailures, ...totals };
}

export function buildAiSmokeTestReport(audit, input = {}) {
  const protocol = buildAiSmokeTestProtocol(audit);
  const record = normalizeAiSmokeTestRecord(audit, input);
  const summary = summarizeAiSmokeTestRecord(audit, record);

  return {
    kind: 'editp-skirmish-ai-smoke-test-report',
    version: AI_SMOKE_TEST_RECORD_VERSION,
    generatedBy: 'BAR Editor',
    safety: {
      manualEvidenceOnly: true,
      importedCodeExecuted: false,
      sourceContentsIncluded: false,
      nativeBinariesIncluded: false,
    },
    package: protocol.package,
    environment: record.environment,
    summary,
    tests: protocol.tests.map(test => ({
      id: test.id,
      label: test.label,
      critical: test.critical,
      status: record.results[test.id].status,
      note: record.results[test.id].note,
    })),
    notes: record.notes,
  };
}

export function serializeAiSmokeTestReport(audit, input = {}) {
  return `${JSON.stringify(buildAiSmokeTestReport(audit, input), null, 2)}\n`;
}

export function buildAiSmokeTestSummary(audit, input = {}) {
  const report = buildAiSmokeTestReport(audit, input);
  return [
    `${report.package.name} - Runtime smoke test`,
    `Verdict: ${report.summary.verdict}`,
    `Package fingerprint: ${report.package.fingerprint}`,
    `Passed: ${report.summary.passed}/${report.summary.total}`,
    `Failed: ${report.summary.failed}`,
    `Pending: ${report.summary.pending}`,
    '',
    ...report.tests.map(test => `[${test.status.toUpperCase()}] ${test.label}${test.note ? ` - ${test.note}` : ''}`),
    '',
    'Manual evidence recorded by BAR Editor; imported AI code was not executed in the browser.',
  ].join('\n');
}
