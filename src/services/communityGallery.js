import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js';

export const COMMUNITY_PAGE_SIZE = 24;
export const COMMUNITY_MAX_PROJECT_BYTES = 1024 * 1024;

const COMMUNITY_PROJECT_FIELDS = [
  'id',
  'owner_id',
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
  'has_project_copy',
].join(',');

const URL_PATTERN = /(?:https?:\/\/|www\.)/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TAG_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s-]{0,23}$/u;
const REPORT_REASONS = new Set(['broken', 'unsafe', 'misleading', 'copyright', 'other']);
const COMPATIBILITY_STATUSES = new Set(['compatible', 'review', 'outdated', 'experimental']);
const PUBLIC_PROJECT_FIELDS = new Set([
  'version', 'tweaks', 'clones', 'disabledUnitIds', 'buildMenuSteps', 'buildMenuPacks',
  'unitDescriptions', 'weaponLibrary', 'supportingWeaponDefs', 'unitCollections',
  'tweakModules', 'lobbySetup', 'projectName', 'projectAuthor', 'projectDesc',
  'includeTweaks', 'includeClones', 'includeRosters', 'includeHeader',
  'exportOptimizationProfile',
]);

function sanitizeSearchTerm(value) {
  return String(value || '')
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

function normalizeTag(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 24);
}

function normalizeProject(row) {
  return {
    id: row.id,
    ownerId: row.owner_id || '',
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
    hasProjectCopy: Boolean(row.has_project_copy),
  };
}

function communityError(error, fallback) {
  if (error?.code === '23505') return new Error('You already reported this project.');
  if (error?.code === '42501') return new Error('Your account is not allowed to perform this action.');
  return new Error(error?.message || fallback);
}

export function normalizeCommunityTags(tags) {
  return [...new Set((Array.isArray(tags) ? tags : String(tags || '').split(','))
    .map(normalizeTag)
    .filter(tag => TAG_PATTERN.test(tag)))]
    .slice(0, 8);
}

export function sanitizeCommunityProjectDocument(document) {
  const sanitized = Object.fromEntries(Object.entries(structuredClone(document || {}))
    .filter(([key]) => PUBLIC_PROJECT_FIELDS.has(key)));
  sanitized.tweakModules = [];
  sanitized.lobbySetup = {
    version: 1,
    sourceName: '',
    importedAt: '',
    commands: [],
    slotClears: [],
    slotResetFields: [],
    requirements: [],
    ignoredLineCount: 0,
    overwrittenCount: 0,
  };
  return sanitized;
}

export function validateCommunityPublication({ title, summary, authorName, tags, document }) {
  const safeTitle = String(title || '').trim();
  const safeSummary = String(summary || '').trim();
  const safeAuthor = String(authorName || '').trim();
  const safeTags = normalizeCommunityTags(tags);
  const errors = [];

  if (safeTitle.length < 3 || safeTitle.length > 80) errors.push('Project title must contain 3 to 80 characters.');
  if (safeSummary.length < 12 || safeSummary.length > 500) errors.push('Summary must contain 12 to 500 characters.');
  if (safeAuthor.length < 2 || safeAuthor.length > 48) errors.push('Creator name must contain 2 to 48 characters.');
  if ([safeTitle, safeSummary, safeAuthor, ...safeTags].some(value => URL_PATTERN.test(value))) errors.push('External links are not permitted.');

  const sanitizedDocument = sanitizeCommunityProjectDocument(document);
  const serialized = JSON.stringify(sanitizedDocument);
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (URL_PATTERN.test(serialized)) errors.push('Remove external links from the project before publishing.');
  if (bytes > COMMUNITY_MAX_PROJECT_BYTES) errors.push('The safe project copy exceeds the 1 MB publication limit.');

  return {
    valid: errors.length === 0,
    errors,
    values: {
      title: safeTitle,
      summary: safeSummary,
      authorName: safeAuthor,
      tags: safeTags,
      document: sanitizedDocument,
      bytes,
    },
  };
}

export async function getCommunitySession() {
  if (!isSupabaseConfigured) return { user: null, configured: false };
  const supabase = await getSupabaseClient();
  if (!supabase) return { user: null, configured: false };
  const { data, error } = await supabase.auth.getSession();
  if (error) throw communityError(error, 'Could not read the community account session.');
  return { user: data.session?.user || null, configured: true };
}

