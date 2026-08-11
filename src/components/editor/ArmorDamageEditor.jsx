import { useMemo, useState } from 'react';
import {
  BUILTIN_ARMOR_PROFILES,
  collectArmorDamageProfiles,
  getArmorDamageParameterKey,
  isValidArmorProfile,
  normalizeArmorProfile,
} from '../../config/armorProfiles.js';
import { Badge, Button } from '../ui.jsx';

export default function ArmorDamageEditor({
  values = {},
  modifiedValues = {},
  linkedProfiles = [],
  onChange,
  compact = false,
}) {
  const [draftProfile, setDraftProfile] = useState('');
  const profiles = useMemo(() => [...new Set([
    ...collectArmorDamageProfiles(values),
    ...collectArmorDamageProfiles(modifiedValues),
    ...linkedProfiles.map(normalizeArmorProfile).filter(Boolean),
  ])].sort(), [linkedProfiles, modifiedValues, values]);
  const normalizedDraft = normalizeArmorProfile(draftProfile);
  const canAdd = isValidArmorProfile(normalizedDraft) && !profiles.includes(normalizedDraft);

  return (
    <section className={`armor-damage-editor ${compact ? 'is-compact' : ''}`} aria-labelledby="armor-damage-editor-title">
      <header className="armor-damage-editor__header">
        <div>
          <span>Tweak-defined armor contract</span>
          <h4 id="armor-damage-editor-title">Custom armor damage</h4>
          <p>Pair a unit Armor Profile with a weapon damage value. This compiles to <code>damage.&lt;profile&gt;</code>.</p>
        </div>
        <Badge size="sm">{profiles.length} profiles</Badge>
      </header>

      <div className="armor-damage-editor__composer">
        <label>
          <span>Armor profile ID</span>
          <input
            className="ui-control"
            value={draftProfile}
            list="armor-profile-suggestions"
            placeholder="e.g. armored"
            onChange={event => setDraftProfile(event.target.value)}
          />
          <datalist id="armor-profile-suggestions">
            {[...BUILTIN_ARMOR_PROFILES, ...linkedProfiles].map(profile => <option key={profile} value={profile} />)}
          </datalist>
        </label>
        <Button
          variant="secondary"
          disabled={!canAdd}
          onClick={() => {
            onChange(getArmorDamageParameterKey(normalizedDraft), 0);
            setDraftProfile('');
          }}
        >
          Add profile
        </Button>
      </div>

      {draftProfile && !isValidArmorProfile(normalizedDraft) && (
        <p className="armor-damage-editor__error">Use letters, numbers, and underscores; begin with a letter or underscore.</p>
      )}

      {profiles.length > 0 ? (
        <div className="armor-damage-editor__rows">
          {profiles.map(profile => {
            const key = getArmorDamageParameterKey(profile);
            const modified = Object.prototype.hasOwnProperty.call(modifiedValues, key);
            const value = modified ? modifiedValues[key] : values[key];
            return (
              <div className={`armor-damage-editor__row ${modified ? 'is-modified' : ''}`} key={profile}>
                <div>
                  <strong>{profile}</strong>
                  <code>damage.{profile}</code>
                </div>
                <input
                  className="ui-control"
                  type="number"
                  min="0"
                  step="any"
                  aria-label={`Damage against ${profile} armor`}
                  value={value ?? ''}
                  placeholder="Inherited"
                  onChange={event => onChange(key, event.target.value === '' ? undefined : event.target.value)}
                />
                <Button size="sm" variant="ghost" disabled={!modified} onClick={() => onChange(key, undefined)}>
                  Reset
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="armor-damage-editor__empty">No custom armor damage profiles are configured for this weapon.</p>
      )}
    </section>
  );
}
