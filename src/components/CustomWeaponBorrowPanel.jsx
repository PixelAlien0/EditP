import { useMemo, useState } from 'react';
import { Badge, Button, EmptyState, Type } from './ui/index.js';
import { getWeaponBlueprintMetrics } from '../utils/weaponBlueprint.js';

export default function CustomWeaponBorrowPanel({
  library,
  selectedBlueprintId,
  targetSlot,
  onSelect,
  onEquip,
  onOpenLaboratory,
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return library;
    return library.filter(blueprint => [
      blueprint.name,
      blueprint.description,
      blueprint.sourceWeaponDefKey,
      blueprint.sourceUnitId,
    ].some(value => String(value || '').toLowerCase().includes(normalizedQuery)));
  }, [library, query]);
  const selected = filtered.find(item => item.id === selectedBlueprintId)
    || library.find(item => item.id === selectedBlueprintId)
    || filtered[0]
    || null;
  const metrics = selected ? getWeaponBlueprintMetrics(selected) : null;

  return (
    <>
      <aside className="weapon-swap-library weapon-swap-custom-library" aria-label="Custom weapon storage">
        <div className="weapon-swap-library-heading">
          <span>Project storage</span>
          <strong>Custom weapons</strong>
          <small>{library.length} saved weapon{library.length === 1 ? '' : 's'}</small>
        </div>
        <label className="weapon-swap-search-field">
          <span>Search custom weapons</span>
          <input
            type="search"
            className="weapon-swap-search"
            placeholder="Name, source, or role"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        <div className="weapon-swap-custom-list" role="listbox" aria-label="Saved custom weapons">
          {filtered.map(blueprint => {
            const itemMetrics = getWeaponBlueprintMetrics(blueprint);
            const isSelected = blueprint.id === selected?.id;
            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                key={blueprint.id}
                className={`weapon-swap-custom-item ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onSelect(blueprint.id)}
              >
                <span
                  className="weapon-swap-custom-swatch"
                  style={{ '--custom-weapon-color': blueprint.appearance?.color || 'var(--color-accent)' }}
                  aria-hidden="true"
                />
                <span>
                  <strong>{blueprint.name}</strong>
                  <code>{blueprint.sourceWeaponDefKey}</code>
                </span>
                <small>{itemMetrics.dps.toFixed(1)} DPS</small>
              </button>
            );
          })}
          {!filtered.length && (
            <div className="weapon-swap-custom-list__empty">
              <strong>{library.length ? 'No matching weapons' : 'Storage is empty'}</strong>
              <span>{library.length ? 'Try another search.' : 'Clone and save a weapon in the Weapon Laboratory first.'}</span>
            </div>
          )}
        </div>
        <Button size="sm" fullWidth onClick={onOpenLaboratory}>Open Weapon Laboratory</Button>
      </aside>

      <div className="weapon-swap-stage weapon-swap-custom-stage">
        {selected ? (
          <div className="weapon-swap-custom-detail">
            <header>
              <div
                className="weapon-swap-custom-detail__swatch"
                style={{ '--custom-weapon-color': selected.appearance?.color || 'var(--color-accent)' }}
                aria-hidden="true"
              />
              <div>
                <Type variant="eyebrow">Stored custom WeaponDef</Type>
                <Type as="h4" variant="section-title">{selected.name}</Type>
                <code>{selected.id}</code>
              </div>
              <Badge tone="accent">Custom</Badge>
            </header>
            <p>{selected.description || 'No design note was supplied for this custom weapon.'}</p>
            <dl>
              <div><dt>DPS</dt><dd>{metrics.dps.toFixed(1)}</dd><small>Sustained estimate</small></div>
              <div><dt>Alpha</dt><dd>{metrics.alpha.toFixed(0)}</dd><small>Full salvo</small></div>
              <div><dt>Range</dt><dd>{metrics.range.toLocaleString()}</dd><small>Engine units</small></div>
              <div><dt>Splash</dt><dd>{metrics.aoe.toLocaleString()}</dd><small>Impact radius</small></div>
            </dl>
            <section>
              <Type variant="eyebrow">Source lineage</Type>
              <div><span>Source unit</span><code>{selected.sourceUnitId}</code></div>
              <div><span>Source WeaponDef</span><code>{selected.sourceWeaponDefKey}</code></div>
              <div><span>Target mount</span><strong>Slot {targetSlot}</strong></div>
            </section>
            <footer>
              <p>Equipping creates the generated WeaponDef only for this clone’s selected slot. The stored design remains reusable and unchanged.</p>
              <Button variant="primary" onClick={() => onEquip(selected)}>
                Equip custom weapon on slot {targetSlot}
              </Button>
            </footer>
          </div>
        ) : (
          <EmptyState
            title="No custom weapon selected"
            description="Choose a saved weapon from storage, or open the Weapon Laboratory to create one."
            action={<Button onClick={onOpenLaboratory}>Open Weapon Laboratory</Button>}
          />
        )}
      </div>
    </>
  );
}
