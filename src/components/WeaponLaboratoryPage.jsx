import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  PageShell,
  SelectField,
  StatusBadge,
  SwitchField,
  Tabs,
  TextAreaField,
  TextField,
  Type,
} from './ui.jsx';
import AssetPicker from './editor/AssetPicker.jsx';
import WeaponBlueprintParameterEditor from './WeaponBlueprintParameterEditor.jsx';
import {
  createWeaponBlueprintDraft,
  getWeaponBlueprintMetrics,
  getWeaponBlueprintParameterValue,
  normalizeWeaponBlueprint,
  validateWeaponBlueprint,
} from '../utils/weaponBlueprint.js';
import '../styles/features/weapon-laboratory.css';

const LAB_TABS = [
  { id: 'source', label: 'Source catalog', panelId: 'weapon-lab-panel-source' },
  { id: 'gameplay', label: 'Gameplay profile', panelId: 'weapon-lab-panel-gameplay' },
  { id: 'effects', label: 'Effects & assets', panelId: 'weapon-lab-panel-effects' },
  { id: 'library', label: 'Custom storage', panelId: 'weapon-lab-panel-library' },
];

const EFFECT_NUMBER_GROUPS = [
  {
    id: 'trail',
    title: 'Trail emitter',
    engine: 'CBitmapMuzzleFlame',
    fields: [
      { key: 'trailSize', label: 'Width', min: 1, max: 80, step: 1 },
      { key: 'trailLength', label: 'Length', min: 1, max: 160, step: 1 },
      { key: 'trailGrowth', label: 'Growth', min: -1, max: 5, step: 0.05 },
      { key: 'trailLife', label: 'Lifetime', min: 1, max: 60, step: 1 },
      { key: 'trailOffset', label: 'Front offset', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'particles',
    title: 'Impact particles',
    engine: 'CSimpleParticleSystem',
    toggle: 'particlesEnabled',
    fields: [
      { key: 'particleSize', label: 'Particle size', min: 1, max: 40, step: 1 },
      { key: 'particleCount', label: 'Particle count', min: 1, max: 32, step: 1 },
      { key: 'particleLife', label: 'Particle lifetime', min: 1, max: 90, step: 1 },
      { key: 'spread', label: 'Emitter spread', min: 0, max: 90, step: 1 },
    ],
  },
  {
    id: 'heat',
    title: 'Heat core',
    engine: 'CHeatCloudProjectile',
    toggle: 'heatEnabled',
    fields: [
      { key: 'heatSize', label: 'Initial size', min: 1, max: 120, step: 1 },
      { key: 'heatGrowth', label: 'Size growth', min: 0, max: 20, step: 0.1 },
      { key: 'heatFalloff', label: 'Heat falloff', min: 0.1, max: 12, step: 0.1 },
    ],
  },
  {
    id: 'flash',
    title: 'Ground flash',
    engine: 'CStandardGroundFlash',
    toggle: 'groundFlashEnabled',
    fields: [
      { key: 'flashSize', label: 'Flash size', min: 1, max: 250, step: 1 },
      { key: 'flashAlpha', label: 'Flash alpha', min: 0, max: 1, step: 0.05 },
      { key: 'flashGrowth', label: 'Ring growth', min: 0, max: 40, step: 0.1 },
      { key: 'flashLife', label: 'Lifetime', min: 1, max: 60, step: 1 },
    ],
  },
];

function NumberField({ field, value, onChange }) {
  return (
    <label className="weapon-lab-number-field">
      <span>{field.label}{field.suffix && <small>{field.suffix}</small>}</span>
      <input
        className="ui-control"
        type="number"
        value={value ?? ''}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={event => onChange(event.target.value)}
      />
    </label>
  );
}

function LabGroup({ title, description, engine, enabled = true, toggle, fields, values, onChange, onToggle }) {
  return (
    <section className={`weapon-lab-group ${enabled ? '' : 'is-disabled'}`}>
      <header>
        <div>
          <Type as="h3" variant="subsection-title">{title}</Type>
          <Type as="p" variant="description">{description || engine}</Type>
        </div>
        {engine && <Badge size="sm">{engine}</Badge>}
        {toggle && (
          <SwitchField
            label={`Enable ${title.toLowerCase()}`}
            checked={enabled}
            onChange={event => onToggle(event.target.checked)}
          />
        )}
      </header>
      <div className="weapon-lab-field-grid">
        {fields.map(field => (
          <NumberField
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={value => onChange(field.key, value)}
          />
        ))}
      </div>
    </section>
  );
}

function SourceCatalogPanel({ sources, currentSourceId, onClone }) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(48);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sources;
    return sources.filter(source => [
      source.sourceWeaponDefKey,
      source.sourceUnitName,
      source.sourceUnitId,
    ].some(value => String(value || '').toLowerCase().includes(normalizedQuery)));
  }, [query, sources]);
  const visibleSources = filtered.slice(0, limit);

  return (
    <div className="weapon-lab-source-catalog">
      <header>
        <div>
          <Type variant="eyebrow">BAR WeaponDefs</Type>
          <Type as="h2" variant="section-title">Choose a weapon to clone</Type>
          <Type as="p" variant="description">The source remains untouched. Cloning creates an isolated draft that is only compiled after you save it and equip it to a clone.</Type>
        </div>
        <Badge>{filtered.length} sources</Badge>
      </header>
      <label className="weapon-lab-source-search">
        <span>Search weapon, unit, or definition ID</span>
        <input
          type="search"
          className="ui-control"
          placeholder="e.g. heat ray, Tremor, arm"
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setLimit(48);
          }}
        />
      </label>
      <div className="weapon-lab-source-grid">
        {visibleSources.map(source => {
          const sourceDraft = createWeaponBlueprintDraft({
            sourceUnitId: source.sourceUnitId,
            slot: source.slot,
          });
          const metrics = getWeaponBlueprintMetrics(sourceDraft);
          const isCurrent = currentSourceId === source.id;
          return (
            <article key={source.id} className={`weapon-lab-source-card ${isCurrent ? 'is-current' : ''}`}>
              <header>
                <div>
                  <strong>{source.sourceWeaponDefKey.toUpperCase()}</strong>
                  <span>{source.sourceUnitName}</span>
                  <code>{source.sourceUnitId}</code>
                </div>
                {isCurrent && <Badge tone="accent" size="sm">Draft source</Badge>}
              </header>
              <dl>
                <div><dt>DPS</dt><dd>{metrics.dps.toFixed(1)}</dd></div>
                <div><dt>Range</dt><dd>{metrics.range.toLocaleString()}</dd></div>
                <div><dt>Reload</dt><dd>{Number(getWeaponBlueprintParameterValue(sourceDraft, 'reload') || 0).toFixed(2)}s</dd></div>
              </dl>
              <Button size="sm" variant={isCurrent ? 'secondary' : 'primary'} onClick={() => onClone(source)}>
                {isCurrent ? 'Clone fresh copy' : 'Clone to workspace'}
              </Button>
            </article>
          );
        })}
      </div>
      {!visibleSources.length && (
        <EmptyState title="No source weapons found" description="Try a broader unit name or WeaponDef ID." />
      )}
      {visibleSources.length < filtered.length && (
        <Button className="weapon-lab-source-more" onClick={() => setLimit(previous => previous + 48)}>
          Show 48 more · {filtered.length - visibleSources.length} remaining
        </Button>
      )}
    </div>
  );
}

