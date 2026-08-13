import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js';

export const COMMUNITY_PAGE_SIZE = 24;

const COMMUNITY_PROJECT_FIELDS = [
  'id',
  'title',
  'summary',
  'author_name',
  'tags',
  'compatibility_status',
  'snapshot_commit',
  'project_version',
  'metrics',
  'published_at',
  'updated_at',
  'download_count',
  'fork_count',
].join(',');

function sanitizeSearchTerm(value) {
  return String(value || '')
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

function normalizeProject(row) {
  return {
    id: row.id,
    title: row.title || 'Untitled community project',
    summary: row.summary || 'No project summary was provided.',
    authorName: row.author_name || 'Community creator',
    tags: Array.isArray(row.tags) ? row.tags.filter(Boolean).slice(0, 8) : [],
    compatibilityStatus: row.compatibility_status || 'review',
    snapshotCommit: row.snapshot_commit || '',
    projectVersion: row.project_version || '',
    metrics: row.metrics && typeof row.metrics === 'object' ? row.metrics : {},
    publishedAt: row.published_at || row.updated_at || '',
    updatedAt: row.updated_at || row.published_at || '',
    downloadCount: Number(row.download_count) || 0,
    forkCount: Number(row.fork_count) || 0,
  };
}

export async function listCommunityProjects({
  page = 1,
  pageSize = COMMUNITY_PAGE_SIZE,
  search = '',
  compatibility = 'all',
  sort = 'newest',
} = {}) {
  if (!isSupabaseConfigured) {
    return { projects: [], total: 0, configured: false };
  }

  const supabase = await getSupabaseClient();
  if (!supabase) return { projects: [], total: 0, configured: false };

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(48, Math.max(1, Number(pageSize) || COMMUNITY_PAGE_SIZE));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  const searchTerm = sanitizeSearchTerm(search);

  let request = supabase
    .from('community_projects')
    .select(COMMUNITY_PROJECT_FIELDS, { count: 'exact' })
    .eq('status', 'published');

  if (searchTerm) {
    request = request.or(`title.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%,author_name.ilike.%${searchTerm}%`);
  }
  if (compatibility !== 'all') request = request.eq('compatibility_status', compatibility);

  if (sort === 'popular') {
    request = request.order('download_count', { ascending: false }).order('published_at', { ascending: false });
  } else if (sort === 'updated') {
    request = request.order('updated_at', { ascending: false });
  } else {
    request = request.order('published_at', { ascending: false });
  }

  const { data, error, count } = await request.range(from, to);
  if (error) throw new Error(error.message || 'The community gallery could not be loaded.');

  return {
    projects: (data || []).map(normalizeProject),
    total: count || 0,
    configured: true,
  };
}
