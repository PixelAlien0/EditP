import OnlinePresenceBadge from './OnlinePresenceBadge.jsx';
import { CapabilityLabels } from './ui.jsx';
import { m, useReducedMotion } from 'motion/react';

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
  onCommunity,
  onLoadProject,
  onSaveProject,
}) {
  const reduceMotion = useReducedMotion();
  const hasWork = projectChangeCount > 0;
  const currentProjectName = projectName?.trim() || 'Untitled BAR project';
  const workspaces = [
    {
      id: 'edit', number: '01', eyebrow: 'Editor', title: 'Edit units',
      description: 'Unit stats, weapons, behavior, assets, and clones.',
      meta: hasWork ? `${projectChangeCount} changes` : 'No changes', capabilityId: 'workspace.edit', primary: true, onSelect: onEditUnits,
    },
    {
      id: 'build', number: '02', eyebrow: 'Production', title: 'Build menus',
      description: 'Factory and builder production rosters.',
      meta: rosterCount ? `${rosterCount} roster changes` : 'No roster changes', capabilityId: 'workspace.build-menus', onSelect: onBuildMenus,
    },
    {
      id: 'review', number: '03', eyebrow: 'Output', title: 'Review & export',
      description: 'Validation, Lua output, and lobby commands.',
      meta: hasWork ? 'Ready for review' : 'No changes to export', capabilityId: 'workspace.review', onSelect: onReviewExport,
    },
  ];
  const tools = [
    { id: 'community', code: 'COM', title: 'Community', description: 'Public creator projects', capabilityId: 'tool.community-gallery', onSelect: onCommunity },
    { id: 'collections', code: 'COL', title: 'Collections', description: 'Reusable unit sets', capabilityId: 'workspace.collections', onSelect: onCollections },
    { id: 'presets', code: 'PRE', title: 'Preset Gallery', description: 'Project snapshots', capabilityId: 'tool.preset-gallery', onSelect: onPresetGallery },
    { id: 'tweak-lab', code: 'LAB', title: 'Tweak Package Lab', description: 'Lua package analysis', capabilityId: 'tool.tweak-package-lab', onSelect: onTweakLab },
    { id: 'weapondefs', code: 'WDF', title: 'WeaponDef Library', description: 'Supporting definitions', capabilityId: 'tool.weapondef-library', onSelect: onWeaponDefLibrary },
    { id: 'reference', code: 'REF', title: 'BAR Reference Library', description: 'Verified game data', capabilityId: 'tool.reference-library', onSelect: onReferenceLibrary },
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

        <m.section
          className="main-menu__project-desk"
          aria-labelledby="main-menu-title"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <article className="main-menu__active-project" aria-labelledby="main-menu-project-title">
            <header>
              <div>
                <span>Current project</span>
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
              <span><small>Edit units</small><strong>{hasWork ? 'Continue editing' : 'Open editor'}</strong></span>
              <ArrowIcon />
            </button>
          </article>

          <aside className="main-menu__project-sidebar" aria-label="Project actions and status">
            <div className="main-menu__project-summary">
              <span>BAR Editor</span>
              <h1 id="main-menu-title">Bar EditP</h1>
              <p>Edit BAR units and export lobby-ready tweaks.</p>
            </div>

            <section className="main-menu__project-files" aria-labelledby="main-menu-files-title">
              <h2 id="main-menu-files-title">Project files</h2>
              <div className="main-menu__project-file-actions">
                <label>
                  <FileIcon direction="in" />
                  <span><strong>Load project</strong><small>Open JSON</small></span>
                  <input type="file" accept=".json" onChange={onLoadProject} />
                </label>
                <button type="button" onClick={onSaveProject}>
                  <FileIcon direction="out" />
                  <span><strong>Save project</strong><small>Download JSON</small></span>
                </button>
              </div>
            </section>

            <dl className="main-menu__system-status" aria-label="Editor status">
              <div><dt>BAR data</dt><dd>{gameDataStatus === 'ready' ? 'Validated' : gameDataStatus === 'error' ? 'Unavailable' : 'Checking'}</dd></div>
              <div><dt>Storage</dt><dd>Local</dd></div>
            </dl>
          </aside>
        </m.section>

        <m.section
          className="main-menu__launchpad"
          aria-labelledby="main-menu-directory-title"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: reduceMotion ? 0 : 0.04, ease: 'easeOut' }}
        >
          <header className="main-menu__launchpad-heading">
            <h2 id="main-menu-directory-title">Workspaces</h2>
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

          <section className="main-menu__tool-directory" aria-label="Research & package tools">
            <header><h3 id="main-menu-tools-title">Tools</h3></header>
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
        </m.section>
      </div>

      <footer className="main-menu__footer">
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
