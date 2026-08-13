import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Callout,
  Dialog,
  EmptyState,
  PageShell,
  Spinner,
  Type,
} from './ui.jsx';
import {
  COMMUNITY_PAGE_SIZE,
  deleteCommunityProject,
  getCommunitySession,
  listCommunityProjects,
  openCommunityProjectCopy,
  publishCommunityProject,
  reportCommunityProject,
  requestCommunitySignIn,
  signOutCommunity,
  subscribeCommunityAuth,
} from '../services/communityGallery.js';
import '../styles/features/community-gallery.css';

const COMPATIBILITY_OPTIONS = Object.freeze([
  { value: 'all', label: 'All compatibility' },
  { value: 'compatible', label: 'Current snapshot' },
  { value: 'review', label: 'Review advised' },
  { value: 'outdated', label: 'Older snapshot' },
  { value: 'experimental', label: 'Experimental' },
]);

const STATUS_PRESENTATION = Object.freeze({
  compatible: { label: 'Current snapshot', tone: 'success' },
  review: { label: 'Review advised', tone: 'warning' },
  outdated: { label: 'Older snapshot', tone: 'neutral' },
  experimental: { label: 'Experimental', tone: 'info' },
});

const REPORT_REASONS = Object.freeze([
  { value: 'broken', label: 'Broken or unusable project' },
  { value: 'unsafe', label: 'Unsafe or misleading setup' },
  { value: 'misleading', label: 'Misleading title or description' },
  { value: 'copyright', label: 'Copyright or attribution concern' },
  { value: 'other', label: 'Other policy concern' },
]);

function getStatus(project) {
  return STATUS_PRESENTATION[project.compatibilityStatus] || STATUS_PRESENTATION.review;
}

