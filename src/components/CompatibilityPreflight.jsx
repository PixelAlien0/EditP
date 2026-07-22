import { useMemo, useState } from 'react';
import { Button, EmptyState } from './ui.jsx';
import '../styles/features/compatibility-preflight.css';

const FILTERS = [
  ['all', 'All checks'],
  ['blocker', 'Blockers'],
  ['warning', 'Review'],
  ['pass', 'Passed'],
];

const STATUS_COPY = Object.freeze({
  blocked: {
    eyebrow: 'Export blocked',
    title: 'Compatibility issues must be repaired',
    description: 'Definite failures were found. Lobby command copying stays disabled until they are resolved.',
  },
  review: {
    eyebrow: 'Review advised',
    title: 'Package is structurally exportable',
    description: 'No definite failure was found, but runtime assumptions should be verified in an isolated BAR lobby.',
  },
  ready: {
    eyebrow: 'Preflight clear',
    title: 'Package is ready for game testing',
    description: 'The editor found no static compatibility concerns in the active output.',
  },
});

function levelLabel(level) {
  if (level === 'blocker') return 'Blocker';
  if (level === 'warning') return 'Review';
  if (level === 'pass') return 'Passed';
  return 'Note';
}

export default function CompatibilityPreflight({ report, onAction }) {
  const [filter, setFilter] = useState('all');
  const status = STATUS_COPY[report.status] || STATUS_COPY.review;
  const visibleGroups = useMemo(() => report.groups
    .map(group => ({
      ...group,
      items: filter === 'all'
        ? group.items
        : filter === 'pass'
          ? group.items.filter(item => item.level === 'pass')
          : group.items.filter(item => item.level === filter),
    }))
    .filter(group => group.items.length > 0), [filter, report.groups]);

  return (
    <section className={`compatibility-preflight is-${report.status}`} aria-labelledby="compatibility-preflight-title">
      <header className="compatibility-preflight__header">
        <div className="compatibility-preflight__seal" aria-hidden="true">
          <span>{report.status === 'blocked' ? '!' : report.status === 'review' ? '◇' : '✓'}</span>
        </div>
        <div>
          <span className="workflow-eyebrow">Compatibility preflight · {status.eyebrow}</span>
          <h3 id="compatibility-preflight-title">{status.title}</h3>
          <p>{status.description}</p>
        </div>
        <div className="compatibility-preflight__scope">
          <span>Static scope</span>
          <strong>{report.checkedSlotCount} lobby fields</strong>
          <small>{report.activeModuleCount} raw modules active</small>
        </div>
      </header>

      <div className="compatibility-preflight__summary" aria-label="Compatibility result counts">
        {[
          ['blocker', 'Blockers', report.counts.blocker],
          ['warning', 'Review', report.counts.warning],
          ['pass', 'Passed', report.counts.pass],
          ['info', 'Notes', report.counts.info],
        ].map(([level, label, count]) => (
          <div className={`is-${level}`} key={level}>
            <span>{label}</span><strong>{count}</strong>
          </div>
        ))}
      </div>

      <div className="compatibility-preflight__toolbar">
        <div role="group" aria-label="Filter compatibility checks">
          {FILTERS.map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={filter === id ? 'is-active' : ''}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              <span>{label}</span>
              {id !== 'all' && <small>{report.counts[id]}</small>}
            </button>
          ))}
        </div>
        <p>Static analysis is conservative: community Lua may still run with advisories, while a clear result still requires in-game testing.</p>
      </div>

      <div className="compatibility-preflight__groups" aria-live="polite">
        {visibleGroups.length === 0 ? (
          <EmptyState compact title="No checks in this view" description="Choose another result filter to inspect the package." />
        ) : visibleGroups.map(group => (
          <details className="compatibility-preflight__group" key={group.id} open>
            <summary>
              <span>{group.label}</span>
              <small>{group.items.length} {group.items.length === 1 ? 'check' : 'checks'}</small>
            </summary>
            <div>
              {group.items.map(item => (
                <article className={`compatibility-preflight__item is-${item.level}`} key={item.id}>
                  <span className="compatibility-preflight__marker" aria-hidden="true" />
                  <div>
                    <span>{levelLabel(item.level)}</span>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                  {item.action && (
                    <Button size="sm" onClick={() => onAction(item.action)}>{item.action.label}</Button>
                  )}
                </article>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
