import { useId, useMemo, useState } from 'react';
import '../styles/features/carrier-drone-workbench.css';
import {
  buildCarrierLinkageTweaks,
  CARRIER_ARCHETYPES,
  getCarrierLinkageConfig,
} from '../utils/carrierDroneLinkage.js';
import UnitArtwork from './UnitArtwork.jsx';
import { Button, Dialog, IconButton, SelectField, Switch } from './ui.jsx';

export default function CarrierDroneWorkbenchDialog({
  open,
  onClose,
  units = [],
  clones = [],
  selectedUnit = null,
  defaultsDb = {},
  tweaks = {},
  onApplyLinkage,
  onCreateClone,
}) {
  const titleId = useId();
  const descriptionId = useId();

  // Combine real units + custom clones for carrier & drone pickers
  const allAvailableUnits = useMemo(() => {
    const cloneList = clones.map(c => ({
      id: c.newId.toLowerCase(),
      name: c.displayName || c.newId,
      faction: c.faction || 'all',
      isClone: true,
    }));
    const existingIds = new Set(cloneList.map(c => c.id));
    const baseList = units.filter(u => !existingIds.has(u.id.toLowerCase()));
    return [...cloneList, ...baseList];
  }, [units, clones]);

  // Initial state derived from selected unit or first preset
  const initialParentId = selectedUnit ? selectedUnit.id.toLowerCase() : 'armcarrier';
  const initialConfig = useMemo(
    () => getCarrierLinkageConfig(initialParentId, tweaks, defaultsDb),
    [initialParentId, tweaks, defaultsDb]
  );

  const [parentUnitId, setParentUnitId] = useState(initialParentId);
  const [carriedUnit, setCarriedUnit] = useState(initialConfig.carriedUnit || 'armantiodrone');
  const [droneAmmo, setDroneAmmo] = useState(initialConfig.droneAmmo || 6);
  const [spawnMetal, setSpawnMetal] = useState(initialConfig.spawnMetal || 120);
  const [spawnEnergy, setSpawnEnergy] = useState(initialConfig.spawnEnergy || 1200);
  const [spawnInterval, setSpawnInterval] = useState(initialConfig.spawnInterval || 5);
  const [returnHp, setReturnHp] = useState(initialConfig.returnHp || 25);

  const parentUnitInfo = useMemo(
    () => allAvailableUnits.find(u => u.id.toLowerCase() === parentUnitId.toLowerCase()) || { id: parentUnitId, name: parentUnitId },
    [allAvailableUnits, parentUnitId]
  );

  const childUnitInfo = useMemo(
    () => allAvailableUnits.find(u => u.id.toLowerCase() === carriedUnit.toLowerCase()) || { id: carriedUnit, name: carriedUnit },
    [allAvailableUnits, carriedUnit]
  );

  const handleApplyPreset = preset => {
    setParentUnitId(preset.parentUnitId);
    setCarriedUnit(preset.childUnitId);
    setDroneAmmo(preset.capacity);
    setSpawnInterval(preset.spawnInterval);
    setSpawnMetal(preset.metalCost);
    setSpawnEnergy(preset.energyCost);
    setReturnHp(preset.returnHpPercent);
  };

  const handleParentChange = newParentId => {
    setParentUnitId(newParentId);
    const cfg = getCarrierLinkageConfig(newParentId, tweaks, defaultsDb);
    if (cfg.carriedUnit) setCarriedUnit(cfg.carriedUnit);
    if (cfg.droneAmmo) setDroneAmmo(cfg.droneAmmo);
    if (cfg.spawnMetal) setSpawnMetal(cfg.spawnMetal);
    if (cfg.spawnEnergy) setSpawnEnergy(cfg.spawnEnergy);
    if (cfg.spawnInterval) setSpawnInterval(cfg.spawnInterval);
    if (cfg.returnHp) setReturnHp(cfg.returnHp);
  };

  const handleSave = event => {
    event.preventDefault();
    if (!parentUnitId || !carriedUnit) return;

    const compiledTweaks = buildCarrierLinkageTweaks({
      parentUnitId,
      carriedUnit,
      spawnsName: carriedUnit,
      droneAmmo,
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
            <span className="carrier-workbench__eyebrow">Visual Hangar Studio</span>
            <h2 id={titleId}>Carrier &amp; Deployed Drone Linkage Workbench</h2>
            <p id={descriptionId}>Connect parent warship chassis with child fighter drones, hangar capacities, and spawn mechanics.</p>
          </div>
          <IconButton label="Close carrier workbench" variant="quiet" size="sm" onClick={onClose}>×</IconButton>
        </header>

        <div className="carrier-workbench__body">
          {/* Visual Flight-Deck Link Diagram */}
          <section className="carrier-workbench__deck-diagram">
            <div className="carrier-workbench__card">
              <UnitArtwork unitId={parentUnitInfo.id} className="carrier-workbench__card-art" alt="" />
              <div className="carrier-workbench__card-info">
                <span className="carrier-workbench__card-role">Parent Carrier Chassis</span>
                <span className="carrier-workbench__card-title">{parentUnitInfo.name}</span>
                <code className="carrier-workbench__card-code">{parentUnitInfo.id}</code>
              </div>
            </div>

            <div className="carrier-workbench__link-bus" aria-hidden="true">
              <span className="carrier-workbench__link-arrow">➔</span>
              <small style={{ fontSize: '9px', fontWeight: 'bold' }}>{droneAmmo} Drones</small>
            </div>

            <div className="carrier-workbench__card">
              <UnitArtwork unitId={childUnitInfo.id} className="carrier-workbench__card-art" alt="" />
              <div className="carrier-workbench__card-info">
                <span className="carrier-workbench__card-role">Deployed Child Drone</span>
                <span className="carrier-workbench__card-title">{childUnitInfo.name}</span>
                <code className="carrier-workbench__card-code">{childUnitInfo.id}</code>
              </div>
            </div>
          </section>

          {/* Quick Presets */}
          <section className="carrier-workbench__section">
            <div className="carrier-workbench__section-title">
              <span>01. Archetype Presets</span>
            </div>
            <div className="carrier-workbench__presets">
              {CARRIER_ARCHETYPES.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  className="carrier-workbench__preset-card"
                  onClick={() => handleApplyPreset(preset)}
                >
                  <strong>⚡ {preset.name}</strong>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Unit Pickers & Controls Grid */}
          <div className="carrier-workbench__grid">
            {/* Column 1: Parent & Child Selection */}
            <section className="carrier-workbench__section">
              <div className="carrier-workbench__section-title">
                <span>02. Unit Roster Configuration</span>
              </div>

              <SelectField
                label="Parent Carrier Chassis"
                value={parentUnitId}
                onChange={e => handleParentChange(e.target.value)}
              >
                {allAvailableUnits.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.isClone ? `[Clone] ${u.name}` : u.name} ({u.id})
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Deployed Child Drone Unit"
                value={carriedUnit}
                onChange={e => setCarriedUnit(e.target.value)}
              >
                {allAvailableUnits.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.isClone ? `[Clone] ${u.name}` : u.name} ({u.id})
                  </option>
                ))}
              </SelectField>

              <div style={{ marginTop: '4px' }}>
                <Button type="button" variant="secondary" size="sm" onClick={handleQuickCreateDroneClone}>
                  ➕ Create Custom Clone of "{childUnitInfo.name}"
                </Button>
              </div>
            </section>

            {/* Column 2: Hangar & Launch Parameters */}
            <section className="carrier-workbench__section">
              <div className="carrier-workbench__section-title">
                <span>03. Hangar &amp; Deployment Parameters</span>
              </div>

              <div className="carrier-workbench__slider-group">
                <div className="carrier-workbench__slider-header">
                  <label htmlFor="drone-ammo-range">Active Payload Capacity (`droneammo`)</label>
                  <span>{droneAmmo} units</span>
                </div>
                <input
                  id="drone-ammo-range"
                  type="range"
                  min="1"
                  max="25"
                  value={droneAmmo}
                  onChange={e => setDroneAmmo(Number(e.target.value))}
                />
              </div>

              <div className="carrier-workbench__slider-group">
                <div className="carrier-workbench__slider-header">
                  <label htmlFor="spawn-interval-range">Spawn Delay / Interval (`spawn_interval`)</label>
                  <span>{spawnInterval}s</span>
                </div>
                <input
                  id="spawn-interval-range"
                  type="range"
                  min="1"
                  max="30"
                  value={spawnInterval}
                  onChange={e => setSpawnInterval(Number(e.target.value))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label htmlFor="spawn-metal">Spawn Metal Cost</label>
                  <input
                    id="spawn-metal"
                    type="number"
                    className="form-input"
                    value={spawnMetal}
                    onChange={e => setSpawnMetal(Number(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="spawn-energy">Spawn Energy Cost</label>
                  <input
                    id="spawn-energy"
                    type="number"
                    className="form-input"
                    value={spawnEnergy}
                    onChange={e => setSpawnEnergy(Number(e.target.value))}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>

        <footer className="carrier-workbench__footer">
          <span className="carrier-workbench__summary">
            Carrier <strong>{parentUnitInfo.name}</strong> will launch up to <strong>{droneAmmo}</strong> active <strong>{childUnitInfo.name}</strong> drones every {spawnInterval}s.
          </span>
          <div className="carrier-workbench__actions">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary">Apply Linkage</Button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