function LibraryPanel({ library, currentId, onLoad, onDelete }) {
  if (!library.length) {
    return (
      <EmptyState
        title="Custom weapon storage is empty"
        description="Clone a BAR weapon, customize the isolated draft, then save it here. Stored weapons do not affect any unit until equipped."
      />
    );
  }

  return (
    <div className="weapon-lab-library-grid">
      {library.map(blueprint => {
        const metrics = getWeaponBlueprintMetrics(blueprint);
        const isCurrent = blueprint.id === currentId;
        return (
          <article
            key={blueprint.id}
            className={`weapon-lab-library-card ${isCurrent ? 'is-current' : ''}`}
            style={{ '--weapon-swatch': blueprint.appearance?.color || 'var(--color-accent)' }}
          >
            <div className="weapon-lab-library-card__heading">
              <span className="weapon-lab-swatch" aria-hidden="true" />
              <div>
                <strong>{blueprint.name}</strong>
                <code>{blueprint.sourceWeaponDefKey}</code>
              </div>
              {isCurrent && <Badge tone="accent" size="sm">Editing</Badge>}
            </div>
            <p>{blueprint.description || 'Reusable weapon profile'}</p>
            <dl>
              <div><dt>DPS</dt><dd>{metrics.dps.toFixed(1)}</dd></div>
              <div><dt>Range</dt><dd>{metrics.range.toLocaleString()}</dd></div>
              <div><dt>Delivery</dt><dd>{metrics.delivery}</dd></div>
            </dl>
            <footer>
              <Button size="sm" variant="primary" onClick={() => onLoad(blueprint)}>Edit stored copy</Button>
              <Button size="sm" variant="danger" onClick={() => onDelete(blueprint.id)}>Delete</Button>
            </footer>
          </article>
        );
      })}
    </div>
  );
}

