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
import {
  getWeaponBlueprintMetrics,
  normalizeWeaponBlueprint,
  validateWeaponBlueprint,
} from '../utils/weaponBlueprint.js';
import '../styles/features/weapon-laboratory.css';

const LAB_TABS = [
  { id: 'gameplay', label: 'Gameplay profile', panelId: 'weapon-lab-panel-gameplay' },
  { id: 'effects', label: 'Effects & assets', panelId: 'weapon-lab-panel-effects' },
  { id: 'library', label: 'Blueprint library', panelId: 'weapon-lab-panel-library' },
];

const GAMEPLAY_GROUPS = [
  {
    id: 'output',
    title: 'Output',
    description: 'Damage delivered by each projectile and the resulting impact area.',
    fields: [
      { key: 'damage', label: 'Damage', min: 0, step: 1 },
      { key: 'aoe', label: 'Splash radius', min: 0, step: 1 },
      { key: 'projectiles', label: 'Projectiles', min: 1, step: 1 },
    ],
  },
  {
    id: 'cadence',
    title: 'Cadence',
    description: 'Timing for individual shots, bursts, and volleys.',
    fields: [
      { key: 'reload', label: 'Reload time', min: 0, step: 0.01, suffix: 's' },
      { key: 'burst', label: 'Burst count', min: 1, step: 1 },
      { key: 'burstrate', label: 'Burst interval', min: 0, step: 0.01, suffix: 's' },
    ],
  },
  {
    id: 'delivery',
    title: 'Delivery',
    description: 'Range, projectile motion, and practical hit dispersion.',
    fields: [
      { key: 'range', label: 'Range', min: 0, step: 1, suffix: 'elmo' },
      { key: 'velocity', label: 'Velocity', min: 0, step: 1 },
      { key: 'flighttime', label: 'Flight time', min: 0, step: 0.1, suffix: 's' },
      { key: 'accuracy', label: 'Accuracy cone', min: 0, step: 1 },
      { key: 'sprayangle', label: 'Spray angle', min: 0, step: 1 },
    ],
  },
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

function LibraryPanel({ library, currentId, canEquip, onLoad, onEquip, onDelete }) {
  if (!library.length) {
    return (
      <EmptyState
        title="No saved blueprints"
        description="Save the current profile to create a reusable weapon design. Blueprints remain inside the project file."
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
              <Button size="sm" onClick={() => onLoad(blueprint)}>Open</Button>
              <Button size="sm" variant="primary" disabled={!canEquip} onClick={() => onEquip(blueprint)}>Equip</Button>
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
  selectedUnit,
  activeSlotNumber,
  onDraftChange,
  onNewVariant,
  onSave,
  onEquip,
  onDelete,
  onExportVfx,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('gameplay');
  const normalizedDraft = useMemo(
    () => normalizeWeaponBlueprint(draft, { createId: false }),
    [draft]
  );
  const issues = useMemo(() => validateWeaponBlueprint(draft), [draft]);
  const metrics = useMemo(() => getWeaponBlueprintMetrics(draft), [draft]);
  const isSaved = Boolean(draft?.id && library.some(item => item.id === draft.id));
  const canEquip = Boolean(selectedUnit?.isClone);
  const updateDraft = patch => onDraftChange(previous => ({ ...previous, ...patch }));
  const updateOverride = (key, value) => onDraftChange(previous => ({
    ...previous,
    overrides: { ...previous.overrides, [key]: value },
  }));
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
      description="Build a reusable weapon profile from the selected slot, validate its output, and equip it on a custom unit."
      capabilityIds={['development', 'generated']}
      metrics={[
        { label: 'Blueprints', value: library.length },
        { label: 'Target slot', value: activeSlotNumber || '—' },
      ]}
      status={<StatusBadge status={issues.length ? 'warning' : isSaved ? 'success' : 'info'}>{issues.length ? `${issues.length} to review` : isSaved ? 'Saved' : 'Draft'}</StatusBadge>}
      actions={(
        <>
          <Button onClick={onNewVariant}>New from slot</Button>
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
            items={LAB_TABS.map(item => item.id === 'library' ? { ...item, count: library.length } : item)}
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
              </button>
            ))}
          </nav>
          <div className="weapon-lab-brief__scope">
            <Type variant="eyebrow">Runtime scope</Type>
            <p>Gameplay overrides compile into cloned WeaponDefs. Generated CEG definitions require a full game or mod package.</p>
          </div>
        </aside>

        <div className="weapon-lab-workbench">
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
              <div className="weapon-lab-group-stack">
                {GAMEPLAY_GROUPS.map(group => (
                  <LabGroup
                    key={group.id}
                    {...group}
                    values={draft.overrides}
                    onChange={updateOverride}
                  />
                ))}
              </div>
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
                  <AssetPicker assetType="ceg" label="Trail / CEG" value={draft.overrides.cegtag || ''} onChange={value => updateOverride('cegtag', value)} />
                  <AssetPicker assetType="ceg" label="Explosion generator" value={draft.overrides.explosiongenerator || ''} onChange={value => updateOverride('explosiongenerator', value)} />
                  <AssetPicker assetType="projectileModel" label="Projectile model" value={draft.overrides.model || ''} onChange={value => updateOverride('model', value)} />
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
                  <Type as="h2" variant="section-title">Reusable weapon blueprints</Type>
                  <Type as="p" variant="description">Open a design for editing or equip it on the selected clone’s active weapon slot.</Type>
                </div>
                <Badge>{library.length} saved</Badge>
              </header>
              <LibraryPanel
                library={library}
                currentId={draft.id}
                canEquip={canEquip}
                onLoad={blueprint => onDraftChange(normalizeWeaponBlueprint(blueprint, { createId: false }))}
                onEquip={onEquip}
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
            <div><span>Trail binding</span><code>{effectEnabled ? `editp_${generatedId}_trail` : draft.overrides.cegtag || 'Inherited'}</code></div>
            <div><span>Impact binding</span><code>{effectEnabled ? `custom:editp_${generatedId}_impact` : draft.overrides.explosiongenerator || 'Inherited'}</code></div>
            <div><span>Projectile model</span><code>{draft.overrides.model || 'Inherited'}</code></div>
          </section>

          <section className="weapon-lab-validation">
            <Type variant="eyebrow">Compatibility</Type>
            {issues.length ? (
              <ul>{issues.map(issue => <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>)}</ul>
            ) : (
              <p className="is-ready">Blueprint values are structurally valid.</p>
            )}
            <p>The browser does not simulate Recoil rendering. Validate custom CEGs in game before distributing them.</p>
            {!canEquip && <p className="is-advisory">Select or create a cloned unit to equip this blueprint. Vanilla units can still be used as sources.</p>}
          </section>

          <div className="weapon-lab-action-stack">
            <Button variant="primary" fullWidth disabled={issues.length > 0} onClick={() => onSave(draft)}>Save blueprint</Button>
            <Button fullWidth disabled={issues.length > 0 || !canEquip} onClick={() => {
              const saved = onSave(draft);
              if (saved) onEquip(saved);
            }}>Save & equip on slot {activeSlotNumber}</Button>
            <Button fullWidth disabled={!effectEnabled || issues.length > 0} onClick={() => onExportVfx(draft)}>Save & download effect Lua</Button>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
