import { strToU8, zipSync } from 'fflate';
import { buildAiCompatibilityReport } from './barbarianAiCompatibilityReport.js';
import { buildAiDeploymentPlan } from './barbarianAiDeploymentPlan.js';
import { buildAiSmokeTestReport } from './barbarianAiSmokeTest.js';

export const AI_RELEASE_DOSSIER_VERSION = 1;

function safeFileName(value) {
  return String(value || 'ai-package')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'ai-package';
}

function sanitizedCheck(item) {
  return {
    id: item.id,
    label: item.label || item.id,
    status: item.status,
    summary: item.summary,
  };
}

function sourcePathRedactor(audit) {
  const paths = (audit.files || [])
    .map(file => String(file.path || '').trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  return value => paths.reduce(
    (text, path) => text.replaceAll(path, '[source path]'),
    String(value || ''),
  );
}

function releaseGate(id, label, status, detail) {
  return { id, label, status, detail };
}

function runtimeGateStatus(smokeTest) {
  if (smokeTest.summary.verdict === 'failed') return 'blocked';
  if (smokeTest.summary.verdict !== 'passed') return 'review';
  return smokeTest.tests
    .filter(test => test.critical)
    .every(test => test.status === 'passed')
    ? 'passed'
    : 'review';
}

function dossierStatus(gates) {
  if (gates.some(gate => gate.status === 'blocked')) return 'blocked';
  if (gates.some(gate => gate.status === 'review')) return 'review';
  return 'verified';
}

export function buildAiReleaseDossier(audit, smokeInput = {}) {
  if (!audit) throw new Error('An AI package audit is required.');

  const compatibility = buildAiCompatibilityReport(audit);
  const deployment = buildAiDeploymentPlan(audit);
  const smokeTest = buildAiSmokeTestReport(audit, smokeInput);
  const redactSourcePaths = sourcePathRedactor(audit);
  const runtimeStatus = runtimeGateStatus(smokeTest);
  const gates = [
    releaseGate(
      'compatibility',
      'Static compatibility',
      compatibility.verdict === 'incompatible' ? 'blocked' : compatibility.verdict === 'review' ? 'review' : 'passed',
      `${compatibility.summary.checksPassed}/${compatibility.summary.checksTotal} static checks passed.`,
    ),
    releaseGate(
      'deployment',
      'Deployment readiness',
      deployment.readiness === 'blocked' ? 'blocked' : deployment.readiness === 'review' ? 'review' : 'passed',
      deployment.readiness === 'ready' ? `Target route: ${deployment.destination}` : 'Installation plan still needs review.',
    ),
    releaseGate(
      'runtime',
      'BAR runtime verification',
      runtimeStatus,
      runtimeStatus === 'passed'
        ? `${smokeTest.summary.passed}/${smokeTest.summary.total} manual checks passed; every critical check passed explicitly.`
        : `${smokeTest.summary.passed}/${smokeTest.summary.total} manual checks passed; every critical check must be marked passed.`,
    ),
  ];
  const status = dossierStatus(gates);

  return {
    kind: 'editp-skirmish-ai-release-dossier',
    version: AI_RELEASE_DOSSIER_VERSION,
    generatedBy: 'BAR Editor',
    safety: {
      evidenceOnly: true,
      importedCodeExecuted: false,
      sourceContentsIncluded: false,
      sourcePathsIncluded: false,
      nativeBinariesIncluded: false,
      installablePackageIncluded: false,
    },
    package: { ...compatibility.package },
    status,
    gates,
    summary: {
      passed: gates.filter(gate => gate.status === 'passed').length,
      reviews: gates.filter(gate => gate.status === 'review').length,
      blockers: gates.filter(gate => gate.status === 'blocked').length,
      total: gates.length,
    },
    evidence: {
      compatibility: {
        verdict: compatibility.verdict,
        summary: compatibility.summary,
        checks: compatibility.checks.map(sanitizedCheck),
        findings: compatibility.findings.map(item => ({
          id: redactSourcePaths(item.id),
          severity: item.severity,
          title: redactSourcePaths(item.title),
          description: redactSourcePaths(item.description),
        })),
        recommendations: [...compatibility.recommendations],
      },
      deployment: {
        readiness: deployment.readiness,
        destination: deployment.destination,
        platformCoverage: deployment.coverage.map(item => ({
          id: item.id,
          label: item.label,
          status: item.status,
          fileCount: item.files.length,
        })),
        parsedProfiles: deployment.profiles.parsed,
        checks: deployment.checks.map(sanitizedCheck),
        steps: [...deployment.steps],
        cautions: [...deployment.cautions],
      },
      runtimeSmokeTest: smokeTest,
    },
  };
}

export function serializeAiReleaseDossier(audit, smokeInput = {}) {
  return `${JSON.stringify(buildAiReleaseDossier(audit, smokeInput), null, 2)}\n`;
}

export function buildAiReleaseSummary(audit, smokeInput = {}) {
  const dossier = buildAiReleaseDossier(audit, smokeInput);
  const label = dossier.status === 'verified' ? 'Verified evidence' : dossier.status === 'blocked' ? 'Release blocked' : 'Review required';
  return [
    `${dossier.package.name} - Release dossier`,
    `Status: ${label}`,
    `Package fingerprint: ${dossier.package.fingerprint}`,
    `Gates: ${dossier.summary.passed}/${dossier.summary.total} passed`,
    '',
    ...dossier.gates.map(gate => `[${gate.status.toUpperCase()}] ${gate.label} - ${gate.detail}`),
    '',
    'Evidence-only BAR Editor dossier. Imported source, native binaries, and installable package files are excluded.',
  ].join('\n');
}

export function buildAiReleaseBundle(audit, smokeInput = {}) {
  const dossier = buildAiReleaseDossier(audit, smokeInput);
  const fixedEntryOptions = { mtime: new Date('2000-01-01T12:00:00.000Z') };
  const entry = value => [strToU8(value), fixedEntryOptions];
  const files = {
    'release-dossier.json': entry(`${JSON.stringify(dossier, null, 2)}\n`),
    'compatibility-evidence.json': entry(`${JSON.stringify(dossier.evidence.compatibility, null, 2)}\n`),
    'deployment-evidence.json': entry(`${JSON.stringify(dossier.evidence.deployment, null, 2)}\n`),
    'runtime-smoke-test.json': entry(`${JSON.stringify(dossier.evidence.runtimeSmokeTest, null, 2)}\n`),
    'README.txt': entry(`${buildAiReleaseSummary(audit, smokeInput)}\n`),
  };

  return {
    bytes: zipSync(files, { level: 6 }),
    filename: `${safeFileName(dossier.package.shortName || dossier.package.name)}-release-dossier.zip`,
    status: dossier.status,
    dossier,
  };
}
