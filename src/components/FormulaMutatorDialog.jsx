import { useId, useMemo, useState } from 'react';
import '../styles/features/formula-mutator.css';
import {
  evaluateUnitFormula,
  FORMULA_VARIABLES,
  PRESET_FORMULAS,
  validateFormula,
} from '../utils/formulaEvaluator.js';
import UnitArtwork from './UnitArtwork.jsx';
import { Button, Dialog, IconButton, SelectField } from './ui.jsx';

export default function FormulaMutatorDialog({
  open,
  onClose,
  units = [],
  selectedUnit = null,
  activeCollection = null,
  filteredUnits = [],
  defaultsDb = {},
  tweaks = {},
  onApplyFormula,
}) {
  const titleId = useId();
  const descriptionId = useId();

  const [scope, setScope] = useState('filtered');
  const [property, setProperty] = useState('health');
  const [formula, setFormula] = useState('health * 1.5');
  const [wipAcknowledged, setWipAcknowledged] = useState(false);

  const error = useMemo(() => validateFormula(formula), [formula]);

  const targetUnits = useMemo(() => {
    if (scope === 'selected') return selectedUnit ? [selectedUnit] : [];
    if (scope === 'collection') {
      if (!activeCollection) return filteredUnits;
      const set = new Set(activeCollection.unitIds || []);
      return units.filter(u => set.has(u.id));
    }
    if (scope === 'filtered') return filteredUnits;
    return units;
  }, [scope, selectedUnit, activeCollection, filteredUnits, units]);

  const previewList = useMemo(() => {
    if (error || !formula.trim() || targetUnits.length === 0) return [];
    return targetUnits.slice(0, 10).map(unit => {
      const unitId = unit.id;
      const defaults = defaultsDb[unitId] || {};
      const currentTweaks = tweaks[unitId] || {};
      const beforeVal = property === 'damage' || property === 'range' || property === 'reload'
        ? (defaults.weaponSlots?.[0]?.[property] ?? (property === 'reload' ? 1 : 0))
        : (currentTweaks[property] ?? defaults[property] ?? 0);

      const afterVal = evaluateUnitFormula(property, formula, unitId, defaults, tweaks);
      return {
        unit,
        beforeVal,
        afterVal,
      };
    });
  }, [error, formula, targetUnits, property, defaultsDb, tweaks]);

  const handleApply = event => {
    event.preventDefault();
    if (error || targetUnits.length === 0) return;

    const updates = targetUnits.map(unit => {
      const unitId = unit.id;
      const defaults = defaultsDb[unitId] || {};
      const newVal = evaluateUnitFormula(property, formula, unitId, defaults, tweaks);
      return { unitId, property, value: newVal };
    });

    onApplyFormula(updates);
    onClose();
  };

  const insertToken = token => {
    setFormula(prev => (prev ? `${prev} ${token}` : token));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="formula-mutator"
      overlayClassName="formula-mutator-overlay"
      labelledBy={titleId}
      describedBy={descriptionId}
    >
      {!wipAcknowledged && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1000,
          backgroundColor: 'var(--color-overlay, rgba(20, 18, 17, 0.75))',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px'
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            backgroundColor: 'var(--color-surface-raised, #2c2927)',
            border: '1px solid var(--color-border-strong, rgba(239, 222, 207, 0.25))',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '36px 32px',
            boxShadow: 'var(--shadow-float, 0 18px 48px rgba(0, 0, 0, 0.4))',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--color-warning-surface, rgba(211, 166, 110, 0.15))',
              color: 'var(--color-warning, #d3a66e)',
              border: '1px solid var(--color-border-warm, rgba(211, 166, 110, 0.3))',
              borderRadius: 'var(--radius-xs, 3px)',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono, monospace)'
            }}>
              EXPERIMENTAL FEATURE
            </div>
            <h3 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              color: 'var(--color-text-strong, #f2e9df)',
              fontFamily: 'var(--font-ui, sans-serif)',
              letterSpacing: '-0.01em'
            }}>
              Feature Under Active Development
            </h3>
            <p style={{
              margin: 0,
              fontSize: '13.5px',
              color: 'var(--color-text-muted, #b5a79c)',
              lineHeight: 1.65,
              maxWidth: '400px'
            }}>
              The <strong>Dynamic Formula Mutator</strong> is currently an experimental workbench module. Calculations and batch property rules are subject to updates.
            </p>
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '12px',
              width: '100%',
              justifyContent: 'center'
            }}>
              <Button type="button" variant="secondary" onClick={onClose} style={{ minWidth: '130px' }}>
                Back to Editor
              </Button>
              <Button type="button" variant="primary" onClick={() => setWipAcknowledged(true)} style={{ minWidth: '160px' }}>
                Proceed to Workbench
              </Button>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={handleApply}>
        <header className="formula-mutator__header">
          <div className="formula-mutator__heading">
            <span className="formula-mutator__eyebrow">Power-User Engineering Studio</span>
            <h2 id={titleId}>Dynamic Formula Mutator</h2>
            <p id={descriptionId}>Evaluate math functions and scaling equations across target chassis scopes.</p>
          </div>
          <IconButton label="Close formula mutator" variant="quiet" size="sm" onClick={onClose}>×</IconButton>
        </header>

        <div className="formula-mutator__body">
          {/* Step 1: Scope selection */}
          <section className="formula-mutator__section">
            <div className="formula-mutator__section-title">
              <span>01. Select Target Scope</span>
            </div>
            <div className="formula-mutator__scope-grid">
              {[
                { id: 'selected', label: 'Selected Unit', desc: selectedUnit?.name || 'No unit selected' },
                { id: 'collection', label: 'Active Collection', desc: activeCollection ? activeCollection.name : 'Current scope' },
                { id: 'filtered', label: 'Filtered List', desc: `${filteredUnits.length.toLocaleString()} units match search` },
                { id: 'all', label: 'All Units', desc: `${units.length.toLocaleString()} total BAR units` },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={`formula-mutator__scope-btn ${scope === opt.id ? 'is-active' : ''}`}
                  onClick={() => setScope(opt.id)}
                >
                  <strong>{opt.label}</strong>
                  <span>{opt.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Step 2: Property & Formula Editor */}
          <section className="formula-mutator__section">
            <div className="formula-mutator__section-title">
              <span>02. Property & Math Expression</span>
            </div>

            <div className="formula-mutator__form-row">
              <SelectField
                label="Target Property"
                value={property}
                onChange={e => setProperty(e.target.value)}
              >
                {FORMULA_VARIABLES.map(v => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </SelectField>

              <div className="form-group">
                <label htmlFor="formula-input">Math Expression</label>
                <input
                  id="formula-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. floor(health * 1.5)"
                  value={formula}
                  onChange={e => setFormula(e.target.value)}
                />
              </div>
            </div>

            {error && <div className="formula-mutator__error">{error}</div>}

            <div className="formula-mutator__tokens" aria-label="Available variables and functions">
              {FORMULA_VARIABLES.map(v => (
                <button
                  key={v.id}
                  type="button"
                  className="formula-mutator__token-chip"
                  onClick={() => insertToken(v.id)}
                >
                  {v.id}
                </button>
              ))}
              {['floor()', 'ceil()', 'round()', 'max()', 'min()', 'clamp()'].map(fn => (
                <button
                  key={fn}
                  type="button"
                  className="formula-mutator__token-chip"
                  onClick={() => insertToken(fn)}
                >
                  {fn}
                </button>
              ))}
            </div>
          </section>

          {/* Step 3: Presets */}
          <section className="formula-mutator__section">
            <div className="formula-mutator__section-title">
              <span>03. Formula Presets</span>
            </div>
            <div className="formula-mutator__presets">
              {PRESET_FORMULAS.map(p => (
                <button
                  key={p.name}
                  type="button"
                  className="formula-mutator__preset-btn"
                  onClick={() => {
                    setProperty(p.property);
                    setFormula(p.formula);
                  }}
                  title={p.description}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </section>

          {/* Step 4: Real-time Live Preview */}
          {previewList.length > 0 && (
            <section className="formula-mutator__section">
              <div className="formula-mutator__section-title">
                <span>04. Real-Time Live Sample Diff ({targetUnits.length.toLocaleString()} matching)</span>
              </div>
              <div className="formula-mutator__preview">
                <table className="formula-mutator__preview-table">
                  <thead>
                    <tr>
                      <th>Unit</th>
                      <th>Original {property}</th>
                      <th>Calculated Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewList.map(item => (
                      <tr key={item.unit.id}>
                        <td>
                          <div className="formula-mutator__unit-cell">
                            <UnitArtwork unitId={item.unit.id} alt="" />
                            <span><strong>{item.unit.name}</strong> <code>{item.unit.id}</code></span>
                          </div>
                        </td>
                        <td className="formula-mutator__val-before">{item.beforeVal}</td>
                        <td className="formula-mutator__val-after">{item.afterVal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <footer className="formula-mutator__footer">
          <span className="formula-mutator__summary">
            {targetUnits.length.toLocaleString()} units will receive formula overrides for <strong>{property}</strong>.
          </span>
          <div className="formula-mutator__actions">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={Boolean(error) || targetUnits.length === 0}>
              Apply Formula
            </Button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
