import { useMemo, useState } from 'react';
import {
  getApplicableWeaponParameters,
  getSpecialProjectileParameters,
  WEAPON_ADVANCED_GROUPS,
  WEAPON_CORE_PARAMETERS,
  WEAPON_SECONDARY_PARAMETERS,
  WEAPON_TARGET_MASK_PARAMETERS,
} from '../config/weaponParameters.js';
import { TARGET_CATEGORY_GROUPS } from '../config/editorParameters.js';
import { getParameterHelp } from '../config/parameterGuidance.js';
import {
  getWeaponBlueprintEffectiveValues,
  getWeaponBlueprintOverrides,
  getWeaponBlueprintSourceValues,
} from '../utils/weaponBlueprint.js';
import { Badge, Button, ParameterStatus } from './ui.jsx';
import AssetPicker from './editor/AssetPicker.jsx';
import ArmorDamageEditor from './editor/ArmorDamageEditor.jsx';

function groupCoreParameters(parameters) {
  const groups = new Map();
  parameters.forEach(parameter => {
    const groupName = parameter.group || 'Additional';
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(parameter);
  });
  return [...groups.entries()].map(([title, params]) => ({
    id: `core-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title,
    description: 'Engine-native WeaponDef controls.',
    params,
  }));
}

function valuesMatch(left, right, valueType) {
  if (valueType === 'boolean') {
    const normalize = value => value === true || value === 'true' || value === 1 || value === '1';
    return normalize(left) === normalize(right);
  }
  if (valueType === 'number' && left !== '' && right !== '') {
    return Number.isFinite(Number(left)) && Number(left) === Number(right);
  }
  return String(left ?? '') === String(right ?? '');
}

function ParameterControl({ parameter, sourceValues, overrideValues, effectiveValues, onChange }) {
  const value = effectiveValues[parameter.key];
  const sourceValue = sourceValues[parameter.key];
  const modified = Object.prototype.hasOwnProperty.call(overrideValues, parameter.key);
  const description = parameter.description || getParameterHelp(parameter.key, parameter.label);
  const commit = nextValue => {
    if (
      nextValue === undefined
      || nextValue === ''
      || (
        Object.prototype.hasOwnProperty.call(sourceValues, parameter.key)
        && valuesMatch(nextValue, sourceValue, parameter.valueType)
      )
    ) {
      onChange(parameter.key, undefined);
      return;
    }
    onChange(parameter.key, nextValue);
  };

  let control;
  if (parameter.assetType) {
    control = (
      <AssetPicker
        assetType={parameter.assetType}
        label={parameter.label}
        value={value ?? ''}
        placeholder={sourceValue !== undefined ? String(sourceValue) : 'Inherited'}
        onChange={nextValue => commit(nextValue || undefined)}
      />
    );
  } else if (parameter.valueType === 'boolean') {
    control = (
      <select
        className="ui-control"
        aria-label={parameter.label}
        value={modified ? String(value) : ''}
        onChange={event => commit(
          event.target.value === '' ? undefined : event.target.value === 'true',
        )}
      >
        <option value="">Source · {sourceValue === undefined ? 'inherited' : sourceValue ? 'enabled' : 'disabled'}</option>
        <option value="true">Enabled</option>
        <option value="false">Disabled</option>
      </select>
    );
  } else if (parameter.options) {
    control = (
      <select
        className="ui-control"
        aria-label={parameter.label}
        value={modified ? value ?? '' : ''}
        onChange={event => commit(event.target.value || undefined)}
      >
        <option value="">Source · {sourceValue === undefined || sourceValue === '' ? 'inherited' : sourceValue}</option>
        {parameter.options.filter(option => option !== '').map(option => (
          <option key={option} value={option}>{parameter.optionLabels?.[option] || option}</option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        className="ui-control"
        type={parameter.valueType === 'number' ? 'number' : 'text'}
        value={value ?? ''}
        min={parameter.min}
        max={parameter.max}
        step={parameter.step || (parameter.valueType === 'number' ? 'any' : undefined)}
        placeholder={sourceValue !== undefined ? String(sourceValue) : 'Inherited'}
        aria-label={parameter.label}
        onChange={event => commit(event.target.value)}
      />
    );
  }

  return (
    <div className={[
      'weapon-lab-parameter',
      parameter.assetType ? 'has-asset' : '',
      parameter.assetType === 'sound' ? 'has-sound' : '',
      modified ? 'is-modified' : '',
    ].filter(Boolean).join(' ')}>
      <div className="weapon-lab-parameter__heading">
        <span>{parameter.label}</span>
        <ParameterStatus
          modified={modified}
          source={Object.prototype.hasOwnProperty.call(sourceValues, parameter.key) ? 'bar' : 'inherited'}
          capabilityIds={parameter.capabilities}
          generated
        />
      </div>
      {control}
      <div className="weapon-lab-parameter__footer">
        <small title={description}>{description}</small>
        {modified && (
          <Button size="sm" variant="ghost" onClick={() => onChange(parameter.key, undefined)}>
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}

function ParameterGroup({
  group,
  sourceValues,
  overrideValues,
  effectiveValues,
  onChange,
  defaultOpen = false,
}) {
  return (
    <details className="weapon-lab-parameter-group" open={defaultOpen}>
      <summary>
        <div>
          <strong>{group.title}</strong>
          <small>{group.description}</small>
        </div>
        <Badge size="sm">{group.params.length} fields</Badge>
        <span className="weapon-lab-parameter-group__chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="weapon-lab-parameter-grid">
        {group.params.map(parameter => (
          <ParameterControl
            key={parameter.key}
            parameter={parameter}
            sourceValues={sourceValues}
            overrideValues={overrideValues}
            effectiveValues={effectiveValues}
            onChange={onChange}
          />
        ))}
      </div>
    </details>
  );
}

function TargetMaskGroup({ sourceValues, overrideValues, effectiveValues, onChange }) {
  return (
    <details className="weapon-lab-parameter-group weapon-lab-target-masks">
      <summary>
        <div>
          <strong>Target category filters</strong>
          <small>Eligibility and target-priority masks applied to the destination weapon mount.</small>
        </div>
        <Badge size="sm">{WEAPON_TARGET_MASK_PARAMETERS.length} masks</Badge>
        <span className="weapon-lab-parameter-group__chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="weapon-lab-target-mask-list">
        {WEAPON_TARGET_MASK_PARAMETERS.map(parameter => {
          const value = String(effectiveValues[parameter.key] || '');
          const activeCategories = value.split(/\s+/).filter(Boolean);
          const modified = Object.prototype.hasOwnProperty.call(overrideValues, parameter.key);
          return (
            <section key={parameter.key} className={`weapon-lab-target-mask ${modified ? 'is-modified' : ''}`}>
              <header>
                <div>
                  <strong>{parameter.label}</strong>
                  <small>{parameter.description}</small>
                </div>
                <div className="weapon-lab-target-mask__status">
                  <ParameterStatus
                    modified={modified}
                    source={Object.prototype.hasOwnProperty.call(sourceValues, parameter.key) ? 'bar' : 'inherited'}
                    generated
                  />
                  {modified && <Button size="sm" variant="ghost" onClick={() => onChange(parameter.key, undefined)}>Reset</Button>}
                </div>
              </header>
              <input
                className="ui-control"
                value={value}
                placeholder="Inherited category mask"
                aria-label={`${parameter.label} category mask`}
                onChange={event => onChange(parameter.key, event.target.value || undefined)}
              />
              <div className="weapon-lab-target-groups target-filter-groups">
                {TARGET_CATEGORY_GROUPS.map(categoryGroup => (
                  <div className="target-filter-group" key={categoryGroup.label}>
                    <span>{categoryGroup.label}</span>
                    <div className="target-filter-chips">
                      {categoryGroup.categories.map(category => {
                        const active = activeCategories.includes(category);
                        return (
                          <button
                            key={category}
                            type="button"
                            className={`target-filter-chip ${active ? 'active' : ''}`}
                            aria-pressed={active}
                            onClick={() => {
                              const next = active
                                ? activeCategories.filter(item => item !== category)
                                : [...activeCategories, category];
                              onChange(parameter.key, next.length ? next.join(' ') : undefined);
                            }}
                          >
                            {category}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </details>
  );
}

export default function WeaponBlueprintParameterEditor({ blueprint, onChange }) {
  const [showAll, setShowAll] = useState(false);
  const effectiveValues = useMemo(
    () => getWeaponBlueprintEffectiveValues(blueprint),
    [blueprint],
  );
  const sourceValues = useMemo(
    () => getWeaponBlueprintSourceValues(blueprint),
    [blueprint],
  );
  const overrideValues = useMemo(
    () => getWeaponBlueprintOverrides(blueprint),
    [blueprint],
  );
  const hasParameter = key => Object.prototype.hasOwnProperty.call(effectiveValues, key);
  const visibleCore = getApplicableWeaponParameters(WEAPON_CORE_PARAMETERS, {
    showAll,
    hasParameter,
    includeEssential: true,
  });
  const activeSpecialBehavior = String(effectiveValues.speceffect || '').trim().toLowerCase();
  const advancedGroups = WEAPON_ADVANCED_GROUPS
    .map(group => {
      const candidates = group.kind === 'special-projectile' && !showAll
        ? getSpecialProjectileParameters(activeSpecialBehavior)
        : group.params;
      return {
        ...group,
        params: getApplicableWeaponParameters(candidates, { showAll, hasParameter }),
      };
    })
    .filter(group => group.params.length);
  const behaviorParameters = WEAPON_SECONDARY_PARAMETERS.filter(
    parameter => parameter.surface !== 'target-mask',
  );
  const visibleBehavior = getApplicableWeaponParameters(behaviorParameters, {
    showAll,
    hasParameter,
  });
  const groups = [
    ...groupCoreParameters(visibleCore),
    ...advancedGroups.map(group => ({
      id: `advanced-${group.groupOrder}`,
      title: group.title,
      description: group.description,
      params: group.params,
    })),
    ...(visibleBehavior.length ? [{
      id: 'behavior',
      title: 'Interceptor & fire control',
      description: 'Projectile interception and manual-fire behavior.',
      params: visibleBehavior,
    }] : []),
  ];
  const visibleCount = groups.reduce((total, group) => total + group.params.length, 0)
    + WEAPON_TARGET_MASK_PARAMETERS.length;

  return (
    <section className="weapon-lab-canonical-parameters">
      <header className="weapon-lab-parameter-toolbar">
        <div>
          <span>Canonical BAR parameter catalog</span>
          <strong>{visibleCount} visible controls</strong>
          <small>{showAll ? 'All supported WeaponDef and mount controls.' : 'Source fields plus essential authoring controls.'}</small>
        </div>
        <div className="weapon-lab-parameter-view weapon-parameter-view-toggle weapon-parameter-view-toggle__options" role="group" aria-label="Weapon Laboratory parameter view">
          <button type="button" className={!showAll ? 'is-active' : ''} aria-pressed={!showAll} onClick={() => setShowAll(false)}>
            Relevant
          </button>
          <button type="button" className={showAll ? 'is-active' : ''} aria-pressed={showAll} onClick={() => setShowAll(true)}>
            All
          </button>
        </div>
      </header>
      <div className="weapon-lab-canonical-parameter-groups">
        <ArmorDamageEditor
          values={effectiveValues}
          modifiedValues={overrideValues}
          linkedProfiles={[]}
          onChange={onChange}
        />
        {groups.map((group, index) => (
          <ParameterGroup
            key={group.id || group.title}
            group={group}
            sourceValues={sourceValues}
            overrideValues={overrideValues}
            effectiveValues={effectiveValues}
            onChange={onChange}
            defaultOpen={index === 0}
          />
        ))}
        <TargetMaskGroup
          sourceValues={sourceValues}
          overrideValues={overrideValues}
          effectiveValues={effectiveValues}
          onChange={onChange}
        />
      </div>
    </section>
  );
}
