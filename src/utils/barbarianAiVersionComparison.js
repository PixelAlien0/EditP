export const AI_VERSION_COMPARISON_VERSION = 1;

const IDENTITY_FIELDS = Object.freeze(['shortName', 'name', 'version', 'description']);

function text(value) {
  return String(value ?? '').trim();
}

function sortedUnique(values) {
  return [...new Set((values || []).map(text).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function compareValues(previousValues, currentValues) {
  const previous = sortedUnique(previousValues);
  const current = sortedUnique(currentValues);
  const previousSet = new Set(previous);
  const currentSet = new Set(current);
  return {
    added: current.filter(value => !previousSet.has(value)),
    removed: previous.filter(value => !currentSet.has(value)),
    retained: current.filter(value => previousSet.has(value)),
  };
}

function compareIdentity(previousAudit, currentAudit) {
  const previous = previousAudit.contract?.identity || {};
  const current = currentAudit.contract?.identity || {};
  return IDENTITY_FIELDS.map(field => ({
    field,
    previous: text(previous[field]),
    current: text(current[field]),
    changed: text(previous[field]) !== text(current[field]),
  }));
}

function compareProfileSurfaces(previousAudit, currentAudit) {
  const previous = new Map((previousAudit.contract?.profileSurfaces || []).map(surface => [surface.id, surface]));
  const current = new Map((currentAudit.contract?.profileSurfaces || []).map(surface => [surface.id, surface]));
  const ids = sortedUnique([...previous.keys(), ...current.keys()]);

  return ids.map(id => {
    const before = previous.get(id);
    const after = current.get(id);
    const files = compareValues(before?.files, after?.files);
    const status = !before ? 'added' : !after ? 'removed' : files.added.length || files.removed.length ? 'changed' : 'unchanged';
    return {
      id,
      label: after?.label || before?.label || id,
      status,
      files,
      previousCount: before?.files?.length || 0,
      currentCount: after?.files?.length || 0,
    };
  });
}

function compareRuntimeFingerprints(previousAudit, currentAudit) {
  const toMap = audit => new Map((audit.contract?.runtimeFingerprints || []).map(runtime => [text(runtime.path).toLowerCase(), runtime]));
  const previous = toMap(previousAudit);
  const current = toMap(currentAudit);
  const paths = sortedUnique([...previous.keys(), ...current.keys()]);

  return paths.map(path => {
    const before = previous.get(path);
    const after = current.get(path);
    return {
      path: after?.path || before?.path || path,
      status: !before ? 'added' : !after ? 'removed' : before.hash !== after.hash ? 'changed' : 'unchanged',
      previousHash: before?.hash || '',
      currentHash: after?.hash || '',
      previousSize: before?.size || 0,
      currentSize: after?.size || 0,
    };
  });
}

function compareFindings(previousAudit, currentAudit) {
  const previous = new Map((previousAudit.findings || []).map(item => [item.id, item]));
  const current = new Map((currentAudit.findings || []).map(item => [item.id, item]));
  const ids = sortedUnique([...previous.keys(), ...current.keys()]);
  return ids.map(id => {
    const before = previous.get(id);
    const after = current.get(id);
    return {
      id,
      title: after?.title || before?.title || id,
      status: !before ? 'added' : !after ? 'resolved' : before.severity !== after.severity ? 'changed' : 'unchanged',
      previousSeverity: before?.severity || '',
      currentSeverity: after?.severity || '',
    };
  });
}

function comparisonVerdict(currentAudit, comparison) {
  if (currentAudit.compatibility === 'incompatible') return 'blocked';
  const shortNameChanged = comparison.identity.some(item => item.field === 'shortName' && item.changed);
  const runtimeChanged = comparison.runtimes.some(item => item.status !== 'unchanged');
  const newReviewFinding = comparison.findings.some(item => item.status === 'added' && ['blocker', 'review'].includes(item.currentSeverity));
  const moreUnresolved = comparison.references.unresolved.added.length > 0;
  return shortNameChanged || runtimeChanged || newReviewFinding || moreUnresolved ? 'review' : 'compatible';
}

export function compareBarbarianAiPackages(previousAudit, currentAudit) {
  if (!previousAudit || !currentAudit) throw new Error('Both a baseline and current AI package audit are required.');

  const comparison = {
    identity: compareIdentity(previousAudit, currentAudit),
    options: compareValues(previousAudit.contract?.optionKeys, currentAudit.contract?.optionKeys),
    surfaces: compareProfileSurfaces(previousAudit, currentAudit),
    runtimes: compareRuntimeFingerprints(previousAudit, currentAudit),
    references: {
      referenced: compareValues(previousAudit.references?.referenced, currentAudit.references?.referenced),
      unresolved: compareValues(previousAudit.references?.unresolved, currentAudit.references?.unresolved),
    },
    findings: compareFindings(previousAudit, currentAudit),
  };
  const changedSurfaces = comparison.surfaces.filter(item => item.status !== 'unchanged').length;
  const changedRuntimes = comparison.runtimes.filter(item => item.status !== 'unchanged').length;
  const changedIdentity = comparison.identity.filter(item => item.changed).length;
  const findingChanges = comparison.findings.filter(item => item.status !== 'unchanged').length;
  const optionChanges = comparison.options.added.length + comparison.options.removed.length;
  const referenceChanges = comparison.references.referenced.added.length
    + comparison.references.referenced.removed.length
    + comparison.references.unresolved.added.length
    + comparison.references.unresolved.removed.length;

  return {
    kind: 'editp-skirmish-ai-version-comparison',
    version: AI_VERSION_COMPARISON_VERSION,
    verdict: comparisonVerdict(currentAudit, comparison),
    baseline: {
      name: previousAudit.contract?.identity?.name || previousAudit.contract?.identity?.shortName || 'Baseline package',
      version: previousAudit.contract?.identity?.version || 'Unknown',
      files: previousAudit.totals?.files || 0,
      bytes: previousAudit.totals?.bytes || 0,
    },
    current: {
      name: currentAudit.contract?.identity?.name || currentAudit.contract?.identity?.shortName || 'Current package',
      version: currentAudit.contract?.identity?.version || 'Unknown',
      files: currentAudit.totals?.files || 0,
      bytes: currentAudit.totals?.bytes || 0,
    },
    summary: {
      totalChanges: changedIdentity + optionChanges + changedSurfaces + changedRuntimes + findingChanges + referenceChanges,
      identity: changedIdentity,
      options: optionChanges,
      surfaces: changedSurfaces,
      runtimes: changedRuntimes,
      findings: findingChanges,
      references: referenceChanges,
    },
    ...comparison,
  };
}

export function buildAiVersionComparisonSummary(previousAudit, currentAudit) {
  const report = compareBarbarianAiPackages(previousAudit, currentAudit);
  const lines = [
    `${report.baseline.name} ${report.baseline.version} -> ${report.current.name} ${report.current.version}`,
    `Upgrade verdict: ${report.verdict}`,
    `Detected changes: ${report.summary.totalChanges}`,
    '',
    `Identity: ${report.summary.identity}`,
    `Profile surfaces: ${report.summary.surfaces}`,
    `Lobby options: ${report.summary.options}`,
    `Runtime binaries: ${report.summary.runtimes}`,
    `Unit references: ${report.summary.references}`,
    `Compatibility findings: ${report.summary.findings}`,
  ];

  const runtimeChanges = report.runtimes.filter(item => item.status !== 'unchanged');
  if (runtimeChanges.length) {
    lines.push('', 'Runtime changes:', ...runtimeChanges.map(item => `- [${item.status}] ${item.path}`));
  }
  const newFindings = report.findings.filter(item => item.status === 'added');
  if (newFindings.length) {
    lines.push('', 'New findings:', ...newFindings.map(item => `- [${item.currentSeverity}] ${item.title}`));
  }
  lines.push('', 'Static comparison only. Neither package was executed by BAR Editor.');
  return lines.join('\n');
}