function getMetric(metrics, ...keys) {
  for (const key of keys) {
    const value = Number(metrics?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function getProjectMetrics(document) {
  return {
    unitEdits: Object.keys(document?.tweaks || {}).length,
    clones: Array.isArray(document?.clones) ? document.clones.length : 0,
    rosterEdits: Array.isArray(document?.buildMenuSteps) ? document.buildMenuSteps.length : 0,
  };
}

function CommunityDialog({ children, className = '', labelledBy, describedBy, onClose, role }) {
  return (
    <Dialog
      className={`community-gallery-dialog ${className}`.trim()}
      labelledBy={labelledBy}
      describedBy={describedBy}
      onClose={onClose}
      role={role}
    >
      {children}
    </Dialog>
  );
}

export default function CommunityGalleryPage({
  onBack,
  currentProject,
  currentSnapshot,
  onOpenCopy,
  onNotice,
  loadProjects = listCommunityProjects,
  getSession = getCommunitySession,
  subscribeAuth = subscribeCommunityAuth,
  requestSignIn = requestCommunitySignIn,
  signOut = signOutCommunity,
  publishProject = publishCommunityProject,
  openProjectCopy = openCommunityProjectCopy,
  deleteProject = deleteCommunityProject,
  reportProject = reportCommunityProject,
}) {
  const [queryDraft, setQueryDraft] = useState('');
  const [query, setQuery] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [tag, setTag] = useState('');
  const [compatibility, setCompatibility] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState([]);
  const [total, setTotal] = useState(0);
  const [configured, setConfigured] = useState(true);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [user, setUser] = useState(null);
  const [authConfigured, setAuthConfigured] = useState(true);
  const [dialog, setDialog] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [reportReason, setReportReason] = useState('broken');
  const [publishDraft, setPublishDraft] = useState({ title: '', summary: '', authorName: '', tags: '', compatibilityStatus: 'compatible' });
  const requestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => undefined;
    void getSession()
      .then(result => {
        if (!active) return;
        setUser(result.user);
        setAuthConfigured(result.configured);
      })
      .catch(() => {
        if (active) setAuthConfigured(false);
      });
    void subscribeAuth(nextUser => {
      if (active) setUser(nextUser);
    }).then(cleanup => { unsubscribe = cleanup; }).catch(() => undefined);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [getSession, subscribeAuth]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setStatus('loading');
    setError('');
    void loadProjects({ page, pageSize: COMMUNITY_PAGE_SIZE, search: query, tag, compatibility, sort })
      .then(result => {
        if (requestId !== requestIdRef.current) return;
        setProjects(result.projects);
        setTotal(result.total);
        setConfigured(result.configured);
        setStatus('ready');
        setSelectedId(current => result.projects.some(project => project.id === current)
          ? current
          : (result.projects[0]?.id || ''));
      })
      .catch(loadError => {
        if (requestId !== requestIdRef.current) return;
        setProjects([]);
        setTotal(0);
        setError(loadError instanceof Error ? loadError.message : 'The community gallery could not be loaded.');
        setStatus('error');
      });
  }, [compatibility, loadProjects, page, query, reloadToken, sort, tag]);

  const pageCount = Math.max(1, Math.ceil(total / COMMUNITY_PAGE_SIZE));
  const selectedProject = useMemo(
    () => projects.find(project => project.id === selectedId) || null,
    [projects, selectedId]
  );
  const isOwner = Boolean(user?.id && selectedProject?.ownerId === user.id);

  const updateFilter = setter => event => {
    setter(event.target.value);
    setPage(1);
  };

  const submitSearch = event => {
    event.preventDefault();
    setPage(1);
    setQuery(queryDraft.trim());
    setTag(tagDraft.trim().toLowerCase());
  };

  const clearFilters = () => {
    setQueryDraft('');
    setQuery('');
    setTagDraft('');
    setTag('');
    setCompatibility('all');
    setSort('newest');
    setPage(1);
  };

  const selectTag = nextTag => {
    setTagDraft(nextTag);
    setTag(nextTag);
    setPage(1);
  };

  const closeDialog = () => {
    if (busyAction) return;
    setDialog('');
    setActionError('');
  };

  const openPublish = () => {
    setActionError('');
    if (!user) {
      setDialog('auth');
      return;
    }
    setPublishDraft({
      title: currentProject?.projectName || 'BAR Editor project',
      summary: currentProject?.projectDesc || '',
      authorName: currentProject?.projectAuthor || '',
      tags: '',
      compatibilityStatus: 'compatible',
    });
    setDialog('publish');
  };

  const handleSignIn = async event => {
    event.preventDefault();
    setBusyAction('auth');
    setActionError('');
    try {
      await requestSignIn(email);
      setNotice('Check your email to finish signing in.');
      setDialog('');
    } catch (signInError) {
      setActionError(signInError instanceof Error ? signInError.message : 'Could not send the sign-in email.');
    } finally {
      setBusyAction('');
    }
  };

  const handlePublish = async event => {
    event.preventDefault();
    setBusyAction('publish');
    setActionError('');
    try {
      const published = await publishProject({
        user,
        ...publishDraft,
        snapshotCommit: currentSnapshot?.sourceCommit || '',
        projectVersion: currentProject?.version || '',
        metrics: getProjectMetrics(currentProject),
        document: currentProject,
      });
      setDialog('');
      setPage(1);
      setSelectedId(published.id);
      setReloadToken(current => current + 1);
      setNotice('Project published without raw Lua or external links.');
      onNotice?.('Community project published.');
    } catch (publishError) {
      setActionError(publishError instanceof Error ? publishError.message : 'The project could not be published.');
    } finally {
      setBusyAction('');
    }
  };

  const handleOpenCopy = async () => {
    if (!selectedProject) return;
    setBusyAction('copy');
    setActionError('');
    try {
      const copy = await openProjectCopy(selectedProject.id);
      onOpenCopy?.(copy.document, copy.title);
    } catch (copyError) {
      setActionError(copyError instanceof Error ? copyError.message : 'The project copy could not be opened.');
    } finally {
      setBusyAction('');
    }
  };

  const handleDelete = async () => {
    if (!selectedProject) return;
    setBusyAction('delete');
    setActionError('');
    try {
      await deleteProject(selectedProject.id, user);
      setDialog('');
      setSelectedId('');
      setReloadToken(current => current + 1);
      setNotice('Your published project was deleted.');
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'The project could not be deleted.');
    } finally {
      setBusyAction('');
    }
  };

  const handleReport = async event => {
    event.preventDefault();
    if (!selectedProject) return;
    setBusyAction('report');
    setActionError('');
    try {
      await reportProject(selectedProject.id, reportReason, user);
      setDialog('');
      setNotice('Report submitted for review.');
    } catch (reportError) {
      setActionError(reportError instanceof Error ? reportError.message : 'The report could not be submitted.');
    } finally {
      setBusyAction('');
    }
  };

  const requestReport = () => {
    setActionError('');
    if (!user) {
      setDialog('auth');
      return;
    }
    setReportReason('broken');
    setDialog('report');
  };

  return (
    <>
      <PageShell
        className="community-gallery-page"
        label="Community gallery"
        eyebrow="Community workshop"
        title="Community projects"
        description="Browse sanitized project copies shared by BAR Editor creators. Publishing requires an account; browsing does not."
        capabilityId="tool.community-gallery"
        metrics={[
          { label: 'Published projects', value: total.toLocaleString() },
          { label: 'Page', value: `${page} / ${pageCount}` },
        ]}
        actions={(
          <div className="community-gallery-header-actions">
            {user ? (
              <Button variant="quiet" onClick={() => void signOut().catch(signOutError => setNotice(signOutError.message))}>Sign out</Button>
            ) : (
              <Button variant="quiet" onClick={() => setDialog('auth')}>Sign in</Button>
            )}
            <Button variant="primary" disabled={!currentProject || !authConfigured} onClick={openPublish}>Publish project</Button>
            <Button onClick={onBack}>Back to editor</Button>
          </div>
        )}
        toolbar={(
          <form className="community-gallery-toolbar" role="search" onSubmit={submitSearch}>
            <label className="community-gallery-search">
              <span>Search projects</span>
              <input type="search" value={queryDraft} onChange={event => setQueryDraft(event.target.value)} placeholder="Project, creator, or description" maxLength={80} />
            </label>
            <label>
              <span>Tag</span>
              <input value={tagDraft} onChange={event => setTagDraft(event.target.value)} placeholder="e.g. balance" maxLength={24} />
            </label>
            <Button variant="primary" type="submit">Search</Button>
            <label>
              <span>Compatibility</span>
              <select value={compatibility} onChange={updateFilter(setCompatibility)}>
                {COMPATIBILITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select value={sort} onChange={updateFilter(setSort)}>
                <option value="newest">Newest</option>
                <option value="updated">Recently updated</option>
                <option value="popular">Most opened</option>
              </select>
            </label>
            {(query || tag || compatibility !== 'all' || sort !== 'newest') && <Button variant="quiet" onClick={clearFilters}>Reset</Button>}
          </form>
        )}
        bodyClassName="community-gallery-page__body"
      >
        {notice && <Callout className="community-gallery-notice" tone="success" title="Community gallery">{notice}</Callout>}
        {!configured ? (
          <EmptyState
            className="community-gallery-state"
            title="Community gallery is not connected"
            description="Add the Supabase environment variables and run the included community-gallery.sql setup before deploying this page."
            action={<Button onClick={onBack}>Return to editor</Button>}
          />
        ) : status === 'loading' ? (
          <div className="community-gallery-state" role="status"><Spinner label="Loading community projects" /><strong>Loading community projects</strong><span>Reading one page of published metadata.</span></div>
        ) : status === 'error' ? (
          <Callout className="community-gallery-error" tone="danger" title="Community projects are unavailable" actions={<Button size="sm" onClick={() => setReloadToken(current => current + 1)}>Try again</Button>}>{error}</Callout>
        ) : projects.length === 0 ? (
          <EmptyState
            className="community-gallery-state"
            title={query || tag || compatibility !== 'all' ? 'No projects match these filters' : 'No projects have been published yet'}
            description={query || tag || compatibility !== 'all' ? 'Reset the filters or try a broader search.' : 'Sign in to publish the first sanitized project copy.'}
            action={(query || tag || compatibility !== 'all') ? <Button onClick={clearFilters}>Clear filters</Button> : <Button variant="primary" onClick={openPublish}>Publish project</Button>}
          />
        ) : (
          <div className="community-gallery-workbench">
            <section className="community-gallery-results" aria-labelledby="community-results-title">
              <header><div><Type variant="eyebrow">Published library</Type><Type as="h3" variant="section-title" id="community-results-title">Browse projects</Type></div><span aria-live="polite">{total.toLocaleString()} {total === 1 ? 'project' : 'projects'}</span></header>
              <div className="community-project-grid">
                {projects.map(project => {
                  const projectStatus = getStatus(project);
                  const unitEdits = getMetric(project.metrics, 'unitEdits', 'unit_edits', 'tweaks');
                  const clones = getMetric(project.metrics, 'clones');
                  const rosterEdits = getMetric(project.metrics, 'rosterEdits', 'roster_edits', 'buildMenus', 'build_menus');
                  return (
                    <article className={`community-project-card ${project.id === selectedId ? 'is-selected' : ''}`} key={project.id}>
                      <header><div><Type variant="eyebrow">Community project</Type><Type as="h4" variant="subsection-title">{project.title}</Type></div><Badge tone={projectStatus.tone} size="sm">{projectStatus.label}</Badge></header>
                      <p>{project.summary}</p>
                      <div className="community-project-tags" aria-label="Project tags">
                        {project.tags.slice(0, 3).map(projectTag => <button type="button" key={projectTag} onClick={() => selectTag(projectTag)}>#{projectTag}</button>)}
                      </div>
                      <dl aria-label={`${project.title} contents`}><div><dt>Unit edits</dt><dd>{unitEdits}</dd></div><div><dt>Clones</dt><dd>{clones}</dd></div><div><dt>Rosters</dt><dd>{rosterEdits}</dd></div></dl>
                      <footer><span>By <strong>{project.authorName}</strong></span><Button size="sm" variant={project.id === selectedId ? 'primary' : 'secondary'} aria-pressed={project.id === selectedId} onClick={() => setSelectedId(project.id)}>View details</Button></footer>
                    </article>
                  );
                })}
              </div>
              <nav className="community-gallery-pagination" aria-label="Community project pages"><Button disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</Button><span>Page <strong>{page}</strong> of <strong>{pageCount}</strong></span><Button disabled={page >= pageCount} onClick={() => setPage(current => Math.min(pageCount, current + 1))}>Next</Button></nav>
            </section>

            <aside className="community-project-details" aria-live="polite">
              {selectedProject && (() => {
                const projectStatus = getStatus(selectedProject);
                return (
                  <>
                    <header><Type variant="eyebrow">Project dossier</Type><Type as="h3" variant="section-title">{selectedProject.title}</Type><span>Published {formatDate(selectedProject.publishedAt)}</span></header>
                    <Badge tone={projectStatus.tone}>{projectStatus.label}</Badge>
                    <p>{selectedProject.summary}</p>
                    <dl><div><dt>Creator</dt><dd>{selectedProject.authorName}</dd></div><div><dt>Project format</dt><dd>{selectedProject.projectVersion || 'Not supplied'}</dd></div><div><dt>BAR snapshot</dt><dd>{selectedProject.snapshotCommit ? selectedProject.snapshotCommit.slice(0, 12) : 'Not supplied'}</dd></div><div><dt>Opened as copies</dt><dd>{selectedProject.forkCount.toLocaleString()}</dd></div></dl>
                    <div className="community-project-details__tags">{selectedProject.tags.length > 0 ? selectedProject.tags.map(projectTag => <button type="button" key={projectTag} onClick={() => selectTag(projectTag)}>#{projectTag}</button>) : <span>Untagged project</span>}</div>
                    {actionError && !dialog && <Callout tone="danger" title="Action unavailable">{actionError}</Callout>}
                    <div className="community-project-details__actions">
                      <Button variant="primary" loading={busyAction === 'copy'} disabled={!selectedProject.hasProjectCopy} onClick={handleOpenCopy}>Open as copy</Button>
                      <Button onClick={requestReport}>Report project</Button>
                      {isOwner && <Button variant="danger" onClick={() => { setActionError(''); setDialog('delete'); }}>Delete your project</Button>}
                    </div>
                    <Callout title="Sanitized project copy" tone="info">Opens as an independent local copy. Comments, external links, imported raw Lua, and lobby command payloads are never published.</Callout>
                  </>
                );
              })()}
            </aside>
          </div>
        )}
      </PageShell>

      {dialog === 'auth' && (
        <CommunityDialog labelledBy="community-auth-title" describedBy="community-auth-description" onClose={closeDialog}>
          <form onSubmit={handleSignIn}>
            <header><Type variant="eyebrow">Community account</Type><Type as="h2" variant="section-title" id="community-auth-title">Sign in to contribute</Type><p id="community-auth-description">Publishing, reporting, and owner deletion require an account. A secure sign-in link will be sent to your email.</p></header>
            <div className="community-gallery-dialog__body"><label><span>Email address</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>{actionError && <Callout tone="danger" title="Sign-in failed">{actionError}</Callout>}</div>
            <footer><Button onClick={closeDialog}>Cancel</Button><Button variant="primary" type="submit" loading={busyAction === 'auth'}>Send sign-in link</Button></footer>
          </form>
        </CommunityDialog>
      )}

      {dialog === 'publish' && (
        <CommunityDialog className="community-gallery-dialog--publish" labelledBy="community-publish-title" describedBy="community-publish-description" onClose={closeDialog}>
          <form onSubmit={handlePublish}>
            <header><Type variant="eyebrow">Publish safe copy</Type><Type as="h2" variant="section-title" id="community-publish-title">Share this project</Type><p id="community-publish-description">Only structured editor data is shared. Raw Lua, lobby imports, links, and comments are excluded.</p></header>
            <div className="community-gallery-dialog__body community-gallery-publish-grid">
              <label><span>Project title</span><input value={publishDraft.title} onChange={event => setPublishDraft(current => ({ ...current, title: event.target.value }))} minLength={3} maxLength={80} required /></label>
              <label><span>Creator name</span><input value={publishDraft.authorName} onChange={event => setPublishDraft(current => ({ ...current, authorName: event.target.value }))} minLength={2} maxLength={48} required /></label>
              <label className="is-wide"><span>Summary</span><textarea value={publishDraft.summary} onChange={event => setPublishDraft(current => ({ ...current, summary: event.target.value }))} minLength={12} maxLength={500} required /></label>
              <label><span>Tags, comma separated</span><input value={publishDraft.tags} onChange={event => setPublishDraft(current => ({ ...current, tags: event.target.value }))} placeholder="balance, armada, experimental" /></label>
              <label><span>Compatibility</span><select value={publishDraft.compatibilityStatus} onChange={event => setPublishDraft(current => ({ ...current, compatibilityStatus: event.target.value }))}>{COMPATIBILITY_OPTIONS.slice(1).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              {actionError && <Callout className="is-wide" tone="danger" title="Cannot publish">{actionError}</Callout>}
            </div>
            <footer><Button onClick={closeDialog}>Cancel</Button><Button variant="primary" type="submit" loading={busyAction === 'publish'}>Publish sanitized copy</Button></footer>
          </form>
        </CommunityDialog>
      )}

      {dialog === 'report' && selectedProject && (
        <CommunityDialog labelledBy="community-report-title" describedBy="community-report-description" onClose={closeDialog}>
          <form onSubmit={handleReport}>
            <header><Type variant="eyebrow">Community safety</Type><Type as="h2" variant="section-title" id="community-report-title">Report project</Type><p id="community-report-description">Choose the closest reason. Reports do not include a public comment or message.</p></header>
            <div className="community-gallery-dialog__body"><label><span>Reason</span><select value={reportReason} onChange={event => setReportReason(event.target.value)}>{REPORT_REASONS.map(reason => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label>{actionError && <Callout tone="danger" title="Report failed">{actionError}</Callout>}</div>
            <footer><Button onClick={closeDialog}>Cancel</Button><Button variant="primary" type="submit" loading={busyAction === 'report'}>Submit report</Button></footer>
          </form>
        </CommunityDialog>
      )}

      {dialog === 'delete' && selectedProject && (
        <CommunityDialog className="community-gallery-dialog--confirm" labelledBy="community-delete-title" describedBy="community-delete-description" onClose={closeDialog} role="alertdialog">
          <div>
            <header><Type variant="eyebrow">Owner action</Type><Type as="h2" variant="section-title" id="community-delete-title">Delete published project?</Type><p id="community-delete-description">This removes “{selectedProject.title}” from the public gallery. Your local editor project is not changed.</p></header>
            <div className="community-gallery-dialog__body">{actionError && <Callout tone="danger" title="Delete failed">{actionError}</Callout>}</div>
            <footer><Button onClick={closeDialog}>Keep project</Button><Button variant="danger" loading={busyAction === 'delete'} onClick={handleDelete}>Delete project</Button></footer>
          </div>
        </CommunityDialog>
      )}
    </>
  );
}
