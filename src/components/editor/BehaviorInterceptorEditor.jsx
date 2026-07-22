import { Button } from '../ui.jsx';
import '../../styles/features/behavior-interceptor.css';
import {
  INTERCEPTION_CHANNELS,
  INTERCEPTION_ROLE_PRESETS,
  UNIT_BEHAVIOR_CONTROLS,
  getInterceptionDiagnostics,
  normalizeInterceptionMask,
  toggleInterceptionChannel,
} from '../../config/behaviorInterceptor.js';

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function displayValue(value) {
  if (value === true) return 'Enabled';
  if (value === false) return 'Disabled';
  if (value === undefined || value === null || value === '') return 'Engine-defined';
  return String(value);
}

function BooleanOverride({ control, inheritedValue, modified, value, onChange, onFocus }) {
  const selectedValue = modified ? String(value === true || value === 'true') : '';
  return (
    <label className={`behavior-control ${modified ? 'is-edited' : ''}`} data-param-key={control.key}>
      <span className="behavior-control__copy">
        <strong>{control.label}</strong>
        <small>{control.description}</small>
      </span>
      <select
        aria-label={control.label}
        value={selectedValue}
        onFocus={() => onFocus(control.key)}
        onChange={event => onChange(event.target.value === '' ? undefined : event.target.value === 'true')}
      >
        <option value="">Inherited · {displayValue(inheritedValue)}</option>
        <option value="true">Enabled</option>
        <option value="false">Disabled</option>
      </select>
    </label>
  );
}

