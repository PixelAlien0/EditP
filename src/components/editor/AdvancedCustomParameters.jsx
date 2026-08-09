import { useMemo, useState } from 'react';
import { Button, ParameterStatus } from '../ui.jsx';
import {
  CUSTOM_PARAMETER_BY_KEY,
  CUSTOM_PARAMETER_CATALOG,
  CUSTOM_PARAMETER_DISCOVERY,
  coerceCustomParameterValue,
  isValidCustomParameterKey,
  normalizeCustomParameterKey
} from '../../config/customParameters.js';
import {
  CUSTOM_PARAMETER_PROMOTION_ORDER,
  CUSTOM_PARAMETER_PROMOTION_STAGES,
} from '../../config/customParameterPromotion.js';

const PREFIX = 'customparams.';
const CORE_CUSTOM_KEYS = new Set([
  'techlevel', 'energyconv_capacity', 'energyconv_efficiency', 'carried_unit', 'spawnrate',
  'maxunits', 'controlradius', 'enabledocking', 'decayrate', 'deathdecayrate',
  'carrierdeaththroe', 'metalcost', 'energycost'
]);
const SCAVENGER_PROFILE_KEYS = Object.freeze([
  'scavcustomsquad', 'scavsquadunitsamount', 'scavsquadminanger', 'scavsquadmaxanger',
  'scavsquadweight', 'scavsquadrarity', 'scavsquadbehavior', 'scavsquadbehaviordistance',
  'scavsquadbehaviorchance',
]);
const SCAVENGER_PRESETS = Object.freeze({
  fighter: Object.freeze({
    label: 'Fighter screen',
    values: Object.freeze({ scavsquadunitsamount: 6, scavsquadminanger: 15, scavsquadmaxanger: 140, scavsquadweight: 100, scavsquadrarity: 'basic', scavsquadbehavior: 'berserk', scavsquadbehaviordistance: 1000, scavsquadbehaviorchance: 1 }),
  }),
  scout: Object.freeze({
    label: 'Scout raider',
    values: Object.freeze({ scavsquadunitsamount: 1, scavsquadminanger: 15, scavsquadmaxanger: 100, scavsquadweight: 100, scavsquadrarity: 'basic', scavsquadbehavior: 'raider', scavsquadbehaviordistance: 600, scavsquadbehaviorchance: 1 }),
  }),
  assault: Object.freeze({
    label: 'Assault group',
    values: Object.freeze({ scavsquadunitsamount: 2, scavsquadminanger: 30, scavsquadmaxanger: 120, scavsquadweight: 150, scavsquadrarity: 'basic', scavsquadbehavior: 'berserk', scavsquadbehaviordistance: 1000, scavsquadbehaviorchance: 1 }),
  }),
  artillery: Object.freeze({
    label: 'Artillery group',
    values: Object.freeze({ scavsquadunitsamount: 2, scavsquadminanger: 30, scavsquadmaxanger: 120, scavsquadweight: 150, scavsquadrarity: 'basic', scavsquadbehavior: 'artillery', scavsquadbehaviordistance: 1100, scavsquadbehaviorchance: 1 }),
  }),
  special: Object.freeze({
    label: 'Special encounter',
    values: Object.freeze({ scavsquadunitsamount: 2, scavsquadminanger: 55, scavsquadmaxanger: 120, scavsquadweight: 150, scavsquadrarity: 'special', scavsquadbehavior: 'raider', scavsquadbehaviordistance: 1000, scavsquadbehaviorchance: 1 }),
  }),
});

function getValueType(value, catalogEntry) {
  if (catalogEntry?.type) return catalogEntry.type;
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
}

