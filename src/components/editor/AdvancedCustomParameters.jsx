import { useMemo, useState } from 'react';
import { Button, ParameterStatus } from '../ui.jsx';
import CustomParameterControl from './CustomParameterControl.jsx';
import CustomParameterContractBundles from './CustomParameterContractBundles.jsx';
import DiscoveredKeyReviewWorkbench from './DiscoveredKeyReviewWorkbench.jsx';
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
import { buildCustomParameterReferenceCatalogs } from '../../config/customParameterEditors.js';

const PREFIX = 'customparams.';
const CORE_CUSTOM_KEYS = new Set([
  'techlevel', 'energyconv_capacity', 'energyconv_efficiency', 'carried_unit', 'spawnrate',
  'maxunits', 'controlradius', 'enabledocking', 'decayrate', 'deathdecayrate',
  'carrierdeaththroe', 'metalcost', 'energycost', 'armordef'
]);

function getValueType(value, catalogEntry) {
  if (catalogEntry?.type) return catalogEntry.type;
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
}

function valueDiscoverySummary(definition) {
  const discovery = definition?.valueDiscovery;
  if (!discovery) return '';
  const parts = [`Inferred ${discovery.inferredType} (${discovery.typeConfidence} confidence)`];
  const range = discovery.numericRange;
  if (range) {
    if (range.observedMin != null || range.observedMax != null) {
      parts.push(`observed ${range.observedMin ?? '?'} to ${range.observedMax ?? '?'}`);
    }
    if (range.lowerBound != null) parts.push(`consumer lower bound ${range.lowerBound}`);
    if (range.upperBound != null) parts.push(`consumer upper bound ${range.upperBound}`);
  }
  if (discovery.defaultCandidates.length > 0) {
    parts.push(`consumer default${discovery.defaultCandidates.length === 1 ? '' : 's'} ${discovery.defaultCandidates.join(', ')}`);
  }
  return parts.join(' · ');
}

function ArmorProfileField({ defaults, tweaks, onChange }) {
  const tweakKey = `${PREFIX}armordef`;
  const modified = Object.prototype.hasOwnProperty.call(tweaks, tweakKey);
  const inherited = defaults[tweakKey];
  const value = modified ? tweaks[tweakKey] : inherited;
  return (
    <section className={`armor-profile-field ${modified ? 'is-modified' : ''}`} aria-labelledby="armor-profile-field-title">
      <div className="armor-profile-field__identity">
        <span>Tweak-defined armor contract</span>
        <h4 id="armor-profile-field-title">Unit armor profile</h4>
        <p>Weapons with a matching <code>damage.&lt;profile&gt;</code> value use that damage against this unit.</p>
      </div>
      <label>
        <span>Profile ID</span>
        <input
          className="ui-control"
          value={value ?? ''}
          placeholder="e.g. armored"
          aria-describedby="armor-profile-field-help"
          onChange={event => {
            const next = event.target.value.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
            onChange(tweakKey, next || undefined);
          }}
        />
      </label>
      <Button size="sm" variant="ghost" disabled={!modified} onClick={() => onChange(tweakKey, undefined)}>Reset</Button>
      <small id="armor-profile-field-help">Lowercase letters, numbers, and underscores. Configure the same ID under a weapon’s Custom armor damage section.</small>
    </section>
  );
}

