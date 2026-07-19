import { useMemo, useState } from 'react';
import { analyzeTweakPackage, MAX_TWEAK_PACKAGE_BYTES, parseTweakPackageInput } from '../utils/tweakPackage.js';
import { Button, EmptyState, PageShell, Switch } from './ui.jsx';
import '../styles/features/tweak-package-lab.css';

function ModuleCard({ module, selected, analysis, onSelect, onUpdate, onRemove, onMove }) {
  return (
    <article className={`tweak-module-card ${selected ? 'is-selected' : ''}`}>
      <button type="button" className="tweak-module-card__main" onClick={onSelect}>
        <span className={`tweak-module-kind is-${module.kind}`}>{module.kind === 'defs' ? 'DEFS' : 'UNITS'}</span>
        <span><strong>{module.label}</strong><small>{analysis.decodedBytes.toLocaleString()} decoded bytes</small></span>
        <em>{analysis.warnings.length ? `${analysis.warnings.length} notices` : 'Parsed'}</em>
      </button>
      <div className="tweak-module-card__actions">
        <Switch
          label={`Include ${module.label} in lobby output`}
          checked={module.enabled}
          disabled={module.converted}
          onChange={event => onUpdate({ enabled: event.target.checked })}
        />
        <span className="tweak-module-order" aria-label="Module order controls">
          <button type="button" onClick={() => onMove(-1)} aria-label={`Move ${module.label} earlier`}>↑</button>
          <button type="button" onClick={() => onMove(1)} aria-label={`Move ${module.label} later`}>↓</button>
        </span>
        <button type="button" onClick={onRemove} aria-label={`Remove ${module.label}`}>Remove</button>
      </div>
    </article>
  );
}

