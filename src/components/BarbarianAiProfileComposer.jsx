import { useEffect, useMemo, useState } from 'react';
import {
  buildAiProfileOverlay,
  createAiProfileSchema,
  createAiProfileWorkspace,
  resetAiProfileDraft,
  resetAiProfileValue,
  updateAiProfileDraft,
  updateAiProfileValue,
} from '../utils/barbarianAiProfiles.js';
import { Button, Callout, EmptyState, StatusBadge, Switch, Tabs, Type } from './ui.jsx';

function safeFileName(value) {
  return String(value || 'barbarian-profile')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'barbarian-profile';
}

function downloadBytes(bytes, name) {
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function profileStatus(profile) {
  if (!profile.valid) return <StatusBadge status="danger">Invalid</StatusBadge>;
  if (profile.changed) return <StatusBadge status="warning">Edited</StatusBadge>;
  return <StatusBadge status="success">Imported</StatusBadge>;
}

function printableValue(field) {
  if (field.type === 'array') return field.value.map(value => String(value)).join('\n');
  return field.value === null || field.value === undefined ? '' : String(field.value);
}

function parseListDraft(source, originalValues) {
  const values = source.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  const sample = originalValues.find(value => value !== null && value !== undefined);
  if (typeof sample === 'number') {
    const numbers = values.map(Number);
    if (numbers.some(value => !Number.isFinite(value))) throw new Error('Every list entry must be a number.');
    return numbers;
  }
  if (typeof sample === 'boolean') {
    if (values.some(value => !['true', 'false'].includes(value.toLowerCase()))) {
      throw new Error('Boolean lists accept only true or false.');
    }
    return values.map(value => value.toLowerCase() === 'true');
  }
  return values;
}

function ProfileFieldEditor({ field, onChange, onReset, onOpenSource }) {
  const [draft, setDraft] = useState(printableValue(field));
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(printableValue(field));
    setError('');
  }, [field]);

  const commit = () => {
    try {
      let nextValue = draft;
      if (field.type === 'number') {
        nextValue = Number(draft);
        if (!Number.isFinite(nextValue)) throw new Error('Enter a valid number.');
      } else if (field.type === 'array') {
        nextValue = parseListDraft(draft, field.value);
      }
      setError('');
      onChange(nextValue);
    } catch (nextError) {
      setError(nextError.message);
    }
  };

  return (
    <article className={`barbarian-profile-field${field.changed ? ' is-edited' : ''}`}>
      <header className="barbarian-profile-field__header">
        <div>
          <span className="barbarian-profile-field__group">{field.groupKey}</span>
          <strong>{field.label}</strong>
        </div>
        <div className="barbarian-profile-field__status">
          {field.changed && <StatusBadge status="warning">Edited</StatusBadge>}
          <details className="barbarian-profile-field__help">
            <summary aria-label={`Help for ${field.label}`}>?</summary>
            <div role="tooltip">
              <strong>{field.label}</strong>
              <p>{field.description}</p>
              <dl>
                <div><dt>Expected</dt><dd>{field.format}</dd></div>
                <div><dt>Profile key</dt><dd><code>{field.path.join('.')}</code></dd></div>
                <div><dt>Imported</dt><dd><code>{JSON.stringify(field.originalValue)}</code></dd></div>
              </dl>
            </div>
          </details>
        </div>
      </header>

      <p className="barbarian-profile-field__description">{field.description}</p>

      {field.type === 'boolean' ? (
        <Switch
          checked={Boolean(field.value)}
          onChange={event => onChange(event.target.checked)}
          label={`${field.label}: ${field.value ? 'enabled' : 'disabled'}`}
          className="barbarian-profile-field__boolean"
        >
          <span>{field.value ? 'Enabled' : 'Disabled'}</span>
        </Switch>
      ) : field.editable ? (
        field.type === 'array' ? (
          <textarea
            className="barbarian-profile-field__input barbarian-profile-field__input--list"
            aria-label={field.label}
            aria-invalid={Boolean(error)}
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onBlur={commit}
          />
        ) : (
          <input
            className="barbarian-profile-field__input"
            type={field.type === 'number' ? 'number' : 'text'}
            aria-label={field.label}
            aria-invalid={Boolean(error)}
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={event => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                setDraft(printableValue(field));
                setError('');
                event.currentTarget.blur();
              }
            }}
          />
        )
      ) : (
        <button type="button" className="barbarian-profile-field__source-only" onClick={onOpenSource}>
          <span>Nested structure</span>
          <small>Review this value in Advanced source</small>
        </button>
      )}

      {error && <span className="barbarian-profile-field__error">{error}</span>}
      <footer>
        <code>{field.type === 'array' ? `${field.value.length} entries` : field.type}</code>
        <Button variant="quiet" size="sm" disabled={!field.changed} onClick={onReset}>Restore imported</Button>
      </footer>
    </article>
  );
}

