import { useMemo, useState } from 'react';
import { analyzeTweakModule, MAX_TWEAK_PACKAGE_BYTES, parseTweakPackageInput } from '../utils/tweakPackage.js';
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
  onMoveModule, onApplyConversions, onBack, onToast,
}) {
  const [selectedId, setSelectedId] = useState(modules[0]?.id || null);
  const [pasteValue, setPasteValue] = useState('');
  const [rawKind, setRawKind] = useState('defs');
  const analyses = useMemo(() => new Map(modules.map(module => [module.id, analyzeTweakModule(module)])), [modules]);
  const selected = modules.find(module => module.id === selectedId) || modules[0] || null;
  const selectedAnalysis = selected ? analyses.get(selected.id) : null;

  const importText = (text, options = {}) => {
    const result = parseTweakPackageInput(text, { kind: rawKind, ...options });
    if (result.modules.length) {
      onAddModules(result.modules);
      setSelectedId(result.modules[0].id);
      setPasteValue('');
      onToast(`${result.modules.length} tweak module${result.modules.length === 1 ? '' : 's'} imported disabled.`);
    }
    if (result.errors.length) onToast(result.errors.join(' '));
  };

  const importFiles = async event => {
    const files = [...(event.target.files || [])];
    const imported = [];
    const errors = [];
    for (const file of files) {
      const result = parseTweakPackageInput(await file.text(), { kind: rawKind, sourceName: file.name });
      imported.push(...result.modules);
      errors.push(...result.errors.map(error => `${file.name}: ${error}`));
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
        </aside>

        <section className="tweak-lab-modules" aria-label="Imported tweak modules">
          <div className="tweak-lab-section-heading"><span>Imported modules</span><strong>{modules.length}</strong></div>
          {modules.length === 0 ? (
            <EmptyState title="No package loaded" description="Import the nine reference commands or another BAR tweak package to inspect its structure." />
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
              <section className="tweak-analysis-section">
                <div className="tweak-analysis-section__heading"><h4>Safe conversions</h4><span>{selectedAnalysis.conversions.length}</span></div>
                <p>Only literal clones, build-menu operations, and supported scalar parameters can be converted.</p>
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
