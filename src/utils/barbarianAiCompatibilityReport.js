import { stableContentHash } from './barbarianAiPackage.js';

export const AI_COMPATIBILITY_REPORT_VERSION = 1;

function check(id, label, status, summary, evidence = []) {
  return {
    id,
    label,
    status,
    summary,
    evidence: evidence.filter(Boolean),
  };
}

function packageFingerprint(files = []) {
  const signature = [...files]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(file => `${file.path}\u0000${file.size}\u0000${file.hash}`)
    .join('\n');
  return stableContentHash(signature);
}

function buildChecks(audit) {
  const identity = audit.contract?.identity || {};
  const hasIdentity = Boolean(identity.name || identity.shortName);
  const runtimeCount = audit.totals?.nativeFiles || 0;
  const profileCount = audit.parsedProfileCount || 0;
  const invalidProfiles = audit.findings.filter(item => item.id.startsWith('invalid-config:'));
  const optionReview = audit.findings.find(item => item.id === 'unknown-options');
  const unresolved = audit.references?.unresolved || [];

  return [
    check(
      'identity',
      'Package identity',
      hasIdentity ? 'passed' : 'blocked',
      hasIdentity ? 'A discoverable Skirmish AI identity is present.' : 'AIInfo.lua did not provide a usable package identity.',
      [identity.name, identity.shortName, identity.version].filter(Boolean),
    ),
    check(
      'runtime',
      'Runtime route',
      runtimeCount ? 'passed' : 'review',
      runtimeCount
        ? `${runtimeCount} native runtime ${runtimeCount === 1 ? 'file was' : 'files were'} fingerprinted without being loaded.`
        : 'No native runtime was discovered; confirm that the package is intentionally script-only.',
      (audit.contract?.runtimeFingerprints || []).map(item => `${item.path} · ${item.hash}`),
    ),
    check(
      'profiles',
      'Profile parsing',
      invalidProfiles.length ? 'blocked' : profileCount ? 'passed' : 'review',
      invalidProfiles.length
        ? `${invalidProfiles.length} profile ${invalidProfiles.length === 1 ? 'file could' : 'files could'} not be parsed safely.`
        : profileCount
          ? `${profileCount} JSONC ${profileCount === 1 ? 'profile was' : 'profiles were'} parsed statically.`
          : 'No parseable JSONC profile was discovered.',
      (audit.contract?.profileSurfaces || []).map(surface => `${surface.label}: ${surface.files.length}`),
    ),
    check(
      'lobby-options',
      'Lobby options',
      optionReview ? 'review' : 'passed',
      optionReview
        ? 'The package exposes options outside the currently pinned BARbarIAn contract.'
        : `${audit.contract?.optionKeys?.length || 0} lobby option keys match the understood contract surface.`,
      audit.contract?.optionKeys || [],
    ),
    check(
      'unit-references',
      'BAR unit references',
      unresolved.length ? 'review' : 'passed',
      unresolved.length
        ? `${unresolved.length} BAR-shaped unit ${unresolved.length === 1 ? 'ID is' : 'IDs are'} absent from the pinned editor snapshot.`
        : `${audit.references?.referenced?.length || 0} discovered unit references resolve against the pinned snapshot.`,
      unresolved,
    ),
  ];
}

function buildRecommendations(checks) {
  const recommendations = [];
  const byId = Object.fromEntries(checks.map(item => [item.id, item]));
  if (byId.identity.status === 'blocked') recommendations.push('Add or repair AIInfo.lua before distributing the package.');
  if (byId.runtime.status === 'review') recommendations.push('Confirm the expected platform runtime and package it for every target operating system.');
  if (byId.profiles.status === 'blocked') recommendations.push('Repair invalid JSONC profiles, then run the audit again.');
  if (byId.profiles.status === 'review') recommendations.push('Confirm whether this AI intentionally ships without editable JSONC profiles.');
  if (byId['lobby-options'].status === 'review') recommendations.push('Review additional lobby options for defaults, value ranges, and backward compatibility.');
  if (byId['unit-references'].status === 'review') recommendations.push('Replace stale unit IDs or document the game package that supplies them.');
  recommendations.push('Run an in-game skirmish smoke test; static inspection cannot execute or prove native AI behavior.');
  return recommendations;
}

export function buildAiCompatibilityReport(audit) {
  if (!audit) throw new Error('An AI package audit is required.');
  const checks = buildChecks(audit);
  const findings = audit.findings.map(item => ({
    id: item.id,
    severity: item.severity,
    title: item.title,
    description: item.description,
    ...(item.path ? { path: item.path } : {}),
  }));

  return {
    kind: 'editp-skirmish-ai-compatibility-report',
    version: AI_COMPATIBILITY_REPORT_VERSION,
    generatedBy: 'BAR Editor',
    safety: {
      inspectionMode: 'static-only',
      importedCodeExecuted: false,
      sourceFilesIncluded: false,
      nativeBinariesIncluded: false,
    },
    package: {
      name: audit.contract?.identity?.name || audit.contract?.identity?.shortName || 'Unidentified Skirmish AI',
      shortName: audit.contract?.identity?.shortName || '',
      version: audit.contract?.identity?.version || '',
      fingerprint: packageFingerprint(audit.files),
      files: audit.totals.files,
      bytes: audit.totals.bytes,
    },
    verdict: audit.compatibility,
    summary: {
      blockers: audit.totals.blockers,
      reviews: audit.totals.reviews,
      notes: audit.totals.notes,
      checksPassed: checks.filter(item => item.status === 'passed').length,
      checksTotal: checks.length,
    },
    contract: {
      id: audit.contract.id,
      version: audit.contract.version,
      profileSurfaces: audit.contract.profileSurfaces.map(surface => ({
        id: surface.id,
        label: surface.label,
        fileCount: surface.files.length,
      })),
      optionKeys: [...audit.contract.optionKeys],
      scriptRouteCount: audit.contract.scriptRoutes.length,
      runtimeFingerprints: audit.contract.runtimeFingerprints.map(item => ({ ...item })),
    },
    checks,
    findings,
    recommendations: buildRecommendations(checks),
  };
}

export function serializeAiCompatibilityReport(audit) {
  return `${JSON.stringify(buildAiCompatibilityReport(audit), null, 2)}\n`;
}

export function buildAiCompatibilitySummary(audit) {
  const report = buildAiCompatibilityReport(audit);
  const verdict = report.verdict === 'compatible' ? 'Compatible' : report.verdict === 'review' ? 'Review required' : 'Blocked';
  const lines = [
    `${report.package.name} — ${verdict}`,
    `Package fingerprint: ${report.package.fingerprint}`,
    `Checks: ${report.summary.checksPassed}/${report.summary.checksTotal} passed · ${report.summary.blockers} blockers · ${report.summary.reviews} review items`,
    ...report.checks.map(item => `${item.status === 'passed' ? 'PASS' : item.status === 'blocked' ? 'BLOCK' : 'REVIEW'} · ${item.label}: ${item.summary}`),
    '',
    'Next actions:',
    ...report.recommendations.map(item => `- ${item}`),
    '',
    'Static BAR Editor report. Imported code was not executed; in-game testing is still required.',
  ];
  return lines.join('\n');
}
