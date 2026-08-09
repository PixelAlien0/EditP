import { useCallback, useState } from 'react';
import { STAT_KEYS } from '../config/editorParameters.js';

export const BULK_PARAMETER_GROUPS = [
  {
    label: 'Common unit stats',
    options: [
      { value: 'health', label: 'Unit Health (HP)', description: 'Adjust the maximum durability of every eligible unit.' },
      { value: 'metalcost', label: 'Metal Cost', description: 'Adjust the metal investment required to build each unit.' },
      { value: 'energycost', label: 'Energy Cost', description: 'Adjust the energy investment required to build each unit.' },
      { value: 'buildtime', label: 'Build Time', description: 'Adjust the build work required to complete each unit.' },
      { value: 'maxvelocity', label: 'Max Velocity (Speed)', description: 'Adjust the maximum movement speed of eligible units.' },
    ],
  },
  {
    label: 'Weapon slots',
    options: [
      { value: 'all_weapons_damage', label: 'All Weapons Damage', description: 'Adjust every weapon slot’s base damage for each eligible unit.' },
      { value: 'all_weapons_range', label: 'All Weapons Range', description: 'Adjust every weapon slot’s maximum range for each eligible unit.' },
    ],
  },
  {
    label: 'Additional numeric stats',
    options: STAT_KEYS
      .filter(stat => stat.type === 'number' && !['health', 'metalcost', 'energycost', 'buildtime', 'maxvelocity'].includes(stat.key))
      .map(stat => ({
        value: stat.key,
        label: stat.label,
        description: `Adjust ${stat.label.toLowerCase()} across every eligible unit.`,
      })),
  },
];

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
  let count = 0;
  const updates = [];
  units.forEach(unit => {
    const baseId = unit.isClone ? resolveCloneRootId(unit.id) : unit.id;
    const defaults = defaultsDb[baseId];

    if (statKey === 'all_weapons_damage' || statKey === 'all_weapons_range') {
      const slots = defaults.weaponSlots || [];
      slots.forEach(slot => {
        const subKey = statKey === 'all_weapons_damage' ? 'damage' : 'range';
        const tweakKey = `weapon_slot_${slot.slot}_${subKey}`;
        const currentTweak = tweaks[unit.id]?.[tweakKey];
        const defaultVal = slot[subKey] || 0;
        const baseVal = currentTweak !== undefined ? parseFloat(currentTweak) : defaultVal;

        let newVal = baseVal;
        if (mode === 'percent') {
          newVal = baseVal * (1 + changeValue / 100);
        } else {
          newVal = baseVal + changeValue;
        }
        if (newVal < 0) newVal = 0;
        updates.push({ unitId: unit.id, key: tweakKey, value: newVal.toFixed(2) });
      });
      count++;
    } else {
      const defaultVal = parseFloat(defaults[statKey] || 0);
      const currentTweak = tweaks[unit.id]?.[statKey];
      const baseVal = currentTweak !== undefined ? parseFloat(currentTweak) : defaultVal;

      let newVal = baseVal;
      if (mode === 'percent') {
        newVal = baseVal * (1 + changeValue / 100);
      } else {
        newVal = baseVal + changeValue;
      }

      if (newVal < 0 && (statKey.includes('cost') || statKey.includes('health') || statKey.includes('velocity'))) {
        newVal = 0;
      }
      updates.push({ unitId: unit.id, key: statKey, value: newVal.toFixed(2) });
      count++;
    }
  });
  return { updates, count };
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

  // Apply Bulk edit
  const handleApplyBulk = useCallback(() => {
    const changeVal = parseFloat(bulkPercent);
    if (Number.isNaN(changeVal)) {
      showToast('Error: Invalid bulk adjustment value');
      return;
    }

    const { updates, count } = computeBulkUpdates(bulkTargetUnits, defaultsDb, tweaks, {
      statKey: bulkStatKey,
      changeValue: changeVal,
      mode: bulkMode,
      resolveCloneRootId,
    });

    transactProject(current => {
      const nextTweaks = { ...current.tweaks };
      updates.forEach(({ unitId, key, value }) => {
        nextTweaks[unitId] = {
          ...(nextTweaks[unitId] || {}),
          [key]: value,
        };
      });
      const touchesClone = bulkTargetUnits.some(unit => unit.isClone);
      return {
        tweaks: nextTweaks,
        includeClones: touchesClone ? true : current.includeClones,
        includeTweaks: touchesClone ? true : current.includeTweaks,
      };
    });
    setShowBulkPanel(false);
    showToast(`Adjusted ${bulkStatKey} for ${count} units by ${bulkMode === 'percent' ? (changeVal > 0 ? '+' : '') + changeVal + '%' : (changeVal > 0 ? '+' : '') + changeVal}`);
  }, [
    bulkMode,
    bulkPercent,
    bulkStatKey,
    bulkTargetUnits,
    defaultsDb,
    resolveCloneRootId,
    showToast,
    transactProject,
    tweaks,
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
    setShowBulkPanel,
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
    handleApplyBulk,
    handleRandomAdjustments,
    handleApplyFormula,
  };
}
