import { useEffect, useRef, useState } from 'react';
import OnlinePresenceBadge from './OnlinePresenceBadge.jsx';
import { Button, ButtonGroup, CapabilityLabels, FileButton, IconButton } from './ui.jsx';

const HEADER_WORKSPACES = Object.freeze([
  { id: 'edit', step: '01', label: 'Edit Units' },
  { id: 'collections', step: '02', label: 'Collections' },
  { id: 'designer', step: '03', label: 'Build Menus' },
  { id: 'review', step: '04', label: 'Review & Export' },
]);

export default function AppHeader({
  activeWorkspace,
  themeMode,
  historyPastCount,
  historyFutureCount,
  presence,
  workflowProgress = {},
  unreadChatCount,
  validationIssueCount = 0,
  weaponLabEnabled = false,
  batchAdjustEnabled = false,
  mutatorToolsEnabled = false,
  onWorkspaceChange,
  onMainMenu,
  onToggleTheme,
  onUndo,
  onRedo,
  onCredits,
  onChat,
  onClone,
  onCommandPalette,
  onCheckpoints,
  onBatchAdjust,
  onCollections,
  onCarrierWorkbench,
  onPresetGallery,
  onWeaponLab,
  onTweakLab,
  onWeaponDefLibrary,
  onReferenceLibrary,
  onUpdateCenter,
  onCommunity,
  onExport,
  onImport,
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef(null);

  useEffect(() => {
    if (!toolsOpen) return undefined;

    const closeFromOutside = event => {
      if (!toolsRef.current?.contains(event.target)) setToolsOpen(false);
    };
    const closeFromKeyboard = event => {
      if (event.key !== 'Escape') return;
      setToolsOpen(false);
      toolsRef.current?.querySelector('.header-tools-trigger')?.focus();
    };

    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromKeyboard);
    toolsRef.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromKeyboard);
    };
  }, [toolsOpen]);

  const runToolAction = action => {
    setToolsOpen(false);
    action?.();
  };

  return (
    <header className="app-header">
      <div className="header-brand-group">
        <button type="button" className="header-brand" onClick={onMainMenu} title="Return to main menu">
          <img src="/logo.svg" alt="BAR Editor" className="app-logo" />
          <div className="brand-text">
            <span className="brand-kicker">Mod workspace</span>
            <h1>BAR Editor</h1>
          </div>
        </button>
        <OnlinePresenceBadge
          count={presence.count}
          status={presence.status}
          activityCounts={presence.activityCounts}
          currentActivity={presence.currentActivity}
          compact
        />
      </div>

      <nav className="workflow-nav" aria-label="Editor workflow">
        {HEADER_WORKSPACES.map(workspace => {
          const progress = workflowProgress[workspace.id]
            || (workspace.id === 'review' && validationIssueCount > 0 ? {
              value: validationIssueCount,
              label: `${validationIssueCount} validation ${validationIssueCount === 1 ? 'issue' : 'issues'}`,
              tone: 'needs-review',
            } : null);
          return (
            <button
              key={workspace.id}
              className={activeWorkspace === workspace.id ? 'active' : ''}
              aria-current={activeWorkspace === workspace.id ? 'page' : undefined}
              title={progress?.label}
              onClick={() => onWorkspaceChange(workspace.id)}
            >
              <span className="workflow-nav__step">{workspace.step}</span>
              <span className="workflow-nav__label">{workspace.label}</span>
              {progress && (
              <span
                  className={`workflow-nav__status ${progress.tone}`}
                  aria-label={progress.label}
              >
                  {progress.value}
              </span>
            )}
            </button>
          );
        })}
      </nav>

      <div className="header-actions header-utility-actions">
        <div className="header-control-cluster" role="group" aria-label="Navigation, appearance, and history">
          <Button
            variant="quiet"
            className="btn-action btn-secondary header-menu-action"
            onClick={onMainMenu}
            title="Return to main menu"
            aria-label="Return to main menu"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6.5 3.25 1.75 8l4.75 4.75" />
              <path d="M2.25 8h8.25a3.25 3.25 0 0 1 3.25 3.25v1" />
            </svg>
            <span className="header-menu-label">Main menu</span>
          </Button>
          <IconButton
            variant="quiet"
            size="sm"
            className="header-command-action"
            label="Open command palette"
            title="Open command palette (Ctrl+K)"
            onClick={onCommandPalette}
          >
            <svg viewBox="0 0 16 16">
              <circle cx="7" cy="7" r="4.25" />
              <path d="m10.25 10.25 3 3" />
            </svg>
          </IconButton>
          <Button
            variant="quiet"
            className="theme-toggle"
            aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
            aria-pressed={themeMode === 'dark'}
            onClick={onToggleTheme}
          >
            <svg className="theme-toggle-mark" viewBox="0 0 16 16" aria-hidden="true">
              {themeMode === 'dark' ? (
                <>
                  <circle cx="8" cy="8" r="2.75" />
                  <path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M12.6 3.4l-.9.9M4.3 11.7l-.9.9" />
                </>
              ) : (
                <path d="M11.75 10.9A5.25 5.25 0 0 1 5.1 4.25 5.25 5.25 0 1 0 11.75 10.9Z" />
              )}
            </svg>
            <span>{themeMode === 'dark' ? 'Light' : 'Dark'}</span>
          </Button>
          <ButtonGroup className="history-controls" label="Change history">
            <IconButton variant="quiet" size="sm" label="Undo" onClick={onUndo} disabled={historyPastCount === 0} title="Undo (Ctrl+Z)">
              <svg viewBox="0 0 16 16"><path d="M6 4 2.5 7.5 6 11" /><path d="M3 7.5h6a4 4 0 0 1 4 4" /></svg>
            </IconButton>
            <IconButton variant="quiet" size="sm" label="Redo" onClick={onRedo} disabled={historyFutureCount === 0} title="Redo (Ctrl+Y)">
              <svg viewBox="0 0 16 16"><path d="m10 4 3.5 3.5L10 11" /><path d="M13 7.5H7a4 4 0 0 0-4 4" /></svg>
            </IconButton>
          </ButtonGroup>
        </div>

        <div className="header-collaboration-actions" role="group" aria-label="Community and project information">
          <Button
            variant="quiet"
            className="btn-action btn-secondary header-credits-action"
            onClick={onCredits}
            title="Disclaimer, asset sources, and project credits"
          >
            <span className="header-credits-icon" aria-hidden="true">i</span>
            <span className="header-credits-label">Credits</span>
          </Button>
          <Button
            variant="quiet"
            className={`btn-action btn-secondary header-chat-action ${unreadChatCount > 0 ? 'has-unread' : ''}`}
            onClick={onChat}
            aria-haspopup="dialog"
            aria-label={unreadChatCount > 0
              ? `Open editor chat, ${unreadChatCount} unread message${unreadChatCount === 1 ? '' : 's'}`
              : 'Open editor chat'}
            title="Open temporary editor chat"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 3.25h10a1.5 1.5 0 0 1 1.5 1.5v5.5a1.5 1.5 0 0 1-1.5 1.5H8l-3.25 2v-2H3a1.5 1.5 0 0 1-1.5-1.5v-5.5A1.5 1.5 0 0 1 3 3.25Z" />
              <path d="M4.5 6.5h7M4.5 8.75h4.75" />
            </svg>
            <span className="header-chat-label">Chat</span>
            {unreadChatCount > 0 && (
              <span className="header-chat-unread" aria-hidden="true">
                {Math.min(unreadChatCount, 9)}{unreadChatCount > 9 ? '+' : ''}
              </span>
            )}
            <span className="ui-visually-hidden" role="status" aria-live="polite">
              {unreadChatCount > 0 ? `${unreadChatCount} unread chat message${unreadChatCount === 1 ? '' : 's'}` : 'No unread chat messages'}
            </span>
          </Button>
        </div>

        <Button
          variant="primary"
          className="btn-action header-create-action"
          aria-label="Create a clone of the selected unit"
          title="Create a clone of the selected unit"
          onClick={onClone}
        >
          <svg className="header-create-icon" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2.25" y="2.25" width="8.5" height="8.5" rx="1.25" />
            <path d="M5.25 5.25h7.5a1 1 0 0 1 1 1v7.5" />
            <path d="M10 11.5h4" />
            <path d="M12 9.5v4" />
          </svg>
          <span className="header-create-label">Clone unit</span>
        </Button>

        <div className="header-tools" ref={toolsRef}>
          <Button
            className="btn-action btn-secondary header-tools-trigger"
            aria-label="Tools"
            aria-haspopup="menu"
            aria-expanded={toolsOpen}
            aria-controls="header-tools-menu"
            onClick={() => setToolsOpen(open => !open)}
          >
            <svg className="header-action-icon" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 4.25h10M5.5 8h5M7 11.75h2" />
            </svg>
            <span>Tools</span>
            <svg className="header-tools-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m5 6.5 3 3 3-3" /></svg>
          </Button>
          {toolsOpen && (
            <div className="header-tools-menu" id="header-tools-menu" role="menu" aria-label="Editor tools">
              <div className="header-tools-menu__intro">
                <span className="header-tools-menu__eyebrow">Workbench</span>
                <strong>Editor tools</strong>
                <small>Utilities, saved states, and BAR references.</small>
              </div>
              <div className="header-tools-menu__group" aria-label="Quick access">
                <span className="header-tools-menu__group-label">Quick access</span>
                <button type="button" role="menuitem" onClick={() => runToolAction(onCommandPalette)}>
                  <span><span className="header-tool-title"><strong>Command Palette</strong><CapabilityLabels featureId="tool.command-palette" compact /></span><small>Search actions and workspaces</small></span><kbd>Ctrl K</kbd>
                </button>
                <button type="button" role="menuitem" onClick={() => runToolAction(onCheckpoints)}>
                  <span><span className="header-tool-title"><strong>Project Checkpoints</strong><CapabilityLabels featureId="tool.checkpoints" compact /></span><small>Save and restore named states</small></span>
                </button>
                <button type="button" role="menuitem" onClick={() => runToolAction(onCollections)}>
                  <span><span className="header-tool-title"><strong>Collections</strong><CapabilityLabels featureId="tool.collections" compact /></span><small>Organize reusable unit scopes</small></span>
                </button>
              </div>
              <div className="header-tools-menu__group" aria-label="Editing tools">
                <span className="header-tools-menu__group-label">Editing tools</span>
                <button type="button" role="menuitem" disabled={!batchAdjustEnabled} onClick={() => runToolAction(onBatchAdjust)}>
                  <span><span className="header-tool-title"><strong>Batch Adjust</strong><CapabilityLabels capabilityIds={batchAdjustEnabled ? ['development'] : ['locked']} compact /></span><small>{batchAdjustEnabled ? 'Preview and apply safe numeric edits across the active scope' : 'Temporarily unavailable while bulk editing is repaired'}</small></span>
                </button>
                <button type="button" role="menuitem" disabled={!mutatorToolsEnabled}>
                  <span><span className="header-tool-title"><strong>Formula Mutator</strong><CapabilityLabels capabilityIds={mutatorToolsEnabled ? ['experimental'] : ['locked']} compact /></span><small>Temporarily unavailable while formula evaluation is repaired</small></span>
                </button>
                <button type="button" role="menuitem" onClick={() => runToolAction(onCarrierWorkbench)}>
                  <span><span className="header-tool-title"><strong>Carrier &amp; Drone Studio</strong><CapabilityLabels featureId="tool.carrier-workbench" compact /></span><small>Configure a BAR carrier controller WeaponDef</small></span>
                </button>
                <button type="button" role="menuitem" onClick={() => runToolAction(onPresetGallery)}>
                  <span><span className="header-tool-title"><strong>Preset Gallery</strong><CapabilityLabels featureId="tool.preset-gallery" compact /></span><small>Apply or save project snapshots</small></span>
                </button>
                {weaponLabEnabled && (
                  <button type="button" role="menuitem" onClick={() => runToolAction(onWeaponLab)}>
                    <span><span className="header-tool-title"><strong>Weapon Lab</strong><CapabilityLabels capabilityIds={['development']} compact /></span><small>Develop custom weapon blueprints</small></span>
                  </button>
                )}
                <button type="button" role="menuitem" disabled={!mutatorToolsEnabled}>
                  <span><span className="header-tool-title"><strong>Mutation Lab</strong><CapabilityLabels capabilityIds={mutatorToolsEnabled ? ['experimental'] : ['locked']} compact /></span><small>Temporarily unavailable while mutation rules are repaired</small></span>
                </button>
              </div>
              <div className="header-tools-menu__group header-tools-menu__group--wide" aria-label="Package and reference tools">
                <span className="header-tools-menu__group-label">Packages &amp; references</span>
                <button type="button" role="menuitem" onClick={() => runToolAction(onCommunity)}>
                  <span><span className="header-tool-title"><strong>Community Projects</strong><CapabilityLabels featureId="tool.community-gallery" compact /></span><small>Browse public creator projects</small></span>
                </button>
                <button type="button" role="menuitem" onClick={() => runToolAction(onTweakLab)}>
                  <span><span className="header-tool-title"><strong>Tweak Package Lab</strong><CapabilityLabels featureId="tool.tweak-package-lab" compact /></span><small>Inspect community Lua safely</small></span>
                </button>
                <button type="button" role="menuitem" onClick={() => runToolAction(onWeaponDefLibrary)}>
                  <span><span className="header-tool-title"><strong>WeaponDef Library</strong><CapabilityLabels featureId="tool.weapondef-library" compact /></span><small>Create and validate supporting definitions</small></span>
                </button>
                <button type="button" role="menuitem" onClick={() => runToolAction(onReferenceLibrary)}>
                  <span><span className="header-tool-title"><strong>BAR Reference Library</strong><CapabilityLabels featureId="tool.reference-library" compact /></span><small>Search definitions and assets</small></span>
                </button>
                <button type="button" role="menuitem" onClick={() => runToolAction(onUpdateCenter)}>
                  <span><span className="header-tool-title"><strong>BAR Update Center</strong><CapabilityLabels featureId="tool.update-center" compact /></span><small>Review bundled snapshot changes</small></span>
                </button>
              </div>
              <div className="header-tools-menu-project-actions" role="group" aria-label="Project files">
                <button type="button" onClick={() => runToolAction(onExport)}>Save Project</button>
                <label>
                  Load Project
                  <input type="file" accept=".json" onChange={event => { setToolsOpen(false); onImport(event); }} />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="header-project-actions">
          <Button
            className="btn-action btn-secondary header-file-action"
            onClick={onExport}
            title="Download your configuration profile locally"
          >
            <svg className="header-action-icon" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 2.5h8.25L13.5 4.75v8.75h-11v-11Z" /><path d="M5 2.5v4h5v-4M5 13.5V9h6v4.5" />
            </svg>
            <span>Save Project</span>
          </Button>
          <FileButton className="btn-action btn-secondary header-file-action" title="Upload an exported .json config" accept=".json" onChange={onImport}>
            <svg className="header-action-icon" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 2.25v7.5M5.25 7 8 9.75 10.75 7" /><path d="M2.5 10.5v3h11v-3" />
            </svg>
            <span>Load Project</span>
          </FileButton>
        </div>
      </div>
    </header>
  );
}
