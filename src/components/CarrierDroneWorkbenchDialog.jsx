import { useId, useMemo, useState } from 'react';
import '../styles/features/carrier-drone-workbench.css';
import { getFactionOfUnit } from '../utils/categories.js';
import {
  buildCarrierLinkageTweaks,
  CARRIER_ARCHETYPES,
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

  // Smart Carrier Unit Selection (defaults to real aircraft carrier if selected unit is not a carrier)
  const defaultParent = useMemo(() => {
    if (selectedUnit) {
      const sId = selectedUnit.id.toLowerCase();
      const sName = (selectedUnit.name || '').toLowerCase();
      const isCarrier = sId.includes('carrier') || sName.includes('carrier') || Boolean(tweaks[sId]?.['customparams.carried_unit']);
      if (isCarrier && allAvailableUnits.some(u => u.id === sId)) {
        return sId;
      }
    }
    const carrierMatch = allAvailableUnits.find(u => u.id.includes('carrier') || u.name.toLowerCase().includes('carrier'));
    return carrierMatch ? carrierMatch.id : (allAvailableUnits.find(u => u.id === 'armcarrier')?.id || allAvailableUnits[0]?.id || 'armcarrier');
  }, [selectedUnit, allAvailableUnits, tweaks]);

  const initialConfig = useMemo(
    () => getCarrierLinkageConfig(defaultParent, tweaks, defaultsDb),
    [defaultParent, tweaks, defaultsDb]
  );

  const [parentUnitId, setParentUnitId] = useState(defaultParent);
  const [carriedUnit, setCarriedUnit] = useState(initialConfig.carriedUnit || 'armantiodrone');
  const [deployMode, setDeployMode] = useState(initialConfig.deployMode || 'air');
  const [droneAmmo, setDroneAmmo] = useState(initialConfig.droneAmmo || 6);
  const [spawnMetal, setSpawnMetal] = useState(initialConfig.spawnMetal || 120);
  const [spawnEnergy, setSpawnEnergy] = useState(initialConfig.spawnEnergy || 1200);
  const [spawnInterval, setSpawnInterval] = useState(initialConfig.spawnInterval || 5);
  const [returnHp, setReturnHp] = useState(initialConfig.returnHp || 25);

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

  const handleApplyPreset = preset => {
    const validParent = allAvailableUnits.some(u => u.id.toLowerCase() === preset.parentUnitId.toLowerCase())
      ? preset.parentUnitId
      : parentUnitId;
    const validChild = allAvailableUnits.some(u => u.id.toLowerCase() === preset.childUnitId.toLowerCase())
      ? preset.childUnitId
      : carriedUnit;

    setParentUnitId(validParent);
    setCarriedUnit(validChild);
    setDroneAmmo(preset.capacity);
    setSpawnInterval(preset.spawnInterval);
    setSpawnMetal(preset.metalCost);
    setSpawnEnergy(preset.energyCost);
    setReturnHp(preset.returnHpPercent);
  };

  const handleParentSelect = newParentId => {
    setParentUnitId(newParentId);
    const cfg = getCarrierLinkageConfig(newParentId, tweaks, defaultsDb);
    if (cfg.carriedUnit && allAvailableUnits.some(u => u.id.toLowerCase() === cfg.carriedUnit.toLowerCase())) {
      setCarriedUnit(cfg.carriedUnit);
    }
    if (cfg.deployMode) setDeployMode(cfg.deployMode);
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
      deployMode,
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
            <span className="carrier-workbench__eyebrow">Flight Deck Engineering</span>
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
              <span className="carrier-workbench__link-badge">{droneAmmo} Drones</span>
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
                <label>Deployment System Mode</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${deployMode === 'air' ? 'is-active' : ''}`}
                    onClick={() => setDeployMode('air')}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                  >
                    Air Fighter Drone (Aircraft Carrier / Hangar)
                  </button>
                  <button
                    type="button"
                    className={`carrier-workbench__faction-chip ${deployMode === 'ground' ? 'is-active' : ''}`}
                    onClick={() => setDeployMode('ground')}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                  >
                    Ground / Assault Unit Spawner (Hive / Building)
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="input-payload-capacity">Hangar Payload Capacity (droneammo)</label>
                <input
                  id="input-payload-capacity"
                  type="number"
                  className="form-input"
                  min="1"
                  max="50"
                  value={droneAmmo}
                  onChange={e => setDroneAmmo(Math.max(1, parseInt(e.target.value, 10) || 1))}
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
            Carrier <strong>{parentUnitInfo.displayName}</strong> will launch up to <strong>{droneAmmo}</strong> active <strong>{childUnitInfo.displayName}</strong> drones every {spawnInterval}s.
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
