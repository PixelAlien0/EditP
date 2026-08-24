import { useMemo } from 'react';
import {
  aiSmokeTestStorageKey,
  createAiSmokeTestRecord,
  normalizeAiSmokeTestRecord,
} from '../utils/barbarianAiSmokeTest.js';
import {
  buildAiReleaseBundle,
  buildAiReleaseDossier,
  buildAiReleaseSummary,
} from '../utils/barbarianAiReleaseDossier.js';
import { Badge, Button, Callout, StatusBadge, Type } from './ui.jsx';

function loadSmokeRecord(audit, fingerprint) {
  try {
    const stored = localStorage.getItem(aiSmokeTestStorageKey(fingerprint));
    return stored ? normalizeAiSmokeTestRecord(audit, JSON.parse(stored)) : createAiSmokeTestRecord(audit);
  } catch {
    return createAiSmokeTestRecord(audit);
  }
}

function statusTone(status) {
  if (status === 'blocked') return 'danger';
  if (status === 'verified' || status === 'passed') return 'success';
  return 'warning';
}

function statusLabel(status) {
  if (status === 'blocked') return 'Release blocked';
  if (status === 'verified') return 'Release evidence complete';
  return 'Evidence needs review';
}

export default function BarbarianAiReleaseDossier({ audit, onNotice }) {
  const fingerprint = useMemo(() => buildAiReleaseDossier(audit).package.fingerprint, [audit]);
  const smokeRecord = useMemo(() => loadSmokeRecord(audit, fingerprint), [audit, fingerprint]);
  const dossier = useMemo(() => buildAiReleaseDossier(audit, smokeRecord), [audit, smokeRecord]);

  const copySummary = async () => {
    await navigator.clipboard.writeText(buildAiReleaseSummary(audit, smokeRecord));
    onNotice?.('Copied the AI release-dossier summary.');
  };

  const downloadBundle = () => {
    const bundle = buildAiReleaseBundle(audit, smokeRecord);
    const blob = new Blob([bundle.bytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = bundle.filename;
    anchor.click();
    URL.revokeObjectURL(url);
    onNotice?.(`Downloaded the ${bundle.status} AI release dossier.`);
  };

  return (
    <div className="barbarian-ai-release">
      <header className="barbarian-ai-release__header">
        <div>
          <Type variant="eyebrow">Phase 7 / Release dossier</Type>
          <Type as="h3" variant="section-title">Package the evidence, not the imported AI</Type>
          <Type as="p" variant="description">
            Combine the static audit, deployment plan, and locally recorded BAR smoke test into one sanitized review bundle.
          </Type>
        </div>
        <div className="barbarian-ai-release__actions">
          <Button variant="secondary" onClick={copySummary}>Copy summary</Button>
          <Button variant="primary" onClick={downloadBundle}>Download dossier</Button>
        </div>
      </header>

      <section className={`barbarian-ai-release__status is-${dossier.status}`} aria-labelledby="ai-release-status-title">
        <div>
          <StatusBadge status={statusTone(dossier.status)}>{statusLabel(dossier.status)}</StatusBadge>
          <Type as="h4" variant="subsection-title" id="ai-release-status-title">{dossier.package.name}</Type>
          <code>{dossier.package.fingerprint}</code>
        </div>
        <dl>
          <div><dt>Passed</dt><dd>{dossier.summary.passed}</dd></div>
          <div><dt>Review</dt><dd>{dossier.summary.reviews}</dd></div>
          <div><dt>Blocked</dt><dd>{dossier.summary.blockers}</dd></div>
        </dl>
      </section>

      <section className="barbarian-ai-release__gates" aria-labelledby="ai-release-gates-title">
        <div className="barbarian-ai-release__section-heading">
          <div>
            <Type variant="eyebrow">Release gates</Type>
            <Type as="h4" variant="subsection-title" id="ai-release-gates-title">Three independent confidence checks</Type>
          </div>
          <Badge tone="neutral">{dossier.summary.passed} of {dossier.summary.total} passed</Badge>
        </div>
        <div className="barbarian-ai-release__gate-grid">
          {dossier.gates.map((gate, index) => (
            <article className={`barbarian-ai-release__gate is-${gate.status}`} key={gate.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{gate.label}</strong>
                <p>{gate.detail}</p>
              </div>
              <StatusBadge status={statusTone(gate.status)}>{gate.status}</StatusBadge>
            </article>
          ))}
        </div>
      </section>

      <section className="barbarian-ai-release__contents" aria-labelledby="ai-release-contents-title">
        <div className="barbarian-ai-release__section-heading">
          <div>
            <Type variant="eyebrow">Bundle boundary</Type>
            <Type as="h4" variant="subsection-title" id="ai-release-contents-title">A portable, non-executable dossier</Type>
          </div>
        </div>
        <div className="barbarian-ai-release__contents-grid">
          <article>
            <strong>Included evidence</strong>
            <ul>
              <li>Sanitized compatibility findings and check results</li>
              <li>Installation destination, platform counts, and cautions</li>
              <li>Manual runtime results tied to this package fingerprint</li>
              <li>Human-readable release summary</li>
            </ul>
          </article>
          <article>
            <strong>Intentionally excluded</strong>
            <ul>
              <li>Imported Lua, AngelScript, JSONC, and source paths</li>
              <li>Native DLL, SO, and dylib files</li>
              <li>Installable package contents</li>
              <li>Claims of runtime compatibility without completed testing</li>
            </ul>
          </article>
        </div>
      </section>

      <Callout
        tone={dossier.status === 'blocked' ? 'danger' : dossier.status === 'verified' ? 'success' : 'warning'}
        title={statusLabel(dossier.status)}
      >
        {dossier.status === 'verified'
          ? 'All three evidence gates passed. Keep the original audited package separately; this dossier is evidence, not an installer.'
          : dossier.status === 'blocked'
            ? 'At least one release gate failed. Use the included evidence to repair the package, then rerun the audit and BAR smoke test.'
            : 'Complete the outstanding review or runtime checks before treating this package as verified.'}
      </Callout>
    </div>
  );
}
