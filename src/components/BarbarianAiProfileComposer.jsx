import { useEffect, useMemo, useState } from 'react';
import {
  buildAiProfileOverlay,
  createAiProfileWorkspace,
  resetAiProfileDraft,
  updateAiProfileDraft,
} from '../utils/barbarianAiProfiles.js';
import { Button, Callout, EmptyState, StatusBadge, Type } from './ui.jsx';

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

export default function BarbarianAiProfileComposer({ audit, onNotice }) {
  const initialProfiles = useMemo(() => createAiProfileWorkspace(audit), [audit]);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [selectedId, setSelectedId] = useState(initialProfiles[0]?.id || '');
  const [packageName, setPackageName] = useState(audit?.contract?.identity?.name || 'BARbarIAn profile');
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    setProfiles(initialProfiles);
    setSelectedId(initialProfiles[0]?.id || '');
    setPackageName(audit?.contract?.identity?.name || 'BARbarIAn profile');
    setExportError('');
  }, [audit, initialProfiles]);

  const selected = profiles.find(profile => profile.id === selectedId) || profiles[0] || null;
  const changedCount = profiles.filter(profile => profile.changed).length;
  const invalidCount = profiles.filter(profile => !profile.valid).length;

  const replaceProfile = nextProfile => {
    setProfiles(current => current.map(profile => profile.id === nextProfile.id ? nextProfile : profile));
  };

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
    return (
      <EmptyState
        title="No editable profiles discovered"
        description="Import a package with recognized JSON or JSONC files under a config or profiles directory. Native code and scripts remain inspection-only."
      />
    );
  }

  return (
    <div className="barbarian-profile-composer">
      <header className="barbarian-profile-composer__header">
        <div>
          <Type variant="eyebrow">Phase 3 / Safe profile authoring</Type>
          <Type as="h3" variant="section-title">BARbarIAn Profile Composer</Type>
          <Type as="p" variant="description">
            Tune recognized configuration data locally. Exports contain changed JSON profiles only; never DLLs, Lua, or AngelScript.
          </Type>
        </div>
        <div className="barbarian-profile-composer__header-actions">
          <label className="barbarian-profile-composer__package-name">
            <span>Overlay name</span>
            <input value={packageName} maxLength={80} onChange={event => setPackageName(event.target.value)} />
          </label>
          <Button variant="quiet" disabled={!changedCount} onClick={resetAll}>Reset all</Button>
          <Button variant="primary" disabled={!changedCount || Boolean(invalidCount)} onClick={exportOverlay}>Export profile overlay</Button>
        </div>
      </header>

      {exportError && <Callout tone="danger" title="Overlay not exported">{exportError}</Callout>}

      <div className="barbarian-profile-composer__ledger" aria-label="Profile draft summary">
        <span><b>{profiles.length}</b> recognized profiles</span>
        <span><b>{changedCount}</b> changed</span>
        <span><b>{invalidCount}</b> invalid</span>
        <span><b>Config only</b> export boundary</span>
      </div>

      <div className="barbarian-profile-composer__workspace">
        <nav className="barbarian-profile-composer__profile-list" aria-label="Editable AI profiles">
          {profiles.map(profile => (
            <button
              type="button"
              className={profile.id === selected?.id ? 'is-active' : ''}
              aria-current={profile.id === selected?.id ? 'page' : undefined}
              onClick={() => setSelectedId(profile.id)}
              key={profile.id}
            >
              <span><strong>{profile.label}</strong><code>{profile.path}</code></span>
              {profileStatus(profile)}
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
            <div className="barbarian-profile-composer__editor-actions">
              {profileStatus(selected)}
              <Button variant="quiet" size="sm" disabled={!selected.changed} onClick={() => replaceProfile(resetAiProfileDraft(selected))}>Reset profile</Button>
            </div>
          </header>

          <div className="barbarian-profile-composer__profile-facts">
            <span><b>{selected.summary?.groups ?? 0}</b> top-level groups</span>
            <span><b>{selected.summary?.scalars ?? 0}</b> scalar values</span>
            <span><b>{selected.summary?.arrays ?? 0}</b> arrays</span>
            <span><b>{selected.summary?.maximumDepth ?? 0}</b> levels deep</span>
          </div>

          <div className="barbarian-profile-composer__editor-grid">
            <div className="barbarian-profile-composer__group-index">
              <Type variant="eyebrow">Configuration map</Type>
              {selected.groups.length ? selected.groups.map(group => (
                <div key={group.key}>
                  <code>{group.key}</code>
                  <span>{group.type} / {group.entries} {group.entries === 1 ? 'entry' : 'entries'}</span>
                </div>
              )) : <Type as="p" variant="description">The draft cannot be indexed until its JSONC is valid.</Type>}
            </div>

            <label className="barbarian-profile-composer__source-field">
              <span>Validated JSONC profile</span>
              <textarea
                spellCheck="false"
                value={selected.draftSource}
                aria-invalid={!selected.valid}
                aria-describedby="barbarian-profile-source-help"
                onChange={event => replaceProfile(updateAiProfileDraft(selected, event.target.value))}
              />
              <small id="barbarian-profile-source-help">
                Unknown fields are preserved. Comments may be entered, but exported overlays use normalized JSON for deterministic output.
              </small>
            </label>
          </div>

          {!selected.valid && <Callout tone="danger" title="Profile syntax needs attention">{selected.error}</Callout>}
        </section>
      </div>
    </div>
  );
}
