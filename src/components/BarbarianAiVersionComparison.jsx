import { useMemo, useRef, useState } from 'react';
import { auditBarbarianAiPackage, readAiPackageFiles } from '../utils/barbarianAiPackage.js';
import {
  buildAiVersionComparisonSummary,
  compareBarbarianAiPackages,
} from '../utils/barbarianAiVersionComparison.js';
import { Badge, Button, Callout, EmptyState, StatusBadge, Type } from './ui.jsx';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function statusTone(status) {
  if (status === 'blocked' || status === 'removed') return 'danger';
  if (status === 'review' || status === 'changed' || status === 'added') return 'warning';
  if (status === 'compatible' || status === 'resolved') return 'success';
  return 'neutral';
}

function verdictLabel(verdict) {
  if (verdict === 'blocked') return 'Upgrade blocked';
  if (verdict === 'review') return 'Review upgrade';
  return 'Upgrade surface stable';
}

function DeltaList({ title, description, items, renderLabel }) {
  const changed = items.filter(item => item.status !== 'unchanged');
  return (
    <section>
      <header>
        <div>
          <Type as="h4" variant="subsection-title">{title}</Type>
          <Type as="p" variant="description">{description}</Type>
        </div>
        <Badge tone={changed.length ? 'warning' : 'neutral'}>{changed.length} changed</Badge>
      </header>
      <div className="barbarian-ai-audit__surface-list">
        {changed.length ? changed.map(item => (
          <article key={item.id || item.path}>
            <div><strong>{renderLabel(item)}</strong></div>
            <StatusBadge status={statusTone(item.status)}>{item.status}</StatusBadge>
          </article>
        )) : <Type as="p" variant="description">No changes detected.</Type>}
      </div>
    </section>
  );
}

function SetDelta({ title, added, removed, removedLabel = 'removed' }) {
  const entries = [
    ...added.map(value => ({ value, status: 'added', label: 'added' })),
    ...removed.map(value => ({ value, status: 'removed', label: removedLabel })),
  ];

  return (
    <section>
      <header>
        <div>
          <Type as="h4" variant="subsection-title">{title}</Type>
          <Type as="p" variant="description">{added.length} added, {removed.length} {removedLabel}</Type>
        </div>
        <Badge tone={entries.length ? 'warning' : 'neutral'}>{entries.length} changed</Badge>
      </header>
      <div className="barbarian-ai-audit__surface-list">
        {entries.length ? entries.map(entry => (
          <article key={`${entry.status}:${entry.value}`}>
            <code>{entry.value}</code>
            <StatusBadge status={statusTone(entry.status)}>{entry.label}</StatusBadge>
          </article>
        )) : <Type as="p" variant="description">No changes detected.</Type>}
      </div>
    </section>
  );
}

