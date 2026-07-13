import { useMemo, useState } from 'react';
import { Button, Dialog, EmptyState, IconButton, Tabs } from './ui.jsx';

const CONFIRMATION_COPY = {
  all: {
    eyebrow: 'Project reset',
    title: 'Reset every active editor change?',
    description: 'This clears unit parameters and descriptions, custom clones, build-menu changes and packs, and disabled units. Presets, project identity, theme preferences, and the weapon library stay intact.',
    confirmLabel: 'Reset all changes'
  },
  tweaks: {
    eyebrow: 'Unit edits',
    title: 'Reset every unit edit?',
    description: 'All parameter overrides and custom unit descriptions will return to their inherited values.',
    confirmLabel: 'Reset unit edits'
  },
  clones: {
    eyebrow: 'Custom units',
    title: 'Delete every custom clone?',
    description: 'Clone definitions, their parameter overrides, descriptions, and builder assignments will be removed.',
    confirmLabel: 'Delete all clones'
  },
  rosters: {
    eyebrow: 'Build menus',
    title: 'Revert every build-menu change?',
    description: 'Factory roster edits and the Extra Units and Scavenger Units packs will return to their defaults.',
    confirmLabel: 'Revert build menus'
  },
  disabled: {
    eyebrow: 'Disabled units',
    title: 'Restore every disabled unit?',
    description: 'All units currently excluded from the project will be enabled again.',
    confirmLabel: 'Restore all units'
  }
};

