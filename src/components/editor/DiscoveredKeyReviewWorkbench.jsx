import { useMemo, useRef, useState } from 'react';
import { Badge, Button, Dialog, IconButton } from '../ui.jsx';
import {
  buildDiscoveredKeyReviewArtifact,
  buildDiscoveredKeyReviewQueue,
  DISCOVERED_KEY_REVIEW_DECISIONS,
  filterDiscoveredKeyReviewQueue,
  normalizeDiscoveredKeyReview,
} from '../../utils/customParameterReview.js';
import { CUSTOM_PARAMETER_DISCOVERY } from '../../config/customParameters.js';

const STORAGE_KEY = 'editp_discovered_key_reviews_v1';

function readReviews() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return Object.fromEntries(Object.entries(parsed)
      .map(([id, review]) => [id, normalizeDiscoveredKeyReview(review)])
      .filter(([, review]) => review));
  } catch {
    return {};
  }
}

function writeReviews(reviews) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
    return true;
  } catch {
    return false;
  }
}

function evidenceLabel(entry) {
  if (entry.scope === 'unresolved') return 'Scope unresolved';
  if (entry.declarationKind === 'consumer-only') return 'Consumer only';
  if (entry.consumerCount > 0) return `${entry.consumerCount} consumer${entry.consumerCount === 1 ? '' : 's'}`;
  return `${entry.occurrences} declaration${entry.occurrences === 1 ? '' : 's'}`;
}

function EvidenceList({ title, empty, children }) {
  return (
    <section className="discovered-key-review__evidence-section">
      <h4>{title}</h4>
      {children || <p>{empty}</p>}
    </section>
  );
}

function NumericEvidence({ range }) {
  if (!range) return null;
  const entries = [
    ['Observed min', range.observedMin],
    ['Observed max', range.observedMax],
    ['Consumer lower bound', range.lowerBound],
    ['Consumer upper bound', range.upperBound],
  ].filter(([, value]) => value != null);
  return entries.length > 0
    ? <div className="discovered-key-review__tokens">{entries.map(([label, value]) => <code key={label}>{label}: {value}</code>)}</div>
    : null;
}

