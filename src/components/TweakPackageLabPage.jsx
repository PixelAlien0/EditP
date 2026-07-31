import { useEffect, useMemo, useState } from 'react';
import { analyzeTweakPackage, MAX_TWEAK_PACKAGE_BYTES, parseTweakPackageInput, repairAndSanitizeTweakPackage } from '../utils/tweakPackage.js';
import {
  filterLobbySetupCategories,
  LOBBY_SETUP_CATEGORIES,
  LOBBY_SETUP_CATEGORY_META,
  parseLobbySetupBundle,
} from '../utils/lobbySetupBundle.js';
import { Button, EmptyState, PageShell, Switch, Type } from './ui.jsx';
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
          <Type variant="eyebrow" className="workflow-eyebrow">Full lobby bundle detected</Type>
          <Type as="h3" variant="section-title" id="lobby-bundle-preview-title">Review before importing</Type>
          <Type as="p" variant="description">Lua remains disabled. Lobby and host commands are stored for inspection and are never run by the editor.</Type>
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
  const [workspaceTab, setWorkspaceTab] = useState('source');
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
    + packageAnalysis.typeIssues.length
    + packageAnalysis.confidenceCounts.probable
    + packageAnalysis.confidenceCounts.dynamic
    + packageAnalysis.unknownCustomParameters.length;
  const selectedDiagnosticCount = selectedAnalysis
    ? selectedAnalysis.warnings.length
      + selectedAnalysis.typeIssues.length
      + selectedAnalysis.runtimeRisks.length
      + selectedAnalysis.findings.filter(finding => finding.confidence !== 'exact').length
      + selectedAnalysis.unknownCustomParameters.length
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
    onToast(`Imported ${importedModules.length} disabled module${importedModules.length === 1 ? '' : 's'} and ${nextSetup.commands.length} lobby command${nextSetup.commands.length === 1 ? '' : 's'}.`);
  };

  const slotSummary = compiledModules
    ? `${compiledModules.defs.required}/9 Definitions · ${compiledModules.units.required}/9 Units`
    : '0/9 Definitions · 0/9 Units';

  return (
    <PageShell
      className="tweak-package-lab"
      label="Tweak Package Lab"
      eyebrow="Static package workbench"
      title="Tweak Package Lab"
      description="Inspect modular BAR tweaks without executing imported Lua."
      capabilityId="tool.tweak-package-lab"
      status={<span className={`tweak-lab-slot-status ${compiledModules?.overflow ? 'is-overflow' : ''}`}>{slotSummary}</span>}
      actions={<Button onClick={onBack}>Back to editor</Button>}
      bodyClassName="tweak-package-lab__body"
    >
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
            <Type variant="eyebrow" className="workflow-eyebrow">Imported lobby setup</Type>
            <Type as="strong" variant="subsection-title">{lobbySetup.sourceName || 'Lobby command bundle'}</Type>
            <Type as="small" variant="technical">{lobbySetup.commands.length} effective commands · {lobbySetup.slotResetFields?.length || 0} slot resets · stored for inspection</Type>
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

      {/* PACKAGE ARCHITECTURE & DEPENDENCY AUDIT BANNER */}
      {modules.length > 0 && (
        <section className="tweak-package-audit" aria-label="Package dependency audit">
          <div className="tweak-package-audit__heading">
            <div><Type variant="eyebrow" className="workflow-eyebrow">Package architecture</Type><Type as="h3" variant="section-title">Dependencies and reusable recipes</Type></div>
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
            <div><span>Exact findings</span><strong>{packageAnalysis.confidenceCounts.exact}</strong></div>
            <div><span>Probable</span><strong>{packageAnalysis.confidenceCounts.probable}</strong></div>
            <div><span>Dynamic</span><strong>{packageAnalysis.confidenceCounts.dynamic}</strong></div>
            <div><span>Module links</span><strong>{packageAnalysis.edges.length}</strong></div>
            <div><span>Unresolved IDs</span><strong>{packageAnalysis.unresolved.length}</strong></div>
            <div><span>Definition conflicts</span><strong>{packageAnalysis.collisions.length}</strong></div>
            <div><span>Type mismatches</span><strong>{packageAnalysis.typeIssues.length}</strong></div>
            <div><span>Risk locations</span><strong>{packageAnalysis.runtimeRiskCount}</strong></div>
            <div><span>Unknown params</span><strong>{packageAnalysis.unknownCustomParameters.length}</strong></div>
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

      {/* SUPPORTING WEAPONDEF LIBRARY ACCORDION */}
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
        {/* PANEL 1: NAVIGATOR (Left) */}
        <aside className="tweak-lab-navigator" aria-label="Package Navigator">
          <div className="tweak-lab-section-heading"><span>Modules</span><strong>{modules.length}</strong></div>
          {modules.length === 0 ? (
            <EmptyState title="No package loaded" description="Import BAR lobby commands or raw Lua to inspect how the package is structured." />
          ) : (
            <div className="tweak-lab-module-list">
              {modules.map(module => (
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
            </div>
          )}

          <details className="tweak-support-library">
            <summary>
              <span><b>Add Module / Paste</b><small>Import files or paste lobby commands</small></span>
            </summary>
            <div className="tweak-lab-paste-card">
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
                placeholder="Paste !bset commands or raw Lua…"
                rows={4}
                className="tweak-lab-paste-input"
              />
              <Button variant="primary" size="sm" disabled={!pasteValue.trim()} onClick={() => importText(pasteValue)}>Import text</Button>
              {(packageDiagnostics.requirements.length > 0 || packageDiagnostics.duplicateFields.length > 0 || packageDiagnostics.legacyFields.length > 0) && (
                <section className="tweak-lab-package-diagnostics" aria-label="Imported package compatibility">
                  <strong>Package compatibility</strong>
                  {packageDiagnostics.requirements.includes('forceallunits') && <p><span>Manual dependency</span>Enable <b>Force-load all units</b> in the BAR lobby.</p>}
                  {packageDiagnostics.duplicateFields.map(([field, count]) => <p key={field}><span>Field repaired</span>{field} appeared {count} times.</p>)}
                  {packageDiagnostics.legacyFields.length > 0 && <p><span>Legacy fields</span>{packageDiagnostics.legacyFields.length} unnumbered field(s) normalized.</p>}
                </section>
              )}
            </div>
          </details>
        </aside>

        {/* PANEL 2: WORKSPACE (Center) */}
        <main className="tweak-lab-workspace" aria-label="Module Workspace">
          {!selected ? (
            <EmptyState compact title="Select a module" description="Module workbench, source editor, and safe conversions appear here." />
          ) : (
            <>
              <div className="tweak-workbench-toolbar">
                <div>
                  <Type variant="eyebrow" className="workflow-eyebrow">{selected.kind.toUpperCase()} MODULE</Type>
                  <Type as="h3" variant="section-title">{selected.label}</Type>
                </div>
                <div className="tweak-workbench-actions">
                  <select aria-label="Module loading stage" value={selected.stage} onChange={event => onUpdateModule(selected.id, { stage: event.target.value })} className="tweak-workbench-stage-select">
                    <option value="before-editor">Before editor</option>
                    <option value="after-editor">After editor</option>
                  </select>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (!selected?.rawLua) return;
                      const { sanitizedSource, issuesFixed } = repairAndSanitizeTweakPackage(selected.rawLua);
                      if (issuesFixed === 0) {
                        onToast?.('Module is clean! No syntax typos or inline comments found.');
                        return;
                      }
                      onUpdateModule(selected.id, { rawLua: sanitizedSource });
                      onToast?.(`Auto-sanitized & repaired ${issuesFixed} issue${issuesFixed === 1 ? '' : 's'}.`);
                    }}
                  >Auto-Sanitize & Repair</Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={selected.enabled || selected.converted || !selectedAnalysis || selectedAnalysis.conversions.length === 0 || Boolean(selectedAnalysis.parseError)}
                    onClick={() => onApplyConversions(selected, selectedAnalysis.conversions)}
                  >{selected.converted ? 'Converted' : 'Apply recognized changes'}</Button>
                </div>
              </div>

              <label className="tweak-workbench-attribution">
                <span>Attribution / source note</span>
                <input value={selected.attribution || ''} onChange={event => onUpdateModule(selected.id, { attribution: event.target.value })} placeholder="Optional author or source note" />
              </label>

              {/* TAB BAR */}
              <nav className="tweak-workbench-tabs">
                <button
                  type="button"
                  className={`tweak-workbench-tab ${workspaceTab === 'source' ? 'is-active' : ''}`}
                  onClick={() => setWorkspaceTab('source')}
                >Source & Repair</button>
                <button
                  type="button"
                  className={`tweak-workbench-tab ${workspaceTab === 'units' ? 'is-active' : ''}`}
                  onClick={() => setWorkspaceTab('units')}
                >Recognized Units ({selectedAnalysis?.createdUnits.length || 0})</button>
                <button
                  type="button"
                  className={`tweak-workbench-tab ${workspaceTab === 'support' ? 'is-active' : ''}`}
                  onClick={() => setWorkspaceTab('support')}
                >Supporting WeaponDefs ({selectedAnalysis?.supportingWeaponDefs.length || 0})</button>
                <button
                  type="button"
                  className={`tweak-workbench-tab ${workspaceTab === 'helpers' ? 'is-active' : ''}`}
                  onClick={() => setWorkspaceTab('helpers')}
                >Helper Recipes ({selectedAnalysis?.recipes.length || 0})</button>
              </nav>

              {/* TAB CONTENTS */}
              {workspaceTab === 'source' && (
                <div className="tweak-workbench-tab-content">
                  <textarea
                    value={selected.rawLua}
                    onChange={event => onUpdateModule(selected.id, { rawLua: event.target.value })}
                    spellCheck="false"
                    className="tweak-workbench-editor"
                  />
                </div>
              )}

              {workspaceTab === 'units' && (
                <div className="tweak-workbench-tab-content">
                  <div className="tweak-analysis-metrics">
                    <div><span>Creates</span><strong>{selectedAnalysis?.createdUnits.length || 0}</strong></div>
                    <div><span>References</span><strong>{selectedAnalysis?.referencedUnits.length || 0}</strong></div>
                    <div><span>Weapons</span><strong>{selectedAnalysis?.weaponChanges || 0}</strong></div>
                    <div><span>Build menu</span><strong>{selectedAnalysis?.buildMenuOperations || 0}</strong></div>
                  </div>
                  <section className="tweak-analysis-section">
                    <h4>Recognized unit definitions</h4>
                    <p>{selectedAnalysis?.createdUnits.join(', ') || 'No literal clone or unit definitions found.'}</p>
                  </section>
                  <section className="tweak-analysis-section">
                    <h4>Custom parameters</h4>
                    <p>{selectedAnalysis?.customParameters.join(', ') || 'No custom parameters found.'}</p>
                    {selectedAnalysis?.unknownCustomParameters.length > 0 && (
                      <small className="tweak-custom-params-unknown">Inspection-only: {selectedAnalysis.unknownCustomParameters.join(', ')}</small>
                    )}
                  </section>
                </div>
              )}

              {workspaceTab === 'support' && (
                <div className="tweak-workbench-tab-content">
                  {selectedAnalysis?.supportingWeaponDefs.length > 0 && (
                    <section className="tweak-analysis-section tweak-support-candidates">
                      <div className="tweak-analysis-section__heading">
                        <h4>Project WeaponDefs candidates</h4>
                        <Button size="sm" onClick={() => onAddSupportingWeaponDefs(selectedAnalysis.supportingWeaponDefs)}>Add all {selectedAnalysis.supportingWeaponDefs.length}</Button>
                      </div>
                      <div className="tweak-lab-module-list">
                        {selectedAnalysis.supportingWeaponDefs.map(definition => {
                          const destination = `${definition.ownerUnitId}:${definition.key}`.toLowerCase();
                          const exists = supportingDestinations.has(destination);
                          return (
                            <article key={definition.id} className="tweak-support-candidate-card">
                              <span><strong>{definition.key.toUpperCase()}</strong> ({definition.ownerUnitId} · {definition.role})</span>
                              <Button size="sm" disabled={exists} onClick={() => onAddSupportingWeaponDefs([definition])}>{exists ? 'In library' : 'Add'}</Button>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  {selectedReport?.assetReferences.length > 0 && (
                    <section className="tweak-analysis-section">
                      <h4>External asset references ({selectedReport.assetReferences.length})</h4>
                      <div className="tweak-asset-list">
                        {selectedReport.assetReferences.slice(0, 12).map((reference, index) => (
                          <div key={`${reference.line}-${reference.field}-${reference.value}-${index}`}>
                            <span>{reference.kind} · line {reference.line}</span><code>{reference.value}</code>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {workspaceTab === 'helpers' && (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {selectedAnalysis?.helpers.length > 0 ? (
                    <div className="tweak-helper-list">
                      {selectedAnalysis.helpers.map(helper => (
                        <div key={helper.name} style={{ padding: '8px', border: '1px solid var(--color-border-subtle)', borderRadius: '4px' }}>
                          <code>{helper.name}(...)</code>
                          <span>{helper.mode === 'clone-factory' ? 'Clone factory' : 'Definition factory'} · {helper.callCount} calls</span>
                        </div>
                      ))}
                    </div>
                  ) : <p>No community helper functions recognized in this module.</p>}
                  {selectedAnalysis?.recipes.length > 0 && (
                    <section className="tweak-analysis-section">
                      <h4>Recognized helper recipes ({selectedAnalysis.recipes.length})</h4>
                      <div className="tweak-recipe-calls">
                        {selectedAnalysis.recipes.slice(0, 12).map((recipe, index) => (
                          <div key={`${recipe.helperName}-${recipe.newId}-${index}`}>
                            <code>{recipe.newId}</code>
                            <span>{recipe.sourceId ? `from ${recipe.sourceId}` : recipe.mode}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* PANEL 3: PREFLIGHT INSPECTOR (Right) */}
        <aside className={`tweak-lab-inspector ${inspectorFullscreen ? 'is-fullscreen' : ''}`} aria-label="Preflight Inspector">
          <div className="tweak-lab-section-heading">
            <span>Preflight Inspector</span>
            {selected && (
              <Button
                size="sm"
                variant={inspectorFullscreen ? 'primary' : 'secondary'}
                onClick={() => setInspectorFullscreen(val => !val)}
              >{inspectorFullscreen ? 'Restore view' : '↗ Full screen'}</Button>
            )}
          </div>
          {packageAnalysis.blockingIssues.length > 0 ? (
            <div className="tweak-inspector-diagnostics-empty" style={{ borderColor: 'var(--color-danger)' }}>
              <span style={{ color: 'var(--color-danger)' }}>✕</span>
              <div><strong>{packageAnalysis.blockingIssues.length} Blocker Issue(s)</strong><small>Syntax or load-order conflicts need repair before game launch.</small></div>
            </div>
          ) : (
            <div className="tweak-inspector-diagnostics-empty">
              <span aria-hidden="true">✓</span>
              <div><strong>Preflight clear</strong><small>No syntax or blocking dependency issues detected.</small></div>
            </div>
          )}

          {selectedAnalysis?.findings.length > 0 && (
            <section className="tweak-analyzer-v2">
              <h4>Analyzer Findings ({selectedAnalysis.findings.length})</h4>
              <div className="tweak-analyzer-confidence" style={{ display: 'flex', gap: '8px', fontSize: '10px', marginBottom: '8px' }}>
                <span className="is-exact"><b>{selectedAnalysis.confidenceCounts.exact}</b> Exact</span>
                <span className="is-probable"><b>{selectedAnalysis.confidenceCounts.probable}</b> Probable</span>
                <span className="is-dynamic"><b>{selectedAnalysis.confidenceCounts.dynamic}</b> Dynamic</span>
              </div>
              <div className="tweak-analyzer-findings">
                {selectedAnalysis.findings.slice(0, 8).map(finding => (
                  <article className={`is-${finding.confidence}`} key={finding.id}>
                    <span>{finding.confidence}</span>
                    <div><strong>{finding.title}</strong><small>{finding.detail}</small></div>
                    {finding.line > 0 && <code>Ln {finding.line}</code>}
                  </article>
                ))}
              </div>
            </section>
          )}

          {(selectedReport?.typeIssues.length > 0 || selectedReport?.runtimeRisks.length > 0) && (
            <section className="tweak-analysis-section tweak-preflight-section">
              <h4>Runtime Preflight Notices</h4>
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
                    <span>{risk.message} Lines {risk.lines.slice(0, 6).join(', ')}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {selectedReport && (
            <section className="tweak-analysis-section">
              <h4>Module Relationships</h4>
              {selectedReport.dependencies.map(edge => <p key={`dependency-${edge.to}`}><b>Needs</b> {moduleLabel(edge.to)} <code>{edge.unitIds.join(', ')}</code></p>)}
              {selectedReport.dependents.map(edge => <p key={`dependent-${edge.from}`}><b>Used by</b> {moduleLabel(edge.from)} <code>{edge.unitIds.join(', ')}</code></p>)}
              {selectedReport.unresolved.map(item => <p key={`unresolved-${item.unitId}`} style={{ color: 'var(--color-warning)' }}><b>External</b> <code>{item.unitId}</code></p>)}
            </section>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
