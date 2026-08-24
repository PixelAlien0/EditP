import { buildAiCompatibilityReport } from './barbarianAiCompatibilityReport.js';

export const AI_DEPLOYMENT_PLAN_VERSION = 1;

const PLATFORM_ROUTES = Object.freeze([
  { id: 'windows', label: 'Windows', extension: /\.dll$/i },
  { id: 'linux', label: 'Linux', extension: /\.so$/i },
  { id: 'macos', label: 'macOS', extension: /\.dylib$/i },
]);

function safePathSegment(value, fallback = '') {
  const normalized = String(value || '')
    .normalize('NFKC')
    .split('')
    .map(character => character.charCodeAt(0) < 32 ? '-' : character)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .replace(/\s+/g, '-');
  return normalized || fallback;
}

function runtimeCoverage(runtimeFingerprints = []) {
  return PLATFORM_ROUTES.map(platform => {
    const files = runtimeFingerprints
      .filter(runtime => platform.extension.test(runtime.path))
      .map(runtime => ({ path: runtime.path, size: runtime.size, hash: runtime.hash }))
      .sort((left, right) => left.path.localeCompare(right.path));
    return {
      id: platform.id,
      label: platform.label,
      status: files.length ? 'present' : 'missing',
      files,
    };
  });
}

function determineReadiness(audit, shortName, version, coverage) {
  if (!shortName || audit.compatibility === 'incompatible') return 'blocked';
  if (!version || audit.compatibility === 'review' || coverage.every(platform => platform.status === 'missing')) return 'review';
  return 'ready';
}

export function buildAiDeploymentPlan(audit) {
  if (!audit) throw new Error('An AI package audit is required.');

  const report = buildAiCompatibilityReport(audit);
  const identity = audit.contract?.identity || {};
  const shortName = safePathSegment(identity.shortName);
  const version = safePathSegment(identity.version, 'unversioned');
  const coverage = runtimeCoverage(audit.contract?.runtimeFingerprints || []);
  const readiness = determineReadiness(audit, shortName, identity.version, coverage);
  const destination = shortName ? `AI/Skirmish/${shortName}/${version}` : 'AI/Skirmish/<shortName>/<version>';
  const profileFiles = (audit.contract?.profileSurfaces || [])
    .flatMap(surface => surface.files.map(path => ({ surface: surface.id, path })))
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    kind: 'editp-skirmish-ai-deployment-plan',
    version: AI_DEPLOYMENT_PLAN_VERSION,
    generatedBy: 'BAR Editor',
    safety: {
      planOnly: true,
      packageInstalled: false,
      importedCodeExecuted: false,
      sourceContentsIncluded: false,
      nativeBinariesIncluded: false,
    },
    package: {
      name: identity.name || identity.shortName || 'Unidentified Skirmish AI',
      shortName: identity.shortName || '',
      version: identity.version || '',
      fingerprint: report.package.fingerprint,
      files: audit.totals.files,
      bytes: audit.totals.bytes,
    },
    readiness,
    destination,
    coverage,
    profiles: {
      parsed: audit.parsedProfileCount || 0,
      files: profileFiles,
    },
    checks: report.checks.map(item => ({ id: item.id, status: item.status, summary: item.summary })),
    steps: [
      'Back up any existing AI package folder with the same short name and version.',
      `Create the target package folder: ${destination}.`,
      'Copy the original audited package into the target folder without renaming its internal files.',
      'If a profile overlay was exported from Profile Composer, apply it over the copied package while preserving relative paths.',
      'Restart BAR so the engine refreshes its Skirmish AI discovery list.',
      'Create a small offline skirmish, select the AI, and verify its lobby options before starting.',
      'Run a short smoke test and inspect the engine log for load, profile, or native-runtime errors.',
    ],
    cautions: [
      'This manifest does not contain or install the imported package.',
      'Profile edits require the original compatible AI runtime; they do not create a new AI by themselves.',
      'A BAR engine update can replace versioned engine folders, so locally installed packages may need to be copied again.',
      'Every multiplayer participant must have a compatible package and game setup when the AI is used outside a local skirmish.',
    ],
  };
}

export function serializeAiDeploymentPlan(audit) {
  return `${JSON.stringify(buildAiDeploymentPlan(audit), null, 2)}\n`;
}

export function buildAiDeploymentChecklist(audit) {
  const plan = buildAiDeploymentPlan(audit);
  return [
    `${plan.package.name} - Deployment Plan`,
    `Readiness: ${plan.readiness}`,
    `Package fingerprint: ${plan.package.fingerprint}`,
    `Target: ${plan.destination}`,
    `Runtime coverage: ${plan.coverage.map(item => `${item.label} ${item.status}`).join(', ')}`,
    '',
    ...plan.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    'Safety notes:',
    ...plan.cautions.map(item => `- ${item}`),
  ].join('\n');
}
