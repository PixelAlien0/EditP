import { useMemo, useState } from 'react';
import { Button } from '../ui.jsx';
import {
  CUSTOM_PARAMETER_BY_KEY,
  CUSTOM_PARAMETER_CATALOG,
  coerceCustomParameterValue,
  isValidCustomParameterKey,
  normalizeCustomParameterKey
} from '../../config/customParameters.js';

const PREFIX = 'customparams.';
const CORE_CUSTOM_KEYS = new Set([
  'techlevel', 'energyconv_capacity', 'energyconv_efficiency', 'carried_unit', 'spawnrate',
  'maxunits', 'controlradius', 'enabledocking', 'decayrate', 'deathdecayrate',
  'carrierdeaththroe', 'metalcost', 'energycost'
]);

function getValueType(value, catalogEntry) {
  if (catalogEntry?.type) return catalogEntry.type;
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
}

export default function AdvancedCustomParameters({ defaults = {}, tweaks = {}, onChange }) {
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
  const available = CUSTOM_PARAMETER_CATALOG.filter(parameter => !activeKeys.has(parameter.key));
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
          <p>These keys are consumed by BAR gadgets or optional packages, not by Recoil automatically.</p>
        </div>
        <span className="advanced-custom-parameters__count">{active.filter(parameter => parameter.modified).length} overrides</span>
      </header>

      {active.length > 0 && (
        <div className="advanced-custom-parameters__list">
          {active.map(parameter => {
            const type = getValueType(parameter.value, parameter.definition);
            return (
              <div className="advanced-custom-parameter" key={parameter.tweakKey}>
                <div className="advanced-custom-parameter__identity">
                  <strong>{parameter.definition?.label || parameter.shortKey}</strong>
                  <code>{parameter.shortKey}</code>
                  <span>{parameter.modified ? 'Edited' : 'Inherited'} · {parameter.definition?.owner || 'Unverified custom key'}</span>
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
                      aria-label={`${parameter.definition?.label || parameter.shortKey} value`}
                      value={parameter.value}
                      onChange={event => onChange(parameter.tweakKey, event.target.value)}
                    />
                  )}
                  <Button variant="quiet" disabled={!parameter.modified} onClick={() => onChange(parameter.tweakKey, undefined)}>{parameter.modified ? 'Reset' : 'Inherited'}</Button>
                </div>
                <p>{parameter.definition?.description || 'Custom package key. Confirm that the loaded game code consumes it before relying on the value.'}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="advanced-custom-parameters__composer">
        <label>
          <span>Parameter</span>
          <select value={catalogKey} onChange={event => { setCatalogKey(event.target.value); setDraftValue(''); }}>
            <option value="">Choose a supported key…</option>
            {available.map(parameter => <option key={parameter.key} value={parameter.key}>{parameter.label}</option>)}
            <option value="__custom__">Custom package key…</option>
          </select>
        </label>
        {isCustom && (
          <label>
            <span>Key</span>
            <input value={customKey} placeholder="lowercase_key" onChange={event => setCustomKey(event.target.value)} />
          </label>
        )}
        {isCustom && (
          <label>
            <span>Type</span>
            <select value={draftType} onChange={event => setDraftType(event.target.value)}>
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
              <select value={draftValue} onChange={event => setDraftValue(event.target.value)}>
                <option value="">Disabled</option>
                <option value="true">Enabled</option>
              </select>
            ) : (
              <input
                type={selectedType === 'number' ? 'number' : 'text'}
                value={draftValue}
                placeholder={selectedType === 'number' ? '0' : 'Value required'}
                onChange={event => setDraftValue(event.target.value)}
              />
            )}
          </label>
        )}
        <Button variant="secondary" disabled={!canAdd} onClick={addParameter}>Add parameter</Button>
      </div>
      {definition && <p className="advanced-custom-parameters__note"><strong>{definition.owner}:</strong> {definition.description}</p>}
      {isCustom && selectedKey && !isValidCustomParameterKey(selectedKey) && <p className="advanced-custom-parameters__error">Use lowercase letters, numbers, and underscores; the first character must be a letter or underscore.</p>}
    </section>
  );
}