export default function BarbarianAiProfileComposer({ audit, onNotice }) {
  const initialProfiles = useMemo(() => createAiProfileWorkspace(audit), [audit]);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [selectedId, setSelectedId] = useState(initialProfiles[0]?.id || '');
  const [packageName, setPackageName] = useState(audit?.contract?.identity?.name || 'BARbarIAn profile');
  const [editorMode, setEditorMode] = useState('visual');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [fieldQuery, setFieldQuery] = useState('');
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    setProfiles(initialProfiles);
    setSelectedId(initialProfiles[0]?.id || '');
    setPackageName(audit?.contract?.identity?.name || 'BARbarIAn profile');
    setEditorMode('visual');
    setFieldQuery('');
    setExportError('');
  }, [audit, initialProfiles]);

  const selected = profiles.find(profile => profile.id === selectedId) || profiles[0] || null;
  const schema = useMemo(() => createAiProfileSchema(selected), [selected]);
  const changedCount = profiles.filter(profile => profile.changed).length;
  const invalidCount = profiles.filter(profile => !profile.valid).length;

  useEffect(() => {
    if (!schema.groups.some(group => group.id === selectedGroup)) setSelectedGroup(schema.groups[0]?.id || '');
  }, [schema.groups, selectedGroup]);

  const replaceProfile = nextProfile => {
    setProfiles(current => current.map(profile => profile.id === nextProfile.id ? nextProfile : profile));
  };

  const visibleFields = useMemo(() => {
    const query = fieldQuery.trim().toLowerCase();
    return schema.fields.filter(field => {
      const matchesGroup = !selectedGroup || field.groupKey === selectedGroup;
      const matchesQuery = !query || `${field.label} ${field.key} ${field.description}`.toLowerCase().includes(query);
      return matchesGroup && matchesQuery;
    });
  }, [fieldQuery, schema.fields, selectedGroup]);

  const resetAll = () => {
    setProfiles(current => current.map(resetAiProfileDraft));
    setExportError('');
    onNotice?.('Restored every AI profile draft to its imported value.');
  };

  const exportOverlay = () => {
    setExportError('');
    try {
      const overlay = buildAiProfileOverlay(profiles, { packageName: packageName.trim() || 'BARbarIAn profile' });
      downloadBytes(overlay.bytes, `${safeFileName(packageName)}-profile-overlay.zip`);
      onNotice?.(`Exported ${overlay.fileCount} changed AI profile${overlay.fileCount === 1 ? '' : 's'} as a config-only overlay.`);
    } catch (error) {
      setExportError(error.message || 'The profile overlay could not be exported.');
    }
  };

  if (!profiles.length) {
    return <EmptyState title="No editable profiles discovered" description="Import a package with recognized JSON or JSONC files under a config or profiles directory." />;
  }

  return (
    <div className="barbarian-profile-composer">
      <header className="barbarian-profile-composer__header">
        <div>
          <Type variant="eyebrow">Phase 3 / Safe profile authoring</Type>
          <Type as="h3" variant="section-title">BARbarIAn Profile Composer</Type>
          <Type as="p" variant="description">Tune recognized settings through human-readable controls. Advanced source remains available without becoming the default workflow.</Type>
        </div>
        <div className="barbarian-profile-composer__header-actions">
          <label className="barbarian-profile-composer__package-name"><span>Overlay name</span><input value={packageName} maxLength={80} onChange={event => setPackageName(event.target.value)} /></label>
          <Button variant="quiet" disabled={!changedCount} onClick={resetAll}>Reset all</Button>
          <Button variant="primary" disabled={!changedCount || Boolean(invalidCount)} onClick={exportOverlay}>Export profile overlay</Button>
        </div>
      </header>

      {exportError && <Callout tone="danger" title="Overlay not exported">{exportError}</Callout>}

      <div className="barbarian-profile-composer__ledger" aria-label="Profile draft summary">
        <span><b>{profiles.length}</b> recognized profiles</span><span><b>{changedCount}</b> changed</span><span><b>{invalidCount}</b> invalid</span><span><b>Config only</b> export boundary</span>
      </div>

      <div className="barbarian-profile-composer__workspace">
        <nav className="barbarian-profile-composer__profile-list" aria-label="Editable AI profiles">
          {profiles.map(profile => (
            <button type="button" className={profile.id === selected?.id ? 'is-active' : ''} aria-current={profile.id === selected?.id ? 'page' : undefined} onClick={() => setSelectedId(profile.id)} key={profile.id}>
              <span><strong>{profile.label}</strong><code>{profile.path}</code></span>{profileStatus(profile)}
            </button>
          ))}
        </nav>

        <section className="barbarian-profile-composer__editor" aria-labelledby="barbarian-profile-editor-title">
          <header>
            <div>
              <Type variant="eyebrow">{selected.surfaceId.replaceAll('_', ' ')}</Type>
              <Type as="h4" variant="subsection-title" id="barbarian-profile-editor-title">{selected.label}</Type>
              <Type as="p" variant="description">{selected.description}</Type>
            </div>
            <div className="barbarian-profile-composer__editor-actions">{profileStatus(selected)}<Button variant="quiet" size="sm" disabled={!selected.changed} onClick={() => replaceProfile(resetAiProfileDraft(selected))}>Reset profile</Button></div>
          </header>

          <div className="barbarian-profile-composer__profile-facts">
            <span><b>{selected.summary?.groups ?? 0}</b> top-level groups</span><span><b>{schema.editableCount}</b> visual controls</span><span><b>{schema.sourceOnlyCount}</b> source-only values</span><span><b>{selected.summary?.maximumDepth ?? 0}</b> levels deep</span>
          </div>

          <Tabs
            className="barbarian-profile-composer__mode-tabs"
            label="Profile editing mode"
            value={editorMode}
            onChange={setEditorMode}
            items={[
              { id: 'visual', label: 'Visual editor', count: schema.editableCount, panelId: 'barbarian-profile-visual-panel' },
              { id: 'source', label: 'Advanced source', panelId: 'barbarian-profile-source-panel' },
            ]}
          />

          {editorMode === 'visual' ? (
            <div id="barbarian-profile-visual-panel" role="tabpanel" className="barbarian-profile-composer__visual-panel">
              <div className="barbarian-profile-composer__schema-toolbar">
                <div><Type variant="eyebrow">Human-readable schema</Type><strong>{visibleFields.length} settings shown</strong><small>Unknown keys stay preserved even when they do not have a visual control.</small></div>
                <label><span>Find a setting</span><input type="search" value={fieldQuery} placeholder="Economy, threat, retreat..." onChange={event => setFieldQuery(event.target.value)} /></label>
              </div>
              <div className="barbarian-profile-composer__visual-workspace">
                <nav className="barbarian-profile-composer__visual-groups" aria-label="Profile setting groups">
                  {schema.groups.map(group => (
                    <button key={group.id} type="button" className={selectedGroup === group.id ? 'is-active' : ''} aria-pressed={selectedGroup === group.id} onClick={() => setSelectedGroup(group.id)}>
                      <span><strong>{group.label}</strong><small>{group.editableCount} editable</small></span><b>{group.count}</b>
                    </button>
                  ))}
                </nav>
                <div className="barbarian-profile-composer__field-area">
                  {visibleFields.length ? (
                    <div className="barbarian-profile-composer__field-grid">
                      {visibleFields.map(field => (
                        <ProfileFieldEditor
                          key={field.id}
                          field={field}
                          onChange={value => replaceProfile(updateAiProfileValue(selected, field.path, value))}
                          onReset={() => replaceProfile(resetAiProfileValue(selected, field.path))}
                          onOpenSource={() => setEditorMode('source')}
                        />
                      ))}
                    </div>
                  ) : <EmptyState title="No matching settings" description="Try another group or clear the setting search." />}
                </div>
              </div>
            </div>
          ) : (
            <div id="barbarian-profile-source-panel" role="tabpanel" className="barbarian-profile-composer__editor-grid">
              <div className="barbarian-profile-composer__group-index"><Type variant="eyebrow">Advanced editing</Type><p>Use source mode for nested structures and package-specific keys not yet represented visually.</p>{selected.groups.map(group => <div key={group.key}><code>{group.key}</code><span>{group.type} / {group.entries} entries</span></div>)}</div>
              <label className="barbarian-profile-composer__source-field"><span>Validated JSONC profile</span><textarea spellCheck="false" value={selected.draftSource} aria-invalid={!selected.valid} aria-describedby="barbarian-profile-source-help" onChange={event => replaceProfile(updateAiProfileDraft(selected, event.target.value))} /><small id="barbarian-profile-source-help">Unknown fields are preserved. Exported overlays use normalized JSON for deterministic output.</small></label>
            </div>
          )}

          {!selected.valid && <Callout tone="danger" title="Profile syntax needs attention">{selected.error}</Callout>}
        </section>
      </div>
    </div>
  );
}
