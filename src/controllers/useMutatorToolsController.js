import { useCallback, useMemo, useState } from 'react';

export const BULK_PARAMETER_GROUPS = Object.freeze([
  {
    label: 'Structure and cost',
    options: [
      { value: 'health', label: 'Health', unit: 'HP', minimum: 1, decimals: 2, description: 'Maximum durability. Units without a numeric BAR value are skipped.' },
      { value: 'metalcost', label: 'Metal cost', unit: 'metal', minimum: 0, decimals: 2, description: 'Metal required to construct each eligible unit.' },
      { value: 'energycost', label: 'Energy cost', unit: 'energy', minimum: 0, decimals: 2, description: 'Energy required to construct each eligible unit.' },
      { value: 'buildtime', label: 'Build time', unit: 'work', minimum: 1, decimals: 2, description: 'Build work required to complete each eligible unit.' },
      { value: 'mass', label: 'Mass', unit: 'mass', minimum: 1, decimals: 2, description: 'Collision and impulse mass for units that define it.' },
    ],
  },
  {
    label: 'Movement and sensors',
    options: [
      { value: 'maxvelocity', label: 'Maximum speed', unit: 'elmos/s', minimum: 0, decimals: 4, description: 'Top movement speed for units that define locomotion.' },
      { value: 'acceleration', label: 'Acceleration', unit: 'elmos/s²', minimum: 0, decimals: 5, description: 'Rate at which eligible units gain movement speed.' },
      { value: 'brakerate', label: 'Brake rate', unit: 'elmos/s²', minimum: 0, decimals: 5, description: 'Rate at which eligible units lose movement speed.' },
      { value: 'turnrate', label: 'Turn rate', unit: 'turn/s', minimum: 0, decimals: 3, description: 'Ground or chassis turning speed where BAR defines it.' },
      { value: 'sightdistance', label: 'Sight range', unit: 'elmos', minimum: 0, decimals: 2, description: 'Ordinary visual detection range.' },
      { value: 'radardistance', label: 'Radar range', unit: 'elmos', minimum: 0, decimals: 2, description: 'Radar detection range for units that carry radar.' },
      { value: 'sonardistance', label: 'Sonar range', unit: 'elmos', minimum: 0, decimals: 2, description: 'Underwater detection range for units that carry sonar.' },
    ],
  },
  {
    label: 'Production and storage',
    options: [
      { value: 'workertime', label: 'Worker power', unit: 'work/s', minimum: 0, decimals: 3, description: 'Build, repair, reclaim, and terraform power.' },
      { value: 'metalmake', label: 'Metal production', unit: 'metal/s', minimum: 0, decimals: 4, description: 'Passive metal production where BAR defines it.' },
      { value: 'energymake', label: 'Energy production', unit: 'energy/s', minimum: 0, decimals: 4, description: 'Passive energy production where BAR defines it.' },
      { value: 'metalstorage', label: 'Metal storage', unit: 'metal', minimum: 0, decimals: 2, description: 'Additional team metal storage.' },
      { value: 'energystorage', label: 'Energy storage', unit: 'energy', minimum: 0, decimals: 2, description: 'Additional team energy storage.' },
      { value: 'builddistance', label: 'Build range', unit: 'elmos', minimum: 0, decimals: 2, description: 'Builder interaction range for units that define it.' },
    ],
  },
  {
    label: 'Existing weapon slots',
    options: [
      { value: 'all_weapons_damage', label: 'All weapon damage', unit: 'damage', minimum: 0, decimals: 3, weaponField: 'damage', description: 'Adjust base damage on every existing mounted weapon slot.' },
      { value: 'all_weapons_range', label: 'All weapon range', unit: 'elmos', minimum: 0, decimals: 2, weaponField: 'range', description: 'Adjust range on every existing mounted weapon slot.' },
      { value: 'all_weapons_reload', label: 'All weapon reload', unit: 'seconds', minimum: 0.01, decimals: 4, weaponField: 'reload', description: 'Adjust reload time on every existing mounted weapon slot.' },
    ],
  },
]);

