import { useRef } from 'react';
import OnlinePresenceBadge from './OnlinePresenceBadge.jsx';
import MainMenuAtmosphere from './MainMenuAtmosphere.jsx';
import MainMenuProjectSignal from './MainMenuProjectSignal.jsx';
import { CapabilityLabels } from './ui.jsx';
import useMainMenuGsap from '../hooks/useMainMenuGsap.js';

const ArrowIcon = () => (
  <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 9h11" /><path d="m10.5 5 4 4-4 4" /></svg>
);

const MotionArrow = () => (
  <span className="main-menu__motion-arrow" aria-hidden="true">
    <ArrowIcon />
  </span>
);

const EditorialLine = ({ children }) => (
  <span className="main-menu__editorial-mask">
    <span data-gsap-editorial-line>{children}</span>
  </span>
);

const FileIcon = ({ direction = 'in' }) => (
  <svg viewBox="0 0 18 18" aria-hidden="true">
    <path d="M4 3.5h6l4 4v7H4z" /><path d="M10 3.5v4h4" />
    {direction === 'in' ? <><path d="M9 9v5" /><path d="m6.75 11.75 2.25 2.25 2.25-2.25" /></> : <><path d="M9 14V9" /><path d="m6.75 11.25 2.25-2.25 2.25 2.25" /></>}
  </svg>
);