function UnitBehaviorControl({ control, defaults, tweaks, onChange, onFocus }) {
  const modified = hasOwn(tweaks, control.key);
  const value = modified ? tweaks[control.key] : defaults[control.key];
  if (control.type === 'boolean') {
    return (
      <BooleanOverride
        control={control}
        inheritedValue={defaults[control.key]}
        modified={modified}
        value={value}
        onChange={next => onChange(control.key, next)}
        onFocus={onFocus}
      />
    );
  }

  return (
    <label className={`behavior-control ${modified ? 'is-edited' : ''}`} data-param-key={control.key}>
      <span className="behavior-control__copy">
        <strong>{control.label}</strong>
        <small>{control.description}</small>
      </span>
      {control.type === 'select' ? (
        <select
          aria-label={control.label}
          value={modified ? String(tweaks[control.key]) : ''}
          onFocus={() => onFocus(control.key)}
          onChange={event => onChange(control.key, event.target.value === '' ? undefined : Number(event.target.value))}
        >
          <option value="">Inherited · {displayValue(defaults[control.key])}</option>
          {control.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : (
        <span className="behavior-control__field">
          <input
            type="text"
            aria-label={control.label}
            value={modified ? String(tweaks[control.key]) : ''}
            placeholder={defaults[control.key] || 'Inherited'}
            onFocus={() => onFocus(control.key)}
            onChange={event => onChange(control.key, event.target.value || undefined)}
          />
          {modified && <button type="button" onClick={() => onChange(control.key, undefined)} aria-label={`Reset ${control.label}`}>Reset</button>}
        </span>
      )}
    </label>
  );
}

function MaskEditor({ label, description, parameterKey, value, inheritedValue, modified, onChange, onFocus }) {
  const mask = normalizeInterceptionMask(value);
  return (
    <section className={`interception-mask ${modified ? 'is-edited' : ''}`} data-param-key={parameterKey}>
      <header>
        <span><strong>{label}</strong><small>{description}</small></span>
        <span className="interception-mask__value">{mask}</span>
      </header>
      <div className="interception-mask__channels" aria-label={`${label} channels`}>
        {INTERCEPTION_CHANNELS.map(channel => {
          const selected = (mask & channel.bit) !== 0;
          return (
            <button
              type="button"
              key={channel.bit}
              className={selected ? 'is-selected' : ''}
              aria-pressed={selected}
              title={channel.description}
              onFocus={() => onFocus(parameterKey)}
              onClick={() => onChange(toggleInterceptionChannel(mask, channel.bit))}
            >
              <span>{channel.label}</span>
              <small>{channel.bit}</small>
            </button>
          );
        })}
      </div>
      <footer>
        <label>
          <span>Decimal mask</span>
          <input
            type="number"
            min="0"
            step="1"
            aria-label={`${label} decimal mask`}
            value={modified ? value : ''}
            placeholder={inheritedValue === undefined ? '0' : String(inheritedValue)}
            onFocus={() => onFocus(parameterKey)}
            onChange={event => onChange(event.target.value === '' ? undefined : normalizeInterceptionMask(event.target.value))}
          />
        </label>
        {modified && <button type="button" onClick={() => onChange(undefined)}>Use inherited</button>}
      </footer>
    </section>
  );
}

export default function BehaviorInterceptorEditor({
  slot,
  unitDefaults,
  unitTweaks,
  knownTargetableMask,
  onWeaponChange,
  onUnitChange,
  onParameterFocus,
}) {
  const weaponKey = key => `weapon_slot_${slot.slot}_${key}`;
  const weaponModified = key => hasOwn(unitTweaks, weaponKey(key));
  const weaponValue = key => weaponModified(key) ? unitTweaks[weaponKey(key)] : slot[key];
  const targetable = weaponValue('targetable');
  const interceptor = weaponValue('interceptor');
  const coverage = weaponValue('coverage');
  const range = weaponValue('range');
  const diagnostics = getInterceptionDiagnostics({ targetable, interceptor, coverage, range, knownTargetableMask });
  const activeRole = INTERCEPTION_ROLE_PRESETS.find(preset => preset.id === diagnostics.role);

  const setWeapon = (key, value) => onWeaponChange(weaponKey(key), value);
  const applyRole = preset => {
    setWeapon('targetable', preset.targetable);
    setWeapon('interceptor', preset.interceptor);
    if (preset.interceptor > 0 && (!Number.isFinite(Number(coverage)) || Number(coverage) <= 0)) {
      setWeapon('coverage', Math.max(1, Number(range) || 1000));
    }
  };

  return (
    <section className="behavior-interceptor-editor" aria-labelledby="behavior-interceptor-title">
      <header className="behavior-interceptor-editor__heading">
        <div>
          <span className="behavior-interceptor-editor__eyebrow">Linked weapon system</span>
          <h3 id="behavior-interceptor-title">Behaviour &amp; Interception</h3>
          <p>Configure how the unit engages, then connect projectile and interceptor channels without guessing at bitmasks.</p>
        </div>
        <div className={`behavior-interceptor-editor__role is-${diagnostics.role}`}>
          <small>Current role</small>
          <strong>{activeRole?.label || 'Custom'}</strong>
        </div>
      </header>

      <div className="behavior-interceptor-editor__layout">
        <section className="behavior-interceptor-panel behavior-interceptor-panel--behavior">
          <header><span>Unit behaviour</span><small>Orders and engagement policy</small></header>
          <div className="behavior-control-list">
            {UNIT_BEHAVIOR_CONTROLS.map(control => (
              <UnitBehaviorControl
                key={control.key}
                control={control}
                defaults={unitDefaults}
                tweaks={unitTweaks}
                onChange={onUnitChange}
                onFocus={onParameterFocus}
              />
            ))}
          </div>
        </section>

        <section className="behavior-interceptor-panel behavior-interceptor-panel--roles">
          <header><span>Projectile role</span><small>Safe starting profiles</small></header>
          <div className="interception-role-grid">
            {INTERCEPTION_ROLE_PRESETS.map(preset => (
              <button
                type="button"
                key={preset.id}
                className={diagnostics.role === preset.id ? 'is-selected' : ''}
                aria-pressed={diagnostics.role === preset.id}
                onClick={() => applyRole(preset)}
              >
                <strong>{preset.label}</strong>
                <small>{preset.description}</small>
              </button>
            ))}
          </div>

          <div className="weapon-behavior-controls">
            <BooleanOverride
              control={{ key: 'commandfire', label: 'Manual fire only', description: 'Responds to manual-fire orders instead of automatic attack.' }}
              inheritedValue={slot.commandfire}
              modified={weaponModified('commandfire')}
              value={weaponValue('commandfire')}
              onChange={value => setWeapon('commandfire', value)}
              onFocus={onParameterFocus}
            />
            <BooleanOverride
              control={{ key: 'interceptsolo', label: 'Exclusive interception', description: 'Prevents other interceptors from committing to the same projectile.' }}
              inheritedValue={slot.interceptsolo}
              modified={weaponModified('interceptsolo')}
              value={weaponValue('interceptsolo')}
              onChange={value => setWeapon('interceptsolo', value)}
              onFocus={onParameterFocus}
            />
            <label className={`behavior-control ${weaponModified('coverage') ? 'is-edited' : ''}`} data-param-key="coverage">
              <span className="behavior-control__copy"><strong>Acquisition coverage</strong><small>Radius used to search for matching projectiles.</small></span>
              <span className="behavior-control__field">
                <input
                  type="number"
                  min="0"
                  aria-label="Interceptor acquisition coverage"
                  value={weaponModified('coverage') ? unitTweaks[weaponKey('coverage')] : ''}
                  placeholder={slot.coverage === undefined ? 'Inherited' : String(slot.coverage)}
                  onFocus={() => onParameterFocus('coverage')}
                  onChange={event => setWeapon('coverage', event.target.value === '' ? undefined : event.target.value)}
                />
                {weaponModified('coverage') && <button type="button" onClick={() => setWeapon('coverage', undefined)}>Reset</button>}
              </span>
            </label>
          </div>
        </section>

        <section className="behavior-interceptor-panel behavior-interceptor-panel--masks">
          <header><span>Channel matrix</span><small>Matching bits establish compatibility</small></header>
          <div className="interception-mask-grid">
            <MaskEditor
              label="Projectile targetable mask"
              description="Which interceptor channels can acquire this projectile."
              parameterKey="targetable"
              value={targetable}
              inheritedValue={slot.targetable}
              modified={weaponModified('targetable')}
              onChange={value => setWeapon('targetable', value)}
              onFocus={onParameterFocus}
            />
            <div className="interception-mask-link" aria-hidden="true">
              <span>Match when</span><strong>INTERCEPTOR &amp; TARGETABLE ≠ 0</strong>
            </div>
            <MaskEditor
              label="Interceptor weapon mask"
              description="Which projectile channels this weapon searches for."
              parameterKey="interceptor"
              value={interceptor}
              inheritedValue={slot.interceptor}
              modified={weaponModified('interceptor')}
              onChange={value => setWeapon('interceptor', value)}
              onFocus={onParameterFocus}
            />
          </div>
        </section>
      </div>

      <footer className="behavior-interceptor-editor__diagnostics" aria-live="polite">
        <div className="behavior-interceptor-editor__summary">
          <span><small>Targetable</small><strong>{diagnostics.targetableMask}</strong></span>
          <span><small>Interceptor</small><strong>{diagnostics.interceptorMask}</strong></span>
          <span><small>BAR matches</small><strong>{diagnostics.matchedKnownMask || 'None'}</strong></span>
          <span><small>Coverage</small><strong>{Number(coverage) > 0 ? `${coverage} elmos` : 'Not set'}</strong></span>
        </div>
        <div className="behavior-interceptor-editor__messages">
          {diagnostics.messages.map(message => (
            <span className={`is-${message.level}`} key={message.code}>{message.message}</span>
          ))}
        </div>
        {(weaponModified('targetable') || weaponModified('interceptor') || weaponModified('coverage') || weaponModified('interceptsolo') || weaponModified('commandfire')) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => ['targetable', 'interceptor', 'coverage', 'interceptsolo', 'commandfire'].forEach(key => setWeapon(key, undefined))}
          >
            Reset weapon behaviour
          </Button>
        )}
      </footer>
    </section>
  );
}
