import { useMemo, useState } from 'react';
import { Button, EmptyState, PageShell, TextAreaField, TextField, Type } from './ui.jsx';
import '../styles/features/preset-gallery.css';

function getPresetMetrics(preset) {
  const snapshot = preset.snapshot || {};
  const tweakCount = Object.keys(snapshot.tweaks || {}).length;
  const cloneCount = (snapshot.clones || []).length;
  const rosterCount = (snapshot.buildMenuSteps || []).length;
  return {
    tweakCount,
    cloneCount,
    rosterCount,
    totalChanges: tweakCount + cloneCount + rosterCount,
  };
}

export default function PresetGalleryPage({
  presets,
  projectName,
  presetName,
  presetDescription,
  onPresetNameChange,
  onPresetDescriptionChange,
  onSave,
  onApply,
  onDelete,
  onClose,
}) {
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState('newest');
  const [pendingDeleteId, setPendingDeleteId] = useState('');

  const enrichedPresets = useMemo(() => presets.map(preset => ({
    ...preset,
    metrics: getPresetMetrics(preset),
  })), [presets]);

  const visiblePresets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = normalizedQuery
      ? enrichedPresets.filter(preset => `${preset.name || ''} ${preset.description || ''}`.toLowerCase().includes(normalizedQuery))
      : [...enrichedPresets];

    return matches.sort((left, right) => {
      if (sortMode === 'oldest') return new Date(left.createdAt) - new Date(right.createdAt);
      if (sortMode === 'name') return String(left.name || '').localeCompare(String(right.name || ''), 'en');
      if (sortMode === 'changes') return right.metrics.totalChanges - left.metrics.totalChanges;
      return new Date(right.createdAt) - new Date(left.createdAt);
    });
  }, [enrichedPresets, query, sortMode]);

  const libraryTotals = enrichedPresets.reduce((totals, preset) => ({
    changes: totals.changes + preset.metrics.totalChanges,
    clones: totals.clones + preset.metrics.cloneCount,
    rosters: totals.rosters + preset.metrics.rosterCount,
  }), { changes: 0, clones: 0, rosters: 0 });

  const requestDelete = presetId => setPendingDeleteId(presetId);
  const confirmDelete = presetId => {
    onDelete(presetId);
    setPendingDeleteId('');
  };

  return (
    <PageShell
      className="preset-gallery-page"
      label="Preset Gallery"
      eyebrow="Experiment library"
      title="Preset Gallery"
      description="Capture complete project states, compare experiments, and return to a known design without rebuilding."
      capabilityId="tool.preset-gallery"
      metrics={[
        { label: 'Saved presets', value: presets.length },
        { label: 'Recorded changes', value: libraryTotals.changes },
      ]}
      actions={<Button className="preset-gallery-close" onClick={onClose}>Back to editor</Button>}
      bodyClassName="preset-gallery-page__body"
    >
      <div className="preset-gallery-workbench">
        <aside className="preset-capture-panel" aria-labelledby="preset-capture-title">
          <div className="preset-capture-panel__heading">
            <Type variant="eyebrow">Capture station</Type>
            <Type as="h3" variant="section-title" id="preset-capture-title">Save the current project</Type>
            <Type as="p" variant="description">Store every active tweak, clone, build-menu change, and compiler preference as one local snapshot.</Type>
          </div>

          <div className="preset-capture-project">
            <small>Active project</small>
            <strong>{projectName || 'Untitled project'}</strong>
            <span>Local project snapshot</span>
          </div>

          <div className="preset-capture-form">
            <TextField
              label="Preset name"
              placeholder={`${projectName || 'Project'} preset`}
              value={presetName}
              onChange={event => onPresetNameChange(event.target.value)}
            />
            <TextAreaField
              label="Design note"
              placeholder="What changed, and what should this version prove?"
              value={presetDescription}
              onChange={event => onPresetDescriptionChange(event.target.value)}
              rows={3}
            />
          </div>

          <ul className="preset-capture-scope" aria-label="Preset contents">
            <li><span>Unit definitions</span><strong>Included</strong></li>
            <li><span>Clone identities</span><strong>Included</strong></li>
            <li><span>Factory rosters</span><strong>Included</strong></li>
            <li><span>Export settings</span><strong>Included</strong></li>
          </ul>

          <Button variant="primary" className="preset-save-action" onClick={onSave}>Save current preset</Button>
          <p className="preset-capture-footnote">Presets remain in this browser until they are deleted or local site data is cleared.</p>
        </aside>

        <section className="preset-library" aria-labelledby="preset-library-title">
          <header className="preset-library-header">
            <div className="preset-library-heading">
              <Type variant="eyebrow">Saved experiments</Type>
              <Type as="h3" variant="section-title" id="preset-library-title">Project snapshots</Type>
              <Type as="p" variant="description">Open a snapshot to replace the active editor state with that saved configuration.</Type>
            </div>
            <dl className="preset-library-summary">
              <div><dt>Presets</dt><dd>{presets.length}</dd></div>
              <div><dt>Clones</dt><dd>{libraryTotals.clones}</dd></div>
              <div><dt>Rosters</dt><dd>{libraryTotals.rosters}</dd></div>
            </dl>
          </header>

          <div className="preset-library-toolbar">
            <label className="preset-search-field">
              <span className="ui-visually-hidden">Search saved presets</span>
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search names or design notes..."
              />
            </label>
            <label className="preset-sort-field">
              <span>Sort</span>
              <select value={sortMode} onChange={event => setSortMode(event.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Name</option>
                <option value="changes">Most changes</option>
              </select>
            </label>
            <span className="preset-result-count" aria-live="polite">{visiblePresets.length} shown</span>
          </div>

          <div className="preset-gallery-content">
            {visiblePresets.length > 0 ? (
              <div className="preset-card-grid">
                {visiblePresets.map((preset, index) => {
                  const { tweakCount, cloneCount, rosterCount, totalChanges } = preset.metrics;
                  const pendingDelete = pendingDeleteId === preset.id;
                  return (
                    <article className="preset-card" key={preset.id}>
                      <div className="preset-card-heading">
                        <span className="preset-card-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                        <div className="preset-card-identity">
                          <Type variant="eyebrow" className="preset-card-overline">Project snapshot</Type>
                          <Type as="h4" variant="subsection-title">{preset.name}</Type>
                        </div>
                        <time dateTime={preset.createdAt}>{new Date(preset.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</time>
                      </div>

                      <p className="preset-card-description">{preset.description || 'Saved editor configuration'}</p>

                      <dl className="preset-card-metrics" aria-label={`${preset.name} summary`}>
                        <div><dt>Unit tweaks</dt><dd>{tweakCount}</dd></div>
                        <div><dt>Custom units</dt><dd>{cloneCount}</dd></div>
                        <div><dt>Roster edits</dt><dd>{rosterCount}</dd></div>
                      </dl>

                      <footer className="preset-card-footer">
                        <span><strong>{totalChanges}</strong> recorded changes</span>
                        <div className="preset-card-actions">
                          <Button variant="primary" className="preset-apply-action" onClick={() => onApply(preset)}>Open preset</Button>
                          <Button variant="danger" className="preset-delete-action" onClick={() => requestDelete(preset.id)} aria-label={`Delete ${preset.name}`}>Delete</Button>
                        </div>
                      </footer>

                      {pendingDelete && (
                        <div className="preset-delete-confirmation" role="alertdialog" aria-labelledby={`delete-preset-${preset.id}`}>
                          <div>
                            <strong id={`delete-preset-${preset.id}`}>Delete this preset?</strong>
                            <span>This local snapshot cannot be restored after deletion.</span>
                          </div>
                          <div>
                            <Button size="sm" onClick={() => setPendingDeleteId('')}>Cancel</Button>
                            <Button size="sm" variant="danger" onClick={() => confirmDelete(preset.id)}>Delete permanently</Button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : presets.length === 0 ? (
              <EmptyState
                className="preset-empty-state"
                title="No saved presets yet"
                description="Name the current project state in the capture station, then save your first reusable snapshot."
              />
            ) : (
              <EmptyState
                className="preset-empty-state"
                title="No presets match"
                description="Clear the search or try a different name or design note."
                action={<Button size="sm" onClick={() => setQuery('')}>Clear search</Button>}
              />
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