function ExplorerSection({ title, description, action, children, labelledBy }) {
  return (
    <section className="summary-explorer-section" role="tabpanel" id={labelledBy} tabIndex={0}>
      <header className="summary-explorer-section__header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function ExplorerRow({ title, id, meta, badge, actionLabel, onAction, tone = 'default' }) {
  return (
    <article className={`summary-explorer-row ${tone === 'accent' ? 'is-accent' : ''}`}>
      <div className="summary-explorer-row__copy">
        <div className="summary-explorer-row__title">
          <strong>{title}</strong>
          {badge && <span>{badge}</span>}
        </div>
        {id && <code>{id}</code>}
        {meta && <p>{meta}</p>}
      </div>
      {actionLabel && (
        <Button variant="danger" size="sm" onClick={onAction}>{actionLabel}</Button>
      )}
    </article>
  );
}

export default function SummaryExplorerDialog({
  open,
  activeTab,
  onTabChange,
  onClose,
  tweaks,
  clones,
  disabledUnitIds,
  unitDescriptions,
  buildMenuSteps,
  buildMenuPacks,
  unitNames,
  onResetUnitEdits,
  onResetAllUnitEdits,
  onDeleteClone,
  onDeleteAllClones,
  onRevertRoster,
  onResetAllRosters,
  onDisableBuildMenuPack,
  onRestoreUnit,
  onRestoreAllUnits,
  onResetAllChanges
}) {
  const [pendingReset, setPendingReset] = useState(null);
  const editedUnitIds = useMemo(() => [...new Set([
    ...Object.entries(tweaks).filter(([, patch]) => Object.keys(patch || {}).length > 0).map(([unitId]) => unitId),
    ...Object.keys(unitDescriptions)
  ])], [tweaks, unitDescriptions]);
  const totalParameterOverrides = useMemo(
    () => Object.values(tweaks).reduce((total, patch) => total + Object.keys(patch || {}).length, 0),
    [tweaks]
  );
  const enabledPacks = useMemo(() => Object.entries(buildMenuPacks).filter(([, enabled]) => enabled), [buildMenuPacks]);
  const rosterChangeCount = buildMenuSteps.length + enabledPacks.length;
  const totalChanges = editedUnitIds.length + clones.length + rosterChangeCount + disabledUnitIds.length;
  const hasChanges = totalChanges > 0;

  const tabs = [
    { id: 'tweaks', label: 'Unit edits', count: editedUnitIds.length, panelId: 'summary-panel-tweaks' },
    { id: 'clones', label: 'Clones', count: clones.length, panelId: 'summary-panel-clones' },
    { id: 'rosters', label: 'Build menus', count: rosterChangeCount, panelId: 'summary-panel-rosters' },
    { id: 'disabled', label: 'Disabled', count: disabledUnitIds.length, panelId: 'summary-panel-disabled' }
  ];

  const runPendingReset = () => {
    const actions = {
      all: onResetAllChanges,
      tweaks: onResetAllUnitEdits,
      clones: onDeleteAllClones,
      rosters: onResetAllRosters,
      disabled: onRestoreAllUnits
    };
    actions[pendingReset]?.();
    setPendingReset(null);
  };

  const closeDialog = () => {
    setPendingReset(null);
    onClose();
  };

  const confirmation = pendingReset ? CONFIRMATION_COPY[pendingReset] : null;

  return (
    <Dialog
      open={open}
      onClose={closeDialog}
      className="summary-explorer-modal"
      overlayClassName="summary-explorer-overlay"
      labelledBy="summary-explorer-title"
      describedBy="summary-explorer-description"
    >
      <header className="summary-explorer-header">
        <div className="summary-explorer-header__copy">
          <span>Project ledger</span>
          <h2 id="summary-explorer-title">Mod Summary Explorer</h2>
          <p id="summary-explorer-description">Inspect every active editor change and return individual areas—or the whole project—to inherited defaults.</p>
        </div>
        <div className="summary-explorer-header__actions">
          <Button variant="danger" disabled={!hasChanges} onClick={() => setPendingReset('all')}>Reset all changes</Button>
          <IconButton label="Close Mod Summary Explorer" variant="quiet" onClick={closeDialog}>×</IconButton>
        </div>
      </header>

      <nav className="summary-explorer-overview" aria-label="Change categories">
        {tabs.map(item => (
          <button key={item.id} type="button" className={item.id === activeTab ? 'is-active' : ''} onClick={() => onTabChange(item.id)}>
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </button>
        ))}
      </nav>

      {confirmation && (
        <section className="summary-explorer-confirm" role="alertdialog" aria-labelledby="summary-reset-title" aria-describedby="summary-reset-description">
          <div>
            <span>{confirmation.eyebrow}</span>
            <strong id="summary-reset-title">{confirmation.title}</strong>
            <p id="summary-reset-description">{confirmation.description}</p>
          </div>
          <div>
            <Button variant="quiet" onClick={() => setPendingReset(null)}>Cancel</Button>
            <Button variant="danger" onClick={runPendingReset}>{confirmation.confirmLabel}</Button>
          </div>
        </section>
      )}

      <Tabs className="summary-explorer-tabs" items={tabs} value={activeTab} onChange={onTabChange} label="Summary category" />

      <div className="summary-explorer-body">
        {activeTab === 'tweaks' && (
          <ExplorerSection
            labelledBy="summary-panel-tweaks"
            title="Unit edits"
            description={`${editedUnitIds.length} units contain ${totalParameterOverrides} parameter overrides and ${Object.keys(unitDescriptions).length} custom descriptions.`}
            action={editedUnitIds.length > 0 ? <Button variant="danger" size="sm" onClick={() => setPendingReset('tweaks')}>Reset unit edits</Button> : null}
          >
            {editedUnitIds.length === 0 ? (
              <EmptyState title="No unit edits" description="Parameter overrides and custom descriptions will appear here." />
            ) : (
              <div className="summary-explorer-list">
                {editedUnitIds.map(unitId => {
                  const patchKeys = Object.keys(tweaks[unitId] || {});
                  const hasDescription = unitDescriptions[unitId] !== undefined;
                  const details = [
                    patchKeys.length > 0 ? `${patchKeys.length} parameter${patchKeys.length === 1 ? '' : 's'}: ${patchKeys.join(', ')}` : null,
                    hasDescription ? 'Custom description' : null
                  ].filter(Boolean).join(' · ');
                  return (
                    <ExplorerRow
                      key={unitId}
                      title={unitNames[unitId] || clones.find(clone => clone.newId.toLowerCase() === unitId.toLowerCase())?.displayName || unitId}
                      id={unitId}
                      meta={details}
                      badge={`${patchKeys.length + (hasDescription ? 1 : 0)} edits`}
                      actionLabel="Reset"
                      onAction={() => onResetUnitEdits(unitId)}
                    />
                  );
                })}
              </div>
            )}
          </ExplorerSection>
        )}

        {activeTab === 'clones' && (
          <ExplorerSection
            labelledBy="summary-panel-clones"
            title="Custom cloned units"
            description="Independent unit definitions created from an existing BAR chassis."
            action={clones.length > 0 ? <Button variant="danger" size="sm" onClick={() => setPendingReset('clones')}>Delete all clones</Button> : null}
          >
            {clones.length === 0 ? (
              <EmptyState title="No custom clones" description="Use Clone Unit in the header to create an independent unit definition." />
            ) : (
              <div className="summary-explorer-list">
                {clones.map(clone => (
                  <ExplorerRow
                    key={clone.newId}
                    title={clone.displayName || clone.newId}
                    id={clone.newId}
                    meta={`Cloned from ${unitNames[clone.baseId] || clone.baseId} · ${(clone.builderIds || []).length} builders assigned`}
                    badge="Custom unit"
                    actionLabel="Delete"
                    onAction={() => onDeleteClone(clone)}
                  />
                ))}
              </div>
            )}
          </ExplorerSection>
        )}

        {activeTab === 'rosters' && (
          <ExplorerSection
            labelledBy="summary-panel-rosters"
            title="Build menus and unit packs"
            description="Factory roster operations and optional BAR content packs active in this project."
            action={rosterChangeCount > 0 ? <Button variant="danger" size="sm" onClick={() => setPendingReset('rosters')}>Revert build menus</Button> : null}
          >
            {rosterChangeCount === 0 ? (
              <EmptyState title="No build-menu changes" description="Factory roster edits and optional unit packs will appear here." />
            ) : (
              <div className="summary-explorer-list">
                {enabledPacks.map(([packId]) => (
                  <ExplorerRow
                    key={packId}
                    title={packId === 'extraUnits' ? 'Extra Units Pack' : 'Scavenger Units Pack'}
                    meta="Optional BAR content pack enabled"
                    badge="Unit pack"
                    tone="accent"
                    actionLabel="Disable"
                    onAction={() => onDisableBuildMenuPack(packId)}
                  />
                ))}
                {buildMenuSteps.map(step => (
                  <ExplorerRow
                    key={step.builderId}
                    title={unitNames[step.builderId] || step.builderId}
                    id={step.builderId}
                    meta={`${step.add?.length || 0} added · ${step.remove?.length || 0} removed${step.order?.length ? ` · ${step.order.length} ordered` : ''}`}
                    badge="Factory roster"
                    actionLabel="Revert"
                    onAction={() => onRevertRoster(step.builderId)}
                  />
                ))}
              </div>
            )}
          </ExplorerSection>
        )}

        {activeTab === 'disabled' && (
          <ExplorerSection
            labelledBy="summary-panel-disabled"
            title="Disabled units"
            description="Units explicitly excluded from the generated project configuration."
            action={disabledUnitIds.length > 0 ? <Button variant="danger" size="sm" onClick={() => setPendingReset('disabled')}>Restore all units</Button> : null}
          >
            {disabledUnitIds.length === 0 ? (
              <EmptyState title="No disabled units" description="Units disabled from the editor header will appear here." />
            ) : (
              <div className="summary-explorer-list">
                {disabledUnitIds.map(unitId => (
                  <ExplorerRow
                    key={unitId}
                    title={unitNames[unitId] || unitId}
                    id={unitId}
                    meta="Excluded from generated unit definitions"
                    badge="Disabled"
                    actionLabel="Restore"
                    onAction={() => onRestoreUnit(unitId)}
                  />
                ))}
              </div>
            )}
          </ExplorerSection>
        )}
      </div>
    </Dialog>
  );
}
