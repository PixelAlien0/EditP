import { compareBarbarianAiPackages } from './barbarianAiVersionComparison.js';

export const AI_MIGRATION_PLAN_VERSION = 1;

const STAGES = Object.freeze([
  ['identity', 'Package identity', 'Decide how the new package will coexist with or replace the baseline.'],
  ['configuration', 'Configuration migration', 'Reconcile lobby options, profile routes, and referenced units.'],
  ['runtime', 'Runtime verification', 'Treat changed native runtimes as opaque artifacts that require a fresh BAR test.'],
  ['validation', 'Game validation', 'Install locally and record a clean, version-specific smoke test before release.'],
]);

function action(id, stage, status, title, detail, evidence = '') {
  return { id, stage, status, title, detail, evidence };
}

function identityActions(comparison) {
  return comparison.identity.filter(item => item.changed).map(item => action(
    `identity:${item.field}`,
    'identity',
    item.field === 'shortName' ? 'decision' : 'review',
    `Review changed ${item.field}`,
    item.field === 'shortName'
      ? 'A changed short name can create a separate AI identity. Confirm whether this is an upgrade or a side-by-side package before installation.'
      : 'Confirm the new literal package metadata is intentional and suitable for the release record.',
    `${item.previous || 'Not set'} -> ${item.current || 'Not set'}`,
  ));
}

function configurationActions(comparison) {
  const actions = [];
  if (comparison.options.removed.length) actions.push(action(
    'options:removed', 'configuration', 'review', 'Migrate removed lobby options',
    'Saved lobby configurations may still contain these keys. Map, replace, or deliberately retire them.',
    comparison.options.removed.join(', '),
  ));
  if (comparison.options.added.length) actions.push(action(
    'options:added', 'configuration', 'verify', 'Verify new lobby options',
    'Check defaults, ranges, and labels before exposing the new options to players.',
    comparison.options.added.join(', '),
  ));

  comparison.surfaces.filter(item => item.status !== 'unchanged').forEach(item => actions.push(action(
    `surface:${item.id}`, 'configuration', item.status === 'removed' ? 'review' : 'verify',
    `${item.status === 'removed' ? 'Retire' : 'Verify'} ${item.label}`,
    `The discovered profile route changed from ${item.previousCount} to ${item.currentCount} files. Confirm the intended profiles still reach this surface.`,
    [...item.files.added.map(file => `+ ${file}`), ...item.files.removed.map(file => `- ${file}`)].join('; '),
  )));

  if (comparison.references.referenced.removed.length) actions.push(action(
    'references:removed', 'configuration', 'review', 'Review removed unit references',
    'Confirm these removals are intentional and do not leave production, role, or response profiles incomplete.',
    comparison.references.referenced.removed.join(', '),
  ));
  if (comparison.references.referenced.added.length) actions.push(action(
    'references:added', 'configuration', 'verify', 'Verify newly referenced units',
    'Check that each new unit is available in the target BAR snapshot and belongs in the intended AI role.',
    comparison.references.referenced.added.join(', '),
  ));
  if (comparison.references.unresolved.added.length) actions.push(action(
    'references:unresolved', 'configuration', 'blocked', 'Resolve new unknown unit references',
    'The current BAR snapshot cannot resolve these unit IDs. Repair or intentionally package their definitions before release.',
    comparison.references.unresolved.added.join(', '),
  ));
  if (comparison.references.unresolved.removed.length) actions.push(action(
    'references:resolved', 'configuration', 'verified', 'Confirm resolved unit references',
    'These previously unknown references now resolve. Retain the resolution evidence in the release review.',
    comparison.references.unresolved.removed.join(', '),
  ));
  return actions;
}

function runtimeActions(comparison) {
  return comparison.runtimes.filter(item => item.status !== 'unchanged').map(item => action(
    `runtime:${item.path.toLowerCase()}`,
    'runtime',
    item.status === 'removed' ? 'review' : 'verify',
    `${item.status === 'removed' ? 'Review removed' : 'Test changed'} runtime artifact`,
    'BAR Editor fingerprints native files but never loads them. Run this exact package build inside a disposable BAR installation.',
    `${item.status}: ${item.path}`,
  ));
}

function findingActions(comparison) {
  return comparison.findings.filter(item => item.status !== 'unchanged').map(item => {
    const isNewBlocker = item.status === 'added' && item.currentSeverity === 'blocker';
    const isResolved = item.status === 'resolved';
    return action(
      `finding:${item.id}`,
      'validation',
      isNewBlocker ? 'blocked' : isResolved ? 'verified' : 'review',
      isResolved ? `Confirm resolved finding: ${item.title}` : `Review compatibility finding: ${item.title}`,
      isResolved
        ? 'The current static audit no longer reports this issue. Confirm the related behavior during the BAR smoke test.'
        : 'Resolve or explicitly accept this compatibility change before releasing the upgraded package.',
      `${item.previousSeverity || 'none'} -> ${item.currentSeverity || 'resolved'}`,
    );
  });
}

export function buildAiUpgradeMigrationPlan(previousAudit, currentAudit) {
  const comparison = compareBarbarianAiPackages(previousAudit, currentAudit);
  const actions = [
    ...identityActions(comparison),
    ...configurationActions(comparison),
    ...runtimeActions(comparison),
    ...findingActions(comparison),
  ];

  actions.push(action(
    'validation:fresh-smoke-test', 'validation', 'verify', 'Run a fresh BAR smoke test',
    'Install the current package separately, exercise its lobby options and representative profiles, then record results against the current package fingerprint.',
  ));

  const stages = STAGES.map(([id, label, description]) => ({
    id,
    label,
    description,
    actions: actions.filter(item => item.stage === id),
  })).filter(stage => stage.actions.length);
  const summary = {
    total: actions.length,
    blocked: actions.filter(item => item.status === 'blocked').length,
    decisions: actions.filter(item => item.status === 'decision').length,
    reviews: actions.filter(item => item.status === 'review').length,
    verifies: actions.filter(item => item.status === 'verify').length,
    verified: actions.filter(item => item.status === 'verified').length,
  };
  const verdict = summary.blocked ? 'blocked' : summary.decisions || summary.reviews ? 'review' : 'ready';

  return {
    kind: 'editp-skirmish-ai-migration-plan',
    version: AI_MIGRATION_PLAN_VERSION,
    verdict,
    baseline: comparison.baseline,
    current: comparison.current,
    comparisonVerdict: comparison.verdict,
    summary,
    stages,
  };
}

export function buildAiUpgradeMigrationChecklist(previousAudit, currentAudit) {
  const plan = buildAiUpgradeMigrationPlan(previousAudit, currentAudit);
  const lines = [
    `${plan.baseline.name} ${plan.baseline.version} -> ${plan.current.name} ${plan.current.version}`,
    `Migration verdict: ${plan.verdict}`,
    `Actions: ${plan.summary.total} (${plan.summary.blocked} blocked, ${plan.summary.decisions} decisions, ${plan.summary.reviews} review, ${plan.summary.verifies} verify)`,
  ];
  plan.stages.forEach(stage => {
    lines.push('', stage.label);
    stage.actions.forEach(item => {
      lines.push(`- [${item.status.toUpperCase()}] ${item.title}`);
      lines.push(`  ${item.detail}`);
      if (item.evidence) lines.push(`  Evidence: ${item.evidence}`);
    });
  });
  lines.push('', 'Static migration plan only. Imported package code was not executed.');
  return lines.join('\n');
}