function isEnabled(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function ScavengerSquadProfile({ defaults, tweaks, onApplyProfile }) {
  const [presetId, setPresetId] = useState('fighter');
  const getEffectiveValue = key => {
    const path = `${PREFIX}${key}`;
    return Object.prototype.hasOwnProperty.call(tweaks, path) ? tweaks[path] : defaults[path];
  };
  const enabled = isEnabled(getEffectiveValue('scavcustomsquad'));
  const minAnger = Number(getEffectiveValue('scavsquadminanger'));
  const maxAnger = Number(getEffectiveValue('scavsquadmaxanger'));
  const chance = Number(getEffectiveValue('scavsquadbehaviorchance'));
  const hasAngerConflict = enabled && Number.isFinite(minAnger) && Number.isFinite(maxAnger) && minAnger > maxAnger;
  const hasChanceConflict = enabled && Number.isFinite(chance) && (chance < 0 || chance > 1);

  const applyPreset = () => {
    const preset = SCAVENGER_PRESETS[presetId];
    onApplyProfile(Object.fromEntries([
      ['scavcustomsquad', true],
      ...Object.entries(preset.values),
    ].map(([key, value]) => [`${PREFIX}${key}`, value])));
  };

  const disableProfile = () => {
    onApplyProfile(Object.fromEntries([
      ['scavcustomsquad', false],
      ...SCAVENGER_PROFILE_KEYS.filter(key => key !== 'scavcustomsquad').map(key => [key, undefined]),
    ].map(([key, value]) => [`${PREFIX}${key}`, value])));
  };

  return (
    <section className={`scavenger-squad-profile ${enabled ? 'is-enabled' : ''}`} aria-labelledby="scavenger-squad-profile-title">
      <div className="scavenger-squad-profile__identity">
        <span>BAR Scavenger system</span>
        <h4 id="scavenger-squad-profile-title">Scavenger Squad Profile</h4>
        <p>{enabled ? 'This unit is registered as an eligible Scavenger squad candidate.' : 'Register this unit for BAR Scavenger squad selection using a tested profile.'}</p>
      </div>
      <label className="scavenger-squad-profile__preset">
        <span>Starter profile</span>
        <select value={presetId} onChange={event => setPresetId(event.target.value)} aria-label="Scavenger squad starter profile">
          {Object.entries(SCAVENGER_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
        </select>
      </label>
      <div className="scavenger-squad-profile__actions">
        <Button variant="secondary" onClick={applyPreset}>{enabled ? 'Reapply profile' : 'Enable profile'}</Button>
        {enabled && <Button variant="quiet" onClick={disableProfile}>Disable</Button>}
      </div>
      <div className="scavenger-squad-profile__footer">
        <span>{enabled ? '9 configured contract fields' : 'No Scavenger registration'}</span>
        <span>Edit the generated fields below for exact tuning.</span>
      </div>
      {(hasAngerConflict || hasChanceConflict) && (
        <p className="scavenger-squad-profile__warning">
          {hasAngerConflict && 'Minimum anger must not exceed maximum anger.'}{hasAngerConflict && hasChanceConflict && ' '}{hasChanceConflict && 'Behavior chance must be between 0 and 1.'}
        </p>
      )}
    </section>
  );
}

export default function AdvancedCustomParameters({ defaults = {}, tweaks = {}, inheritedFromClone = false, onChange, onApplyProfile }) {
  const [catalogKey, setCatalogKey] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [draftType, setDraftType] = useState('string');
  const [draftValue, setDraftValue] = useState('');

  const active = useMemo(() => {
    const keys = new Set([...Object.keys(defaults), ...Object.keys(tweaks)]
      .filter(key => key.startsWith(PREFIX) && !CORE_CUSTOM_KEYS.has(key.slice(PREFIX.length))));
    return [...keys].sort().map(tweakKey => {
      const shortKey = tweakKey.slice(PREFIX.length);
      const modified = Object.prototype.hasOwnProperty.call(tweaks, tweakKey);
      return {
        tweakKey, shortKey, modified,
        value: modified ? tweaks[tweakKey] : defaults[tweakKey],
        definition: CUSTOM_PARAMETER_BY_KEY.get(shortKey)
      };
    });
  }, [defaults, tweaks]);

  const activeKeys = new Set(active.map(parameter => parameter.shortKey));
  const available = CUSTOM_PARAMETER_CATALOG.filter(parameter => (
    !activeKeys.has(parameter.key) && !CORE_CUSTOM_KEYS.has(parameter.key)
  ));
  const availableByPromotion = [...CUSTOM_PARAMETER_PROMOTION_ORDER]
    .reverse()
    .map(stageId => ({
      stage: CUSTOM_PARAMETER_PROMOTION_STAGES[stageId],
      parameters: available.filter(parameter => parameter.promotion.id === stageId),
    }))
    .filter(group => group.parameters.length > 0);
  const promotionCounts = CUSTOM_PARAMETER_CATALOG.reduce((counts, parameter) => {
    counts[parameter.promotion.id] = (counts[parameter.promotion.id] || 0) + 1;
    return counts;
  }, {});
  const supportedCount = CUSTOM_PARAMETER_CATALOG.filter(parameter => parameter.promotion.rank >= 3).length;
  const consumerBackedCount = CUSTOM_PARAMETER_CATALOG.filter(parameter => parameter.consumerCount > 0).length;
  const isCustom = catalogKey === '__custom__';
  const selectedKey = isCustom ? normalizeCustomParameterKey(customKey) : catalogKey;
  const definition = CUSTOM_PARAMETER_BY_KEY.get(selectedKey);
  const selectedType = definition?.type || draftType;
  const canAdd = isValidCustomParameterKey(selectedKey)
    && !activeKeys.has(selectedKey)
    && (selectedType === 'boolean' || draftValue.trim() !== '')
    && (selectedType !== 'number' || Number.isFinite(Number(draftValue)));

  const addParameter = () => {
    if (!canAdd) return;
    const value = coerceCustomParameterValue(selectedType === 'boolean' && draftValue === '' ? false : draftValue, selectedType);
    onChange(`${PREFIX}${selectedKey}`, value);
    setCatalogKey('');
    setCustomKey('');
    setDraftType('string');
    setDraftValue('');
  };

  return (
    <section className="advanced-custom-parameters" aria-labelledby="advanced-custom-parameters-title">
      <header className="advanced-custom-parameters__header">
        <div>
          <span>Extensible definition data</span>
          <h3 id="advanced-custom-parameters-title">Advanced custom parameters</h3>
          <p>Documented contracts and keys discovered automatically from the pinned BAR definition snapshot.</p>
        </div>
        <div className="advanced-custom-parameters__summary">
          <span className="advanced-custom-parameters__count">{active.filter(parameter => parameter.modified).length} overrides</span>
          <span className="advanced-custom-parameters__count">{CUSTOM_PARAMETER_DISCOVERY.counts.unitParameters} observed keys</span>
          <span className="advanced-custom-parameters__count">{consumerBackedCount} consumer-backed</span>
          <span className="advanced-custom-parameters__count">{supportedCount} supported</span>
        </div>
      </header>

      <ol className="advanced-custom-parameters__promotion-rail" aria-label="Semantic contract promotion stages">
        {CUSTOM_PARAMETER_PROMOTION_ORDER.map((stageId, index) => {
          const stage = CUSTOM_PARAMETER_PROMOTION_STAGES[stageId];
          return (
            <li key={stageId} title={stage.description}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{stage.label}</strong>
              <small>{promotionCounts[stageId] || 0}</small>
            </li>
          );
        })}
      </ol>

      <ScavengerSquadProfile
        defaults={defaults}
        tweaks={tweaks}
        onApplyProfile={onApplyProfile || (patch => Object.entries(patch).forEach(([key, value]) => onChange(key, value)))}
      />

      {active.length > 0 && (
        <div className="advanced-custom-parameters__list">
          {active.map(parameter => {
            const type = getValueType(parameter.value, parameter.definition);
            return (
              <div className="advanced-custom-parameter" key={parameter.tweakKey}>
                <div className="advanced-custom-parameter__identity">
                  <strong>{parameter.definition?.label || parameter.shortKey}</strong>
                  <code>{parameter.shortKey}</code>
                  <span className={`advanced-custom-parameter__status is-${parameter.definition?.promotion.id || 'custom'}`}>
                    {parameter.definition?.promotion.shortLabel || 'Custom'}
                  </span>
                  <ParameterStatus
                    modified={parameter.modified}
                    source={!inheritedFromClone && Object.prototype.hasOwnProperty.call(defaults, parameter.tweakKey) ? 'bar' : 'inherited'}
                    capabilityIds={parameter.definition?.capabilities || []}
                    external={!parameter.definition || parameter.definition.owner === 'Package-specific'}
                  />
                </div>
                <div className="advanced-custom-parameter__editor">
                  {type === 'boolean' ? (
                    <select
                      className="stat-card-input"
                      aria-label={`${parameter.definition?.label || parameter.shortKey} value`}
                      value={parameter.value === true || parameter.value === 1 || parameter.value === '1' || parameter.value === 'true' ? 'true' : 'false'}
                      onChange={event => onChange(parameter.tweakKey, event.target.value === 'true')}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  ) : (
                    <input
                      className="stat-card-input"
                      type={type === 'number' ? 'number' : 'text'}
                      min={parameter.definition?.min}
                      max={parameter.definition?.max}
                      aria-label={`${parameter.definition?.label || parameter.shortKey} value`}
                      value={parameter.value}
                      onChange={event => onChange(parameter.tweakKey, event.target.value)}
                    />
                  )}
                  <Button variant="quiet" disabled={!parameter.modified} onClick={() => onChange(parameter.tweakKey, undefined)}>{parameter.modified ? 'Reset' : 'Inherited'}</Button>
                </div>
                <p>
                  {parameter.definition?.description || 'Custom package key. Confirm that the loaded game code consumes it before relying on the value.'}
                  {parameter.definition?.observed && ` Observed ${parameter.definition.occurrences} time${parameter.definition.occurrences === 1 ? '' : 's'} in the current BAR source.`}
                </p>
                {parameter.definition?.promotion && (
                  <div className="advanced-custom-parameter__evidence">
                    <span>{parameter.definition.promotion.description}</span>
                    {parameter.definition.consumerEvidence.length > 0 && (
                      <span className="advanced-custom-parameter__consumer" title={parameter.definition.consumerEvidence.map(item => item.path).join('\n')}>
                        Consumer evidence: {parameter.definition.consumerCount} {parameter.definition.consumerCount === 1 ? 'read' : 'reads'} across {parameter.definition.consumerEvidence.length} {parameter.definition.consumerEvidence.length === 1 ? 'source' : 'sources'} · {parameter.definition.consumerEvidence[0].path}
                      </span>
                    )}
                    <span>Next: {parameter.definition.promotion.nextRequirement}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="advanced-custom-parameters__composer">
        <label>
          <span>Parameter</span>
          <select aria-label="Custom parameter catalog" value={catalogKey} onChange={event => { setCatalogKey(event.target.value); setDraftValue(''); }}>
            <option value="">Choose a registered key…</option>
            {availableByPromotion.map(group => (
              <optgroup key={group.stage.id} label={`${group.stage.label} (${group.parameters.length})`}>
                {group.parameters.map(parameter => <option key={parameter.key} value={parameter.key}>{parameter.label}</option>)}
              </optgroup>
            ))}
            <option value="__custom__">Custom package key…</option>
          </select>
        </label>
        {isCustom && (
          <label>
            <span>Key</span>
            <input aria-label="Custom parameter key" value={customKey} placeholder="lowercase_key" onChange={event => setCustomKey(event.target.value)} />
          </label>
        )}
        {isCustom && (
          <label>
            <span>Type</span>
            <select aria-label="Custom parameter type" value={draftType} onChange={event => setDraftType(event.target.value)}>
              <option value="string">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
            </select>
          </label>
        )}
        {catalogKey && (
          <label className="advanced-custom-parameters__value">
            <span>Initial value</span>
            {selectedType === 'boolean' ? (
              <select aria-label="Initial value" value={draftValue} onChange={event => setDraftValue(event.target.value)}>
                <option value="">Disabled</option>
                <option value="true">Enabled</option>
              </select>
            ) : (
              <input
                aria-label="Initial value"
                type={selectedType === 'number' ? 'number' : 'text'}
                min={definition?.min}
                max={definition?.max}
                value={draftValue}
                placeholder={selectedType === 'number' ? '0' : 'Value required'}
                onChange={event => setDraftValue(event.target.value)}
              />
            )}
          </label>
        )}
        <Button variant="secondary" disabled={!canAdd} onClick={addParameter}>Add parameter</Button>
      </div>
      {definition && (
        <p className="advanced-custom-parameters__note">
          <strong>{definition.owner}:</strong> {definition.description}
          {definition.observed && ` Observed ${definition.occurrences} time${definition.occurrences === 1 ? '' : 's'} across the pinned BAR source.`}
          <span className="advanced-custom-parameters__promotion-note">
            <strong>{definition.promotion.label}:</strong> {definition.promotion.description}
            {definition.contractIds.length > 0 && ` Linked contract${definition.contractIds.length === 1 ? '' : 's'}: ${definition.contractIds.join(', ')}.`}
            {definition.consumerEvidence.length > 0 && ` Automatic consumer discovery found ${definition.consumerCount} source ${definition.consumerCount === 1 ? 'read' : 'reads'}; first evidence: ${definition.consumerEvidence[0].path}${definition.consumerEvidence[0].line ? `:${definition.consumerEvidence[0].line}` : ''}.`}
            {definition.promotion.runtimeFixtureIds.length > 0 && ` Runtime evidence: ${definition.promotion.runtimeFixtureIds.join(', ')}.`}
            {' '}Next: {definition.promotion.nextRequirement}
          </span>
        </p>
      )}
      {isCustom && selectedKey && !isValidCustomParameterKey(selectedKey) && <p className="advanced-custom-parameters__error">Use lowercase letters, numbers, and underscores; the first character must be a letter or underscore.</p>}
    </section>
  );
}