export default function BarbarianAiVersionComparison({ audit, baselineAudit, onBaselineAuditChange, knownUnitIds = [], onNotice }) {
  const folderInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const comparison = useMemo(
    () => baselineAudit ? compareBarbarianAiPackages(baselineAudit, audit) : null,
    [audit, baselineAudit],
  );

  const importBaseline = async event => {
    const selectedFiles = event.target.files;
    if (!selectedFiles?.length) return;
    setLoading(true);
    setError('');
    try {
      const records = await readAiPackageFiles(selectedFiles);
      onBaselineAuditChange?.(auditBarbarianAiPackage(records, { knownUnitIds }));
      onNotice?.(`Loaded ${records.length} baseline files for a static AI package comparison.`);
    } catch (importError) {
      onBaselineAuditChange?.(null);
      setError(importError.message || 'The baseline package could not be inspected.');
    } finally {
      event.target.value = '';
      setLoading(false);
    }
  };

  const copySummary = async () => {
    await navigator.clipboard.writeText(buildAiVersionComparisonSummary(baselineAudit, audit));
    onNotice?.('Copied the AI package upgrade comparison.');
  };

  return (
    <div className="barbarian-ai-report">
      <header className="barbarian-ai-report__header">
        <div>
          <Type variant="eyebrow">Phase 8 / Version comparison</Type>
          <Type as="h3" variant="section-title">Audit an upgrade against its previous package</Type>
          <Type as="p" variant="description">
            Compare contracts, runtime fingerprints, profile routes, lobby options, references, and findings without executing either version.
          </Type>
        </div>
        <div className="barbarian-ai-report__actions">
          {comparison && <Button variant="secondary" onClick={copySummary}>Copy comparison</Button>}
          <Button variant="primary" loading={loading} onClick={() => folderInputRef.current?.click()}>Choose baseline folder</Button>
          <Button variant="secondary" disabled={loading} onClick={() => fileInputRef.current?.click()}>Choose ZIP or files</Button>
          {baselineAudit && <Button variant="quiet" onClick={() => { onBaselineAuditChange?.(null); setError(''); }}>Clear baseline</Button>}
          <input ref={folderInputRef} className="barbarian-ai-audit__native-input" type="file" multiple webkitdirectory="" directory="" onChange={importBaseline} />
          <input ref={fileInputRef} className="barbarian-ai-audit__native-input" type="file" multiple accept=".zip,.lua,.as,.json,.jsonc,.dll,.so,.dylib,.txt,.md" onChange={importBaseline} />
        </div>
      </header>

      {error && <Callout tone="danger" title="Baseline could not be inspected">{error}</Callout>}
      {!comparison ? (
        <EmptyState
          title="Load the previous AI package"
          description="The package already loaded in AI Package Audit is treated as the current version. Choose an older folder or ZIP to calculate a deterministic upgrade delta."
        />
      ) : (
        <>
          <section className="barbarian-ai-report__verdict">
            <div className="barbarian-ai-report__verdict-copy">
              <StatusBadge status={statusTone(comparison.verdict)}>{verdictLabel(comparison.verdict)}</StatusBadge>
              <div>
                <Type as="h4" variant="subsection-title">{comparison.baseline.name} to {comparison.current.name}</Type>
                <Type as="p" variant="description">{comparison.baseline.version} to {comparison.current.version}</Type>
              </div>
            </div>
            <dl className="barbarian-ai-report__package-facts">
              <div><dt>Changes</dt><dd>{comparison.summary.totalChanges}</dd></div>
              <div><dt>Findings</dt><dd>{comparison.summary.findings}</dd></div>
              <div><dt>Files</dt><dd>{comparison.baseline.files} to {comparison.current.files}</dd></div>
              <div><dt>Size</dt><dd>{formatBytes(comparison.baseline.bytes)} to {formatBytes(comparison.current.bytes)}</dd></div>
            </dl>
          </section>

          <section className="barbarian-ai-audit__identity" aria-labelledby="ai-version-identity-title">
            <header className="barbarian-ai-report__section-heading">
              <div>
                <Type variant="eyebrow">Package identity</Type>
                <Type as="h4" variant="subsection-title" id="ai-version-identity-title">Literal AIInfo.lua fields</Type>
              </div>
              <Badge tone={comparison.summary.identity ? 'warning' : 'neutral'}>{comparison.summary.identity} changed</Badge>
            </header>
            <dl>
              {comparison.identity.map(item => (
                <div key={item.field}>
                  <dt>{item.field}{item.changed ? ' / changed' : ''}</dt>
                  <dd>{item.previous || 'Not set'} to {item.current || 'Not set'}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="barbarian-ai-audit__contract-grid">
            <DeltaList title="Profile surfaces" description="Configuration groups and their discovered file routes." items={comparison.surfaces} renderLabel={item => `${item.label}: ${item.previousCount} to ${item.currentCount} files`} />
            <DeltaList title="Native runtimes" description="Binary paths are fingerprinted only; no binary is loaded." items={comparison.runtimes} renderLabel={item => item.path} />
            <DeltaList title="Compatibility findings" description="New, resolved, or severity-changed audit findings." items={comparison.findings} renderLabel={item => item.title} />
            <SetDelta title="Lobby options" added={comparison.options.added} removed={comparison.options.removed} />
            <SetDelta title="Known unit references" added={comparison.references.referenced.added} removed={comparison.references.referenced.removed} />
            <SetDelta title="Unresolved references" added={comparison.references.unresolved.added} removed={comparison.references.unresolved.removed} removedLabel="resolved" />
          </div>

          <Callout tone={comparison.verdict === 'blocked' ? 'danger' : comparison.verdict === 'review' ? 'warning' : 'success'} title={verdictLabel(comparison.verdict)}>
            {comparison.verdict === 'compatible'
              ? 'No upgrade-sensitive change was detected. Run a fresh BAR smoke test before release even when the static surface is stable.'
              : comparison.verdict === 'blocked'
                ? 'The current package has blocking audit findings. Repair those findings before treating this as a viable upgrade.'
                : 'Review runtime, identity, reference, or compatibility changes and rerun the deployment plan and BAR smoke test.'}
          </Callout>
        </>
      )}
    </div>
  );
}
