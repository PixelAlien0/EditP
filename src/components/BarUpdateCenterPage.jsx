import updateReport from '../data/bar-update-report.json';
import '../styles/features/bar-update-center.css';
import { Badge, Button, PageShell, StatusBadge, Type } from './ui.jsx';

const UPDATE_TRACKS = Object.freeze([
  {
    id: 'gameplay',
    index: '01',
    eyebrow: 'Editor data',
    title: 'Gameplay definitions',
    description: 'Units, names, rosters, and explosion profiles that affect editing and generated output.',
  },
  {
    id: 'delivery',
    index: '02',
    eyebrow: 'Reference delivery',
    title: 'Assets and presentation',
    description: 'Artwork, tactical icons, and validated BAR asset references used by the editor interface.',
  },
  {
    id: 'compatibility',
    index: '03',
    eyebrow: 'Runtime knowledge',
    title: 'Compatibility contracts',
    description: 'Discovered custom parameters and consumer evidence used by guidance and preflight checks.',
  },
]);

const COVERAGE_METRICS = Object.freeze([
  ['units', 'Units'],
  ['weaponDefs', 'WeaponDefs'],
  ['rosters', 'Producers'],
  ['explosions', 'Explosions'],
  ['assetReferences', 'Asset references'],
  ['customParameters', 'Custom parameters'],
]);

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function formatDate(value) {
  if (!value) return 'Initial bundled snapshot';
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function shortCommit(commit) {
  return commit ? commit.slice(0, 12) : 'Unavailable';
}

function changeTotal(summary = {}) {
  return Number(summary.added || 0) + Number(summary.removed || 0) + Number(summary.changed || 0);
}

function datasetChangeTotal(dataset) {
  return dataset.addedCount + dataset.removedCount + dataset.changedCount;
}

function DatasetSamples({ dataset }) {
  const groups = [
    ['Added', dataset.added],
    ['Changed', dataset.changed],
    ['Removed', dataset.removed],
  ].filter(([, entries]) => entries.length > 0);

  if (!groups.length) return null;

  return (
    <div className="bar-update-center__samples">
      {groups.map(([label, entries]) => (
        <div key={label}>
          <Type as="span" variant="metadata">{label}</Type>
          <div className="bar-update-center__sample-list">
            {entries.map(entry => <code key={entry}>{entry}</code>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function DatasetRow({ dataset }) {
  const changes = datasetChangeTotal(dataset);
  const isChanged = dataset.status === 'changed';

  return (
    <article className={`bar-update-center__dataset ${isChanged ? 'is-changed' : ''}`}>
      <div className="bar-update-center__dataset-main">
        <div>
          <strong>{dataset.label}</strong>
          <Type as="span" variant="technical">
            {formatNumber(dataset.currentCount)} records
            {dataset.delta !== 0 ? ` · ${dataset.delta > 0 ? '+' : ''}${formatNumber(dataset.delta)} net` : ''}
          </Type>
        </div>
        <Badge tone={isChanged ? 'accent' : 'neutral'} size="sm">
          {isChanged ? `${formatNumber(changes)} changed` : 'Stable'}
        </Badge>
      </div>
      {isChanged && (
        <div className="bar-update-center__dataset-counts" aria-label={`${dataset.label} change counts`}>
          <span><b>{formatNumber(dataset.addedCount)}</b> added</span>
          <span><b>{formatNumber(dataset.changedCount)}</b> revised</span>
          <span><b>{formatNumber(dataset.removedCount)}</b> removed</span>
        </div>
      )}
      <DatasetSamples dataset={dataset} />
    </article>
  );
}

export default function BarUpdateCenterPage({ onBack, onOpenReference }) {
  const gameplayChanges = changeTotal(updateReport.summary.gameplay);
  const deliveryChanges = changeTotal(updateReport.summary.delivery);
  const compatibilityChanges = changeTotal(updateReport.summary.compatibility);
  const currentCommitUrl = updateReport.current?.sourceCommit
    ? `https://github.com/beyond-all-reason/Beyond-All-Reason/commit/${updateReport.current.sourceCommit}`
    : 'https://github.com/beyond-all-reason/Beyond-All-Reason';

  let verdictTitle = 'Bundled gameplay data is stable';
  let verdictBody = 'The latest refresh did not change unit definitions, names, build rosters, or explosion profiles.';
  if (gameplayChanges > 0) {
    verdictTitle = `${formatNumber(gameplayChanges)} gameplay records changed`;
    verdictBody = 'Review the affected definition groups before continuing work on a project created against the previous snapshot.';
  } else if (deliveryChanges > 0 || compatibilityChanges > 0) {
    verdictTitle = 'Reference coverage was refreshed';
    verdictBody = 'Gameplay definitions stayed stable while editor assets or runtime-contract knowledge were updated.';
  }

  return (
    <PageShell
      className="bar-update-center"
      bodyClassName="bar-update-center__body"
      eyebrow="Bundled game data"
      title="BAR Update Center"
      description="See exactly what changed between the two BAR snapshots packaged with this editor build."
      capabilityId="tool.update-center"
      metrics={[
        { label: 'Current snapshot', value: shortCommit(updateReport.current?.sourceCommit), detail: formatDate(updateReport.current?.sourceDate) },
        { label: 'Previous snapshot', value: shortCommit(updateReport.previous?.sourceCommit), detail: formatDate(updateReport.previous?.sourceDate) },
      ]}
      status={<StatusBadge status={gameplayChanges > 0 ? 'warning' : 'success'}>{gameplayChanges > 0 ? 'Review gameplay changes' : 'Snapshot verified'}</StatusBadge>}
      actions={<Button variant="secondary" onClick={onBack}>Back to editor</Button>}
    >
      <section className="bar-update-center__verdict" aria-labelledby="bar-update-verdict-title">
        <div className="bar-update-center__verdict-index" aria-hidden="true">01</div>
        <div className="bar-update-center__verdict-copy">
          <Type variant="eyebrow">Release verdict</Type>
          <Type as="h3" variant="page-title" id="bar-update-verdict-title">{verdictTitle}</Type>
          <Type as="p" variant="description">{verdictBody}</Type>
        </div>
        <dl className="bar-update-center__verdict-ledger">
          <div><dt>Gameplay</dt><dd>{formatNumber(gameplayChanges)}</dd></div>
          <div><dt>Delivery</dt><dd>{formatNumber(deliveryChanges)}</dd></div>
          <div><dt>Contracts</dt><dd>{formatNumber(compatibilityChanges)}</dd></div>
        </dl>
        <div className="bar-update-center__verdict-actions">
          <Button variant="primary" onClick={onOpenReference}>Open reference library</Button>
          <a className="ui-button ui-button--secondary ui-button--md" href={currentCommitUrl} target="_blank" rel="noreferrer">View BAR commit</a>
        </div>
      </section>

      <section className="bar-update-center__tracks" aria-label="Snapshot change tracks">
        {UPDATE_TRACKS.map(track => {
          const summary = updateReport.summary[track.id];
          const datasets = updateReport.datasets.filter(dataset => dataset.group === track.id);
          const changes = changeTotal(summary);
          return (
            <section className="bar-update-center__track" key={track.id} aria-labelledby={`bar-update-track-${track.id}`}>
              <header className="bar-update-center__track-header">
                <span className="bar-update-center__track-index" aria-hidden="true">{track.index}</span>
                <div>
                  <Type variant="eyebrow">{track.eyebrow}</Type>
                  <Type as="h3" variant="section-title" id={`bar-update-track-${track.id}`}>{track.title}</Type>
                  <Type as="p" variant="description">{track.description}</Type>
                </div>
                <StatusBadge status={changes > 0 ? 'warning' : 'success'}>{changes > 0 ? `${formatNumber(changes)} changes` : 'No changes'}</StatusBadge>
              </header>
              <div className="bar-update-center__dataset-list">
                {datasets.map(dataset => <DatasetRow dataset={dataset} key={dataset.id} />)}
              </div>
            </section>
          );
        })}
      </section>

      <section className="bar-update-center__coverage" aria-labelledby="bar-update-coverage-title">
        <div className="bar-update-center__coverage-copy">
          <Type variant="eyebrow">Bundled coverage</Type>
          <Type as="h3" variant="section-title" id="bar-update-coverage-title">Current editor reference surface</Type>
          <Type as="p" variant="description">
            These counts are generated from the pinned BAR commit and validated during the repository sync pipeline.
          </Type>
        </div>
        <dl className="bar-update-center__coverage-grid">
          {COVERAGE_METRICS.map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{formatNumber(updateReport.current?.counts?.[key])}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="bar-update-center__provenance">
        <div>
          <Type variant="eyebrow">Provenance</Type>
          <strong>{updateReport.current?.snapshotId}</strong>
          <span>Schema v{updateReport.current?.schemaVersion}</span>
        </div>
        <p>This report describes bundled data only. BAR Editor does not contact GitHub or replace project data at runtime.</p>
      </footer>
    </PageShell>
  );
}
