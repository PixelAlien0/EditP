import { useCallback, useId, useMemo, useState } from 'react';
import '../styles/features/carrier-drone-workbench.css';
import { getFactionOfUnit } from '../utils/categories.js';
import {
  buildCarrierLinkageTweaks,
  getCarrierLinkageConfig,
} from '../utils/carrierDroneLinkage.js';
import UnitArtwork from './UnitArtwork.jsx';
import { Button, Dialog, IconButton } from './ui.jsx';

function getFormattedUnitName(u) {
  if (!u) return '';
  if (u.name && u.name !== u.id) return u.name;
  const id = String(u.id || '').toLowerCase();
  if (id === 'armantiodrone') return 'Armada Anti-Air Drone';
  if (id === 'corantiodrone') return 'Cortex Heavy Drone';
  if (id === 'armcarrier') return 'Armada Aircraft Carrier';
  if (id === 'corcarrier') return 'Cortex Aircraft Carrier';
  if (id === 'legvcarry') return 'Legion Kaiser Dreadnought';
  if (id === 'armodrone') return 'Armada Orbital Fighter Drone';
  if (id === 'corodrone') return 'Cortex Orbital Bomber Drone';
  return u.name || u.id;
}

function splitParallelValues(value, delimiter = 'space') {
  const text = String(value ?? '').trim();
  if (!text) return [];
  return delimiter === 'comma'
    ? text.split(',').map(item => item.trim()).filter(Boolean)
    : text.split(/\s+/).filter(Boolean);
}

function getParallelValue(value, index, fallback = '—', delimiter = 'space') {
  const values = splitParallelValues(value, delimiter);
  return values[index] ?? values[values.length - 1] ?? fallback;
}

function removeParallelValue(value, index, count, fallback = '', delimiter = 'space') {
  const values = splitParallelValues(value, delimiter);
  if (values.length === 0 && fallback === '') return '';
  const aligned = Array.from({ length: count }, (_, itemIndex) => (
    values[itemIndex] ?? values[values.length - 1] ?? fallback
  ));
  aligned.splice(index, 1);
  return aligned.join(delimiter === 'comma' ? ',' : ' ');
}