export default function AdvancedCustomParameters({
  defaults = {},
  tweaks = {},
  allUnitsList = [],
  defaultsDb = {},
  inheritedFromClone = false,
  onChange,
  onApplyProfile,
}) {
  const [catalogKey, setCatalogKey] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [draftType, setDraftType] = useState('string');
  const [draftValue, setDraftValue] = useState('');
  const [showReviewWorkbench, setShowReviewWorkbench] = useState(false);
  const referenceCatalogs = useMemo(
    () => buildCustomParameterReferenceCatalogs(allUnitsList, defaultsDb),
    [allUnitsList, defaultsDb]
  );

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
          <Button size="sm" variant="secondary" onClick={() => setShowReviewWorkbench(true)}>Review discovered keys</Button>
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

      <CustomParameterContractBundles
        defaults={defaults}
        tweaks={tweaks}
        onApplyPatch={onApplyProfile || (patch => Object.entries(patch).forEach(([key, value]) => onChange(key, value)))}
      />

      <ArmorProfileField defaults={defaults} tweaks={tweaks} onChange={onChange} />

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
                  <CustomParameterControl
                    definition={parameter.definition || { key: parameter.shortKey, type }}
                    label={parameter.definition?.label || parameter.shortKey}
                    value={parameter.value}
                    onChange={value => onChange(parameter.tweakKey, value)}
                    referenceCatalogs={referenceCatalogs}
                  />
                  <Button variant="quiet" disabled={!parameter.modified} onClick={() => onChange(parameter.tweakKey, undefined)}>{parameter.modified ? 'Reset' : 'Inherited'}</Button>
                </div>
                <p>
                  {parameter.definition?.description || 'Custom package key. Confirm that the loaded game code consumes it before relying on the value.'}
                  {parameter.definition?.observed && ` Observed ${parameter.definition.occurrences} time${parameter.definition.occurrences === 1 ? '' : 's'} in the current BAR source.`}
                  {parameter.definition?.inputHint && (
                    <span className="advanced-custom-parameter__input-hint">
                      <strong>What to enter:</strong> {parameter.definition.inputHint}
                    </span>
                  )}
                  {parameter.definition?.acceptedValues?.length > 0 && (
                    <span className="advanced-custom-parameter__accepted-values" aria-label={`Accepted values: ${parameter.definition.acceptedValues.join(', ')}`}>
                      {parameter.definition.acceptedValues.map(value => <code key={value}>{value}</code>)}
                    </span>
                  )}
                  {!parameter.definition?.acceptedValues?.length && parameter.definition?.suggestedValues?.length > 0 && (
                    <span className="advanced-custom-parameter__accepted-values" aria-label={`Values discovered in BAR: ${parameter.definition.suggestedValues.join(', ')}`}>
                      <strong>Observed suggestions:</strong>
                      {parameter.definition.suggestedValues.map(value => <code key={value}>{value}</code>)}
                    </span>
                  )}
                </p>
                {parameter.definition?.promotion && (
                  <div className="advanced-custom-parameter__evidence">
                    <span>{parameter.definition.promotion.description}</span>
                    {parameter.definition.valueDiscovery && <span>{valueDiscoverySummary(parameter.definition)}. Suggestions are evidence, not enforced values.</span>}
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
          <select
            aria-label="Custom parameter catalog"
            value={catalogKey}
            onChange={event => {
              const nextKey = event.target.value;
              const nextDefinition = CUSTOM_PARAMETER_BY_KEY.get(nextKey);
              setCatalogKey(nextKey);
              setDraftValue(nextDefinition?.acceptedValues?.[0] ?? (nextDefinition?.type === 'boolean' ? 'false' : ''));
            }}
          >
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
          <div className="advanced-custom-parameters__value">
            <span>Initial value</span>
            <CustomParameterControl
              definition={definition || { key: selectedKey, type: selectedType }}
              label="Initial value"
              value={draftValue}
              onChange={value => setDraftValue(typeof value === 'boolean' ? String(value) : value)}
              referenceCatalogs={referenceCatalogs}
            />
          </div>
        )}
        <Button variant="secondary" disabled={!canAdd} onClick={addParameter}>Add parameter</Button>
      </div>
      {definition && (
        <p className="advanced-custom-parameters__note">
          <strong>{definition.owner}:</strong> {definition.description}
          {definition.observed && ` Observed ${definition.occurrences} time${definition.occurrences === 1 ? '' : 's'} across the pinned BAR source.`}
          <span className="advanced-custom-parameters__promotion-note">
            <strong>{definition.promotion.label}:</strong> {definition.promotion.description}
            {definition.valueDiscovery && ` Automatic value discovery: ${valueDiscoverySummary(definition)}. Inferred values remain advisory.`}
            {definition.contractIds.length > 0 && ` Linked contract${definition.contractIds.length === 1 ? '' : 's'}: ${definition.contractIds.join(', ')}.`}
            {definition.consumerEvidence.length > 0 && ` Automatic consumer discovery found ${definition.consumerCount} source ${definition.consumerCount === 1 ? 'read' : 'reads'}; first evidence: ${definition.consumerEvidence[0].path}${definition.consumerEvidence[0].line ? `:${definition.consumerEvidence[0].line}` : ''}.`}
            {definition.promotion.runtimeFixtureIds.length > 0 && ` Runtime evidence: ${definition.promotion.runtimeFixtureIds.join(', ')}.`}
            {' '}Next: {definition.promotion.nextRequirement}
          </span>
        </p>
      )}
      {isCustom && selectedKey && !isValidCustomParameterKey(selectedKey) && <p className="advanced-custom-parameters__error">Use lowercase letters, numbers, and underscores; the first character must be a letter or underscore.</p>}
      {showReviewWorkbench && <DiscoveredKeyReviewWorkbench onClose={() => setShowReviewWorkbench(false)} />}
    </section>
  );
}
