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
  const [targetWeaponSlot, setTargetWeaponSlot] = useState(initialConfig.targetWeaponSlot || 1);
  const [targetWeaponDef, setTargetWeaponDef] = useState(initialConfig.targetWeaponDef || '');
  const [spawnSurface, setSpawnSurface] = useState(initialConfig.spawnSurface || '');
  const [carrierDeathBehavior, setCarrierDeathBehavior] = useState(initialConfig.carrierDeathBehavior || 'death');
  const [manualControl, setManualControl] = useState(initialConfig.manualControl ?? true);
  const [dockingEnabled, setDockingEnabled] = useState(initialConfig.dockingEnabled ?? false);
  const [maxUnits, setMaxUnits] = useState(initialConfig.maxUnits || initialConfig.droneAmmo || 6);
  const [startingDroneCount, setStartingDroneCount] = useState(initialConfig.startingDroneCount ?? 0);
  const [spawnMetal, setSpawnMetal] = useState(initialConfig.spawnMetal || 120);
  const [spawnEnergy, setSpawnEnergy] = useState(initialConfig.spawnEnergy || 1200);
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
    if (cfg.carriedUnit && allAvailableUnits.some(u => u.id.toLowerCase() === cfg.carriedUnit.toLowerCase())) {
      setCarriedUnit(cfg.carriedUnit);
    }
    setTargetWeaponSlot(cfg.targetWeaponSlot || 1);
    setTargetWeaponDef(cfg.targetWeaponDef || '');
    setSpawnSurface(cfg.spawnSurface || '');
    setMaxUnits(cfg.maxUnits || cfg.droneAmmo || 1);
    setStartingDroneCount(cfg.startingDroneCount ?? 0);
    setSpawnMetal(cfg.spawnMetal ?? 0);
    setSpawnEnergy(cfg.spawnEnergy ?? 0);
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
    if (cfg.carriedUnit) setCarriedUnit(cfg.carriedUnit);
    setSpawnSurface(cfg.spawnSurface || '');
    setMaxUnits(cfg.maxUnits || cfg.droneAmmo || 1);
    setStartingDroneCount(cfg.startingDroneCount ?? 0);
    setSpawnMetal(cfg.spawnMetal ?? 0);
    setSpawnEnergy(cfg.spawnEnergy ?? 0);
    setSpawnInterval(cfg.spawnInterval || 1);
    setReturnHp(cfg.returnHp ?? 0);
    setCarrierDeathBehavior(cfg.carrierDeathBehavior || 'death');
    setManualControl(cfg.manualControl ?? true);
    setDockingEnabled(cfg.dockingEnabled ?? false);
  };

  const handleSave = event => {
    event.preventDefault();
    if (!parentUnitId || !carriedUnit) return;

    const compiledTweaks = buildCarrierLinkageTweaks({
      parentUnitId,
      carriedUnit,
      spawnsName: carriedUnit,
      targetWeaponSlot,
      targetWeaponDef,
      spawnSurface,
      carrierDeathBehavior,
      manualControl,
      dockingEnabled,
      maxUnits,
      startingDroneCount,
      spawnMetal,
      spawnEnergy,
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
            <span className="carrier-workbench__eyebrow">Carrier Systems</span>
            <h2 id={titleId}>Carrier &amp; Deployed Drone Linkage Workbench</h2>
            <p id={descriptionId}>Connect parent warship chassis with child fighter drones, hangar capacities, and deployment metrics.</p>
          </div>
          <IconButton label="Close carrier workbench" variant="quiet" size="sm" onClick={onClose}>×</IconButton>
        </header>

        <div className="carrier-workbench__body">
          {/* Visual Flight-Deck Diagram with Rich Interactive Picker Cards */}
          <section className="carrier-workbench__deck-diagram">
            <button
              type="button"
              className="carrier-workbench__picker-card"
              onClick={() => { setPickerTarget('parent'); setPickerQuery(''); setPickerFaction('all'); }}
              title="Click to select Parent Carrier Chassis"
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
              <span className="carrier-workbench__link-badge">{maxUnits} Drones</span>
            </div>

            <button
              type="button"
              className="carrier-workbench__picker-card"
              onClick={() => { setPickerTarget('child'); setPickerQuery(''); setPickerFaction('all'); }}
              title="Click to select Deployed Child Drone"
            >
              <UnitArtwork unitId={childUnitInfo.artworkUnitId || childUnitInfo.id} className="carrier-workbench__card-art" alt="" />
              <div className="carrier-workbench__card-info">
                <span className="carrier-workbench__card-role">Deployed Child Drone</span>
                <span className="carrier-workbench__card-title">{childUnitInfo.displayName}</span>
                <code className="carrier-workbench__card-code">{childUnitInfo.id}</code>
              </div>
              <span className="carrier-workbench__card-change">Change</span>
            </button>
          </section>

          {/* Numeric Typeboxes for Parameters */}
          <section className="carrier-workbench__section">
            <div className="carrier-workbench__section-title">
              <span>01. Hangar &amp; Deployment Parameters</span>
            </div>

            <div className="carrier-workbench__typebox-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Spawn Surface Restriction</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${spawnSurface === '' ? 'is-active' : ''}`}
                    onClick={() => setSpawnSurface('')}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                  >
                    Any surface
                  </button>
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${spawnSurface === 'LAND' ? 'is-active' : ''}`}
                    onClick={() => setSpawnSurface('LAND')}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                  >
                    Land only
                  </button>
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${spawnSurface === 'SEA' ? 'is-active' : ''}`}
                    onClick={() => setSpawnSurface('SEA')}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                  >
                    Sea only
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Drone Command Mode</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${manualControl ? 'is-active' : ''}`}
                    onClick={() => setManualControl(true)}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                  >
                    Direct player control
                  </button>
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${!manualControl ? 'is-active' : ''}`}
                    onClick={() => setManualControl(false)}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                  >
                    Carrier-directed only
                  </button>
                </div>
                <small>Direct control uses BAR's <code>manualdrones</code> mode. The carrier can still issue formation and recall orders.</small>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
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

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Docking Behavior</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${!dockingEnabled ? 'is-active' : ''}`}
                    onClick={() => setDockingEnabled(false)}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                  >
                    Free deployment
                  </button>
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${dockingEnabled ? 'is-active' : ''}`}
                    onClick={() => setDockingEnabled(true)}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                  >
                    Dock and auto-return
                  </button>
                </div>
                <small>Free deployment is safer for arbitrary unit models that do not have compatible docking pieces.</small>
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
                <label htmlFor="input-payload-capacity">Maximum Active Units (maxunits)</label>
                <input
                  id="input-payload-capacity"
                  type="number"
                  className="form-input"
                  min="1"
                  max="50"
                  value={maxUnits}
                  onChange={e => setMaxUnits(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="input-starting-drone-count">Initial Deployed Units (startingdronecount)</label>
                <input
                  id="input-starting-drone-count"
                  type="number"
                  className="form-input"
                  min="0"
                  max={maxUnits}
                  value={startingDroneCount}
                  onChange={e => setStartingDroneCount(Math.max(
                    0,
                    Math.min(maxUnits, parseInt(e.target.value, 10) || 0)
                  ))}
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
                <label htmlFor="input-spawn-metal">Spawn Metal Cost</label>
                <input
                  id="input-spawn-metal"
                  type="number"
                  className="form-input"
                  min="0"
                  value={spawnMetal}
                  onChange={e => setSpawnMetal(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="input-spawn-energy">Spawn Energy Cost</label>
                <input
                  id="input-spawn-energy"
                  type="number"
                  className="form-input"
                  min="0"
                  value={spawnEnergy}
                  onChange={e => setSpawnEnergy(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button type="button" variant="secondary" size="sm" onClick={handleQuickCreateDroneClone}>
                  + Create Custom Clone of "{childUnitInfo.displayName}"
                </Button>
              </div>
            </div>
          </section>
        </div>

        <footer className="carrier-workbench__footer">
          <span className="carrier-workbench__summary">
            Carrier <strong>{parentUnitInfo.displayName}</strong> will launch up to <strong>{maxUnits}</strong> active <strong>{childUnitInfo.displayName}</strong> units every {spawnInterval}s. {manualControl ? 'They remain player-selectable.' : 'They remain carrier-directed.'}
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
            <h3>Select {pickerTarget === 'parent' ? 'Parent Carrier Chassis' : 'Deployed Child Drone'}</h3>
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
                  className={`carrier-workbench__unit-option ${(pickerTarget === 'parent' ? parentUnitId : carriedUnit) === unit.id ? 'is-selected' : ''}`}
                  onClick={() => {
                    if (pickerTarget === 'parent') {
                      handleParentSelect(unit.id);
                    } else {
                      setCarriedUnit(unit.id);
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
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
