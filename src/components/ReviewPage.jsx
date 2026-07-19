import { useState } from 'react';
import { Button, EmptyState, PageShell, SwitchField, Tabs, TextAreaField, TextField } from './ui.jsx';
import '../styles/features/review-export.css';

const EXPORT_TABS = [
  { id: 'tweakdefs_lua', label: 'Definitions Lua' },
  { id: 'tweakunits_lua', label: 'Units Lua' },
  { id: 'tweakdefs_b64', label: 'Definitions Base64' },
  { id: 'tweakunits_b64', label: 'Units Base64' }
];

export default function ReviewPage({
  modifiedUnitIds, tweaks, clones, buildMenuSteps, disabledUnitIds, validationIssues,
  projectChangeCount, unitNames, projectName, projectAuthor, projectDesc,
  setProjectName, setProjectAuthor, setProjectDesc,
  includeTweaks, includeClones, includeRosters, includeHeader,
  setIncludeTweaks, setIncludeClones, setIncludeRosters, setIncludeHeader,
  activeOutputTab, setActiveOutputTab, activeCompiledOutput, activeCompiledOutputFallback,
  tweakDefsB64, tweakUnitsB64,
  totalBytesUsed, lobbyByteLimit, limitRisk,
  compiledLobbyModules, lobbyCommands,
  collectionScope,
  onBack, onExport, onOpenSummary, onEditUnit, onToast
}) {
  const [selectedSlotField, setSelectedSlotField] = useState('');
  const [slotPreviewMode, setSlotPreviewMode] = useState('command');
  const lobbySlots = compiledLobbyModules?.slots || [];
  const selectedLobbySlot = lobbySlots.find(slot => slot.fieldName === selectedSlotField) || lobbySlots[0] || null;
  const selectedSlotOutput = selectedLobbySlot
    ? slotPreviewMode === 'lua'
      ? selectedLobbySlot.lua
      : slotPreviewMode === 'base64'
        ? selectedLobbySlot.encoded
        : selectedLobbySlot.command
    : '';
  const openSummary = tab => onOpenSummary(tab);
  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(activeCompiledOutput || activeCompiledOutputFallback);
      onToast('Compiled output copied');
    } catch {
      onToast('Could not copy output. Select the text and copy it manually.');
    }
  };
  const copyLobbyValue = async (label, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      onToast(`${label} value copied`);
    } catch {
      onToast(`Could not copy ${label}. Open its Base64 tab and copy it manually.`);
    }
  };
  const copyAllLobbyCommands = async () => {
    if (!lobbyCommands || compiledLobbyModules?.overflow) return;
    try {
      await navigator.clipboard.writeText(lobbyCommands);
      onToast('All numbered !bset commands copied');
    } catch {
      onToast('Could not copy lobby commands. Copy each slot separately.');
    }
  };

  return (
    <PageShell className="review-workspace" label="Review and export">
      <div className="review-page-header">
        <div>
          <span className="workflow-eyebrow">Final review</span>
          <h2>Review &amp; Export</h2>
          <p>Validate the project, inspect every change, and prepare the generated BAR configuration.</p>
        </div>
        <div className="review-header-actions">
          <Button onClick={onBack}>Back to editor</Button>
          <Button variant="primary" onClick={onExport}>Download project file</Button>
        </div>
      </div>

      <div className="review-content-grid">
        <div className="review-main-column">
          <section className="review-summary-grid" aria-label="Project summary">
            <button onClick={() => openSummary('tweaks')}><span>Modified units</span><strong>{modifiedUnitIds.length}</strong><small>Parameter overrides</small></button>
            <button onClick={() => openSummary('clones')}><span>Custom units</span><strong>{clones.length}</strong><small>Cloned definitions</small></button>
            <button onClick={() => openSummary('rosters')}><span>Build menus</span><strong>{buildMenuSteps.length}</strong><small>Roster operations</small></button>
            <div><span>Disabled units</span><strong>{disabledUnitIds.length}</strong><small>Removed from play</small></div>
          </section>

          {collectionScope && (
            <section className="review-card review-collection-summary" aria-labelledby="review-collection-title">
              <div className="review-card-heading">
                <div><span className="workflow-eyebrow">Active collection scope</span><h3 id="review-collection-title">{collectionScope.name}</h3></div>
                <span className="review-status ready">Summary scope</span>
              </div>
              <div className="review-summary-grid">
                <div><span>Available members</span><strong>{collectionScope.unitCount}</strong><small>Includes nested folders</small></div>
                <div><span>Edited members</span><strong>{collectionScope.modifiedCount}</strong><small>Parameter or description edits</small></div>
                <div><span>Validation issues</span><strong>{collectionScope.validationCount}</strong><small>Inside this collection</small></div>
              </div>
              <p>Collection scope filters this summary and editor tools. Project export still includes every enabled subsystem.</p>
            </section>
          )}

          <section className="review-card validation-center">
            <div className="review-card-heading">
              <div><span className="workflow-eyebrow">Validation center</span><h3>{validationIssues.length === 0 ? 'Ready to export' : `${validationIssues.length} ${validationIssues.length === 1 ? 'issue' : 'issues'} to review`}</h3></div>
              <span className={`review-status ${validationIssues.some(issue => issue.level === 'error') ? 'error' : validationIssues.length ? 'warning' : 'ready'}`}>{validationIssues.some(issue => issue.level === 'error') ? 'Blocked' : validationIssues.length ? 'Review' : 'Ready'}</span>
            </div>
            {validationIssues.length === 0 ? (
              <EmptyState compact className="review-empty-state" title="No validation issues detected" description="Your current parameter values pass the editor's safety checks." />
            ) : (
              <div className="validation-list">{validationIssues.map((issue, index) => <div key={`${issue.unitName}-${issue.key}-${index}`} className={`validation-row ${issue.level}`}><span>{issue.unitName}</span><code>{issue.key.replace('weapon_slot_', 'Weapon ')}</code><strong>{issue.message}</strong></div>)}</div>
            )}
          </section>

          <section className="review-card change-ledger">
            <div className="review-card-heading"><div><span className="workflow-eyebrow">Change ledger</span><h3>{projectChangeCount} project changes</h3></div><button className="text-button" onClick={() => openSummary('tweaks')}>Open full summary</button></div>
            {modifiedUnitIds.length === 0 && clones.length === 0 && disabledUnitIds.length === 0 ? (
              <EmptyState compact className="review-empty-state" title="No unit changes yet" description="Return to Edit Units to begin modifying the project." />
            ) : (
              <div className="change-ledger-list">
                {modifiedUnitIds.slice(0, 8).map(id => <button key={id} onClick={() => onEditUnit(id)}><span>{unitNames[id] || id}</span><code>{Object.keys(tweaks[id] || {}).length} fields</code><strong>Edit →</strong></button>)}
                {modifiedUnitIds.length > 8 && <div className="ledger-more">+{modifiedUnitIds.length - 8} more modified units</div>}
              </div>
            )}
          </section>
        </div>

        <aside className="modular-export-console" aria-label="Export console">
          <header className="modular-export-console__header">
            <div>
              <span className="workflow-eyebrow">Lobby delivery</span>
              <h3>Export Console</h3>
              <p>{projectName || 'Untitled BAR project'}</p>
            </div>
            <div className="export-console-health">
              <span className={`review-status ${compiledLobbyModules?.overflow ? 'error' : limitRisk}`}>{compiledLobbyModules?.overflow ? 'Blocked' : 'Package ready'}</span>
              <small>{totalBytesUsed.toLocaleString()} encoded bytes</small>
            </div>
          </header>

          <details className="export-console-config" open>
            <summary><span>Package identity</span><small>Name, attribution, and enabled systems</small></summary>
            <div className="export-metadata-grid">
              <TextField label="Mod name" value={projectName} onChange={event => setProjectName(event.target.value)} />
              <TextField label="Author" value={projectAuthor} onChange={event => setProjectAuthor(event.target.value)} />
              <TextAreaField className="full" label="Description" value={projectDesc} onChange={event => setProjectDesc(event.target.value)} />
            </div>
            <div className="export-console-flags">
              <SwitchField label="Parameter tweaks" checked={includeTweaks} onChange={event => setIncludeTweaks(event.target.checked)} />
              <SwitchField label="Custom units" checked={includeClones} onChange={event => setIncludeClones(event.target.checked)} />
              <SwitchField label="Build menus" checked={includeRosters} onChange={event => setIncludeRosters(event.target.checked)} />
              <SwitchField label="Header comments" checked={includeHeader} onChange={event => setIncludeHeader(event.target.checked)} />
            </div>
          </details>

          <section className="modular-lobby-package" aria-labelledby="lobby-export-guide-title">
            <div className="modular-lobby-package__heading">
              <div>
                <span className="workflow-eyebrow">Current BAR setup</span>
                <h4 id="lobby-export-guide-title">Numbered lobby package</h4>
                <p>Definitions load first, followed by Units. Each group has exactly nine available fields.</p>
              </div>
              <Button variant="primary" onClick={copyAllLobbyCommands} disabled={!lobbyCommands || compiledLobbyModules?.overflow}>Copy all !bset commands</Button>
            </div>

            <div className="lobby-slot-capacity" aria-label="Lobby slot usage">
              {[
                { id: 'defs', label: 'Definitions', data: compiledLobbyModules?.defs },
                { id: 'units', label: 'Units', data: compiledLobbyModules?.units },
              ].map(group => (
                <div key={group.id} className={group.data?.overflow ? 'is-overflow' : ''} style={{ '--slot-capacity': `${Math.min(100, ((group.data?.required || 0) / 9) * 100)}%` }}>
                  <span>{group.label}</span>
                  <strong>{group.data?.required || 0} / 9</strong>
                  <i aria-hidden="true"><b /></i>
                </div>
              ))}
            </div>

            {compiledLobbyModules?.overflow && (
              <div className="lobby-slot-overflow" role="alert">
                <strong>Package exceeds the available BAR fields.</strong>
                <span>Disable imported modules or reduce generated sections before copying commands.</span>
                {[...(compiledLobbyModules.defs.overflow ? compiledLobbyModules.defs.largestModules : []), ...(compiledLobbyModules.units.overflow ? compiledLobbyModules.units.largestModules : [])]
                  .slice(0, 3)
                  .map(module => <small key={`${module.id}-${module.label}`}>{module.label} · {module.encodedBytes.toLocaleString()} bytes{module.source === 'imported' ? ' · disable from Tweak Package Lab' : ''}</small>)}
              </div>
            )}

            <div className="lobby-slot-workbench">
              <nav className="lobby-slot-index" aria-label="Generated lobby slots">
                {['defs', 'units'].map(kind => (
                  <div className="lobby-slot-index__group" key={kind}>
                    <span>{kind === 'defs' ? 'Definitions' : 'Units'}</span>
                    {lobbySlots.filter(slot => slot.kind === kind).map(slot => (
                      <button
                        type="button"
                        key={slot.fieldName}
                        className={selectedLobbySlot?.fieldName === slot.fieldName ? 'is-active' : ''}
                        aria-pressed={selectedLobbySlot?.fieldName === slot.fieldName}
                        onClick={() => setSelectedSlotField(slot.fieldName)}
                      >
                        <strong>{slot.fieldName}</strong>
                        <small>{slot.encodedBytes.toLocaleString()} B</small>
                      </button>
                    ))}
                    {!lobbySlots.some(slot => slot.kind === kind) && <em>No generated slots</em>}
                  </div>
                ))}
              </nav>

              <section className="lobby-slot-viewer" aria-live="polite">
                {selectedLobbySlot ? (
                  <>
                    <div className="lobby-slot-viewer__header">
                      <div>
                        <span>{selectedLobbySlot.source === 'imported' ? 'Imported module' : 'Editor generated'}</span>
                        <h5>{selectedLobbySlot.fieldName}</h5>
                        <p>{selectedLobbySlot.label}</p>
                      </div>
                      <span className={`slot-compatibility is-${selectedLobbySlot.compatibility}`}>{selectedLobbySlot.compatibility === 'advisory' ? 'Size advisory' : 'Compatible'}</span>
                    </div>
                    <div className="lobby-slot-viewer__toolbar">
                      <div role="group" aria-label="Slot preview format">
                        {[
                          ['command', '!bset'],
                          ['lua', 'Lua'],
                          ['base64', 'Base64'],
                        ].map(([id, label]) => <button type="button" key={id} className={slotPreviewMode === id ? 'is-active' : ''} aria-pressed={slotPreviewMode === id} onClick={() => setSlotPreviewMode(id)}>{label}</button>)}
                      </div>
                      <Button size="sm" onClick={() => copyLobbyValue(selectedLobbySlot.fieldName, selectedLobbySlot.command)}>Copy this !bset</Button>
                    </div>
                    <pre className="lobby-slot-code">{selectedSlotOutput}</pre>
                  </>
                ) : (
                  <EmptyState compact title="No lobby output yet" description="Enable a subsystem or import a module to generate numbered BAR fields." />
                )}
              </section>
            </div>
          </section>

          <details className="legacy-compiler-panel">
            <summary>
              <span><strong>Legacy combined compiler</strong><small>Compatibility inspection only</small></span>
              <em>{lobbyByteLimit.toLocaleString()} byte advisory</em>
            </summary>
            <div className="legacy-compiler-panel__body">
              <p>The numbered package above is the recommended export. Use this view only for older workflows expecting one combined Definitions and Units payload.</p>
              <Tabs className="export-output-tabs" size="sm" label="Legacy generated output format" items={EXPORT_TABS} value={activeOutputTab} onChange={setActiveOutputTab} />
              <pre className="export-code-preview">{activeCompiledOutput || activeCompiledOutputFallback}</pre>
              <div className="legacy-lobby-quick-actions" aria-label="Legacy combined payloads">
                <Button size="sm" onClick={() => copyLobbyValue('Tweak Defs', tweakDefsB64)} disabled={!tweakDefsB64}>Copy Defs Base64</Button>
                <Button size="sm" onClick={() => copyLobbyValue('Tweak Units', tweakUnitsB64)} disabled={!tweakUnitsB64}>Copy Units Base64</Button>
                <Button size="sm" onClick={copyOutput}>Copy current output</Button>
              </div>
            </div>
          </details>

          <footer className="export-console-footer">
            <div><strong>Project document</strong><span>Save editable clones, modules, presets, and compiler settings.</span></div>
            <Button onClick={onExport}>Download project JSON</Button>
          </footer>
        </aside>
      </div>
    </PageShell>
  );
}
