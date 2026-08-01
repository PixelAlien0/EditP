import { Button, Switch } from './ui.jsx';
import '../styles/features/mutation-lab.css';
import '../styles/features/mutation-lab.css';

const INTENSITY_OPTIONS = Object.freeze([
  { id: 'cautious', label: 'Cautious', note: '±10%' },
  { id: 'balanced', label: 'Balanced', note: '±25%' },
  { id: 'chaos', label: 'Chaos', note: '±50%' },
]);

const MUTATION_DOMAINS = Object.freeze([
  { id: 'durability', label: 'Durability', note: 'Health' },
  { id: 'economy', label: 'Economy', note: 'Costs & build time' },
  { id: 'mobility', label: 'Mobility', note: 'Movement speed' },
  { id: 'weapons', label: 'Weapons', note: 'Damage, range & reload' },
]);

export default function MutationLabDialog({
  acknowledged,
  scope,
  intensity,
  domains,
  selectedUnitName,
  filteredUnitCount,
  onAcknowledge,
  onScopeChange,
  onIntensityChange,
  onDomainsChange,
  onApply,
  onClose,
}) {
  return (
    <div className="mutation-lab-overlay">
      {!acknowledged && (
        <div className="mutation-lab-warning">
          <div className="mutation-lab-warning__card">
            <span className="mutation-lab-warning__badge">Experimental feature</span>
            <h3>Feature Under Active Development</h3>
            <p>
              The <strong>Mutation Lab</strong> is currently an experimental workbench module.
              Guided stat randomization procedures are subject to updates.
            </p>
            <div className="mutation-lab-warning__actions">
              <Button type="button" variant="secondary" onClick={onClose}>Back to Editor</Button>
              <Button type="button" variant="primary" onClick={onAcknowledge}>Proceed to Workbench</Button>
            </div>
          </div>
        </div>
      )}

      <div className="mutation-lab-modal" role="dialog" aria-modal="true" aria-labelledby="mutation-lab-title">
        <div className="mutation-lab-header">
          <div>
            <span>Guided randomization</span>
            <h3 id="mutation-lab-title">Mutation Lab</h3>
            <p>Generate a controlled variation from each unit’s original values. Every change remains editable and undoable.</p>
          </div>
          <button type="button" className="mutation-lab-close" onClick={onClose}>Close</button>
        </div>

        <div className="mutation-lab-body">
          <section className="mutation-lab-section">
            <div className="mutation-lab-section-heading">
              <span>01</span>
              <div><strong>Choose scope</strong><small>Decide what the mutation touches.</small></div>
            </div>
            <div className="mutation-choice-grid">
              <button type="button" className={scope === 'selected' ? 'active' : ''} onClick={() => onScopeChange('selected')}>
                <strong>Selected unit</strong><span>{selectedUnitName || 'No unit selected'}</span>
              </button>
              <button type="button" className={scope === 'filtered' ? 'active' : ''} onClick={() => onScopeChange('filtered')}>
                <strong>Filtered units</strong><span>{filteredUnitCount.toLocaleString()} units match current filters</span>
              </button>
            </div>
          </section>

          <section className="mutation-lab-section">
            <div className="mutation-lab-section-heading">
              <span>02</span>
              <div><strong>Set volatility</strong><small>Changes are calculated from each original stat.</small></div>
            </div>
            <div className="mutation-intensity-row">
              {INTENSITY_OPTIONS.map(option => (
                <button type="button" key={option.id} className={intensity === option.id ? 'active' : ''} onClick={() => onIntensityChange(option.id)}>
                  <strong>{option.label}</strong><span>{option.note}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="mutation-lab-section">
            <div className="mutation-lab-section-heading">
              <span>03</span>
              <div><strong>Select mutation domains</strong><small>Only checked domains receive a new value.</small></div>
            </div>
            <div className="mutation-domain-grid">
              {MUTATION_DOMAINS.map(domain => (
                <div key={domain.id} className={`mutation-domain-option ${domains[domain.id] ? 'active' : ''}`}>
                  <Switch
                    label={`Mutate ${domain.label}`}
                    checked={domains[domain.id]}
                    onChange={event => onDomainsChange({ ...domains, [domain.id]: event.target.checked })}
                  />
                  <span><strong>{domain.label}</strong><small>{domain.note}</small></span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mutation-lab-actions">
          <span>{scope === 'selected' ? 'One unit will be mutated.' : `${filteredUnitCount.toLocaleString()} filtered units will be mutated.`}</span>
          <div>
            <button type="button" className="mutation-cancel" onClick={onClose}>Cancel</button>
            <button type="button" className="mutation-apply" onClick={onApply}>Generate mutation</button>
          </div>
        </div>
      </div>
    </div>
  );
}
import '../styles/features/mutation-lab.css'
