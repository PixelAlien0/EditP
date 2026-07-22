import { useEffect, useMemo, useState } from 'react';
import { analyzeTweakPackage, MAX_TWEAK_PACKAGE_BYTES, parseTweakPackageInput } from '../utils/tweakPackage.js';
import {
  filterLobbySetupCategories,
  LOBBY_SETUP_CATEGORIES,
  LOBBY_SETUP_CATEGORY_META,
  parseLobbySetupBundle,
} from '../utils/lobbySetupBundle.js';
import { Button, EmptyState, PageShell, Switch } from './ui.jsx';
import '../styles/features/tweak-package-lab.css';

const LOBBY_CATEGORY_ORDER = [
  LOBBY_SETUP_CATEGORIES.GAME,
  LOBBY_SETUP_CATEGORIES.LOBBY,
  LOBBY_SETUP_CATEGORIES.MAP,
  LOBBY_SETUP_CATEGORIES.IDENTITY,
  LOBBY_SETUP_CATEGORIES.UNKNOWN,
];

function createBundleSelection(bundle) {
  return {
    modules: bundle.modules.length > 0,
    ...Object.fromEntries(LOBBY_CATEGORY_ORDER.map(category => [
      category,
      (bundle.summary?.categoryCounts?.[category] || 0) > 0,
    ])),
  };
}

function LobbyBundlePreview({ bundle, selection, onToggle, onCancel, onImport }) {
  const categories = LOBBY_CATEGORY_ORDER
    .map(category => ({
      id: category,
      ...LOBBY_SETUP_CATEGORY_META[category],
      commands: bundle.lobbySetup.commands.filter(command => command.category === category),
    }))
    .filter(category => category.commands.length > 0);
  const selectedCommandCount = categories.reduce((total, category) => (
    total + (selection[category.id] ? category.commands.length : 0)
  ), 0);
  const selectedModuleCount = selection.modules ? bundle.modules.length : 0;

  return (
    <section className="lobby-bundle-preview" aria-labelledby="lobby-bundle-preview-title">
      <header className="lobby-bundle-preview__header">
        <div>
          <span className="workflow-eyebrow">Full lobby bundle detected</span>
          <h3 id="lobby-bundle-preview-title">Review before importing</h3>
          <p>Lua remains disabled. Lobby and host commands are stored for inspection and are never run by the editor.</p>
        </div>
        <div className="lobby-bundle-preview__actions">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={!selectedCommandCount && !selectedModuleCount} onClick={onImport}>
            Import selected
          </Button>
        </div>
      </header>

      <div className="lobby-bundle-preview__metrics" aria-label="Bundle summary">
        <div><span>Modules</span><strong>{bundle.summary.moduleCount}</strong><small>disabled on import</small></div>
        <div><span>Commands</span><strong>{bundle.summary.commandCount}</strong><small>effective values</small></div>
        <div><span>Slot resets</span><strong>{bundle.summary.slotResetCount}</strong><small>{bundle.summary.slotClearCount} remain empty</small></div>
        <div><span>Overrides</span><strong>{bundle.summary.overwrittenCount}</strong><small>last command kept</small></div>
        <div><span>Manual</span><strong>{bundle.summary.manualCommandCount}</strong><small>host review</small></div>
      </div>

      <div className="lobby-bundle-preview__groups">
        {bundle.modules.length > 0 && (
          <article className={`lobby-bundle-group is-modules ${selection.modules ? 'is-selected' : ''}`}>
            <div className="lobby-bundle-group__heading">
              <span><strong>Tweak modules</strong><small>Definitions and Units payloads</small></span>
              <Switch label="Import tweak modules" checked={selection.modules} onChange={() => onToggle('modules')} />
            </div>
            <div className="lobby-bundle-group__items">
              {bundle.modules.slice(0, 5).map(module => <code key={module.id}>{module.originalFieldName || module.kind} · {module.label}</code>)}
              {bundle.modules.length > 5 && <small>+{bundle.modules.length - 5} additional modules</small>}
            </div>
          </article>
        )}
        {categories.map(category => (
          <article className={`lobby-bundle-group ${selection[category.id] ? 'is-selected' : ''}`} key={category.id}>
            <div className="lobby-bundle-group__heading">
              <span><strong>{category.label}</strong><small>{category.description}</small></span>
              <Switch
                label={`Import ${category.label}`}
                checked={Boolean(selection[category.id])}
                onChange={() => onToggle(category.id)}
              />
            </div>
            <div className="lobby-bundle-group__items">
              {category.commands.slice(0, 4).map(command => <code key={command.id}>{command.raw}</code>)}
              {category.commands.length > 4 && <small>+{category.commands.length - 4} additional commands</small>}
            </div>
          </article>
        ))}
      </div>

      {(bundle.errors.length > 0 || bundle.notices.length > 0 || bundle.summary.ignoredLineCount > 0) && (
        <div className="lobby-bundle-preview__diagnostics" aria-live="polite">
          {bundle.errors.map(error => <p className="is-error" key={error}><strong>Decode issue</strong>{error}</p>)}
          {bundle.notices.slice(0, 5).map(notice => <p key={notice}><strong>Import note</strong>{notice}</p>)}
          {bundle.summary.ignoredLineCount > 0 && <p><strong>Ignored text</strong>{bundle.summary.ignoredLineCount} non-command line{bundle.summary.ignoredLineCount === 1 ? '' : 's'} will not be stored.</p>}
        </div>
      )}
    </section>
  );
}

