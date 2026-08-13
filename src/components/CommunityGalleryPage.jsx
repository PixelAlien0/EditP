import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Callout,
  EmptyState,
  PageShell,
  Spinner,
  Type,
} from './ui.jsx';
import { COMMUNITY_PAGE_SIZE, listCommunityProjects } from '../services/communityGallery.js';
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

export default function CommunityGalleryPage({ onBack, loadProjects = listCommunityProjects }) {
  const [queryDraft, setQueryDraft] = useState('');
  const [query, setQuery] = useState('');
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
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setStatus('loading');
    setError('');

    void loadProjects({ page, pageSize: COMMUNITY_PAGE_SIZE, search: query, compatibility, sort })
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
  }, [compatibility, loadProjects, page, query, reloadToken, sort]);

  const pageCount = Math.max(1, Math.ceil(total / COMMUNITY_PAGE_SIZE));
  const selectedProject = useMemo(
    () => projects.find(project => project.id === selectedId) || null,
    [projects, selectedId]
  );

  const updateFilter = setter => event => {
    setter(event.target.value);
    setPage(1);
  };

  const submitSearch = event => {
    event.preventDefault();
    setPage(1);
    setQuery(queryDraft.trim());
  };

  const clearFilters = () => {
    setQueryDraft('');
    setQuery('');
    setCompatibility('all');
    setSort('newest');
    setPage(1);
  };

  return (
    <PageShell
      className="community-gallery-page"
      label="Community gallery"
      eyebrow="Community workshop"
      title="Community projects"
      description="Browse projects shared by BAR Editor creators. Published entries are shown as read-only references in this first release."
      capabilityIds={['read-only']}
      metrics={[
        { label: 'Published projects', value: total.toLocaleString() },
        { label: 'Page', value: `${page} / ${pageCount}` },
      ]}
      actions={<Button onClick={onBack}>Back to editor</Button>}
      toolbar={(
        <form className="community-gallery-toolbar" role="search" onSubmit={submitSearch}>
          <label className="community-gallery-search">
            <span>Search projects</span>
            <input
              type="search"
              value={queryDraft}
              onChange={event => setQueryDraft(event.target.value)}
              placeholder="Project, creator, or description"
              maxLength={80}
            />
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
              <option value="popular">Most downloaded</option>
            </select>
          </label>
          {(query || compatibility !== 'all' || sort !== 'newest') && (
            <Button variant="quiet" onClick={clearFilters}>Reset</Button>
          )}
        </form>
      )}
      bodyClassName="community-gallery-page__body"
    >
      {!configured ? (
        <EmptyState
          className="community-gallery-state"
          title="Community gallery is not connected"
          description="Add the Supabase environment variables and run the included community-gallery.sql setup before deploying this page."
          action={<Button onClick={onBack}>Return to editor</Button>}
        />
      ) : status === 'loading' ? (
        <div className="community-gallery-state" role="status">
          <Spinner label="Loading community projects" />
          <strong>Loading community projects</strong>
          <span>Reading the latest published metadata.</span>
        </div>
      ) : status === 'error' ? (
        <Callout
          className="community-gallery-error"
          tone="danger"
          title="Community projects are unavailable"
          actions={<Button size="sm" onClick={() => setReloadToken(current => current + 1)}>Try again</Button>}
        >{error}</Callout>
      ) : projects.length === 0 ? (
        <EmptyState
          className="community-gallery-state"
          title={query || compatibility !== 'all' ? 'No projects match these filters' : 'No projects have been published yet'}
          description={query || compatibility !== 'all'
            ? 'Reset the filters or try a broader project or creator name.'
            : 'The gallery is ready. Published community projects will appear here without requiring an editor update.'}
          action={(query || compatibility !== 'all') ? <Button onClick={clearFilters}>Clear filters</Button> : null}
        />
      ) : (
        <div className="community-gallery-workbench">
          <section className="community-gallery-results" aria-labelledby="community-results-title">
            <header>
              <div>
                <Type variant="eyebrow">Published library</Type>
                <Type as="h3" variant="section-title" id="community-results-title">Browse projects</Type>
              </div>
              <span aria-live="polite">{total.toLocaleString()} {total === 1 ? 'project' : 'projects'}</span>
            </header>

            <div className="community-project-grid">
              {projects.map(project => {
                const projectStatus = getStatus(project);
                const unitEdits = getMetric(project.metrics, 'unitEdits', 'unit_edits', 'tweaks');
                const clones = getMetric(project.metrics, 'clones');
                const rosterEdits = getMetric(project.metrics, 'rosterEdits', 'roster_edits', 'buildMenus', 'build_menus');
                return (
                  <article className={`community-project-card ${project.id === selectedId ? 'is-selected' : ''}`} key={project.id}>
                    <header>
                      <div>
                        <Type variant="eyebrow">Community project</Type>
                        <Type as="h4" variant="subsection-title">{project.title}</Type>
                      </div>
                      <Badge tone={projectStatus.tone} size="sm">{projectStatus.label}</Badge>
                    </header>
                    <p>{project.summary}</p>
                    <div className="community-project-tags" aria-label="Project tags">
                      {project.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}
                    </div>
                    <dl aria-label={`${project.title} contents`}>
                      <div><dt>Unit edits</dt><dd>{unitEdits}</dd></div>
                      <div><dt>Clones</dt><dd>{clones}</dd></div>
                      <div><dt>Rosters</dt><dd>{rosterEdits}</dd></div>
                    </dl>
                    <footer>
                      <span>By <strong>{project.authorName}</strong></span>
                      <Button
                        size="sm"
                        variant={project.id === selectedId ? 'primary' : 'secondary'}
                        aria-pressed={project.id === selectedId}
                        onClick={() => setSelectedId(project.id)}
                      >View details</Button>
                    </footer>
                  </article>
                );
              })}
            </div>

            <nav className="community-gallery-pagination" aria-label="Community project pages">
              <Button disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</Button>
              <span>Page <strong>{page}</strong> of <strong>{pageCount}</strong></span>
              <Button disabled={page >= pageCount} onClick={() => setPage(current => Math.min(pageCount, current + 1))}>Next</Button>
            </nav>
          </section>

          <aside className="community-project-details" aria-live="polite">
            {selectedProject && (() => {
              const projectStatus = getStatus(selectedProject);
              return (
                <>
                  <header>
                    <Type variant="eyebrow">Project dossier</Type>
                    <Type as="h3" variant="section-title">{selectedProject.title}</Type>
                    <span>Published {formatDate(selectedProject.publishedAt)}</span>
                  </header>
                  <Badge tone={projectStatus.tone}>{projectStatus.label}</Badge>
                  <p>{selectedProject.summary}</p>
                  <dl>
                    <div><dt>Creator</dt><dd>{selectedProject.authorName}</dd></div>
                    <div><dt>Project format</dt><dd>{selectedProject.projectVersion || 'Not supplied'}</dd></div>
                    <div><dt>BAR snapshot</dt><dd>{selectedProject.snapshotCommit ? selectedProject.snapshotCommit.slice(0, 12) : 'Not supplied'}</dd></div>
                    <div><dt>Downloads</dt><dd>{selectedProject.downloadCount.toLocaleString()}</dd></div>
                    <div><dt>Forks</dt><dd>{selectedProject.forkCount.toLocaleString()}</dd></div>
                  </dl>
                  <div className="community-project-details__tags">
                    {selectedProject.tags.length > 0
                      ? selectedProject.tags.map(tag => <span key={tag}>{tag}</span>)
                      : <span>Untagged project</span>}
                  </div>
                  <Callout title="Read-only preview" tone="info">
                    Opening a safe project copy will arrive with the publishing and import phase. This page does not change your current editor state.
                  </Callout>
                </>
              );
            })()}
          </aside>
        </div>
      )}
    </PageShell>
  );
}
