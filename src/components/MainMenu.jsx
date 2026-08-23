import OnlinePresenceBadge from './OnlinePresenceBadge.jsx';
import MainMenuAtmosphere from './MainMenuAtmosphere.jsx';
import { CapabilityLabels } from './ui.jsx';
import { m } from 'motion/react';
import { MOTION_DELAY, MOTION_STAGGER, MOTION_TRANSITION, MOTION_VARIANTS } from './ui/motionConfig.js';

const ArrowIcon = () => (
  <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 9h11" /><path d="m10.5 5 4 4-4 4" /></svg>
);

const MotionArrow = () => (
  <m.span className="main-menu__motion-arrow" variants={MOTION_VARIANTS.directional} aria-hidden="true">
    <ArrowIcon />
  </m.span>
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
    { id: 'ai-audit', code: 'AI', title: 'AI Package Audit', description: 'Skirmish AI compatibility', capabilityId: 'tool.ai-package-audit', onSelect: onAiAudit },
    { id: 'weapondefs', code: 'WDF', title: 'WeaponDef Library', description: 'Supporting definitions', capabilityId: 'tool.weapondef-library', onSelect: onWeaponDefLibrary },
    { id: 'reference', code: 'REF', title: 'BAR Reference Library', description: 'Verified game data', capabilityId: 'tool.reference-library', onSelect: onReferenceLibrary },
    { id: 'updates', code: 'UPD', title: 'BAR Update Center', description: 'Snapshot change report', capabilityId: 'tool.update-center', onSelect: onUpdateCenter },
  ];

  const projectLedger = [
    { label: 'Definitions', value: unitCount.toLocaleString(), note: 'BAR records available' },
    { label: 'Clones', value: cloneCount, note: 'Custom units' },
    { label: 'Rosters', value: rosterCount, note: 'Edited producers' },
  ];

  return (
    <m.main
      className="main-menu"
      variants={MOTION_VARIANTS.fade}
      initial="hidden"
      animate="visible"
      transition={MOTION_TRANSITION.enter}
    >
      <m.header
        className="main-menu__topbar"
        variants={MOTION_VARIANTS.topbar}
        initial="hidden"
        animate="visible"
        transition={MOTION_TRANSITION.enter}
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
      </m.header>

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
          variants={MOTION_VARIANTS.surface}
          initial="hidden"
          animate="visible"
          transition={MOTION_TRANSITION.enter}
        >
          <aside className="main-menu__studio-intro" aria-labelledby="main-menu-title">
            <MainMenuAtmosphere themeMode={themeMode} />
            <div className="main-menu__project-summary">
              <span>Definition workspace</span>
              <h1 id="main-menu-title">Bar EditP</h1>
              <p>A focused workshop for shaping BAR units, production rosters, and lobby-ready projects.</p>
            </div>

            <dl className="main-menu__system-status" aria-label="Editor status">
              <div><dt>BAR data</dt><dd>{gameDataStatus === 'ready' ? 'Validated' : gameDataStatus === 'error' ? 'Unavailable' : 'Checking'}</dd></div>
              <div><dt>Storage</dt><dd>Local-first</dd></div>
            </dl>

            <section className="main-menu__project-files" aria-labelledby="main-menu-files-title">
              <h2 id="main-menu-files-title">Project files</h2>
              <div className="main-menu__project-file-actions">
                <m.label variants={MOTION_VARIANTS.interactiveCard} initial="rest" whileHover="hover" whileTap="tap">
                  <FileIcon direction="in" />
                  <span><strong>Load project</strong><small>Open a saved JSON workspace</small></span>
                  <input type="file" accept=".json" onChange={onLoadProject} />
                </m.label>
                <m.button type="button" onClick={onSaveProject} variants={MOTION_VARIANTS.interactiveCard} initial="rest" whileHover="hover" whileTap="tap">
                  <FileIcon direction="out" />
                  <span><strong>Save project</strong><small>Download the current workspace</small></span>
                </m.button>
              </div>
            </section>
          </aside>

          <article className="main-menu__active-project" aria-labelledby="main-menu-project-title">
            <header>
              <div>
                <span>Active local project</span>
                <h2 id="main-menu-project-title">{currentProjectName}</h2>
              </div>
              <small className={hasWork ? 'is-active' : ''}><i aria-hidden="true" />{hasWork ? 'In progress' : 'Ready'}</small>
            </header>
            <div className="main-menu__project-overview">
              <m.div
                className="main-menu__project-pulse"
                variants={MOTION_VARIANTS.metricItem}
                initial="hidden"
                animate="visible"
                transition={MOTION_TRANSITION.feedback}
              >
                <span>Project activity</span>
                <div className="main-menu__project-pulse-value">
                  <strong>{projectChangeCount.toLocaleString()}</strong>
                  <p>{hasWork ? 'Tracked changes' : 'No pending changes'}</p>
                </div>
                <small>{hasWork ? 'Continue editing or review the current output.' : 'The workspace is ready for a new edit.'}</small>
              </m.div>
              <div className="main-menu__project-inventory">
                <div className="main-menu__project-inventory-heading">
                  <span>Project inventory</span>
                  <small>Local snapshot</small>
                </div>
                <m.dl
                  className="main-menu__project-ledger"
                  variants={MOTION_VARIANTS.staggerGroup}
                  initial="hidden"
                  animate="visible"
                  transition={{ delayChildren: MOTION_DELAY.relatedSection, staggerChildren: MOTION_STAGGER.standard }}
                  aria-label="Current project inventory"
                >
                  {projectLedger.map(({ label, value, note }) => (
                    <m.div key={label} variants={MOTION_VARIANTS.metricItem} transition={MOTION_TRANSITION.feedback}>
                      <span><dt>{label}</dt><small>{note}</small></span>
                      <dd>{value}</dd>
                    </m.div>
                  ))}
                </m.dl>
              </div>
            </div>
            <footer className="main-menu__project-footer">
              <div className="main-menu__project-context">
                <div><span>Workspace state</span><strong>{hasWork ? 'Working draft' : 'Clean workspace'}</strong></div>
                <div><span>Definition source</span><strong>{gameDataSnapshot?.sourceCommit ? `BAR ${gameDataSnapshot.sourceCommit.slice(0, 8)}` : 'Bundled snapshot'}</strong></div>
              </div>
              <button
                type="button"
                className="main-menu__enter"
                onClick={onEditUnits}
              >
                <span><small>Enter workspace</small><strong>{hasWork ? 'Continue editing' : 'Open editor'}</strong></span>
                <MotionArrow />
              </button>
            </footer>
          </article>
        </m.section>

        <m.section
          className="main-menu__launchpad"
          aria-label="Project workspaces and tools"
          variants={MOTION_VARIANTS.surface}
          initial="hidden"
          animate="visible"
          transition={{ ...MOTION_TRANSITION.enter, delay: MOTION_DELAY.relatedSection }}
        >
          <m.nav
            className="main-menu__workspaces"
            variants={MOTION_VARIANTS.staggerGroup}
            initial="hidden"
            animate="visible"
            transition={{ delayChildren: MOTION_DELAY.relatedSection, staggerChildren: MOTION_STAGGER.standard }}
            aria-label="Core workspaces"
          >
            {workspaces.map(item => (
              <m.button
                key={item.id}
                type="button"
                className={item.primary ? 'is-primary' : ''}
                onClick={item.onSelect}
                variants={MOTION_VARIANTS.interactiveSurface}
                transition={MOTION_TRANSITION.enter}
                whileHover="hover"
                whileTap="tap"
              >
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
                <MotionArrow />
              </m.button>
            ))}
          </m.nav>

          <section className="main-menu__tool-directory" aria-label="Research & package tools">
            <m.div
              variants={MOTION_VARIANTS.staggerGroup}
              initial="hidden"
              animate="visible"
              transition={{ delayChildren: MOTION_DELAY.relatedSection, staggerChildren: MOTION_STAGGER.tight }}
            >
              {tools.map(tool => (
                <m.button
                  type="button"
                  key={tool.id}
                  onClick={tool.onSelect}
                  variants={MOTION_VARIANTS.interactiveSurface}
                  transition={MOTION_TRANSITION.enter}
                  whileHover="hover"
                  whileTap="tap"
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
                </m.button>
              ))}
            </m.div>
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
    </m.main>
  );
}
