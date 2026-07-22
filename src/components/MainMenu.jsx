import OnlinePresenceBadge from './OnlinePresenceBadge.jsx';

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
  onToggleTheme,
  onOpenCredits,
  onEditUnits,
  onBuildMenus,
  onReviewExport,
  onCollections,
  onPresetGallery,
  onTweakLab,
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
      meta: hasWork ? `${projectChangeCount} tracked changes` : 'Start here', primary: true, onSelect: onEditUnits,
    },
    {
      id: 'build', number: '02', eyebrow: 'Production', title: 'Build menus',
      description: 'Compose factory rosters and place custom units into production.',
      meta: rosterCount ? `${rosterCount} roster changes` : 'Roster designer', onSelect: onBuildMenus,
    },
    {
      id: 'review', number: '03', eyebrow: 'Delivery', title: 'Review & export',
      description: 'Run compatibility preflight and prepare numbered lobby commands.',
      meta: hasWork ? 'Preflight project' : 'Inspect output', onSelect: onReviewExport,
    },
  ];
  const tools = [
    { id: 'collections', code: 'COL', title: 'Collections', description: 'Organize reusable unit scopes.', onSelect: onCollections },
    { id: 'presets', code: 'PRE', title: 'Preset Gallery', description: 'Save and apply project snapshots.', onSelect: onPresetGallery },
    { id: 'tweak-lab', code: 'LAB', title: 'Tweak Package Lab', description: 'Inspect community Lua safely.', onSelect: onTweakLab },
    { id: 'reference', code: 'REF', title: 'BAR Reference Library', description: 'Search definitions and assets.', onSelect: onReferenceLibrary },
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
              <span aria-hidden="true">{themeMode === 'dark' ? '☼' : '◐'}</span>
              {themeMode === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button type="button" onClick={onOpenCredits}>Credits</button>
          </div>
        </div>
      </header>

      <div className="main-menu__frame">
        <section className="main-menu__project-desk" aria-labelledby="main-menu-title">
          <div className="main-menu__identity">
            <span className="main-menu__kicker">編集工房 · Definition workshop</span>
            <h1 id="main-menu-title"><span>Bar</span> <em>EditP</em></h1>
            <p>Tweak and create your own BAR units in one focused local workspace.</p>
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
            <button type="button" className="main-menu__enter" onClick={onEditUnits}>
              <span><small>{hasWork ? 'Resume editing' : 'Open editor'}</small><strong>{hasWork ? 'Continue workshop' : 'Enter workshop'}</strong></span>
              <ArrowIcon />
            </button>
          </article>

          <section className="main-menu__project-files" aria-labelledby="main-menu-files-title">
            <div>
              <span>Project files</span>
              <h2 id="main-menu-files-title">Save or continue elsewhere</h2>
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
                  <small>{item.eyebrow}</small>
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
                  <span><strong>{tool.title}</strong><small>{tool.description}</small></span>
                  <b aria-hidden="true">↗</b>
                </button>
              ))}
            </div>
          </section>
        </section>
      </div>

      <footer className="main-menu__footer">
        <span>Maintained by <strong>[Grump]SunlessK</strong></span>
        <span>Local project session · BAR definitions loaded</span>
      </footer>
    </main>
  );
}