export default function WeaponLaboratoryPage({
  draft,
  library,
  sourceCatalog,
  onDraftChange,
  onCloneSource,
  onSave,
  onDelete,
  onExportVfx,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('source');
  const normalizedDraft = useMemo(
    () => normalizeWeaponBlueprint(draft, { createId: false }),
    [draft]
  );
  const issues = useMemo(() => validateWeaponBlueprint(draft), [draft]);
  const metrics = useMemo(() => getWeaponBlueprintMetrics(draft), [draft]);
  const isSaved = Boolean(draft?.id && library.some(item => item.id === draft.id));
  const updateDraft = patch => onDraftChange(previous => ({ ...previous, ...patch }));
  const updateOverride = (key, value) => onDraftChange(previous => {
    const overrides = { ...(previous.overrides || {}) };
    if (value === undefined || value === null || value === '') delete overrides[key];
    else overrides[key] = value;
    return { ...previous, overrides };
  });
  const updateAppearance = (key, value) => onDraftChange(previous => ({
    ...previous,
    appearance: { ...previous.appearance, [key]: value },
  }));
  const generatedId = normalizedDraft?.id || 'save-to-assign-id';
  const effectEnabled = draft.appearance?.vfxEnabled === true;

  return (
    <PageShell
      className="weapon-laboratory"
      eyebrow="Armament engineering"
      title="Weapon Laboratory"
      description="Clone a BAR weapon into an isolated design workspace, customize it, and preserve it in project storage for later loadout use."
      capabilityIds={['development', 'generated']}
      metrics={[
        { label: 'Stored weapons', value: library.length },
        { label: 'BAR sources', value: sourceCatalog.length },
      ]}
      status={<StatusBadge status={issues.length ? 'warning' : isSaved ? 'success' : 'info'}>{issues.length ? `${issues.length} to review` : isSaved ? 'Saved' : 'Draft'}</StatusBadge>}
      actions={(
        <>
          <Button onClick={() => setActiveTab('source')}>Choose source</Button>
          <Button onClick={onClose}>Back to editor</Button>
        </>
      )}
      toolbar={(
        <div className="weapon-laboratory__toolbar">
          <div className="weapon-lab-source-summary">
            <span>Source</span>
            <strong>{draft.sourceWeaponDefKey?.toUpperCase()}</strong>
            <code>{draft.sourceUnitId}</code>
          </div>
          <Tabs
            items={LAB_TABS.map(item => item.id === 'library'
              ? { ...item, count: library.length }
              : item.id === 'source'
                ? { ...item, count: sourceCatalog.length }
                : item)}
            value={activeTab}
            onChange={setActiveTab}
            label="Weapon Laboratory sections"
          />
        </div>
      )}
      bodyClassName="weapon-laboratory__body"
    >
      <div className="weapon-laboratory__layout">
        <aside className="weapon-lab-brief" aria-label="Blueprint brief">
          <section>
            <Type variant="eyebrow">Current blueprint</Type>
            <Type as="h2" variant="section-title">{draft.name || 'Untitled weapon'}</Type>
            <p>{draft.description || 'No design note has been added.'}</p>
          </section>
          <nav aria-label="Laboratory section summary">
            {LAB_TABS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={activeTab === item.id ? 'is-active' : ''}
                onClick={() => setActiveTab(item.id)}
              >
                <span>0{index + 1}</span>
                <strong>{item.label}</strong>
                {item.id === 'library' && <small>{library.length}</small>}
                {item.id === 'source' && <small>{sourceCatalog.length}</small>}
              </button>
            ))}
          </nav>
          <div className="weapon-lab-brief__scope">
            <Type variant="eyebrow">Runtime scope</Type>
            <p>Gameplay overrides compile into cloned WeaponDefs. Generated CEG definitions require a full game or mod package.</p>
          </div>
        </aside>

        <div className="weapon-lab-workbench">
          {activeTab === 'source' && (
            <div id="weapon-lab-panel-source" role="tabpanel" className="weapon-lab-tab-panel">
              <SourceCatalogPanel
                sources={sourceCatalog}
                currentSourceId={`${draft.sourceUnitId}:${draft.sourceWeaponDefKey}`}
                onClone={source => {
                  onCloneSource(source);
                  setActiveTab('gameplay');
                }}
              />
            </div>
          )}

          {activeTab === 'gameplay' && (
            <div id="weapon-lab-panel-gameplay" role="tabpanel" className="weapon-lab-tab-panel">
              <section className="weapon-lab-identity-panel">
                <div>
                  <Type variant="eyebrow">Blueprint identity</Type>
                  <Type as="h2" variant="section-title">Define the reusable profile</Type>
                </div>
                <div className="weapon-lab-identity-grid">
                  <TextField
                    label="Blueprint name"
                    value={draft.name}
                    error={issues.find(issue => issue.field === 'name')?.message}
                    onChange={event => updateDraft({ name: event.target.value })}
                  />
                  <TextAreaField
                    label="Design note"
                    value={draft.description}
                    placeholder="Role, balance intent, or installation notes"
                    onChange={event => updateDraft({ description: event.target.value })}
                  />
                </div>
              </section>
              <WeaponBlueprintParameterEditor
                blueprint={draft}
                onChange={updateOverride}
              />
            </div>
          )}

          {activeTab === 'effects' && (
            <div id="weapon-lab-panel-effects" role="tabpanel" className="weapon-lab-tab-panel">
              <section className="weapon-lab-effects-master">
                <SwitchField
                  label="Generate a custom trail and impact package"
                  description="Saving assigns deterministic BAR EditP CEG names. The generated Lua must be installed in a full game or mod."
                  checked={effectEnabled}
                  onChange={event => updateAppearance('vfxEnabled', event.target.checked)}
                />
                <StatusBadge status={effectEnabled ? 'success' : 'neutral'}>{effectEnabled ? 'Custom package enabled' : 'Native references only'}</StatusBadge>
              </section>

              <section className="weapon-lab-group weapon-lab-native-assets">
                <header>
                  <div>
                    <Type as="h3" variant="subsection-title">Native weapon references</Type>
                    <Type as="p" variant="description">Use existing BAR assets, or let the custom package replace the trail and explosion bindings on save.</Type>
                  </div>
                  <Badge size="sm">Engine assets</Badge>
                </header>
                <div className="weapon-lab-asset-grid">
                  <AssetPicker assetType="ceg" label="Trail / CEG" value={getWeaponBlueprintParameterValue(draft, 'cegTag') || ''} onChange={value => updateOverride('cegTag', value)} />
                  <AssetPicker assetType="ceg" label="Explosion generator" value={getWeaponBlueprintParameterValue(draft, 'explosiongenerator') || ''} onChange={value => updateOverride('explosiongenerator', value)} />
                  <AssetPicker assetType="projectileModel" label="Projectile model" value={getWeaponBlueprintParameterValue(draft, 'model') || ''} onChange={value => updateOverride('model', value)} />
                </div>
              </section>

              <section className={`weapon-lab-group weapon-lab-palette ${effectEnabled ? '' : 'is-disabled'}`}>
                <header>
                  <div>
                    <Type as="h3" variant="subsection-title">Effect palette</Type>
                    <Type as="p" variant="description">Color and texture values used by the generated trail and impact emitters.</Type>
                  </div>
                  <Badge size="sm">CEG palette</Badge>
                </header>
                <div className="weapon-lab-palette-grid">
                  <label><span>Core color</span><input type="color" value={draft.appearance.color} onChange={event => updateAppearance('color', event.target.value)} /></label>
                  <label><span>Falloff color</span><input type="color" value={draft.appearance.secondaryColor} onChange={event => updateAppearance('secondaryColor', event.target.value)} /></label>
                  <SelectField label="Texture" value={draft.appearance.texture} onChange={event => updateAppearance('texture', event.target.value)}>
                    <option value="flare">Flare</option>
                    <option value="plasma">Plasma</option>
                    <option value="smoke">Smoke</option>
                    <option value="heatcloud">Heat cloud</option>
                  </SelectField>
                  <NumberField field={{ key: 'brightness', label: 'Brightness', min: 0.1, max: 2, step: 0.1 }} value={draft.appearance.brightness} onChange={value => updateAppearance('brightness', value)} />
                </div>
              </section>

              <div className={`weapon-lab-group-stack ${effectEnabled ? '' : 'is-disabled'}`}>
                {EFFECT_NUMBER_GROUPS.map(group => (
                  <LabGroup
                    key={group.id}
                    {...group}
                    enabled={!group.toggle || draft.appearance[group.toggle] !== false}
                    values={draft.appearance}
                    onChange={updateAppearance}
                    onToggle={value => updateAppearance(group.toggle, value)}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'library' && (
            <div id="weapon-lab-panel-library" role="tabpanel" className="weapon-lab-tab-panel">
              <header className="weapon-lab-library-header">
                <div>
                  <Type variant="eyebrow">Project library</Type>
                  <Type as="h2" variant="section-title">Custom weapon storage</Type>
                  <Type as="p" variant="description">Stored designs remain project assets until you equip one from the Custom Weapons tab in Borrow a Weapon.</Type>
                </div>
                <Badge>{library.length} saved</Badge>
              </header>
              <LibraryPanel
                library={library}
                currentId={draft.id}
                onLoad={blueprint => {
                  onDraftChange(normalizeWeaponBlueprint(blueprint, { createId: false }));
                  setActiveTab('gameplay');
                }}
                onDelete={onDelete}
              />
            </div>
          )}
        </div>

        <aside className="weapon-lab-inspector" aria-label="Weapon blueprint analysis">
          <section className="weapon-lab-analysis">
            <Type variant="eyebrow">Output analysis</Type>
            <dl>
              <div><dt>DPS</dt><dd>{metrics.dps.toFixed(1)}</dd><small>Sustained estimate</small></div>
              <div><dt>Alpha</dt><dd>{metrics.alpha.toFixed(0)}</dd><small>Full salvo</small></div>
              <div><dt>Range</dt><dd>{metrics.range.toLocaleString()}</dd><small>Engine units</small></div>
              <div><dt>Splash</dt><dd>{metrics.aoe.toLocaleString()}</dd><small>Impact radius</small></div>
            </dl>
            <div className="weapon-lab-delivery"><span>Delivery profile</span><strong>{metrics.delivery}</strong></div>
          </section>

          <section className="weapon-lab-manifest">
            <Type variant="eyebrow">Export manifest</Type>
            <div><span>WeaponDef source</span><code>{draft.sourceWeaponDefKey}</code></div>
            <div><span>Trail binding</span><code>{effectEnabled ? `editp_${generatedId}_trail` : getWeaponBlueprintParameterValue(draft, 'cegTag') || 'Inherited'}</code></div>
            <div><span>Impact binding</span><code>{effectEnabled ? `custom:editp_${generatedId}_impact` : getWeaponBlueprintParameterValue(draft, 'explosiongenerator') || 'Inherited'}</code></div>
            <div><span>Projectile model</span><code>{getWeaponBlueprintParameterValue(draft, 'model') || 'Inherited'}</code></div>
          </section>

          <section className="weapon-lab-validation">
            <Type variant="eyebrow">Compatibility</Type>
            {issues.length ? (
              <ul>{issues.map(issue => <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>)}</ul>
            ) : (
              <p className="is-ready">Blueprint values are structurally valid.</p>
            )}
            <p>The browser does not simulate Recoil rendering. Validate custom CEGs in game before distributing them.</p>
            <p className="is-advisory">Saving only writes to custom weapon storage. It does not change the source weapon or any unit loadout.</p>
          </section>

          <div className="weapon-lab-action-stack">
            <Button variant="primary" fullWidth disabled={issues.length > 0} onClick={() => onSave(draft)}>Save to custom storage</Button>
            <Button fullWidth disabled={!effectEnabled || issues.length > 0} onClick={() => onExportVfx(draft)}>Save & download effect Lua</Button>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