export async function requestCommunitySignIn(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail)) throw new Error('Enter a valid email address.');
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Community accounts are not configured.');
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw communityError(error, 'Could not send the sign-in email.');
}

export async function signOutCommunity() {
  const supabase = await getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw communityError(error, 'Could not sign out.');
}

export async function subscribeCommunityAuth(onChange) {
  const supabase = await getSupabaseClient();
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => onChange(session?.user || null));
  return () => data.subscription.unsubscribe();
}

export async function listCommunityProjects({
  page = 1,
  pageSize = COMMUNITY_PAGE_SIZE,
  search = '',
  tag = '',
  compatibility = 'all',
  sort = 'newest',
} = {}) {
  if (!isSupabaseConfigured) return { projects: [], total: 0, configured: false };
  const supabase = await getSupabaseClient();
  if (!supabase) return { projects: [], total: 0, configured: false };

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(48, Math.max(1, Number(pageSize) || COMMUNITY_PAGE_SIZE));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  const searchTerm = sanitizeSearchTerm(search);
  const tagTerm = normalizeTag(tag);

  let request = supabase
    .from('community_projects')
    .select(COMMUNITY_PROJECT_FIELDS, { count: 'exact' })
    .eq('status', 'published');

  if (searchTerm) request = request.or(`title.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%,author_name.ilike.%${searchTerm}%`);
  if (tagTerm) request = request.contains('tags', [tagTerm]);
  if (compatibility !== 'all') request = request.eq('compatibility_status', compatibility);

  if (sort === 'popular') {
    request = request.order('download_count', { ascending: false }).order('published_at', { ascending: false });
  } else if (sort === 'updated') {
    request = request.order('updated_at', { ascending: false });
  } else {
    request = request.order('published_at', { ascending: false });
  }

  const { data, error, count } = await request.range(from, to);
  if (error) throw communityError(error, 'The community gallery could not be loaded.');
  return { projects: (data || []).map(normalizeProject), total: count || 0, configured: true };
}

export async function publishCommunityProject({ user, title, summary, authorName, tags, compatibilityStatus, snapshotCommit, projectVersion, metrics, document }) {
  if (!user?.id) throw new Error('Sign in before publishing a project.');
  const validation = validateCommunityPublication({ title, summary, authorName, tags, document });
  if (!validation.valid) throw new Error(validation.errors[0]);
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Community publishing is not configured.');
  const { values } = validation;
  const { data, error } = await supabase
    .from('community_projects')
    .insert({
      owner_id: user.id,
      title: values.title,
      summary: values.summary,
      author_name: values.authorName,
      tags: values.tags,
      compatibility_status: COMPATIBILITY_STATUSES.has(compatibilityStatus) ? compatibilityStatus : 'review',
      snapshot_commit: String(snapshotCommit || '').slice(0, 64),
      project_version: String(projectVersion || '').slice(0, 24),
      metrics: metrics || {},
      project_document: values.document,
      status: 'published',
    })
    .select(COMMUNITY_PROJECT_FIELDS)
    .single();
  if (error) throw communityError(error, 'The project could not be published.');
  return normalizeProject(data);
}

export async function openCommunityProjectCopy(projectId) {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Community projects are not configured.');
  const { data, error } = await supabase.rpc('open_community_project_copy', { project_uuid: projectId });
  if (error) throw communityError(error, 'The safe project copy could not be loaded.');
  if (!data?.document || Object.keys(data.document).length === 0) throw new Error('This older gallery entry does not include a safe project copy.');
  return { id: data.id, title: data.title, document: data.document };
}

export async function deleteCommunityProject(projectId, user) {
  if (!user?.id) throw new Error('Sign in before deleting a project.');
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Community projects are not configured.');
  const { error } = await supabase.from('community_projects').delete().eq('id', projectId).eq('owner_id', user.id);
  if (error) throw communityError(error, 'The project could not be deleted.');
}

export async function reportCommunityProject(projectId, reason, user) {
  if (!user?.id) throw new Error('Sign in before reporting a project.');
  const normalizedReason = REPORT_REASONS.has(reason) ? reason : 'other';
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Community reports are not configured.');
  const { error } = await supabase.from('community_project_reports').insert({
    project_id: projectId,
    reporter_id: user.id,
    reason: normalizedReason,
  });
  if (error) throw communityError(error, 'The report could not be submitted.');
}