export default function MainMenu({
  themeMode,
  unitCount,
  projectName,
  projectChangeCount,
  cloneCount,
  rosterCount,
  presenceCount,
  presenceStatus,
  presenceActivityCounts,
  currentPresenceActivity,
  gameDataStatus,
  gameDataError,
  gameDataSnapshot,
  onToggleTheme,
  onOpenCredits,
  onEditUnits,
  onBuildMenus,
  onReviewExport,
  onCollections,
  onPresetGallery,
  onTweakLab,
  onAiAudit,
  onWeaponDefLibrary,
  onReferenceLibrary,
  onUpdateCenter,
  onCommunity,
  onLoadProject,
  onSaveProject,
}) {
  const mainMenuRef = useRef(null);
  const navigateWithMotion = useMainMenuGsap(mainMenuRef);
  const hasWork = projectChangeCount > 0;
  const currentProjectName = projectName?.trim() || 'Untitled BAR project';
  const workspaces = [
    {
      id: 'edit', number: '01', eyebrow: 'Editor', title: 'Edit units',
      description: 'Unit stats, weapons, behavior, assets, and clones.',
      focusDetail: `${unitCount.toLocaleString()} definitions · ${cloneCount} custom clones`,
      meta: hasWork ? `${projectChangeCount} changes` : 'No changes', capabilityId: 'workspace.edit', primary: true, onSelect: onEditUnits,
    },
    {
      id: 'build', number: '02', eyebrow: 'Production', title: 'Build menus',
      description: 'Factory and builder production rosters.',
      focusDetail: `${rosterCount} edited producers · ordered output`,
      meta: rosterCount ? `${rosterCount} roster changes` : 'No roster changes', capabilityId: 'workspace.build-menus', onSelect: onBuildMenus,
    },
    {
      id: 'review', number: '03', eyebrow: 'Output', title: 'Review & export',
      description: 'Validation, Lua output, and lobby commands.',
      focusDetail: `${projectChangeCount} tracked edits · compatibility preflight`,
      meta: hasWork ? 'Ready for review' : 'No changes to export', capabilityId: 'workspace.review', onSelect: onReviewExport,
    },
  ];
  const tools = [
    { id: 'community', code: 'COM', title: 'Community', description: 'Public creator projects', capabilityId: 'tool.community-gallery', onSelect: onCommunity },
    { id: 'collections', code: 'COL', title: 'Collections', description: 'Reusable unit sets', capabilityId: 'workspace.collections', onSelect: onCollections },
    { id: 'presets', code: 'PRE', title: 'Preset Gallery', description: 'Project snapshots', capabilityId: 'tool.preset-gallery', onSelect: onPresetGallery },
    { id: 'tweak-lab', code: 'LAB', title: 'Tweak Package Lab', description: 'Lua package analysis', capabilityId: 'tool.tweak-package-lab', onSelect: onTweakLab },
    { id: 'ai-audit', code: 'AI', title: 'AI Package Audit', description: 'Skirmish AI compatibility', capabilityId: 'tool.ai-package-audit', onSelect: onAiAudit },
    { id: 'weapondefs', code: 'WDF', title: 'WeaponDef Library', description: 'Supporting definitions', capabilityId: 'tool.weapondef-library', onSelect: onWeaponDefLibrary },
    { id: 'reference', code: 'REF', title: 'BAR Reference Library', description: 'Verified game data', capabilityId: 'tool.reference-library', onSelect: onReferenceLibrary },
    { id: 'updates', code: 'UPD', title: 'BAR Update Center', description: 'Snapshot change report', capabilityId: 'tool.update-center', onSelect: onUpdateCenter },
  ];

  const projectLedger = [
    { label: 'Definitions', value: unitCount.toLocaleString(), note: 'BAR records available', signalId: null },
    { label: 'Clones', value: cloneCount, note: 'Custom units', signalId: 'clones' },
    { label: 'Rosters', value: rosterCount, note: 'Edited producers', signalId: 'rosters' },
  ];

  return (
    <main ref={mainMenuRef} className="main-menu is-gsap-preparing">
      <header
        className="main-menu__topbar"
        data-gsap-reveal="topbar"
      >
        <div className="main-menu__topbar-inner">
          <div className="main-menu__brand">
            <img src="/logo.svg" alt="" />
            <div>
              <span>Mod workspace</span>
              <strong>Bar EditP</strong>
            </div>
          </div>
          <div className="main-menu__utilities">
            <OnlinePresenceBadge
              count={presenceCount}
              status={presenceStatus}
              activityCounts={presenceActivityCounts}
              currentActivity={currentPresenceActivity}
            />
            <button type="button" onClick={onToggleTheme} aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}>
              {themeMode === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button type="button" onClick={onOpenCredits}>Credits</button>
          </div>
        </div>
      </header>

      <div className="main-menu__frame">
        {gameDataStatus === 'error' && (
          <aside className="main-menu__data-warning" role="alert">
            <span>Snapshot check failed</span>
            <div>
              <strong>BAR definitions are unavailable</strong>
              <p>{gameDataError || 'The bundled game data could not be validated. Reload the deployed editor or restore the last validated build.'}</p>
            </div>
          </aside>
        )}

        <section
          className="main-menu__project-desk"
          aria-labelledby="main-menu-title"
          data-gsap-reveal="project"
        >
          <span className="main-menu__desk-seam" data-gsap-desk-seam aria-hidden="true" />
          <aside className="main-menu__studio-intro" aria-labelledby="main-menu-title" data-gsap-project-panel>
            <MainMenuAtmosphere themeMode={themeMode} />
            <div className="main-menu__project-summary">
              <span>Definition workspace · local-first</span>
              <h1 id="main-menu-title"><EditorialLine>Bar EditP</EditorialLine></h1>
              <p>A focused workshop for shaping BAR units, production rosters, and lobby-ready projects.</p>
            </div>

            <dl className="main-menu__system-status" aria-label="Editor status">
              <div><dt>BAR data</dt><dd>{gameDataStatus === 'ready' ? 'Validated' : gameDataStatus === 'error' ? 'Unavailable' : 'Checking'}</dd></div>
              <div><dt>Storage</dt><dd>Local-first</dd></div>
            </dl>

            <section className="main-menu__project-files" aria-labelledby="main-menu-files-title">
              <div className="main-menu__project-files-heading">
                <h2 id="main-menu-files-title">Project files</h2>
                <span>JSON workspace</span>
              </div>
              <div className="main-menu__project-file-actions">
                <label data-gsap-interactive data-gsap-file-action>
                  <FileIcon direction="in" />
                  <span><strong>Load project</strong><small>Open a saved JSON workspace</small></span>
                  <input type="file" accept=".json" onChange={onLoadProject} />
                </label>
                <button type="button" onClick={onSaveProject} data-gsap-interactive data-gsap-file-action>
                  <FileIcon direction="out" />
                  <span><strong>Save project</strong><small>Download the current workspace</small></span>
                </button>
              </div>
            </section>
          </aside>

          <article className="main-menu__active-project" aria-labelledby="main-menu-project-title" data-gsap-project-panel>
            <MainMenuProjectSignal changes={projectChangeCount} clones={cloneCount} rosters={rosterCount} />
            <header>
              <div>
                <span>Active local project</span>
                <h2 id="main-menu-project-title"><EditorialLine>{currentProjectName}</EditorialLine></h2>
              </div>
              <div className="main-menu__project-state">
                <span>{gameDataSnapshot?.sourceCommit ? `BAR ${gameDataSnapshot.sourceCommit.slice(0, 8)}` : 'Bundled snapshot'}</span>
                <small className={hasWork ? 'is-active' : ''}><i aria-hidden="true" />{hasWork ? 'In progress' : 'Ready'}</small>
              </div>
            </header>
            <div className="main-menu__project-overview">
              <div
                className="main-menu__project-pulse"
                data-gsap-metric
                data-project-signal-source="changes"
              >
                <span>Project activity</span>
                <div className="main-menu__project-pulse-value">
                  <strong data-gsap-count={projectChangeCount} aria-label={`${projectChangeCount} tracked changes`}>{projectChangeCount.toLocaleString()}</strong>
                  <p>{hasWork ? 'Changes held in the current draft' : 'No pending changes'}</p>
                </div>
                <small>{hasWork ? 'Your local project state is ready to continue, compare, or validate.' : 'The workspace is ready for a new edit.'}</small>
              </div>
              <div className="main-menu__project-inventory">
                <dl
                  className="main-menu__project-ledger"
                  aria-label="Current project inventory"
                >
                  {projectLedger.map(({ label, value, note, signalId }) => {
                    const numericValue = Number(String(value).replaceAll(',', ''));
                    return (
                    <div key={label} data-gsap-metric data-project-signal-source={signalId || undefined}>
                      <span><dt>{label}</dt><small>{note}</small></span>
                      <dd data-gsap-count={numericValue} aria-label={`${value} ${label.toLowerCase()}`}>{value}</dd>
                    </div>
                    );
                  })}
                </dl>
              </div>
            </div>
            <footer className="main-menu__project-footer">
              <div className="main-menu__project-context">
                <div><span>Workspace state</span><strong>{hasWork ? 'Working draft' : 'Clean workspace'}</strong></div>
                <div><span>Next step</span><strong>{hasWork ? 'Continue or run preflight' : 'Choose a unit to begin'}</strong></div>
              </div>
              <button
                type="button"
                className="main-menu__enter"
                data-gsap-interactive
                data-gsap-project-action
                onClick={event => navigateWithMotion(onEditUnits, event.currentTarget)}
              >
                <span><small>Enter workspace</small><strong>{hasWork ? 'Continue editing' : 'Open editor'}</strong></span>
                <MotionArrow />
              </button>
            </footer>
          </article>
        </section>

        <section
          className="main-menu__launchpad"
          aria-label="Project workspaces and tools"
          data-gsap-reveal="launchpad"
        >
          <nav
            className="main-menu__workspaces"
            aria-label="Core workspaces"
          >
            {workspaces.map(item => (
              <button
                key={item.id}
                type="button"
                className={item.primary ? 'is-primary' : ''}
                data-gsap-workspace
                data-gsap-interactive
                onClick={event => navigateWithMotion(item.onSelect, event.currentTarget)}
              >
                <span className="main-menu__workspace-number">{item.number}</span>
                <span className="main-menu__workspace-copy">
                  <span className="main-menu__workspace-capabilities">
                    <small>{item.eyebrow}</small>
                    <CapabilityLabels featureId={item.capabilityId} compact />
                  </span>
                  <strong><EditorialLine>{item.title}</EditorialLine></strong>
                  <p>{item.description}</p>
                  <small className="main-menu__workspace-detail" data-gsap-workspace-detail>{item.focusDetail}</small>
                </span>
                <span className="main-menu__workspace-meta">{item.meta}</span>
                <MotionArrow />
              </button>
            ))}
          </nav>

          <section className="main-menu__tool-directory" aria-label="Research & package tools">
            <div>
              {tools.map(tool => (
                <button
                  type="button"
                  key={tool.id}
                  data-gsap-tool
                  data-gsap-interactive
                  onClick={event => navigateWithMotion(tool.onSelect, event.currentTarget)}
                >
                  <span>{tool.code}</span>
                  <span>
                    <span className="main-menu__tool-title">
                      <strong>{tool.title}</strong>
                      <CapabilityLabels featureId={tool.capabilityId} compact />
                    </span>
                    <small>{tool.description}</small>
                  </span>
                  <MotionArrow />
                </button>
              ))}
            </div>
          </section>
        </section>
      </div>

      <footer className="main-menu__footer" data-gsap-reveal="footer">
        <span>Maintained by <strong>[Grump]SunlessK</strong></span>
        <span>
          {gameDataStatus === 'ready'
            ? `BAR snapshot ${gameDataSnapshot?.sourceCommit?.slice(0, 12) || 'validated'}`
            : gameDataStatus === 'error'
              ? 'BAR snapshot unavailable'
              : 'Validating BAR definitions'}
        </span>
      </footer>
    </main>
  );
}