function ModuleCard({ module, selected, analysis, report, onSelect, onUpdate, onRemove, onMove }) {
  const preflightCount = analysis.warnings.length
    + analysis.typeIssues.length
    + analysis.runtimeRisks.length
    + (report?.unresolved.length || 0)
    + (report?.collisions.length || 0);
  return (
    <article className={`tweak-module-card ${selected ? 'is-selected' : ''}`}>
      <button type="button" className="tweak-module-card__main" onClick={onSelect}>
        <span className={`tweak-module-kind is-${module.kind}`}>{module.kind === 'defs' ? 'DEFS' : 'UNITS'}</span>
        <span><strong>{module.label}</strong><small>{analysis.decodedBytes.toLocaleString()} decoded bytes</small></span>
        <em>{preflightCount ? `${preflightCount} notices` : 'Preflight clear'}</em>
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

function SupportingWeaponDefCard({ definition, onUpdate, onRemove }) {
  const [definitionDraft, setDefinitionDraft] = useState(() => JSON.stringify(definition.definition || {}, null, 2));
  const [definitionError, setDefinitionError] = useState('');
  useEffect(() => {
    setDefinitionDraft(JSON.stringify(definition.definition || {}, null, 2));
    setDefinitionError('');
  }, [definition.id, definition.definition]);

  const saveDefinition = () => {
    try {
      const parsed = JSON.parse(definitionDraft);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Definition must be a JSON object.');
      onUpdate(definition.id, { definition: parsed });
      setDefinitionError('');
    } catch (error) {
      setDefinitionError(error.message);
    }
  };

  return (
    <article className="tweak-support-card">
      <div className="tweak-support-card__heading">
        <div><span>{definition.role === 'dependency' ? 'Referenced dependency' : definition.role === 'mounted' ? 'Mounted definition' : 'Auxiliary definition'}</span><strong>{definition.label || definition.key.toUpperCase()}</strong></div>
        <Switch
          label={`Compile supporting WeaponDef ${definition.key}`}
          checked={definition.enabled !== false}
          onChange={event => onUpdate(definition.id, { enabled: event.target.checked })}
        />
      </div>
      <div className="tweak-support-card__fields">
        <label><span>Owner UnitDef</span><input value={definition.ownerUnitId} onChange={event => onUpdate(definition.id, { ownerUnitId: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} /></label>
        <label><span>WeaponDef key</span><input value={definition.key} onChange={event => onUpdate(definition.id, { key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} /></label>
        <label><span>Write mode</span><select value={definition.mode || 'replace'} onChange={event => onUpdate(definition.id, { mode: event.target.value })}><option value="replace">Replace existing</option><option value="create-only">Create only</option></select></label>
      </div>
      <details className="tweak-support-card__editor">
        <summary>Edit literal fields</summary>
        <textarea value={definitionDraft} onChange={event => setDefinitionDraft(event.target.value)} aria-label={`Literal fields for ${definition.key}`} spellCheck="false" />
        <div><span className={definitionError ? 'is-error' : ''}>{definitionError || 'JSON only. Imported Lua is never executed.'}</span><Button size="sm" onClick={saveDefinition}>Save fields</Button></div>
      </details>
      <div className="tweak-support-card__meta">
        <span>{Object.keys(definition.definition || {}).length} root fields</span>
        <span>{definition.dependencies?.length ? `Needs ${definition.dependencies.join(', ')}` : 'No WeaponDef dependencies'}</span>
        <button type="button" onClick={() => onRemove(definition.id)}>Remove</button>
      </div>
    </article>
  );
}

export default function TweakPackageLabPage({
  modules, lobbySetup, supportingWeaponDefs = [], compiledModules, onAddModules, onImportLobbyBundle, onClearLobbySetup, onUpdateModule, onRemoveModule,
  onMoveModule, onReorderModules, onApplyConversions, onBack, onToast, knownUnitIds = [],
  onAddSupportingWeaponDefs, onUpdateSupportingWeaponDef, onRemoveSupportingWeaponDef,
}) {
  const [selectedId, setSelectedId] = useState(modules[0]?.id || null);
  const [pasteValue, setPasteValue] = useState('');
  const [rawKind, setRawKind] = useState('defs');
  const [newSupportOwner, setNewSupportOwner] = useState('');
  const [newSupportKey, setNewSupportKey] = useState('');
  const [inspectorFullscreen, setInspectorFullscreen] = useState(false);
  const [inspectorView, setInspectorView] = useState('summary');
  const [bundlePreview, setBundlePreview] = useState(null);
  const [bundleSelection, setBundleSelection] = useState({});
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
  const supportingDestinations = new Set(supportingWeaponDefs.map(definition => `${definition.ownerUnitId}:${definition.key}`.toLowerCase()));
  const reviewCount = packageAnalysis.unresolved.length
    + packageAnalysis.collisions.length
    + packageAnalysis.orderingIssues.length
    + packageAnalysis.cycles.length
    + packageAnalysis.typeIssues.length;
  const selectedDiagnosticCount = selectedAnalysis
    ? selectedAnalysis.warnings.length
      + selectedAnalysis.typeIssues.length
      + selectedAnalysis.runtimeRisks.length
      + (selectedReport?.unresolved.length || 0)
      + (selectedReport?.collisions.length || 0)
    : 0;

  useEffect(() => {
    if (!inspectorFullscreen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = event => {
      if (event.key === 'Escape') setInspectorFullscreen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [inspectorFullscreen]);

  useEffect(() => {
    if (!selected) setInspectorFullscreen(false);
  }, [selected]);

  const createSupportingWeaponDef = () => {
    const ownerUnitId = newSupportOwner.trim().toLowerCase();
    const key = newSupportKey.trim().toLowerCase();
    const destination = `${ownerUnitId}:${key}`;
    if (!ownerUnitId || !key || supportingDestinations.has(destination)) return;
    onAddSupportingWeaponDefs([{
      id: `support_manual_${ownerUnitId}_${key}_${Date.now()}`,
      ownerUnitId,
      key,
      label: key.toUpperCase(),
      definition: { damage: { default: 0 } },
      enabled: true,
      mode: 'replace',
      role: 'auxiliary',
      mountedSlots: [],
      dependencies: [],
      referencedBy: [],
      sourceName: 'Created in BAR Editor',
    }]);
    setNewSupportOwner('');
    setNewSupportKey('');
    onToast(`Created ${key.toUpperCase()} for ${ownerUnitId}.`);
  };

  const applyRecommendedOrder = () => {
    if (!packageAnalysis.canAutoOrder || !packageAnalysis.orderingIssues.length) return;
    onReorderModules(packageAnalysis.recommendedOrderIds);
    onToast(`Reordered ${modules.length} modules so detected providers load before their consumers.`);
  };

  const importText = (text, options = {}) => {
    const bundle = parseLobbySetupBundle(text, { sourceName: options.sourceName || 'Pasted lobby setup' });
    if (bundle.isBundle) {
      setBundlePreview(bundle);
      setBundleSelection(createBundleSelection(bundle));
      if (bundle.errors.length) onToast(`${bundle.errors.length} tweak payload${bundle.errors.length === 1 ? '' : 's'} need review before import.`);
      return;
    }
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
      const fileText = await file.text();
      const bundle = parseLobbySetupBundle(fileText, { sourceName: file.name });
      if (bundle.isBundle) {
        setBundlePreview(bundle);
        setBundleSelection(createBundleSelection(bundle));
        if (files.length > 1) onToast(`Showing ${file.name}. Import full lobby bundles one at a time so their settings cannot overwrite each other silently.`);
        event.target.value = '';
        return;
      }
      const result = parseTweakPackageInput(fileText, { kind: rawKind, sourceName: file.name });
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

  const toggleBundleSelection = key => {
    setBundleSelection(current => ({ ...current, [key]: !current[key] }));
  };

  const importBundlePreview = () => {
    if (!bundlePreview) return;
    const categories = LOBBY_CATEGORY_ORDER.filter(category => bundleSelection[category]);
    const filteredSetup = filterLobbySetupCategories(bundlePreview.lobbySetup, categories);
    const importedModules = bundleSelection.modules ? bundlePreview.modules : [];
    const nextSetup = {
      ...filteredSetup,
      slotClears: bundleSelection.modules ? filteredSetup.slotClears : [],
      slotResetFields: bundleSelection.modules ? filteredSetup.slotResetFields : [],
    };
    onImportLobbyBundle({ modules: importedModules, lobbySetup: nextSetup });
    if (importedModules.length) setSelectedId(importedModules[0].id);
    setPasteValue('');
    setBundlePreview(null);
    setBundleSelection({});
    onToast(`Imported ${importedModules.length} disabled module${importedModules.length === 1 ? '' : 's'} and ${nextSetup.commands.length} lobby command${nextSetup.commands.length === 1 ? '' : 's'}.`);
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

      {bundlePreview && (
        <LobbyBundlePreview
          bundle={bundlePreview}
          selection={bundleSelection}
          onToggle={toggleBundleSelection}
          onCancel={() => { setBundlePreview(null); setBundleSelection({}); }}
          onImport={importBundlePreview}
        />
      )}

      {!bundlePreview && lobbySetup?.commands?.length > 0 && (
        <section className="tweak-lobby-setup-summary" aria-label="Imported lobby setup">
          <div>
            <span className="workflow-eyebrow">Imported lobby setup</span>
            <strong>{lobbySetup.sourceName || 'Lobby command bundle'}</strong>
            <small>{lobbySetup.commands.length} effective commands · {lobbySetup.slotResetFields?.length || 0} slot resets · stored for inspection</small>
          </div>
          <div className="tweak-lobby-setup-summary__categories">
            {LOBBY_CATEGORY_ORDER.map(category => {
              const count = lobbySetup.commands.filter(command => command.category === category).length;
              return count > 0 ? <span key={category}>{LOBBY_SETUP_CATEGORY_META[category].label} <b>{count}</b></span> : null;
            })}
          </div>
          <Button size="sm" onClick={onClearLobbySetup}>Remove setup</Button>
        </section>
      )}

      {modules.length > 0 && (
        <section className="tweak-package-audit" aria-label="Package dependency audit">
          <div className="tweak-package-audit__heading">
            <div><span className="workflow-eyebrow">Package architecture</span><h3>Dependencies and reusable recipes</h3></div>
            <div className="tweak-package-audit__actions">
              <span className={packageAnalysis.blockingIssues.length ? 'is-error' : ''}>
                {packageAnalysis.blockingIssues.length
                  ? `${packageAnalysis.blockingIssues.length} active blocker${packageAnalysis.blockingIssues.length === 1 ? '' : 's'}`
                  : reviewCount ? `${reviewCount} to review` : 'Preflight clear'}
              </span>
              {packageAnalysis.orderingIssues.length > 0 && (
                <Button
                  size="sm"
                  disabled={!packageAnalysis.canAutoOrder}
                  onClick={applyRecommendedOrder}
                  title={packageAnalysis.canAutoOrder ? 'Move providers before the modules that reference them' : 'Resolve dependency cycles or compiler-lane conflicts first'}
                >Apply safe order</Button>
              )}
            </div>
          </div>
          <div className="tweak-package-audit__metrics">
            <div><span>Modules</span><strong>{modules.length}</strong></div>
            <div><span>Recipe calls</span><strong>{packageAnalysis.recipes.length}</strong></div>
            <div><span>Module links</span><strong>{packageAnalysis.edges.length}</strong></div>
            <div><span>Unresolved IDs</span><strong>{packageAnalysis.unresolved.length}</strong></div>
            <div><span>Definition conflicts</span><strong>{packageAnalysis.collisions.length}</strong></div>
            <div><span>Type mismatches</span><strong>{packageAnalysis.typeIssues.length}</strong></div>
            <div><span>Risk locations</span><strong>{packageAnalysis.runtimeRiskCount}</strong></div>
          </div>
          {(packageAnalysis.unresolved.length > 0 || packageAnalysis.collisions.length > 0 || packageAnalysis.orderingIssues.length > 0 || packageAnalysis.cycles.length > 0 || packageAnalysis.typeIssues.length > 0) && (
            <div className="tweak-package-audit__issues">
              {packageAnalysis.unresolved.slice(0, 4).map(item => <p key={`unresolved-${item.moduleId}-${item.unitId}`}><b>External ID</b>{moduleLabel(item.moduleId)} references <code>{item.unitId}</code>{item.line ? ` near line ${item.line}` : ''}. Confirm the required BAR unit pack or provider module.</p>)}
              {packageAnalysis.collisions.slice(0, 4).map(item => <p key={`collision-${item.unitId}`}><b>Collision</b><code>{item.unitId}</code> is created by {item.moduleIds.map(moduleLabel).join(' and ')}.</p>)}
              {packageAnalysis.orderingIssues.slice(0, 4).map(edge => <p key={`order-${edge.from}-${edge.to}`}><b>Load order</b>{moduleLabel(edge.from)} needs {moduleLabel(edge.to)} first for <code>{edge.unitIds.join(', ')}</code>.</p>)}
              {packageAnalysis.boundaryIssues.slice(0, 2).map(edge => <p key={`boundary-${edge.from}-${edge.to}`}><b>Compiler lane</b>{edge.message}</p>)}
              {packageAnalysis.typeIssues.slice(0, 3).map(issue => <p key={`type-${issue.moduleId}-${issue.line}-${issue.field}`}><b>Value type</b>{moduleLabel(issue.moduleId)}, line {issue.line}: {issue.field} expects {issue.expectedType}.</p>)}
              {packageAnalysis.cycles.slice(0, 2).map(cycle => <p key={`cycle-${cycle.join('-')}`}><b>Dependency cycle</b>{cycle.map(moduleLabel).join(' → ')}.</p>)}
            </div>
          )}
        </section>
      )}

      <details className="tweak-support-library" open={supportingWeaponDefs.length > 0}>
        <summary>
          <span><b>Supporting WeaponDef library</b><small>Auxiliary, cluster-child, and unmounted definitions compiled into their owning UnitDefs.</small></span>
          <strong>{supportingWeaponDefs.length}</strong>
        </summary>
        <div className="tweak-support-library__body">
          <div className="tweak-support-create">
            <div><b>Create auxiliary WeaponDef</b><small>Start with a safe literal definition and edit its fields as JSON.</small></div>
            <label><span>Owner UnitDef</span><input value={newSupportOwner} onChange={event => setNewSupportOwner(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="armflea" /></label>
            <label><span>WeaponDef key</span><input value={newSupportKey} onChange={event => setNewSupportKey(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="cluster_child" /></label>
            <Button
              size="sm"
              disabled={!newSupportOwner || !newSupportKey || supportingDestinations.has(`${newSupportOwner}:${newSupportKey}`)}
              onClick={createSupportingWeaponDef}
            >Create</Button>
          </div>
          {supportingWeaponDefs.length === 0 ? (
            <p>Convert a recognized literal module or add one of its auxiliary WeaponDefs from the module inspector.</p>
          ) : supportingWeaponDefs.map(definition => (
            <SupportingWeaponDefCard
              key={definition.id}
              definition={definition}
              onUpdate={onUpdateSupportingWeaponDef}
              onRemove={onRemoveSupportingWeaponDef}
            />
          ))}
        </div>
      </details>

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
              report={packageAnalysis.moduleReports.find(report => report.moduleId === module.id)}
              onSelect={() => setSelectedId(module.id)}
              onUpdate={patch => onUpdateModule(module.id, patch)}
              onMove={direction => onMoveModule(module.id, direction)}
              onRemove={() => onRemoveModule(module.id)}
            />
          ))}
        </section>

        <aside className={`tweak-lab-inspector ${inspectorFullscreen ? 'is-fullscreen' : ''}`} aria-label="Module inspection">
          {!selected ? (
            <EmptyState compact title="Select a module" description="Module analysis and safe conversions appear here." />
          ) : (
            <>
              <div className="tweak-lab-inspector__heading">
                <div><span className="workflow-eyebrow">Module inspection</span><h3>{selected.label}</h3></div>
                <div className="tweak-lab-inspector__actions">
                  <select aria-label="Module loading stage" value={selected.stage} onChange={event => onUpdateModule(selected.id, { stage: event.target.value })}>
                    <option value="before-editor">Before editor</option>
                    <option value="after-editor">After editor</option>
                  </select>
                  <Button
                    size="sm"
                    variant={inspectorFullscreen ? 'primary' : 'secondary'}
                    className="tweak-lab-inspector__fullscreen"
                    aria-pressed={inspectorFullscreen}
                    onClick={() => {
                      setInspectorFullscreen(value => {
                        if (!value) setInspectorView('summary');
                        return !value;
                      });
                    }}
                    title={inspectorFullscreen ? 'Restore the three-column workbench (Escape)' : 'Expand module inspection to the full viewport'}
                  >
                    <span aria-hidden="true">{inspectorFullscreen ? '↙' : '↗'}</span>
                    {inspectorFullscreen ? 'Restore view' : 'Full screen'}
                  </Button>
                </div>
              </div>
              <label className="tweak-module-attribution">
                <span>Attribution / source note</span>
                <input value={selected.attribution || ''} onChange={event => onUpdateModule(selected.id, { attribution: event.target.value })} placeholder="Optional author or source" />
              </label>
              <nav className="tweak-lab-inspector__views" aria-label="Module inspection view">
                <button type="button" className={inspectorView === 'summary' ? 'is-active' : ''} aria-pressed={inspectorView === 'summary'} onClick={() => setInspectorView('summary')}>
                  <span>Summary</span><small>Structure and conversion</small>
                </button>
                <button type="button" className={inspectorView === 'diagnostics' ? 'is-active' : ''} aria-pressed={inspectorView === 'diagnostics'} onClick={() => setInspectorView('diagnostics')}>
                  <span>Diagnostics</span><small>{selectedDiagnosticCount} notices</small>
                </button>
                <button type="button" className={inspectorView === 'source' ? 'is-active' : ''} aria-pressed={inspectorView === 'source'} onClick={() => setInspectorView('source')}>
                  <span>Source</span><small>{selectedAnalysis.decodedBytes.toLocaleString()} bytes</small>
                </button>
              </nav>
              <div className={`tweak-lab-inspector__content is-view-${inspectorView}`}>
              <div className="tweak-analysis-metrics">
                <div><span>Creates</span><strong>{selectedAnalysis.createdUnits.length}</strong></div>
                <div><span>References</span><strong>{selectedAnalysis.referencedUnits.length}</strong></div>
                <div><span>Weapons</span><strong>{selectedAnalysis.weaponChanges}</strong></div>
                <div><span>Build menu</span><strong>{selectedAnalysis.buildMenuOperations}</strong></div>
              </div>
              {selectedDiagnosticCount === 0 && !selectedReport?.assetReferences.length && (
                <div className="tweak-inspector-diagnostics-empty inspector-diagnostics-panel">
                  <span aria-hidden="true">✓</span>
                  <div><strong>Static preflight clear</strong><small>No type, runtime, dependency, or asset notices were detected for this module.</small></div>
                </div>
              )}
              {selectedAnalysis.literalUnitTables > 0 && <p className="tweak-literal-summary">Literal table recognized: <strong>{selectedAnalysis.literalUnitTables}</strong> unit patches and <strong>{selectedAnalysis.literalWeaponDefinitions}</strong> WeaponDefs are available for structured conversion.</p>}
              {selectedAnalysis.supportingWeaponDefs.length > 0 && (
                <section className="tweak-analysis-section tweak-support-candidates inspector-summary-panel">
                  <div className="tweak-analysis-section__heading"><h4>Project WeaponDefs</h4><Button size="sm" onClick={() => onAddSupportingWeaponDefs(selectedAnalysis.supportingWeaponDefs)}>Add all {selectedAnalysis.supportingWeaponDefs.length}</Button></div>
                  <p>Complete literal definitions, their mount slots, and auxiliary dependencies can be preserved without enabling the source module.</p>
                  <div>
                    {selectedAnalysis.supportingWeaponDefs.map(definition => {
                      const destination = `${definition.ownerUnitId}:${definition.key}`.toLowerCase();
                      const exists = supportingDestinations.has(destination);
                      return (
                        <article key={definition.id}>
                          <span><strong>{definition.key.toUpperCase()}</strong><small>{definition.ownerUnitId} · {definition.role}</small></span>
                          <Button size="sm" disabled={exists} onClick={() => onAddSupportingWeaponDefs([definition])}>{exists ? 'In library' : 'Add'}</Button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}
              {selectedAnalysis.warnings.length > 0 && (
                <div className="tweak-analysis-warnings inspector-diagnostics-panel">
                  {selectedAnalysis.warnings.map(warning => <p key={`${warning.code}-${warning.message}`} className={`is-${warning.level}`}><strong>{warning.code}</strong>{warning.message}</p>)}
                </div>
              )}
              {(selectedReport?.typeIssues.length > 0 || selectedReport?.runtimeRisks.length > 0) && (
                <section className="tweak-analysis-section tweak-preflight-section inspector-diagnostics-panel">
                  <div className="tweak-analysis-section__heading"><h4>Runtime preflight</h4><span>{selectedReport.typeIssues.length + selectedReport.runtimeRisks.length}</span></div>
                  <p>Static checks for literal value types and table access patterns that commonly produce BAR console errors.</p>
                  <div className="tweak-preflight-list">
                    {selectedReport.typeIssues.map(issue => (
                      <div key={`type-${issue.line}-${issue.field}`} className="is-warning">
                        <b>Line {issue.line} · Type</b>
                        <span>{issue.message}</span>
                      </div>
                    ))}
                    {selectedReport.runtimeRisks.map(risk => (
                      <div key={risk.code} className={`is-${risk.level}`}>
                        <b>{risk.count}× · {risk.code}</b>
                        <span>{risk.message} Lines {risk.lines.slice(0, 6).join(', ')}{risk.lines.length > 6 ? '…' : ''}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section className="tweak-analysis-section tweak-definitions-section inspector-summary-panel">
                <h4>Recognized definitions</h4>
                <p>{selectedAnalysis.createdUnits.join(', ') || 'No literal clone definitions found.'}</p>
              </section>
              <section className="tweak-analysis-section tweak-custom-params-section inspector-summary-panel">
                <h4>Custom parameters</h4>
                <p>{selectedAnalysis.customParameters.join(', ') || 'No custom parameters found.'}</p>
              </section>
              {selectedAnalysis.helpers.length > 0 && (
                <section className="tweak-analysis-section tweak-helper-recipes inspector-summary-panel">
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
                <section className="tweak-analysis-section tweak-module-relationships inspector-summary-panel inspector-diagnostics-panel">
                  <div className="tweak-analysis-section__heading"><h4>Module relationships</h4><span>{selectedReport.dependencies.length}</span></div>
                  {selectedReport.dependencies.map(edge => <p key={`dependency-${edge.to}`}><b>Needs</b>{moduleLabel(edge.to)} <code>{edge.unitIds.join(', ')}</code></p>)}
                  {selectedReport.dependents.map(edge => <p key={`dependent-${edge.from}`}><b>Used by</b>{moduleLabel(edge.from)} <code>{edge.unitIds.join(', ')}</code></p>)}
                  {selectedReport.unresolved.slice(0, 8).map(item => <p key={`unresolved-${item.unitId}`} className="is-unresolved"><b>External or missing</b><code>{item.unitId}{item.line ? ` · line ${item.line}` : ''}</code></p>)}
                  {!selectedReport.dependencies.length && !selectedReport.dependents.length && !selectedReport.unresolved.length && <p className="is-empty">No cross-module unit dependencies detected.</p>}
                </section>
              )}
              {selectedReport?.assetReferences.length > 0 && (
                <section className="tweak-analysis-section tweak-assets-section inspector-diagnostics-panel">
                  <div className="tweak-analysis-section__heading"><h4>External asset references</h4><span>{selectedReport.assetReferences.length}</span></div>
                  <p>BAR assets may be reused by lobby tweaks, but imported paths remain unverified until checked against the matching game version.</p>
                  <div className="tweak-asset-list">
                    {selectedReport.assetReferences.slice(0, 12).map((reference, index) => (
                      <div key={`${reference.line}-${reference.field}-${reference.value}-${index}`}>
                        <span>{reference.kind} · line {reference.line}</span><code>{reference.value}</code>
                      </div>
                    ))}
                    {selectedReport.assetReferences.length > 12 && <small>+{selectedReport.assetReferences.length - 12} more references</small>}
                  </div>
                </section>
              )}
              <section className="tweak-analysis-section tweak-conversions-section inspector-summary-panel">
                <div className="tweak-analysis-section__heading"><h4>Safe conversions</h4><span>{selectedAnalysis.conversions.length}</span></div>
                <p>Converts literal clones, complete unit tables, weapon slots, supporting WeaponDefs, build-menu operations, and supported scalar parameters. Asset and script changes remain raw.</p>
                <Button
                  disabled={selected.enabled || selected.converted || selectedAnalysis.conversions.length === 0 || Boolean(selectedAnalysis.parseError)}
                  onClick={() => onApplyConversions(selected, selectedAnalysis.conversions)}
                >{selected.converted ? 'Converted' : 'Apply recognized changes'}</Button>
              </section>
              <details className="tweak-source-preview inspector-source-panel" open={inspectorFullscreen && inspectorView === 'source' ? true : undefined}>
                <summary>Decoded Lua source</summary>
                <pre>{selected.rawLua}</pre>
              </details>
              </div>
            </>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
