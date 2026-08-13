import { useMemo } from 'react';
import { Button, EmptyState, Type } from './ui.jsx';

const SEVERITY_ORDER = ['error', 'warning', 'info'];

const SEVERITY_META = Object.freeze({
  error: {
    label: 'Blockers',
    singular: 'Blocker',
    description: 'Must be resolved before this project can be exported safely.',
  },
  warning: {
    label: 'Warnings',
    singular: 'Warning',
    description: 'Export can continue, but the result needs review or in-game testing.',
  },
  info: {
    label: 'Advisories',
    singular: 'Advisory',
    description: 'Context worth checking; this does not block export.',
  },
});

function normalizeSeverity(level) {
  return SEVERITY_ORDER.includes(level) ? level : 'warning';
}

function formatIssueKey(key) {
  return String(key || 'project')
    .replace(/^weapon_slot_(\d+)_?/, 'Weapon $1 · ')
    .replace(/^customparams\./, 'Custom · ')
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function ValidationCenter({ issues = [], onEditUnit }) {
  const groups = useMemo(() => {
    const grouped = Object.fromEntries(SEVERITY_ORDER.map(level => [level, []]));
    issues.forEach(issue => grouped[normalizeSeverity(issue.level)].push(issue));
    return grouped;
  }, [issues]);

  const blockerCount = groups.error.length;
  const overallStatus = blockerCount > 0 ? 'error' : issues.length > 0 ? 'warning' : 'ready';
  const statusLabel = blockerCount > 0 ? 'Export blocked' : issues.length > 0 ? 'Review advised' : 'Ready';

  return (
    <section className={`review-card validation-center is-${overallStatus}`} aria-labelledby="validation-center-title">
      <header className="validation-center__header">
        <div>
          <Type variant="eyebrow" className="workflow-eyebrow">Validation center</Type>
          <Type as="h3" variant="section-title" id="validation-center-title">
            {issues.length === 0 ? 'Project checks are clear' : `${issues.length} ${issues.length === 1 ? 'finding' : 'findings'} need attention`}
          </Type>
          <p>Resolve blockers first, then review warnings and advisory context before copying lobby commands.</p>
        </div>
        <span className={`review-status ${overallStatus}`}>{statusLabel}</span>
      </header>

      {issues.length === 0 ? (
        <EmptyState
          compact
          className="review-empty-state validation-center__empty"
          title="No validation issues detected"
          description="Current values, project links, and export constraints pass the editor's safety checks."
        />
      ) : (
        <>
          <dl className="validation-severity-summary" aria-label="Validation severity totals">
            {SEVERITY_ORDER.map(level => (
              <div className={`is-${level}`} key={level}>
                <dt>{SEVERITY_META[level].label}</dt>
                <dd>{groups[level].length}</dd>
              </div>
            ))}
          </dl>

          <div className="validation-groups">
            {SEVERITY_ORDER.map(level => {
              const severityIssues = groups[level];
              if (severityIssues.length === 0) return null;
              const meta = SEVERITY_META[level];
              return (
                <section className={`validation-group is-${level}`} key={level} aria-labelledby={`validation-${level}-title`}>
                  <header className="validation-group__header">
                    <span className="validation-group__marker" aria-hidden="true" />
                    <div>
                      <h4 id={`validation-${level}-title`}>{meta.label}</h4>
                      <p>{meta.description}</p>
                    </div>
                    <strong>{severityIssues.length}</strong>
                  </header>
                  <ol className="validation-list">
                    {severityIssues.map((issue, index) => {
                      const canOpenUnit = Boolean(onEditUnit && issue.unitId && issue.unitId !== 'project');
                      return (
                        <li className={`validation-row ${level}`} key={issue.id || `${issue.unitName}-${issue.key}-${index}`}>
                          <span className="validation-row__severity">{meta.singular}</span>
                          <div className="validation-row__body">
                            <div className="validation-row__context">
                              <strong>{issue.unitName || 'Project'}</strong>
                              <code>{formatIssueKey(issue.key)}</code>
                            </div>
                            <p>{issue.message}</p>
                          </div>
                          {canOpenUnit && (
                            <Button size="sm" onClick={() => onEditUnit(issue.unitId)}>
                              Open unit
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </section>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

export default ValidationCenter;