export default function CarrierDroneWorkbenchDialog({
  open,
  onClose,
  units = [],
  clones = [],
  selectedUnit = null,
  initialWeaponSlot = null,
  defaultsDb = {},
  tweaks = {},
  onApplyLinkage,
  onCreateClone,
}) {
  const titleId = useId();
  const descriptionId = useId();

  // Validate and combine all existing real units + project clones
  const allAvailableUnits = useMemo(() => {
    const cloneList = clones.map(c => {
      const baseId = (c.baseId || c.newId).toLowerCase();
      const faction = getFactionOfUnit(c.faction && c.faction !== 'all' ? c.faction : baseId);
      return {
        id: c.newId.toLowerCase(),
        name: c.displayName || c.newId,
        faction: faction || 'all',
        isClone: true,
        artworkUnitId: baseId,
      };
    });
    const existingIds = new Set(cloneList.map(c => c.id));
    const baseList = units.filter(u => Boolean(u?.id) && !existingIds.has(u.id.toLowerCase())).map(u => ({
      ...u,
      faction: getFactionOfUnit(u.id),
      artworkUnitId: u.id,
    }));
    return [...cloneList, ...baseList];
  }, [units, clones]);

  const resolveUnitDefaults = useCallback((unitId) => {
    const normalizedId = String(unitId || '').toLowerCase();
    const clone = clones.find(item => item.newId?.toLowerCase() === normalizedId);
    return defaultsDb[clone?.baseId?.toLowerCase() || normalizedId] || {};
  }, [clones, defaultsDb]);

  // Smart Carrier Unit Selection (defaults to real aircraft carrier if selected unit is not a carrier)
  const defaultParent = useMemo(() => {
    if (selectedUnit) {
      const sId = selectedUnit.id.toLowerCase();
      const sName = (selectedUnit.name || '').toLowerCase();
      const selectedDefaults = resolveUnitDefaults(sId);
      const hasCarrierWeapon = selectedDefaults.weaponSlots?.some(slot => Boolean(slot.carried_unit));
      const hasConfiguredCarrierWeapon = Object.entries(tweaks[sId] || {}).some(([key, value]) => (
        /^weapon_slot_\d+_carried_unit$/.test(key) && String(value || '').trim()
      ));
      const isCarrier = sId.includes('carrier') || sId.includes('carry') || sName.includes('carrier')
        || Boolean(tweaks[sId]?.['customparams.carried_unit']) || hasCarrierWeapon || hasConfiguredCarrierWeapon;
      if (isCarrier && allAvailableUnits.some(u => u.id === sId)) {
        return sId;
      }
    }
    const carrierMatch = allAvailableUnits.find(u => (
      u.id.includes('carrier')
      || u.id.includes('carry')
      || u.name.toLowerCase().includes('carrier')
      || resolveUnitDefaults(u.id).weaponSlots?.some(slot => Boolean(slot.carried_unit))
      || Object.entries(tweaks[u.id] || {}).some(([key, value]) => (
        /^weapon_slot_\d+_carried_unit$/.test(key) && String(value || '').trim()
      ))
    ));
    return carrierMatch ? carrierMatch.id : (allAvailableUnits.find(u => u.id === 'armcarrier')?.id || allAvailableUnits[0]?.id || 'armcarrier');
  }, [selectedUnit, allAvailableUnits, resolveUnitDefaults, tweaks]);

  const resolveCarrierConfig = useCallback((unitId, requestedSlot = null) => {
    const inheritedDefaults = resolveUnitDefaults(unitId);
    const effectiveDefaults = inheritedDefaults
      ? { ...defaultsDb, [unitId]: inheritedDefaults }
      : defaultsDb;
    return getCarrierLinkageConfig(unitId, tweaks, effectiveDefaults, requestedSlot);
  }, [defaultsDb, resolveUnitDefaults, tweaks]);

  const initialConfig = useMemo(
    () => resolveCarrierConfig(defaultParent, initialWeaponSlot),
    [defaultParent, initialWeaponSlot, resolveCarrierConfig]
  );

  const [parentUnitId, setParentUnitId] = useState(defaultParent);
  const [carriedUnit, setCarriedUnit] = useState(initialConfig.carriedUnit || 'armantiodrone');
  const [carriedUnitsText, setCarriedUnitsText] = useState(
    initialConfig.carriedUnitsText || initialConfig.carriedUnit || 'armantiodrone'
  );
  const [targetWeaponSlot, setTargetWeaponSlot] = useState(initialConfig.targetWeaponSlot || 1);
  const [targetWeaponDef, setTargetWeaponDef] = useState(initialConfig.targetWeaponDef || '');
  const [spawnSurface, setSpawnSurface] = useState(initialConfig.spawnSurface || '');
  const [carrierDeathBehavior, setCarrierDeathBehavior] = useState(initialConfig.carrierDeathBehavior || 'death');
  const [manualControl, setManualControl] = useState(initialConfig.manualControl ?? true);
  const [dockingEnabled, setDockingEnabled] = useState(initialConfig.dockingEnabled ?? false);
  const [maxUnits, setMaxUnits] = useState(initialConfig.maxUnitsText || String(initialConfig.maxUnits || 6));
  const [startingDroneCount, setStartingDroneCount] = useState(initialConfig.startingDroneCountText || '0');
  const [spawnMetal, setSpawnMetal] = useState(initialConfig.spawnMetalText || String(initialConfig.spawnMetal ?? 0));
  const [spawnEnergy, setSpawnEnergy] = useState(initialConfig.spawnEnergyText || String(initialConfig.spawnEnergy ?? 0));
  const [droneTypesText, setDroneTypesText] = useState(initialConfig.droneTypesText || 'default');
  const [dockingPiecesText, setDockingPiecesText] = useState(initialConfig.dockingPiecesText || '1');
  const [droneAirTimeText, setDroneAirTimeText] = useState(initialConfig.droneAirTimeText || '');
  const [droneDockTimeText, setDroneDockTimeText] = useState(initialConfig.droneDockTimeText || '');
  const [droneAmmoText, setDroneAmmoText] = useState(initialConfig.droneAmmoText || '0');
  const [minimumIdleRadius, setMinimumIdleRadius] = useState(initialConfig.minimumIdleRadius ?? 160);
  const [controlRadius, setControlRadius] = useState(initialConfig.controlRadius ?? '');
  const [engagementRange, setEngagementRange] = useState(initialConfig.engagementRange ?? '');
  const [spawnInterval, setSpawnInterval] = useState(initialConfig.spawnInterval || 5);
  const [returnHp, setReturnHp] = useState(initialConfig.returnHp || 25);
  const parentConfig = useMemo(
    () => resolveCarrierConfig(parentUnitId, targetWeaponSlot),
    [parentUnitId, resolveCarrierConfig, targetWeaponSlot]
  );

  // Unit Selector Modal State (Parent or Child)
  const [pickerTarget, setPickerTarget] = useState(null); // 'parent' | 'child' | null
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerFaction, setPickerFaction] = useState('all');

  const parentUnitInfo = useMemo(() => {
    const raw = allAvailableUnits.find(u => u.id.toLowerCase() === parentUnitId.toLowerCase()) || { id: parentUnitId, name: parentUnitId };
    return { ...raw, displayName: getFormattedUnitName(raw) };
  }, [allAvailableUnits, parentUnitId]);

  const childUnitInfo = useMemo(() => {
    const raw = allAvailableUnits.find(u => u.id.toLowerCase() === carriedUnit.toLowerCase()) || { id: carriedUnit, name: carriedUnit };
    return { ...raw, displayName: getFormattedUnitName(raw) };
  }, [allAvailableUnits, carriedUnit]);

  const carriedUnitIds = useMemo(
    () => carriedUnitsText.trim().split(/[\s,]+/).filter(Boolean),
    [carriedUnitsText]
  );
  const multiTypeDirectControl = carriedUnitIds.length > 1 && manualControl;
  const linkageModeLabel = manualControl ? 'Player controlled' : 'Carrier directed';
  const dockingModeLabel = dockingEnabled && !multiTypeDirectControl ? 'Docking enabled' : 'Free deployment';

  const rosterRows = useMemo(() => carriedUnitIds.map((unitId, index) => {
    const unit = allAvailableUnits.find(item => item.id.toLowerCase() === unitId.toLowerCase());
    return {
      id: unitId,
      index,
      name: getFormattedUnitName(unit || { id: unitId, name: unitId }),
      artworkUnitId: unit?.artworkUnitId || unitId,
      faction: unit?.faction || getFactionOfUnit(unitId) || 'all',
      droneType: getParallelValue(droneTypesText, index, 'default'),
      capacity: getParallelValue(maxUnits, index, '1'),
      starting: getParallelValue(startingDroneCount, index, '0'),
      metal: getParallelValue(spawnMetal, index, '0'),
      energy: getParallelValue(spawnEnergy, index, '0'),
      docking: getParallelValue(dockingPiecesText, index, '1', 'comma'),
    };
  }), [
    allAvailableUnits,
    carriedUnitIds,
    dockingPiecesText,
    droneTypesText,
    maxUnits,
    spawnEnergy,
    spawnMetal,
    startingDroneCount,
  ]);

  // Filtered unit list for the selection modal
  const filteredPickerUnits = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return allAvailableUnits.filter(u => {
      if (pickerFaction !== 'all' && u.faction !== pickerFaction) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
    });
  }, [allAvailableUnits, pickerQuery, pickerFaction]);

  const handleParentSelect = newParentId => {
    setParentUnitId(newParentId);
    const cfg = resolveCarrierConfig(newParentId);
    setCarriedUnit(cfg.carriedUnit || '');
    setCarriedUnitsText(cfg.carriedUnitsText || cfg.carriedUnit || '');
    setTargetWeaponSlot(cfg.targetWeaponSlot || 1);
    setTargetWeaponDef(cfg.targetWeaponDef || '');
    setSpawnSurface(cfg.spawnSurface || '');
    setMaxUnits(cfg.maxUnitsText || String(cfg.maxUnits || 1));
    setStartingDroneCount(cfg.startingDroneCountText || '0');
    setSpawnMetal(cfg.spawnMetalText || String(cfg.spawnMetal ?? 0));
    setSpawnEnergy(cfg.spawnEnergyText || String(cfg.spawnEnergy ?? 0));
    setDroneTypesText(cfg.droneTypesText || 'default');
    setDockingPiecesText(cfg.dockingPiecesText || '1');
    setDroneAirTimeText(cfg.droneAirTimeText || '');
    setDroneDockTimeText(cfg.droneDockTimeText || '');
    setDroneAmmoText(cfg.droneAmmoText || '0');
    setMinimumIdleRadius(cfg.minimumIdleRadius ?? 160);
    setControlRadius(cfg.controlRadius ?? '');
    setEngagementRange(cfg.engagementRange ?? '');
    setSpawnInterval(cfg.spawnInterval || 1);
    setReturnHp(cfg.returnHp ?? 0);
    setCarrierDeathBehavior(cfg.carrierDeathBehavior || 'death');
    setManualControl(cfg.manualControl ?? true);
    setDockingEnabled(cfg.dockingEnabled ?? false);
  };

  const handleWeaponSlotSelect = slotValue => {
    const slotNumber = Number(slotValue);
    const cfg = resolveCarrierConfig(parentUnitId, slotNumber);
    setTargetWeaponSlot(slotNumber);
    setTargetWeaponDef(cfg.targetWeaponDef || '');
    setCarriedUnit(cfg.carriedUnit || '');
    setCarriedUnitsText(cfg.carriedUnitsText || cfg.carriedUnit || '');
    setSpawnSurface(cfg.spawnSurface || '');
    setMaxUnits(cfg.maxUnitsText || String(cfg.maxUnits || 1));
    setStartingDroneCount(cfg.startingDroneCountText || '0');
    setSpawnMetal(cfg.spawnMetalText || String(cfg.spawnMetal ?? 0));
    setSpawnEnergy(cfg.spawnEnergyText || String(cfg.spawnEnergy ?? 0));
    setDroneTypesText(cfg.droneTypesText || 'default');
    setDockingPiecesText(cfg.dockingPiecesText || '1');
    setDroneAirTimeText(cfg.droneAirTimeText || '');
    setDroneDockTimeText(cfg.droneDockTimeText || '');
    setDroneAmmoText(cfg.droneAmmoText || '0');
    setMinimumIdleRadius(cfg.minimumIdleRadius ?? 160);
    setControlRadius(cfg.controlRadius ?? '');
    setEngagementRange(cfg.engagementRange ?? '');
    setSpawnInterval(cfg.spawnInterval || 1);
    setReturnHp(cfg.returnHp ?? 0);
    setCarrierDeathBehavior(cfg.carrierDeathBehavior || 'death');
    setManualControl(cfg.manualControl ?? true);
    setDockingEnabled(cfg.dockingEnabled ?? false);
  };

  const handleSave = event => {
    event.preventDefault();
    if (!parentUnitId || carriedUnitIds.length === 0) return;

    const compiledTweaks = buildCarrierLinkageTweaks({
      parentUnitId,
      carriedUnit: carriedUnitIds[0],
      carriedUnitsText,
      targetWeaponSlot,
      targetWeaponDef,
      spawnSurface,
      carrierDeathBehavior,
      manualControl,
      // BAR's multi-type carrier support is partial. Directly controlled
      // rosters cannot reliably undock one attached reserve per unit type.
      dockingEnabled: dockingEnabled && !multiTypeDirectControl,
      minimumIdleRadius,
      controlRadius,
      engagementRange,
      maxUnitsText: maxUnits,
      startingDroneCountText: startingDroneCount,
      spawnMetalText: spawnMetal,
      spawnEnergyText: spawnEnergy,
      droneTypesText,
      dockingPiecesText,
      droneAirTimeText,
      droneDockTimeText,
      droneAmmoText,
      spawnInterval,
      returnHp,
    });

    onApplyLinkage(parentUnitId, compiledTweaks);
    onClose();
  };

  const handleQuickCreateDroneClone = () => {
    if (!carriedUnit) return;
    const baseId = carriedUnit.toLowerCase();
    const newId = `${baseId}_custom`;
    onCreateClone({
      baseId,
      newId,
      name: `${childUnitInfo.name} Custom`,
    });
    setCarriedUnit(newId);
    setCarriedUnitsText(current => {
      const unitIds = current.trim().split(/[\s,]+/).filter(Boolean);
      return [newId, ...unitIds.slice(1)].join(' ');
    });
  };

  const openUnitPicker = target => {
    setPickerTarget(target);
    setPickerQuery('');
    setPickerFaction('all');
  };

  const handlePayloadSelect = unitId => {
    const next = [...carriedUnitIds];
    const targetToken = String(pickerTarget || '');
    if (targetToken === 'child:add') {
      if (!next.includes(unitId)) next.push(unitId);
    } else {
      const targetIndex = Math.max(0, Number(targetToken.split(':')[1]) || 0);
      const existingIndex = next.indexOf(unitId);
      if (existingIndex >= 0 && existingIndex !== targetIndex) {
        [next[targetIndex], next[existingIndex]] = [next[existingIndex], next[targetIndex]];
      } else {
        next[targetIndex] = unitId;
      }
    }
    const normalized = next.filter(Boolean);
    if (normalized.length > 1 && manualControl) setDockingEnabled(false);
    setCarriedUnitsText(normalized.join(' '));
    setCarriedUnit(normalized[0] || '');
  };

  const handleRemovePayload = index => {
    const count = carriedUnitIds.length;
    const next = carriedUnitIds.filter((_, itemIndex) => itemIndex !== index);
    setCarriedUnitsText(next.join(' '));
    setCarriedUnit(next[0] || '');
    setDroneTypesText(value => removeParallelValue(value, index, count, 'default'));
    setMaxUnits(value => removeParallelValue(value, index, count, '1'));
    setStartingDroneCount(value => removeParallelValue(value, index, count, '0'));
    setSpawnMetal(value => removeParallelValue(value, index, count, '0'));
    setSpawnEnergy(value => removeParallelValue(value, index, count, '0'));
    setDockingPiecesText(value => removeParallelValue(value, index, count, '1', 'comma'));
    setDroneAirTimeText(value => removeParallelValue(value, index, count));
    setDroneDockTimeText(value => removeParallelValue(value, index, count));
    setDroneAmmoText(value => removeParallelValue(value, index, count));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="carrier-workbench"
      overlayClassName="carrier-workbench-overlay"
      labelledBy={titleId}
      describedBy={descriptionId}
    >
      <form onSubmit={handleSave}>
        <header className="carrier-workbench__header">
          <div className="carrier-workbench__heading">
            <span className="carrier-workbench__eyebrow">Carrier systems · linkage editor</span>
            <h2 id={titleId}>Carrier &amp; Deployed Drone Linkage Workbench</h2>
            <p id={descriptionId}>Build an ordered payload roster, then define how its controller deploys and recalls each unit type.</p>
          </div>
          <IconButton label="Close carrier workbench" variant="quiet" size="sm" onClick={onClose}>×</IconButton>
        </header>

        <div className="carrier-workbench__body">
          <dl className="carrier-workbench__status-rail" aria-label="Current carrier linkage summary">
            <div>
              <dt>Carrier</dt>
              <dd>{parentUnitInfo.displayName}</dd>
              <code>{parentUnitInfo.id}</code>
            </div>
            <div>
              <dt>Controller</dt>
              <dd>Weapon slot {targetWeaponSlot}</dd>
              <code>{targetWeaponDef || parentConfig.activeWeaponDef || 'Inherited WeaponDef'}</code>
            </div>
            <div>
              <dt>Payload roster</dt>
              <dd>{carriedUnitIds.length} {carriedUnitIds.length === 1 ? 'unit type' : 'unit types'}</dd>
              <code>{carriedUnitIds.length ? 'Ordered parallel values' : 'Roster required'}</code>
            </div>
            <div>
              <dt>Runtime policy</dt>
              <dd>{linkageModeLabel}</dd>
              <code>{dockingModeLabel}</code>
            </div>
          </dl>

          {/* Visual Flight-Deck Diagram with Rich Interactive Picker Cards */}
          <section className="carrier-workbench__deck-diagram">
            <button
              type="button"
              className="carrier-workbench__picker-card"
              onClick={() => openUnitPicker('parent')}
              aria-label="Change parent carrier chassis"
            >
              <UnitArtwork unitId={parentUnitInfo.artworkUnitId || parentUnitInfo.id} className="carrier-workbench__card-art" alt="" />
              <div className="carrier-workbench__card-info">
                <span className="carrier-workbench__card-role">Parent Carrier Chassis</span>
                <span className="carrier-workbench__card-title">{parentUnitInfo.displayName}</span>
                <code className="carrier-workbench__card-code">{parentUnitInfo.id}</code>
              </div>
              <span className="carrier-workbench__card-change">Change</span>
            </button>

            <div className="carrier-workbench__link-bus" aria-hidden="true">
              <span className="carrier-workbench__link-arrow">→</span>
              <span className="carrier-workbench__link-badge">
                {carriedUnitIds.length} {carriedUnitIds.length === 1 ? 'Type' : 'Types'}
              </span>
            </div>

            <button
              type="button"
              className="carrier-workbench__picker-card"
              onClick={() => openUnitPicker('child:0')}
              aria-label="Change primary deployed unit"
            >
              <UnitArtwork unitId={childUnitInfo.artworkUnitId || childUnitInfo.id} className="carrier-workbench__card-art" alt="" />
              <div className="carrier-workbench__card-info">
                <span className="carrier-workbench__card-role">Primary Deployed Unit</span>
                <span className="carrier-workbench__card-title">{childUnitInfo.displayName}</span>
                <code className="carrier-workbench__card-code">{childUnitInfo.id}</code>
              </div>
              <span className="carrier-workbench__card-change">Change</span>
            </button>
          </section>

          <section className="carrier-workbench__section carrier-workbench__roster">
            <div className="carrier-workbench__section-heading">
              <div>
                <span className="carrier-workbench__section-index">01 · Payload roster</span>
                <h3>Deployed unit types</h3>
                <p>Order controls how each parallel value maps to BAR's carrier lists.</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => openUnitPicker('child:add')}>
                + Add unit type
              </Button>
            </div>

            <div className="carrier-workbench__roster-grid">
              {rosterRows.map(row => (
                <article className="carrier-workbench__roster-card" key={`${row.id}-${row.index}`}>
                  <div className="carrier-workbench__roster-identity">
                    <span className="carrier-workbench__roster-order">{String(row.index + 1).padStart(2, '0')}</span>
                    <UnitArtwork unitId={row.artworkUnitId} className="carrier-workbench__roster-art" alt="" />
                    <div>
                      <strong>{row.name}</strong>
                      <code>{row.id}</code>
                    </div>
                    <span className="carrier-workbench__roster-type">{row.droneType}</span>
                  </div>
                  <dl className="carrier-workbench__roster-metrics">
                    <div><dt>Capacity</dt><dd>{row.capacity}</dd></div>
                    <div><dt>Initial</dt><dd>{row.starting}</dd></div>
                    <div><dt>Cost</dt><dd>{row.metal} M · {row.energy} E</dd></div>
                    <div><dt>Dock pieces</dt><dd>{row.docking}</dd></div>
                  </dl>
                  <div className="carrier-workbench__roster-actions">
                    <Button size="sm" variant="quiet" onClick={() => openUnitPicker(`child:${row.index}`)}>Change</Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemovePayload(row.index)}
                      aria-label={`Remove ${row.name} from payload roster`}
                    >
                      Remove
                    </Button>
                  </div>
                </article>
              ))}
              {rosterRows.length === 0 && (
                <button type="button" className="carrier-workbench__roster-empty" onClick={() => openUnitPicker('child:add')}>
                  <strong>Add the first deployed unit type</strong>
                  <span>The workbench needs at least one payload before it can compile a linkage.</span>
                </button>
              )}
            </div>

            <div className="form-group carrier-workbench__roster-source">
              <label htmlFor="input-carried-units">
                Raw roster IDs <span>{carriedUnitIds.length} types</span>
              </label>
              <input
                id="input-carried-units"
                type="text"
                className="form-input"
                value={carriedUnitsText}
                onChange={event => {
                  const nextValue = event.target.value;
                  setCarriedUnitsText(nextValue);
                  setCarriedUnit(nextValue.trim().split(/[\s,]+/).filter(Boolean)[0] || '');
                }}
                placeholder="armdrone corvamp legdrone"
                spellCheck="false"
                required
              />
              <small>Advanced input: use space-separated unit IDs. The visual roster above follows this order.</small>
            </div>
          </section>

          <section className="carrier-workbench__section carrier-workbench__configuration">
            <div className="carrier-workbench__section-heading">
              <div>
                <span className="carrier-workbench__section-index">02 · Linkage behavior</span>
                <h3>Carrier command contract</h3>
                <p>Shared behavior applies to every unit type in this roster.</p>
              </div>
            </div>

            <div className="carrier-workbench__typebox-grid">
              <div className="form-group carrier-workbench__field--wide carrier-workbench__policy-field">
                <label>Spawn Surface Restriction</label>
                <div className="carrier-workbench__segmented" role="group" aria-label="Spawn surface restriction">
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${spawnSurface === '' ? 'is-active' : ''}`}
                    onClick={() => setSpawnSurface('')}
                    aria-pressed={spawnSurface === ''}
                  >
                    Any surface
                  </button>
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${spawnSurface === 'LAND' ? 'is-active' : ''}`}
                    onClick={() => setSpawnSurface('LAND')}
                    aria-pressed={spawnSurface === 'LAND'}
                  >
                    Land only
                  </button>
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${spawnSurface === 'SEA' ? 'is-active' : ''}`}
                    onClick={() => setSpawnSurface('SEA')}
                    aria-pressed={spawnSurface === 'SEA'}
                  >
                    Sea only
                  </button>
                </div>
              </div>

              <div className="form-group carrier-workbench__field--wide carrier-workbench__policy-field">
                <label>Drone Command Mode</label>
                <div className="carrier-workbench__segmented" role="group" aria-label="Drone command mode">
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${manualControl ? 'is-active' : ''}`}
                    onClick={() => {
                      setManualControl(true);
                      if (carriedUnitIds.length > 1) setDockingEnabled(false);
                    }}
                    aria-pressed={manualControl}
                  >
                    Direct player control
                  </button>
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${!manualControl ? 'is-active' : ''}`}
                    onClick={() => setManualControl(false)}
                    aria-pressed={!manualControl}
                  >
                    Carrier-directed only
                  </button>
                </div>
                <small>Direct control uses BAR's <code>manualdrones</code> mode. The carrier can still issue formation and recall orders.</small>
              </div>

              <div className="form-group carrier-workbench__field--wide carrier-workbench__policy-field">
                <label htmlFor="input-carrier-death-behavior">When the Carrier Is Destroyed</label>
                <select
                  id="input-carrier-death-behavior"
                  className="form-input"
                  value={carrierDeathBehavior}
                  onChange={event => setCarrierDeathBehavior(event.target.value)}
                >
                  <option value="death">Destroy deployed units</option>
                  <option value="control">Keep survivors under player control</option>
                  <option value="capture">Transfer survivors to the attacker</option>
                  <option value="release">Release survivors from the carrier</option>
                  <option value="parasite">Keep carrier relationship behavior</option>
                </select>
                <small>Surviving modes receive a safe lifetime value to avoid BAR's nil <code>droneAirTime</code> destruction error.</small>
              </div>

              <div className="form-group carrier-workbench__field--wide carrier-workbench__policy-field">
                <label>Docking Behavior</label>
                <div className="carrier-workbench__segmented" role="group" aria-label="Docking behavior">
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${!dockingEnabled ? 'is-active' : ''}`}
                    onClick={() => setDockingEnabled(false)}
                    aria-pressed={!dockingEnabled}
                  >
                    Free deployment
                  </button>
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${dockingEnabled ? 'is-active' : ''}`}
                    onClick={() => setDockingEnabled(true)}
                    aria-pressed={dockingEnabled}
                    disabled={multiTypeDirectControl}
                    title={multiTypeDirectControl
                      ? 'BAR multi-type direct control leaves one attached reserve per type. Use free deployment.'
                      : undefined}
                  >
                    Dock and auto-return
                  </button>
                </div>
                <small>
                  {multiTypeDirectControl
                    ? 'Directly controlled multi-type rosters use free deployment so one unit of every type is not left attached to the carrier.'
                    : 'Free deployment is safer for arbitrary unit models that do not have compatible docking pieces.'}
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="input-carrier-weapon">Carrier Controller WeaponDef</label>
                <select
                  id="input-carrier-weapon"
                  className="form-input"
                  value={String(targetWeaponSlot || '')}
                  onChange={event => handleWeaponSlotSelect(event.target.value)}
                  required
                >
                  {parentConfig.weaponOptions.length === 0 && (
                    <option value="">No weapon slot available</option>
                  )}
                  {parentConfig.weaponOptions.map(option => (
                    <option key={`${option.slot}-${option.defKey}`} value={String(option.slot)}>
                      {option.label}{option.isCarrierController ? ' · current carrier controller' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="input-drone-types">Drone Types</label>
                <input
                  id="input-drone-types"
                  type="text"
                  className="form-input"
                  value={droneTypesText}
                  onChange={event => setDroneTypesText(event.target.value)}
                  placeholder="fighter bomber default"
                  spellCheck="false"
                />
              </div>

              <div className="form-group">
                <label htmlFor="input-payload-capacity">Maximum Active Units per Type</label>
                <input
                  id="input-payload-capacity"
                  type="text"
                  className="form-input"
                  value={maxUnits}
                  onChange={event => setMaxUnits(event.target.value)}
                  placeholder="6 3"
                  inputMode="numeric"
                />
              </div>

              <div className="form-group">
                <label htmlFor="input-starting-drone-count">Initial Units per Type</label>
                <input
                  id="input-starting-drone-count"
                  type="text"
                  className="form-input"
                  value={startingDroneCount}
                  onChange={event => setStartingDroneCount(event.target.value)}
                  placeholder="2 1"
                  inputMode="numeric"
                />
              </div>

              <div className="form-group">
                <label htmlFor="input-spawn-interval">Deployment Delay (seconds)</label>
                <input
                  id="input-spawn-interval"
                  type="number"
                  className="form-input"
                  min="1"
                  max="120"
                  value={spawnInterval}
                  onChange={e => setSpawnInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="input-return-hp">Auto-Return HP Threshold (%)</label>
                <input
                  id="input-return-hp"
                  type="number"
                  className="form-input"
                  min="0"
                  max="100"
                  value={returnHp}
                  onChange={e => setReturnHp(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="input-minimum-idle-radius">Free-Deployment Idle Radius</label>
                <input
                  id="input-minimum-idle-radius"
                  type="number"
                  className="form-input"
                  min="0"
                  max="2000"
                  value={minimumIdleRadius}
                  onChange={event => setMinimumIdleRadius(
                    Math.max(0, Math.min(2000, Number(event.target.value) || 0))
                  )}
                />
                <small>Keeps carrier-directed units from stacking at the carrier while idle. Recommended: 160.</small>
              </div>

              <div className="form-group">
                <label htmlFor="input-control-radius">Carrier Control Radius</label>
                <input
                  id="input-control-radius"
                  type="number"
                  className="form-input"
                  min="0"
                  value={controlRadius}
                  onChange={event => setControlRadius(event.target.value)}
                  placeholder="Unlimited when inherited"
                />
                <small>Single shared recall radius. BAR does not support one value per deployed type.</small>
              </div>

              <div className="form-group">
                <label htmlFor="input-engagement-range">Carrier Engagement Range</label>
                <input
                  id="input-engagement-range"
                  type="number"
                  className="form-input"
                  min="0"
                  value={engagementRange}
                  onChange={event => setEngagementRange(event.target.value)}
                  placeholder="Unlimited when inherited"
                />
                <small>Single shared range in which deployed units adopt the carrier's combat target.</small>
              </div>

              <div className="form-group">
                <label htmlFor="input-spawn-metal">Metal Cost per Type</label>
                <input
                  id="input-spawn-metal"
                  type="text"
                  className="form-input"
                  value={spawnMetal}
                  onChange={event => setSpawnMetal(event.target.value)}
                  placeholder="25 90"
                  inputMode="numeric"
                />
              </div>

              <div className="form-group">
                <label htmlFor="input-spawn-energy">Energy Cost per Type</label>
                <input
                  id="input-spawn-energy"
                  type="text"
                  className="form-input"
                  value={spawnEnergy}
                  onChange={event => setSpawnEnergy(event.target.value)}
                  placeholder="600 1200"
                  inputMode="numeric"
                />
              </div>

              <div className="form-group carrier-workbench__roster-field">
                <label htmlFor="input-docking-pieces">Docking Piece Groups</label>
                <input
                  id="input-docking-pieces"
                  type="text"
                  className="form-input"
                  value={dockingPiecesText}
                  onChange={event => setDockingPiecesText(event.target.value)}
                  placeholder="1 2 3,4 5 6"
                  spellCheck="false"
                />
                <small>One comma-separated group per deployed unit type. Missing groups are safely repeated during compilation.</small>
              </div>

              <div className="form-group">
                <label htmlFor="input-drone-airtime">Maximum Air Time per Type</label>
                <input
                  id="input-drone-airtime"
                  type="text"
                  className="form-input"
                  value={droneAirTimeText}
                  onChange={event => setDroneAirTimeText(event.target.value)}
                  placeholder="60 90"
                  inputMode="numeric"
                />
              </div>

              <div className="form-group">
                <label htmlFor="input-drone-docktime">Minimum Dock Time per Type</label>
                <input
                  id="input-drone-docktime"
                  type="text"
                  className="form-input"
                  value={droneDockTimeText}
                  onChange={event => setDroneDockTimeText(event.target.value)}
                  placeholder="2 4"
                  inputMode="numeric"
                />
              </div>

              <div className="form-group">
                <label htmlFor="input-drone-ammo">Drone Ammunition per Type</label>
                <input
                  id="input-drone-ammo"
                  type="text"
                  className="form-input"
                  value={droneAmmoText}
                  onChange={event => setDroneAmmoText(event.target.value)}
                  placeholder="0 4"
                  inputMode="numeric"
                />
                <small>Use 0 for unlimited ammunition.</small>
              </div>

              <div className="carrier-workbench__clone-action">
                <Button type="button" variant="secondary" size="sm" onClick={handleQuickCreateDroneClone}>
                  + Create Custom Clone of "{childUnitInfo.displayName}"
                </Button>
              </div>
            </div>
          </section>
        </div>

        <footer className="carrier-workbench__footer">
          <span className="carrier-workbench__summary">
            <strong>{parentUnitInfo.displayName}</strong> · slot {targetWeaponSlot} · {carriedUnitIds.length} deployed {carriedUnitIds.length === 1 ? 'type' : 'types'} · {linkageModeLabel} · {dockingModeLabel}
          </span>
          <div className="carrier-workbench__actions">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary">Apply Linkage</Button>
          </div>
        </footer>
      </form>

      {/* Rich Searchable Unit Selection Modal */}
      {pickerTarget && (
        <Dialog
          open={Boolean(pickerTarget)}
          onClose={() => setPickerTarget(null)}
          className="carrier-workbench__picker-dialog"
          overlayClassName="carrier-workbench-overlay"
        >
          <header className="carrier-workbench__picker-header">
            <h3>
              {pickerTarget === 'parent'
                ? 'Select parent carrier chassis'
                : pickerTarget === 'child:add'
                  ? 'Add deployed unit type'
                  : 'Replace deployed unit type'}
            </h3>
            <IconButton label="Close unit picker" variant="quiet" size="sm" onClick={() => setPickerTarget(null)}>×</IconButton>
          </header>

          <div className="carrier-workbench__picker-body">
            <div className="carrier-workbench__picker-filters">
              <input
                type="text"
                className="form-input"
                placeholder="Search unit by name or ID..."
                value={pickerQuery}
                onChange={e => setPickerQuery(e.target.value)}
                autoFocus
              />

              <div className="carrier-workbench__faction-chips">
                {['all', 'arm', 'cor', 'leg', 'rap', 'scav'].map(f => (
                  <button
                    key={f}
                    type="button"
                    className={`carrier-workbench__faction-chip ${pickerFaction === f ? 'is-active' : ''}`}
                    onClick={() => setPickerFaction(f)}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="carrier-workbench__picker-results">
              {filteredPickerUnits.map(unit => (
                <button
                  key={unit.id}
                  type="button"
                  className={`carrier-workbench__unit-option ${
                    (pickerTarget === 'parent'
                      ? parentUnitId
                      : carriedUnitIds[Math.max(0, Number(String(pickerTarget).split(':')[1]) || 0)]) === unit.id
                      ? 'is-selected'
                      : ''
                  }`}
                  onClick={() => {
                    if (pickerTarget === 'parent') {
                      handleParentSelect(unit.id);
                    } else {
                      handlePayloadSelect(unit.id);
                    }
                    setPickerTarget(null);
                  }}
                >
                  <UnitArtwork unitId={unit.artworkUnitId || unit.id} className="carrier-workbench__unit-option-art" alt="" />
                  <div className="carrier-workbench__unit-option-info">
                    <strong>{unit.name} {unit.isClone ? '(Clone)' : ''}</strong>
                    <code>{unit.id}</code>
                  </div>
                  <span className="carrier-workbench__unit-option-faction">{unit.faction?.toUpperCase() || 'ALL'}</span>
                </button>
              ))}

              {filteredPickerUnits.length === 0 && (
                <div className="carrier-workbench__picker-empty">
                  No units found matching "{pickerQuery}".
                </div>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
}