export default function TweakPackageLabPage({
  modules, compiledModules, onAddModules, onUpdateModule, onRemoveModule,
  onMoveModule, onApplyConversions, onBack, onToast, knownUnitIds = [],
}) {
  const [selectedId, setSelectedId] = useState(modules[0]?.id || null);
  const [pasteValue, setPasteValue] = useState('');
  const [rawKind, setRawKind] = useState('defs');
  const packageAnalysis = useMemo(
    () => analyzeTweakPackage(modules, { knownUnitIds }),
    [knownUnitIds, modules]
  );
  const analyses = packageAnalysis.analyses;
  const packageDiagnostics = useMemo(() => {
    const requirements = [...new Set(modules.flatMap(module => module.requirements || []))];
    const fields = modules.reduce((groups, module) => {
      if (!module.originalFieldName) return groups;
      groups[module.originalFieldName] = (groups[module.originalFieldName] || 0) + 1;
      return groups;
    }, {});
    const duplicateFields = Object.entries(fields).filter(([, count]) => count > 1);
    const legacyFields = modules.filter(module => module.originalFieldName && !/\d+$/.test(module.originalFieldName));
    return { requirements, duplicateFields, legacyFields };
  }, [modules]);
  const selected = modules.find(module => module.id === selectedId) || modules[0] || null;
  const selectedAnalysis = selected ? analyses.get(selected.id) : null;
  const selectedReport = selected ? packageAnalysis.moduleReports.find(report => report.moduleId === selected.id) : null;
  const moduleLabel = moduleId => modules.find(module => module.id === moduleId)?.label || moduleId;

  const importText = (text, options = {}) => {
    const result = parseTweakPackageInput(text, { kind: rawKind, ...options });
    if (result.modules.length) {
      onAddModules(result.modules);
      setSelectedId(result.modules[0].id);
      setPasteValue('');
      onToast(`${result.modules.length} tweak module${result.modules.length === 1 ? '' : 's'} imported disabled.`);
    }
    if (result.errors.length) onToast(result.errors.join(' '));
    else if (result.notices?.length) onToast(result.notices.join(' '));
  };

  const importFiles = async event => {
    const files = [...(event.target.files || [])];
    const imported = [];
    const errors = [];
    const notices = [];
    for (const file of files) {
      const result = parseTweakPackageInput(await file.text(), { kind: rawKind, sourceName: file.name });
      imported.push(...result.modules);
      errors.push(...result.errors.map(error => `${file.name}: ${error}`));
      notices.push(...(result.notices || []).map(notice => `${file.name}: ${notice}`));
    }
    const decodedBytes = imported.reduce((total, module) => total + new TextEncoder().encode(module.rawLua).byteLength, 0);
    if (decodedBytes > MAX_TWEAK_PACKAGE_BYTES) {
      onToast('The selected files exceed the 5 MB decoded package limit. Nothing was imported.');
      event.target.value = '';
      return;
    }
    if (imported.length) {
      onAddModules(imported);
      setSelectedId(imported[0].id);
      onToast(`${imported.length} tweak module${imported.length === 1 ? '' : 's'} imported disabled.`);
    }
    if (errors.length) onToast(errors.join(' '));
    else if (notices.length) onToast(notices.join(' '));
    event.target.value = '';
  };

  const slotSummary = compiledModules
    ? `${compiledModules.defs.required}/9 Definitions · ${compiledModules.units.required}/9 Units`
    : '0/9 Definitions · 0/9 Units';

  return (
    <PageShell className="tweak-package-lab" label="Tweak Package Lab">
      <header className="tweak-lab-header">
        <div>
          <span className="workflow-eyebrow">Static package workbench</span>
          <h2>Tweak Package Lab</h2>
          <p>Inspect modular BAR tweaks without executing imported Lua.</p>
        </div>
        <div className="tweak-lab-header__actions">
          <span className={compiledModules?.overflow ? 'is-overflow' : ''}>{slotSummary}</span>
          <Button onClick={onBack}>Back to editor</Button>
        </div>
      </header>

      {modules.length > 0 && (
        <section className="tweak-package-audit" aria-label="Package dependency audit">
          <div className="tweak-package-audit__heading">
            <div><span className="workflow-eyebrow">Package architecture</span><h3>Dependencies and reusable recipes</h3></div>
            <span>{packageAnalysis.unresolved.length || packageAnalysis.collisions.length || packageAnalysis.orderingIssues.length ? 'Review needed' : 'Load order clear'}</span>
          </div>
          <div className="tweak-package-audit__metrics">
            <div><span>Modules</span><strong>{modules.length}</strong></div>
            <div><span>Recipe calls</span><strong>{packageAnalysis.recipes.length}</strong></div>
            <div><span>Module links</span><strong>{packageAnalysis.edges.length}</strong></div>
            <div><span>Unresolved IDs</span><strong>{packageAnalysis.unresolved.length}</strong></div>
            <div><span>Definition conflicts</span><strong>{packageAnalysis.collisions.length}</strong></div>
          </div>
          {(packageAnalysis.collisions.length > 0 || packageAnalysis.orderingIssues.length > 0 || packageAnalysis.cycles.length > 0) && (
            <div className="tweak-package-audit__issues">
              {packageAnalysis.collisions.slice(0, 4).map(item => <p key={`collision-${item.unitId}`}><b>Collision</b><code>{item.unitId}</code> is created by {item.moduleIds.map(moduleLabel).join(' and ')}.</p>)}
              {packageAnalysis.orderingIssues.slice(0, 4).map(edge => <p key={`order-${edge.from}-${edge.to}`}><b>Load order</b>{moduleLabel(edge.from)} needs {moduleLabel(edge.to)} first for <code>{edge.unitIds.join(', ')}</code>.</p>)}
              {packageAnalysis.cycles.slice(0, 2).map(cycle => <p key={`cycle-${cycle.join('-')}`}><b>Dependency cycle</b>{cycle.map(moduleLabel).join(' → ')}.</p>)}
            </div>
          )}
        </section>
      )}

      <div className="tweak-lab-grid">
        <aside className="tweak-lab-import">
          <div className="tweak-lab-section-heading"><span>Package sources</span><strong>{modules.length}</strong></div>
          <label className="tweak-lab-kind-select">
            <span>Raw input type</span>
            <select value={rawKind} onChange={event => setRawKind(event.target.value)}>
              <option value="defs">Definitions</option>
              <option value="units">Units</option>
            </select>
          </label>
          <label className="tweak-lab-file-button">
            <span>Import files</span>
            <input type="file" accept=".txt,.lua,text/plain" multiple onChange={importFiles} />
          </label>
          <textarea
            value={pasteValue}
            onChange={event => setPasteValue(event.target.value)}
            placeholder="Paste !bset commands, Base64, or raw Lua…"
            aria-label="Tweak package input"
          />
          <Button variant="primary" disabled={!pasteValue.trim()} onClick={() => importText(pasteValue)}>Inspect pasted input</Button>
          <p className="tweak-lab-safety-note">Imports are read-only and disabled by default. Nothing is executed in your browser.</p>
          {(packageDiagnostics.requirements.length > 0 || packageDiagnostics.duplicateFields.length > 0 || packageDiagnostics.legacyFields.length > 0) && (
            <section className="tweak-lab-package-diagnostics" aria-label="Imported package compatibility">
              <strong>Package compatibility</strong>
              {packageDiagnostics.requirements.includes('forceallunits') && <p><span>Manual dependency</span>Enable <b>Force-load all units</b> in the BAR lobby. The editor will not write this lobby option.</p>}
              {packageDiagnostics.duplicateFields.map(([field, count]) => <p key={field}><span>Field repaired</span>{field} appeared {count} times. Modules will receive unique numbered slots during export.</p>)}
              {packageDiagnostics.legacyFields.length > 0 && <p><span>Legacy fields</span>{packageDiagnostics.legacyFields.length} unnumbered field{packageDiagnostics.legacyFields.length === 1 ? '' : 's'} will be normalized into the 1–9 slot system.</p>}
            </section>
          )}
        </aside>

        <section className="tweak-lab-modules" aria-label="Imported tweak modules">
          <div className="tweak-lab-section-heading"><span>Imported modules</span><strong>{modules.length}</strong></div>
          {modules.length === 0 ? (
            <EmptyState title="No package loaded" description="Import BAR lobby commands or raw Lua to inspect how the package is structured." />
          ) : modules.map(module => (
            <ModuleCard
              key={module.id}
              module={module}
              selected={selected?.id === module.id}
              analysis={analyses.get(module.id)}
              onSelect={() => setSelectedId(module.id)}
              onUpdate={patch => onUpdateModule(module.id, patch)}
              onMove={direction => onMoveModule(module.id, direction)}
              onRemove={() => onRemoveModule(module.id)}
            />
          ))}
        </section>

        <aside className="tweak-lab-inspector">
          {!selected ? (
            <EmptyState compact title="Select a module" description="Module analysis and safe conversions appear here." />
          ) : (
            <>
              <div className="tweak-lab-inspector__heading">
                <div><span className="workflow-eyebrow">Module inspection</span><h3>{selected.label}</h3></div>
                <select value={selected.stage} onChange={event => onUpdateModule(selected.id, { stage: event.target.value })}>
                  <option value="before-editor">Before editor</option>
                  <option value="after-editor">After editor</option>
                </select>
              </div>
              <label className="tweak-module-attribution">
                <span>Attribution / source note</span>
                <input value={selected.attribution || ''} onChange={event => onUpdateModule(selected.id, { attribution: event.target.value })} placeholder="Optional author or source" />
              </label>
              <div className="tweak-analysis-metrics">
                <div><span>Creates</span><strong>{selectedAnalysis.createdUnits.length}</strong></div>
                <div><span>References</span><strong>{selectedAnalysis.referencedUnits.length}</strong></div>
                <div><span>Weapons</span><strong>{selectedAnalysis.weaponChanges}</strong></div>
                <div><span>Build menu</span><strong>{selectedAnalysis.buildMenuOperations}</strong></div>
              </div>
              {selectedAnalysis.literalUnitTables > 0 && <p className="tweak-literal-summary">Literal table recognized: <strong>{selectedAnalysis.literalUnitTables}</strong> unit patches and <strong>{selectedAnalysis.literalWeaponDefinitions}</strong> WeaponDefs are available for structured conversion.</p>}
              {selectedAnalysis.warnings.length > 0 && (
                <div className="tweak-analysis-warnings">
                  {selectedAnalysis.warnings.map(warning => <p key={`${warning.code}-${warning.message}`} className={`is-${warning.level}`}><strong>{warning.code}</strong>{warning.message}</p>)}
                </div>
              )}
              <section className="tweak-analysis-section">
                <h4>Recognized definitions</h4>
                <p>{selectedAnalysis.createdUnits.join(', ') || 'No literal clone definitions found.'}</p>
              </section>
              <section className="tweak-analysis-section">
                <h4>Custom parameters</h4>
                <p>{selectedAnalysis.customParameters.join(', ') || 'No custom parameters found.'}</p>
              </section>
              {selectedAnalysis.helpers.length > 0 && (
                <section className="tweak-analysis-section tweak-helper-recipes">
                  <div className="tweak-analysis-section__heading"><h4>Reusable helper recipes</h4><span>{selectedAnalysis.recipes.length}</span></div>
                  <p>Community helper functions are described statically. Computed recipe code remains raw and is never executed by the editor.</p>
                  <div className="tweak-helper-list">
                    {selectedAnalysis.helpers.map(helper => (
                      <div key={helper.name}>
                        <code>{helper.name}(...)</code>
                        <span>{helper.mode === 'clone-factory' ? 'Clone factory' : 'Definition factory'} · {helper.callCount} literal call{helper.callCount === 1 ? '' : 's'}</span>
                        <small>{[helper.computed && 'computed logic', helper.touchesWeapons && 'weapon changes', helper.touchesAssets && 'asset changes'].filter(Boolean).join(' · ') || 'literal structure'}</small>
                      </div>
                    ))}
                  </div>
                  {selectedAnalysis.recipes.length > 0 && (
                    <div className="tweak-recipe-calls" aria-label="Recognized helper recipe calls">
                      {selectedAnalysis.recipes.slice(0, 12).map((recipe, index) => (
                        <div key={`${recipe.helperName}-${recipe.newId}-${index}`}>
                          <code>{recipe.newId}</code>
                          <span>{recipe.sourceId ? `from ${recipe.sourceId}` : recipe.mode}</span>
                          <small>{recipe.helperName}{recipe.displayName ? ` · ${recipe.displayName}` : ''}</small>
                        </div>
                      ))}
                      {selectedAnalysis.recipes.length > 12 && <p>+{selectedAnalysis.recipes.length - 12} additional recipe calls</p>}
                    </div>
                  )}
                </section>
              )}
              {selectedReport && (
                <section className="tweak-analysis-section tweak-module-relationships">
                  <div className="tweak-analysis-section__heading"><h4>Module relationships</h4><span>{selectedReport.dependencies.length}</span></div>
                  {selectedReport.dependencies.map(edge => <p key={`dependency-${edge.to}`}><b>Needs</b>{moduleLabel(edge.to)} <code>{edge.unitIds.join(', ')}</code></p>)}
                  {selectedReport.dependents.map(edge => <p key={`dependent-${edge.from}`}><b>Used by</b>{moduleLabel(edge.from)} <code>{edge.unitIds.join(', ')}</code></p>)}
                  {selectedReport.unresolved.slice(0, 8).map(item => <p key={`unresolved-${item.unitId}`} className="is-unresolved"><b>External or missing</b><code>{item.unitId}</code></p>)}
                  {!selectedReport.dependencies.length && !selectedReport.dependents.length && !selectedReport.unresolved.length && <p>No cross-module unit dependencies detected.</p>}
                </section>
              )}
              <section className="tweak-analysis-section">
                <div className="tweak-analysis-section__heading"><h4>Safe conversions</h4><span>{selectedAnalysis.conversions.length}</span></div>
                <p>Converts literal clones, complete unit tables, weapon slots, build-menu operations, and supported scalar parameters. Asset and script changes remain raw.</p>
                <Button
                  disabled={selected.enabled || selected.converted || selectedAnalysis.conversions.length === 0 || Boolean(selectedAnalysis.parseError)}
                  onClick={() => onApplyConversions(selected, selectedAnalysis.conversions)}
                >{selected.converted ? 'Converted' : 'Apply recognized changes'}</Button>
              </section>
              <details className="tweak-source-preview">
                <summary>Decoded Lua source</summary>
                <pre>{selected.rawLua}</pre>
              </details>
            </>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
