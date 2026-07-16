import { Button, EmptyState, PageShell, SwitchField, Tabs, TextAreaField, TextField } from './ui.jsx';

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
  totalBytesUsed, lobbyByteLimit, limitRisk,
  collectionScope,
  onBack, onExport, onOpenSummary, onEditUnit, onToast
}) {
  const openSummary = tab => onOpenSummary(tab);
  const copyOutput = async () => {
    await navigator.clipboard.writeText(activeCompiledOutput || activeCompiledOutputFallback);
    onToast('Compiled output copied');
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

        <aside className="export-console">
          <div className="export-console-header"><div><span className="workflow-eyebrow">Export console</span><h3>{projectName}</h3></div><span className={`review-status ${limitRisk}`}>{totalBytesUsed.toLocaleString()} / {lobbyByteLimit.toLocaleString()} bytes</span></div>
          <div className="export-metadata-grid">
            <TextField label="Mod name" value={projectName} onChange={event => setProjectName(event.target.value)} />
            <TextField label="Author" value={projectAuthor} onChange={event => setProjectAuthor(event.target.value)} />
            <TextAreaField className="full" label="Description" value={projectDesc} onChange={event => setProjectDesc(event.target.value)} />
          </div>
          <div className="export-flags">
            <SwitchField label="Parameter tweaks" checked={includeTweaks} onChange={event => setIncludeTweaks(event.target.checked)} />
            <SwitchField label="Custom units" checked={includeClones} onChange={event => setIncludeClones(event.target.checked)} />
            <SwitchField label="Build menus" checked={includeRosters} onChange={event => setIncludeRosters(event.target.checked)} />
            <SwitchField label="Header comments" checked={includeHeader} onChange={event => setIncludeHeader(event.target.checked)} />
          </div>
          <Tabs className="export-output-tabs" size="sm" label="Generated output format" items={EXPORT_TABS} value={activeOutputTab} onChange={setActiveOutputTab} />
          <pre className="export-code-preview">{activeCompiledOutput || activeCompiledOutputFallback}</pre>
          <div className="export-primary-actions"><Button onClick={copyOutput}>Copy current output</Button><Button variant="primary" onClick={onExport}>Download project JSON</Button></div>
        </aside>
      </div>
    </PageShell>
  );
}