export default function DiscoveredKeyReviewWorkbench({ onClose }) {
  const closeRef = useRef(null);
  const queue = useMemo(() => buildDiscoveredKeyReviewQueue(), []);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [stage, setStage] = useState('needs-review');
  const [evidence, setEvidence] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [reviews, setReviews] = useState(readReviews);
  const [drafts, setDrafts] = useState({});
  const [notice, setNotice] = useState('');

  const filtered = useMemo(() => filterDiscoveredKeyReviewQueue(queue, {
    query, scope, stage, evidence, localReviews: reviews,
  }), [evidence, query, queue, reviews, scope, stage]);
  const selected = filtered.find(entry => entry.id === selectedId) || filtered[0] || null;
  const savedReview = selected ? reviews[selected.id] : null;
  const draft = selected
    ? drafts[selected.id] || savedReview || { decision: 'pending', note: '', reviewedAt: '' }
    : { decision: 'pending', note: '', reviewedAt: '' };
  const reviewCount = Object.keys(reviews).length;
  const pendingCount = queue.filter(entry => ['observed', 'unresolved'].includes(entry.promotion.id)).length;
  const consumerCandidateCount = queue.filter(entry => entry.promotion.id === 'observed' && entry.consumerCount > 0).length;

  const updateDraft = patch => {
    if (!selected) return;
    setDrafts(current => ({
      ...current,
      [selected.id]: { ...draft, ...patch },
    }));
    setNotice('');
  };

  const saveReview = () => {
    if (!selected) return;
    const nextReview = normalizeDiscoveredKeyReview({
      ...draft,
      reviewedAt: new Date().toISOString(),
    });
    const nextReviews = { ...reviews, [selected.id]: nextReview };
    setReviews(nextReviews);
    setDrafts(current => ({ ...current, [selected.id]: nextReview }));
    setNotice(writeReviews(nextReviews) ? 'Review saved locally.' : 'Browser storage is unavailable. Review kept for this session only.');
  };

  const clearReview = () => {
    if (!selected) return;
    const nextReviews = { ...reviews };
    delete nextReviews[selected.id];
    setReviews(nextReviews);
    setDrafts(current => {
      const next = { ...current };
      delete next[selected.id];
      return next;
    });
    writeReviews(nextReviews);
    setNotice('Local review cleared.');
  };

  const copyArtifact = async () => {
    if (!selected) return;
    const artifact = buildDiscoveredKeyReviewArtifact(selected, draft);
    try {
      await navigator.clipboard.writeText(JSON.stringify(artifact, null, 2));
      setNotice('Pinned review record copied.');
    } catch {
      setNotice('Clipboard access was unavailable.');
    }
  };

  return (
    <Dialog
      onClose={onClose}
      initialFocusRef={closeRef}
      className="discovered-key-review"
      overlayClassName="discovered-key-review-overlay"
      labelledBy="discovered-key-review-title"
      describedBy="discovered-key-review-description"
    >
      <header className="discovered-key-review__header">
        <div>
          <span>Registry curation · snapshot {CUSTOM_PARAMETER_DISCOVERY.sourceCommit.slice(0, 8)}</span>
          <h2 id="discovered-key-review-title">Discovered-key review workbench</h2>
          <p id="discovered-key-review-description">Triage automatically discovered BAR keys without silently promoting them into trusted editor contracts.</p>
        </div>
        <div className="discovered-key-review__summary" aria-label="Review queue summary">
          <span><strong>{pendingCount}</strong> need review</span>
          <span><strong>{consumerCandidateCount}</strong> consumer-backed</span>
          <span><strong>{reviewCount}</strong> reviewed locally</span>
        </div>
        <IconButton ref={closeRef} label="Close discovered-key review workbench" variant="quiet" onClick={onClose}>×</IconButton>
      </header>

      <div className="discovered-key-review__toolbar" aria-label="Review queue filters">
        <label className="discovered-key-review__search">
          <span>Search evidence</span>
          <input value={query} placeholder="Key, owner, sample, or source path…" onChange={event => setQuery(event.target.value)} />
        </label>
        <label><span>Scope</span><select value={scope} onChange={event => setScope(event.target.value)}>
          <option value="all">All scopes</option><option value="unit">Unit</option><option value="weapon">Weapon</option><option value="unresolved">Unresolved</option>
        </select></label>
        <label><span>Promotion</span><select value={stage} onChange={event => setStage(event.target.value)}>
          <option value="needs-review">Needs review</option><option value="all">All stages</option><option value="observed">Observed</option><option value="reviewed">Reviewed</option><option value="documented">Documented</option><option value="editor-supported">Editor-supported</option><option value="runtime-tested">Runtime-tested</option><option value="unresolved">Unresolved</option>
        </select></label>
        <label><span>Evidence</span><select value={evidence} onChange={event => setEvidence(event.target.value)}>
          <option value="all">All evidence</option><option value="consumer-backed">Consumer-backed</option><option value="consumer-only">Consumer only</option><option value="no-consumer">No consumer</option><option value="unresolved">Unresolved scope</option><option value="locally-reviewed">Reviewed locally</option>
        </select></label>
        <span className="discovered-key-review__matches" aria-live="polite"><strong>{filtered.length}</strong> matches</span>
      </div>

      <div className="discovered-key-review__body">
        <nav className="discovered-key-review__queue" aria-label="Discovered custom parameter keys">
          {filtered.length === 0 ? (
            <div className="discovered-key-review__empty"><strong>No matching keys</strong><span>Change a filter or search term.</span></div>
          ) : filtered.map(entry => {
            const localReview = reviews[entry.id];
            return (
              <button
                type="button"
                key={entry.id}
                className={`discovered-key-review__queue-item ${selected?.id === entry.id ? 'is-selected' : ''}`}
                aria-current={selected?.id === entry.id ? 'true' : undefined}
                onClick={() => { setSelectedId(entry.id); setNotice(''); }}
              >
                <span className="discovered-key-review__queue-title"><code>{entry.key}</code><Badge size="sm" tone={entry.promotion.tone}>{entry.scope}</Badge></span>
                <span>{evidenceLabel(entry)}</span>
                <small>{localReview ? DISCOVERED_KEY_REVIEW_DECISIONS.find(item => item.id === localReview.decision)?.label : entry.promotion.label}</small>
              </button>
            );
          })}
        </nav>

        <main className="discovered-key-review__inspector">
          {selected ? <>
            <header className="discovered-key-review__identity">
              <div><span>{selected.scope} custom parameter</span><h3>{selected.label}</h3><code>{selected.key}</code></div>
              <div className="discovered-key-review__badges">
                <Badge tone={selected.promotion.tone}>{selected.promotion.label}</Badge>
                <Badge tone={selected.confidence === 'strong' ? 'success' : selected.confidence === 'partial' ? 'info' : 'warning'}>{selected.confidence} evidence</Badge>
                <Badge>{selected.declarationKind}</Badge>
              </div>
            </header>
            <section className="discovered-key-review__brief">
              <p>{selected.description}</p>
              <dl>
                <div><dt>Inferred type</dt><dd>{selected.type}</dd></div>
                <div><dt>Declarations</dt><dd>{selected.occurrences}</dd></div>
                <div><dt>Consumers</dt><dd>{selected.consumerCount}</dd></div>
                <div><dt>Writers</dt><dd>{selected.writerCount}</dd></div>
              </dl>
              <aside><strong>Recommended next step</strong><span>{selected.recommendation}</span></aside>
            </section>
            <div className="discovered-key-review__evidence-grid">
              <EvidenceList title="Value & enum evidence" empty="No literal values or enum candidates were discovered.">
                {selected.sampleValues.length > 0 ? <div className="discovered-key-review__tokens">{selected.sampleValues.map(value => <code key={value}>{value}</code>)}</div> : null}
                {selected.valueDiscovery?.enumCandidates.length > 0 ? <div className="discovered-key-review__tokens" aria-label="Discovered enum candidates">{selected.valueDiscovery.enumCandidates.map(value => <code key={`enum:${value}`}>{value}</code>)}</div> : null}
                {selected.valueDiscovery?.enumCandidates.length > 0 ? <p>{selected.valueDiscovery.enumConfidence} enum evidence · advisory until curated</p> : null}
                <NumericEvidence range={selected.valueDiscovery?.numericRange} />
                {selected.valueDiscovery?.defaultCandidates.length > 0 ? <p>Consumer defaults: {selected.valueDiscovery.defaultCandidates.join(', ')}</p> : null}
              </EvidenceList>
              <EvidenceList title="Observed types" empty="Type remains unresolved.">
                {selected.observedTypes.length > 0 ? <div className="discovered-key-review__tokens">{selected.observedTypes.map(value => <code key={value}>{value}</code>)}</div> : null}
                {selected.valueDiscovery ? <p>Inferred {selected.valueDiscovery.inferredType} · {selected.valueDiscovery.typeConfidence} confidence</p> : null}
              </EvidenceList>
              <EvidenceList title="Consumer evidence" empty="No static consumer was resolved.">
                {selected.consumerEvidence.length > 0 ? <ul>{selected.consumerEvidence.map(item => <li key={`${item.path}:${item.line || 0}`}><code>{item.path}{item.line ? `:${item.line}` : ''}</code><span>{item.layer} · {item.confidence} confidence</span></li>)}</ul> : null}
              </EvidenceList>
              <EvidenceList title="Declaration sources" empty="No UnitDef or WeaponDef declaration source was captured.">
                {selected.sourcePaths.length > 0 ? <ul>{selected.sourcePaths.map(path => <li key={path}><code>{path}</code></li>)}</ul> : null}
              </EvidenceList>
              <EvidenceList title="Representative definitions" empty="No representative definition IDs were captured.">
                {[...selected.sampleUnitIds, ...selected.sampleWeaponDefs].length > 0 ? <div className="discovered-key-review__tokens">{[...selected.sampleUnitIds, ...selected.sampleWeaponDefs].map(value => <code key={value}>{value}</code>)}</div> : null}
              </EvidenceList>
              <EvidenceList title="Review risks" empty="No automatic evidence conflicts were found.">
                {selected.issues.length > 0 ? <ul className="is-warning">{selected.issues.map(issue => <li key={issue}>{issue}</li>)}</ul> : null}
              </EvidenceList>
            </div>
          </> : <div className="discovered-key-review__empty"><strong>No key selected</strong></div>}
        </main>

        <aside className="discovered-key-review__decision">
          <div><span>Maintainer annotation</span><h3>Review decision</h3><p>Stored in this browser only. It does not change compiler trust or promotion status.</p></div>
          <label><span>Decision</span><select value={draft.decision} disabled={!selected} onChange={event => updateDraft({ decision: event.target.value })}>
            {DISCOVERED_KEY_REVIEW_DECISIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          <label className="discovered-key-review__notes"><span>Review notes</span><textarea value={draft.note} disabled={!selected} maxLength={2000} placeholder="Semantics, activation conditions, constraints, and follow-up…" onChange={event => updateDraft({ note: event.target.value })} /></label>
          <small>{draft.note.length} / 2000 characters</small>
          <div className="discovered-key-review__decision-actions">
            <Button size="sm" variant="primary" disabled={!selected} onClick={saveReview}>Save local review</Button>
            <Button size="sm" variant="secondary" disabled={!selected} onClick={copyArtifact}>Copy review JSON</Button>
            <Button size="sm" variant="quiet" disabled={!savedReview} onClick={clearReview}>Clear saved review</Button>
          </div>
          {notice && <p className="discovered-key-review__notice" role="status">{notice}</p>}
          {savedReview?.reviewedAt && <p className="discovered-key-review__saved">Last saved {new Date(savedReview.reviewedAt).toLocaleString()}</p>}
          <footer><strong>Promotion remains source-controlled</strong><span>Use the copied record to curate metadata, add an editor, and attach runtime fixtures in code review.</span></footer>
        </aside>
      </div>
    </Dialog>
  );
}
