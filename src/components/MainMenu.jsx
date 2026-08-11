import OnlinePresenceBadge from './OnlinePresenceBadge.jsx';
import { CapabilityLabels } from './ui.jsx';

const ArrowIcon = () => (
  <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 9h11" /><path d="m10.5 5 4 4-4 4" /></svg>
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
  onWeaponDefLibrary,
  onReferenceLibrary,
  onLoadProject,
  onSaveProject,
}) {
  const hasWork = projectChangeCount > 0;
  const currentProjectName = projectName?.trim() || 'Untitled BAR project';
  const workspaces = [
    {
      id: 'edit', number: '01', eyebrow: 'Core workspace', title: 'Edit units',
      description: 'Tune definitions, weapons, behavior, assets, and clone identity.',
      meta: hasWork ? `${projectChangeCount} tracked changes` : 'Start here', capabilityId: 'workspace.edit', primary: true, onSelect: onEditUnits,
    },
    {
      id: 'build', number: '02', eyebrow: 'Production', title: 'Build menus',
      description: 'Compose factory rosters and place custom units into production.',
      meta: rosterCount ? `${rosterCount} roster changes` : 'Roster designer', capabilityId: 'workspace.build-menus', onSelect: onBuildMenus,
    },
    {
      id: 'review', number: '03', eyebrow: 'Delivery', title: 'Review & export',
      description: 'Run compatibility preflight and prepare numbered lobby commands.',
      meta: hasWork ? 'Preflight project' : 'Inspect output', capabilityId: 'workspace.review', onSelect: onReviewExport,
    },
  ];
  const tools = [
    { id: 'collections', code: 'COL', title: 'Collections', description: 'Organize reusable unit scopes.', capabilityId: 'workspace.collections', onSelect: onCollections },
    { id: 'presets', code: 'PRE', title: 'Preset Gallery', description: 'Save and apply project snapshots.', capabilityId: 'tool.preset-gallery', onSelect: onPresetGallery },
    { id: 'tweak-lab', code: 'LAB', title: 'Tweak Package Lab', description: 'Inspect community Lua safely.', capabilityId: 'tool.tweak-package-lab', onSelect: onTweakLab },
    { id: 'weapondefs', code: 'WDF', title: 'WeaponDef Library', description: 'Build supporting weapon definitions.', capabilityId: 'tool.weapondef-library', onSelect: onWeaponDefLibrary },
    { id: 'reference', code: 'REF', title: 'BAR Reference Library', description: 'Search definitions and assets.', capabilityId: 'tool.reference-library', onSelect: onReferenceLibrary },
  ];

  return (
    <main className="main-menu">
      <header className="main-menu__topbar">
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
        <section className="main-menu__project-desk" aria-labelledby="main-menu-title">
          <div className="main-menu__desk-intro">
            <div className="main-menu__identity">
              <span className="main-menu__kicker">編集工房 · Definition workshop</span>
              <h1 id="main-menu-title"><span>Bar</span> <em>EditP</em></h1>
              <p>Tweak and create your own BAR units in one focused local workspace.</p>
              <dl className="main-menu__identity-meta" aria-label="Editor environment">
                <div><dt>Workspace</dt><dd>Local-first</dd></div>
                <div><dt>BAR data</dt><dd>{gameDataStatus === 'ready' ? 'Validated' : gameDataStatus === 'error' ? 'Unavailable' : 'Checking'}</dd></div>
              </dl>
            </div>

            <section className="main-menu__project-files" aria-labelledby="main-menu-files-title">
              <div>
                <span>Project files</span>
                <h2 id="main-menu-files-title">Continue on another machine</h2>
              </div>
              <div>
                <label>
                  <FileIcon direction="in" />
                  <span><strong>Load project</strong><small>Open an exported JSON workspace</small></span>
                  <input type="file" accept=".json" onChange={onLoadProject} />
                </label>
                <button type="button" onClick={onSaveProject}>
                  <FileIcon direction="out" />
                  <span><strong>Save project</strong><small>Download the current editable state</small></span>
                </button>
              </div>
            </section>
          </div>

          <article className="main-menu__active-project" aria-labelledby="main-menu-project-title">
            <header>
              <div>
                <span>{hasWork ? 'Active local project' : 'New local session'}</span>
                <h2 id="main-menu-project-title">{currentProjectName}</h2>
              </div>
              <small className={hasWork ? 'is-active' : ''}><i aria-hidden="true" />{hasWork ? 'In progress' : 'Ready'}</small>
            </header>
            <dl aria-label="Current project status">
              <div><dt>Definitions</dt><dd>{unitCount.toLocaleString()}</dd></div>
              <div><dt>Changes</dt><dd>{projectChangeCount}</dd></div>
              <div><dt>Clones</dt><dd>{cloneCount}</dd></div>
              <div><dt>Rosters</dt><dd>{rosterCount}</dd></div>
            </dl>
            <div className="main-menu__project-brief">
              <div>
                <span>Current state</span>
                <strong>{hasWork ? `${projectChangeCount} tracked ${projectChangeCount === 1 ? 'change' : 'changes'} in this project` : 'Clean workspace ready for a new edit'}</strong>
              </div>
              <div>
                <span>Definition source</span>
                <strong>{gameDataStatus === 'ready' ? `BAR snapshot ${gameDataSnapshot?.sourceCommit?.slice(0, 8) || 'validated'}` : 'Waiting for validated BAR data'}</strong>
              </div>
            </div>
            <button type="button" className="main-menu__enter" onClick={onEditUnits}>
              <span><small>{hasWork ? 'Resume editing' : 'Open editor'}</small><strong>{hasWork ? 'Continue workshop' : 'Enter workshop'}</strong></span>
              <ArrowIcon />
            </button>
          </article>
        </section>

        <section className="main-menu__launchpad" aria-labelledby="main-menu-directory-title">
          <header className="main-menu__launchpad-heading">
            <div>
              <span>Main menu</span>
              <h2 id="main-menu-directory-title">Workshop directory</h2>
              <p>Move between editing, production setup, and delivery without losing project state.</p>
            </div>
            <small>Local-first</small>
          </header>

          <nav className="main-menu__workspaces" aria-label="Core workspaces">
            {workspaces.map(item => (
              <button key={item.id} type="button" className={item.primary ? 'is-primary' : ''} onClick={item.onSelect}>
                <span className="main-menu__workspace-number">{item.number}</span>
                <span className="main-menu__workspace-copy">
                  <span className="main-menu__workspace-capabilities">
                    <small>{item.eyebrow}</small>
                    <CapabilityLabels featureId={item.capabilityId} compact />
                  </span>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </span>
                <span className="main-menu__workspace-meta">{item.meta}</span>
                <ArrowIcon />
              </button>
            ))}
          </nav>

          <section className="main-menu__tool-directory" aria-labelledby="main-menu-tools-title">
            <header>
              <div><span>Specialist workbenches</span><h3 id="main-menu-tools-title">Research &amp; package tools</h3></div>
              <small>Advanced</small>
            </header>
            <div>
              {tools.map(tool => (
                <button type="button" key={tool.id} onClick={tool.onSelect}>
                  <span>{tool.code}</span>
                  <span>
                    <span className="main-menu__tool-title">
                      <strong>{tool.title}</strong>
                      <CapabilityLabels featureId={tool.capabilityId} compact />
                    </span>
                    <small>{tool.description}</small>
                  </span>
                  <ArrowIcon />
                </button>
              ))}
            </div>
          </section>
        </section>
      </div>

      <footer className="main-menu__footer">
        <span>Maintained by <strong>[Grump]SunlessK</strong></span>
        <span>
          Local project session · {
            gameDataStatus === 'ready'
              ? `BAR snapshot ${gameDataSnapshot?.sourceCommit?.slice(0, 12) || 'validated'}`
              : gameDataStatus === 'error'
                ? 'BAR snapshot unavailable'
                : 'Validating BAR definitions'
          }
        </span>
      </footer>
    </main>
  );
}