const BULK_PARAMETERS = new Map(
  BULK_PARAMETER_GROUPS.flatMap(group => group.options).map(option => [option.value, option]),
);

const BULK_CONFIRMATION_UNIT_THRESHOLD = 100;
const BULK_CONFIRMATION_BASE64_THRESHOLD = 12000;

function formatBulkNumber(value, decimals = 4) {
  const rounded = Number(Number(value).toFixed(decimals));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function applyBulkOperation(currentValue, changeValue, mode) {
  if (mode === 'percent') return currentValue * (1 + changeValue / 100);
  if (mode === 'set') return changeValue;
  return currentValue + changeValue;
}

export const RANDOM_INTENSITY_RANGES = {
  cautious: [0.90, 1.10],
  balanced: [0.75, 1.25],
  chaos: [0.50, 1.50],
};

// Deterministic core of the bulk adjustment handler. Computes the tweak
// updates that would be applied for the given units without touching state.
export function computeBulkUpdates(units, defaultsDb, tweaks, {
  statKey,
  changeValue,
  mode,
  resolveCloneRootId,
}) {
  const parameter = BULK_PARAMETERS.get(statKey);
  const updates = [];
  const previewRows = [];
  const affectedUnitIds = new Set();
  let skippedFieldCount = 0;
  let unchangedFieldCount = 0;
  const numericChange = Number(changeValue);

  if (units.length === 0) {
    return {
      updates,
      count: 0,
      affectedUnitCount: 0,
      affectedFieldCount: 0,
      skippedUnitCount: 0,
      skippedFieldCount: 0,
      unchangedFieldCount: 0,
      estimatedLuaChars: 0,
      estimatedBase64Chars: 0,
      requiresLargeScopeConfirmation: false,
      previewRows,
      blocked: true,
      error: 'Select at least one unit before configuring the batch.',
      warnings: [],
    };
  }

  if (!parameter || !Number.isFinite(numericChange)) {
    return {
      updates,
      count: 0,
      affectedUnitCount: 0,
      affectedFieldCount: 0,
      skippedUnitCount: units.length,
      skippedFieldCount: 0,
      unchangedFieldCount: 0,
      estimatedLuaChars: 0,
      estimatedBase64Chars: 0,
      requiresLargeScopeConfirmation: false,
      previewRows,
      blocked: true,
      error: !parameter ? 'Choose a supported parameter.' : 'Enter a valid numeric adjustment.',
      warnings: [],
    };
  }

  const pushUpdate = (unit, key, rawValue, sourceValue) => {
    const baseValue = Number(rawValue);
    if (!Number.isFinite(baseValue)) {
      skippedFieldCount += 1;
      return;
    }

    let nextValue = applyBulkOperation(baseValue, numericChange, mode === 'fixed' ? 'add' : mode);
    if (!Number.isFinite(nextValue)) {
      skippedFieldCount += 1;
      return;
    }
    if (parameter.minimum !== undefined) nextValue = Math.max(parameter.minimum, nextValue);
    if (parameter.maximum !== undefined) nextValue = Math.min(parameter.maximum, nextValue);

    const before = formatBulkNumber(baseValue, parameter.decimals);
    const after = formatBulkNumber(nextValue, parameter.decimals);
    if (Number(before) === Number(after)) {
      unchangedFieldCount += 1;
      return;
    }

    updates.push({ unitId: unit.id, key, value: after });
    affectedUnitIds.add(unit.id);
    previewRows.push({
      unitId: unit.id,
      unitName: unit.name || unit.id,
      artworkUnitId: unit.isClone ? (unit.baseId || resolveCloneRootId(unit.id)) : unit.id,
      key,
      fieldLabel: parameter.weaponField
        ? `${parameter.label} · slot ${key.match(/weapon_slot_(\d+)_/)?.[1] || '?'}`
        : parameter.label,
      before,
      after,
      source: sourceValue === undefined ? 'BAR' : 'Edited',
    });
  };

  units.forEach(unit => {
    const baseId = unit.isClone ? resolveCloneRootId(unit.id) : unit.id;
    const defaults = defaultsDb[baseId];
    if (!defaults) {
      skippedFieldCount += 1;
      return;
    }

    if (parameter.weaponField) {
      const slots = Array.isArray(defaults.weaponSlots) ? defaults.weaponSlots : [];
      slots.forEach(slot => {
        const subKey = parameter.weaponField;
        const tweakKey = `weapon_slot_${slot.slot}_${subKey}`;
        const currentTweak = tweaks[unit.id]?.[tweakKey];
        const baseValue = currentTweak !== undefined ? currentTweak : slot[subKey];
        if (baseValue === undefined || baseValue === null || baseValue === '') {
          skippedFieldCount += 1;
          return;
        }
        pushUpdate(unit, tweakKey, baseValue, currentTweak);
      });
    } else {
      const currentTweak = tweaks[unit.id]?.[statKey];
      const baseValue = currentTweak !== undefined ? currentTweak : defaults[statKey];
      if (baseValue === undefined || baseValue === null || baseValue === '') {
        skippedFieldCount += 1;
        return;
      }
      pushUpdate(unit, statKey, baseValue, currentTweak);
    }
  });

  const warnings = [];
  const estimatedLuaChars = updates.reduce((total, update) => (
    total + update.unitId.length + update.key.length + String(update.value).length + 28
  ), 0);
  const estimatedBase64Chars = Math.ceil(estimatedLuaChars / 3) * 4;
  const requiresLargeScopeConfirmation = affectedUnitIds.size > BULK_CONFIRMATION_UNIT_THRESHOLD
    || estimatedBase64Chars > BULK_CONFIRMATION_BASE64_THRESHOLD;
  if (skippedFieldCount > 0) warnings.push(`${skippedFieldCount.toLocaleString()} missing or non-numeric fields will be skipped.`);
  if (unchangedFieldCount > 0) warnings.push(`${unchangedFieldCount.toLocaleString()} fields already resolve to the previewed value.`);
  if (requiresLargeScopeConfirmation) warnings.push('Large batch: review the selected units and projected payload before confirming this operation.');

  return {
    updates,
    count: affectedUnitIds.size,
    affectedUnitCount: affectedUnitIds.size,
    affectedFieldCount: updates.length,
    skippedUnitCount: Math.max(0, units.length - affectedUnitIds.size),
    skippedFieldCount,
    unchangedFieldCount,
    estimatedLuaChars,
    estimatedBase64Chars,
    requiresLargeScopeConfirmation,
    previewRows,
    blocked: updates.length === 0,
    error: updates.length === 0 ? 'This adjustment would not change any eligible fields.' : '',
    warnings,
  };
}

// Deterministic core of the Mutation Lab handler. Builds the list of random
// tweaks mutations for the target units. Accepts an injectable RNG so tests
// can run deterministically.
export function buildRandomMutations(targets, defaultsDb, {
  intensity,
  domains,
  resolveCloneRootId,
}, rng = Math.random) {
  const [minRatio, maxRatio] = RANDOM_INTENSITY_RANGES[intensity];
  const mutations = [];
  const applyValue = (unitId, key, value) => {
    mutations.push({ unitId, key, value });
  };
  const mutateValue = (value, decimals = 0) => {
    const ratio = minRatio + rng() * (maxRatio - minRatio);
    return (value * ratio).toFixed(decimals);
  };

  targets.forEach(unit => {
    const baseId = unit.isClone ? resolveCloneRootId(unit.id) : unit.id;
    const defaults = defaultsDb[baseId];
    if (!defaults) return;

    if (domains.durability && Number.isFinite(Number(defaults.health))) {
      applyValue(unit.id, 'health', mutateValue(Number(defaults.health)));
    }
    if (domains.economy) {
      ['metalcost', 'energycost', 'buildtime'].forEach(key => {
        if (Number.isFinite(Number(defaults[key]))) applyValue(unit.id, key, mutateValue(Number(defaults[key])));
      });
    }
    if (domains.mobility && Number.isFinite(Number(defaults.maxvelocity)) && Number(defaults.maxvelocity) > 0) {
      applyValue(unit.id, 'maxvelocity', mutateValue(Number(defaults.maxvelocity), 1));
    }
    if (domains.weapons && defaults.weaponSlots) {
      defaults.weaponSlots.forEach(slot => {
        ['damage', 'range', 'reload'].forEach(key => {
          const value = Number(slot[key]);
          if (Number.isFinite(value) && value > 0) {
            applyValue(unit.id, `weapon_slot_${slot.slot}_${key}`, mutateValue(value, key === 'reload' ? 2 : 1));
          }
        });
      });
    }
  });
  return mutations;
}

export function useMutatorToolsController({
  defaultsDb,
  tweaks,
  bulkTargetUnits,
  filteredUnits,
  selectedUnit,
  resolveCloneRootId,
  transactProject,
  setTweaks,
  showToast,
}) {
  // Bulk Edit states
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [showFormulaMutator, setShowFormulaMutator] = useState(false);
  const [showRandomPanel, setShowRandomPanel] = useState(false);
  const [wipRandomPanelAcknowledged, setWipRandomPanelAcknowledged] = useState(false);
  const [randomScope, setRandomScope] = useState('selected');
  const [randomIntensity, setRandomIntensity] = useState('balanced');
  const [randomDomains, setRandomDomains] = useState({ economy: true, durability: true, mobility: true, weapons: true });
  const [bulkStatKey, setBulkStatKey] = useState('health');
  const [bulkPercent, setBulkPercent] = useState('10');
  const [bulkMode, setBulkMode] = useState('percent');
  const [bulkSelectedUnitIds, setBulkSelectedUnitIds] = useState([]);

  const bulkCandidateUnitIds = useMemo(
    () => new Set(bulkTargetUnits.map(unit => unit.id)),
    [bulkTargetUnits],
  );
  const bulkSelectedUnits = useMemo(() => {
    const selectedIds = new Set(bulkSelectedUnitIds);
    return bulkTargetUnits.filter(unit => selectedIds.has(unit.id));
  }, [bulkSelectedUnitIds, bulkTargetUnits]);
  const activeBulkSelectedUnitIds = useMemo(
    () => bulkSelectedUnits.map(unit => unit.id),
    [bulkSelectedUnits],
  );

  const openBulkPanel = useCallback(() => {
    setBulkSelectedUnitIds([]);
    setShowBulkPanel(true);
  }, []);

  const closeBulkPanel = useCallback(() => {
    setShowBulkPanel(false);
    setBulkSelectedUnitIds([]);
  }, []);

  const toggleBulkUnit = useCallback(unitId => {
    if (!bulkCandidateUnitIds.has(unitId)) return;
    setBulkSelectedUnitIds(current => (
      current.includes(unitId)
        ? current.filter(id => id !== unitId)
        : [...current, unitId]
    ));
  }, [bulkCandidateUnitIds]);

  const selectBulkUnits = useCallback(unitIds => {
    setBulkSelectedUnitIds(current => {
      const next = new Set(current);
      unitIds.forEach(unitId => {
        if (bulkCandidateUnitIds.has(unitId)) next.add(unitId);
      });
      return [...next];
    });
  }, [bulkCandidateUnitIds]);

  const deselectBulkUnits = useCallback(unitIds => {
    const removedIds = new Set(unitIds);
    setBulkSelectedUnitIds(current => current.filter(unitId => !removedIds.has(unitId)));
  }, []);

  const clearBulkSelection = useCallback(() => setBulkSelectedUnitIds([]), []);

  const bulkPreview = useMemo(() => computeBulkUpdates(bulkSelectedUnits, defaultsDb, tweaks, {
    statKey: bulkStatKey,
    changeValue: String(bulkPercent).trim() === '' ? Number.NaN : Number(bulkPercent),
    mode: bulkMode,
    resolveCloneRootId,
  }), [bulkMode, bulkPercent, bulkSelectedUnits, bulkStatKey, defaultsDb, resolveCloneRootId, tweaks]);

  // Apply Bulk edit
  const handleApplyBulk = useCallback(({ allowLargeScope = false } = {}) => {
    const changeVal = parseFloat(bulkPercent);
    if (Number.isNaN(changeVal)) {
      showToast('Error: Invalid bulk adjustment value');
      return;
    }

    const { updates, count, affectedFieldCount, blocked, error } = bulkPreview;
    if (blocked) {
      showToast(error || 'No eligible fields would change.');
      return;
    }
    if (bulkPreview.requiresLargeScopeConfirmation && !allowLargeScope) {
      showToast('Confirm the large export impact before applying this batch.');
      return;
    }

    transactProject(current => {
      const nextTweaks = { ...current.tweaks };
      updates.forEach(({ unitId, key, value }) => {
        nextTweaks[unitId] = {
          ...(nextTweaks[unitId] || {}),
          [key]: value,
        };
      });
      const touchesClone = bulkSelectedUnits.some(unit => unit.isClone);
      return {
        tweaks: nextTweaks,
        includeClones: touchesClone ? true : current.includeClones,
        includeTweaks: touchesClone ? true : current.includeTweaks,
      };
    });
    closeBulkPanel();
    showToast(`Applied ${affectedFieldCount.toLocaleString()} field edits across ${count.toLocaleString()} ${count === 1 ? 'unit' : 'units'}.`);
  }, [
    bulkPercent,
    bulkSelectedUnits,
    bulkPreview,
    closeBulkPanel,
    showToast,
    transactProject,
  ]);

  // Mutation Lab — controlled random adjustments with explicit scope and domains.
  const handleRandomAdjustments = useCallback(() => {
    const targets = randomScope === 'selected' ? (selectedUnit ? [selectedUnit] : []) : filteredUnits;
    const enabledDomains = Object.entries(randomDomains).filter(([, enabled]) => enabled).map(([domain]) => domain);

    if (targets.length === 0) {
      showToast(randomScope === 'selected' ? 'Select a unit before starting a mutation.' : 'No units match the current filters.');
      return;
    }
    if (enabledDomains.length === 0) {
      showToast('Choose at least one mutation domain.');
      return;
    }

    const mutations = buildRandomMutations(targets, defaultsDb, {
      intensity: randomIntensity,
      domains: randomDomains,
      resolveCloneRootId,
    });

    setTweaks(prev => {
      const next = { ...prev };
      mutations.forEach(({ unitId, key, value }) => {
        const unitPatch = { ...(next[unitId] || {}) };
        unitPatch[key] = value;
        next[unitId] = unitPatch;
      });
      return next;
    });

    setShowRandomPanel(false);
    showToast(`Mutation generated across ${targets.length} ${targets.length === 1 ? 'unit' : 'units'} in ${randomIntensity} mode.`);
  }, [
    defaultsDb,
    filteredUnits,
    randomDomains,
    randomIntensity,
    randomScope,
    resolveCloneRootId,
    selectedUnit,
    setTweaks,
    showToast,
  ]);

  const handleApplyFormula = useCallback((updates) => {
    if (!updates || updates.length === 0) return;
    setTweaks(prevTweaks => {
      const next = { ...prevTweaks };
      updates.forEach(({ unitId, property, value }) => {
        const existing = { ...(next[unitId] || {}) };
        existing[property] = value;
        next[unitId] = existing;
      });
      return next;
    });
    showToast(`Applied formula override to ${updates.length.toLocaleString()} ${updates.length === 1 ? 'unit' : 'units'}.`);
  }, [setTweaks, showToast]);

  return {
    showBulkPanel,
    openBulkPanel,
    closeBulkPanel,
    showFormulaMutator,
    setShowFormulaMutator,
    showRandomPanel,
    setShowRandomPanel,
    wipRandomPanelAcknowledged,
    setWipRandomPanelAcknowledged,
    randomScope,
    setRandomScope,
    randomIntensity,
    setRandomIntensity,
    randomDomains,
    setRandomDomains,
    bulkStatKey,
    setBulkStatKey,
    bulkPercent,
    setBulkPercent,
    bulkMode,
    setBulkMode,
    bulkSelectedUnitIds: activeBulkSelectedUnitIds,
    toggleBulkUnit,
    selectBulkUnits,
    deselectBulkUnits,
    clearBulkSelection,
    bulkPreview,
    handleApplyBulk,
    handleRandomAdjustments,
    handleApplyFormula,
  };
}
