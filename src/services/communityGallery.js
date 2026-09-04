import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js';
import { normalizeExportOptimizationProfile } from '../config/exportOptimizationProfiles.js';

export const COMMUNITY_PAGE_SIZE = 24;
export const COMMUNITY_MAX_PROJECT_BYTES = 1024 * 1024;
export const COMMUNITY_MAX_LOBBY_SLOTS = 60;
export const COMMUNITY_MAX_LOBBY_PAYLOAD_CHARACTERS = 16384 * COMMUNITY_MAX_LOBBY_SLOTS;

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
  'has_lobby_commands',
  'export_optimization_profile',
  'lobby_slot_count',
  'lobby_payload_chars',
].join(',');

const COMMUNITY_LEGACY_PROJECT_FIELDS = [
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
const LOBBY_COMMAND_PATTERN = /^!bset (tweakdefs|tweakunits)([1-9]|1\d|2\d)? ([A-Za-z0-9+/_-]+={0,2})$/;
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
    hasLobbyCommands: Boolean(row.has_lobby_commands),
    exportOptimizationProfile: normalizeExportOptimizationProfile(row.export_optimization_profile),
    lobbySlotCount: Number(row.lobby_slot_count) || 0,
    lobbyPayloadCharacters: Number(row.lobby_payload_chars) || 0,
  };
}

function communityError(error, fallback) {
  if (error?.code === '23505') return new Error('You already reported this project.');
  if (error?.code === '42501') return new Error('Your account is not allowed to perform this action.');
  if (isCommunityLobbySchemaError(error)) {
    return new Error('Direct lobby exports are not configured yet. Run the latest Community Gallery Supabase migration.');
  }
  return new Error(error?.message || fallback);
}

export function isCommunityLobbySchemaError(error) {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return ['42703', 'pgrst202', 'pgrst204'].includes(String(error?.code || '').toLowerCase())
    && (
      message.includes('lobby_commands')
      || message.includes('has_lobby_commands')
      || message.includes('export_optimization_profile')
      || message.includes('lobby_slot_count')
      || message.includes('lobby_payload_chars')
      || message.includes('get_community_lobby_commands')
    );
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

export function validateCommunityLobbyArtifact({ commands, optimizationProfile } = {}) {
  const profile = normalizeExportOptimizationProfile(optimizationProfile);
  const normalizedCommands = String(commands || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const errors = [];

  if (normalizedCommands.length > COMMUNITY_MAX_LOBBY_SLOTS) {
    errors.push(`Lobby output uses more than ${COMMUNITY_MAX_LOBBY_SLOTS} fields.`);
  }

  // Published projects made by older editor builds used suffixes 1..9 and
  // Definitions-first ordering. Continue accepting those artifacts while all
  // newly compiled BAR-30 output uses base..29 and Units-first ordering.
  const recognizedCommands = normalizedCommands
    .map(command => command.match(LOBBY_COMMAND_PATTERN))
    .filter(Boolean);
  const legacyArtifact = recognizedCommands.length > 0 && recognizedCommands.every(match => (
    match[2] && Number(match[2]) <= 9
  ));
  let secondLaneStarted = false;
  let payloadCharacters = 0;
  const seenFields = new Set();
  const expectedIndex = { tweakdefs: legacyArtifact ? 1 : 0, tweakunits: legacyArtifact ? 1 : 0 };

  normalizedCommands.forEach(command => {
    const match = command.match(LOBBY_COMMAND_PATTERN);
    if (!match) {
      errors.push('Lobby output contains a command outside the supported tweakdefs/tweakunits format.');
      return;
    }
    const [, kind, indexText = '', payload] = match;
    const fieldName = `${kind}${indexText}`;
    const index = indexText === '' ? 0 : Number(indexText);
    if (seenFields.has(fieldName)) errors.push(`Lobby output repeats ${fieldName}.`);
    seenFields.add(fieldName);
    const firstLane = legacyArtifact ? 'tweakdefs' : 'tweakunits';
    const secondLane = legacyArtifact ? 'tweakunits' : 'tweakdefs';
    if (kind === secondLane) secondLaneStarted = true;
    if (kind === firstLane && secondLaneStarted) {
      errors.push(legacyArtifact
        ? 'Definitions fields must appear before Units fields.'
        : 'Units fields must appear before Definitions fields.');
    }
    if (index !== expectedIndex[kind]) errors.push(legacyArtifact
      ? `${kind} fields must be numbered consecutively from 1.`
      : `${kind} fields must use the base field, then be numbered consecutively from 1.`);
    expectedIndex[kind] = index + 1;
    if (payload.length > 16384) errors.push(`${fieldName} exceeds BAR's 16,384-character field limit.`);
    payloadCharacters += payload.length;
  });

  if (payloadCharacters > COMMUNITY_MAX_LOBBY_PAYLOAD_CHARACTERS) {
    errors.push('Lobby output exceeds the community publication payload limit.');
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    value: {
      commands: normalizedCommands.join('\n'),
      optimizationProfile: profile,
      slotCount: normalizedCommands.length,
      payloadCharacters,
    },
  };
}

export function validateCommunityPublication({ title, summary, authorName, tags, document, lobbyCommands, optimizationProfile }) {
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
  const lobbyArtifact = validateCommunityLobbyArtifact({
    commands: lobbyCommands,
    optimizationProfile: optimizationProfile || sanitizedDocument.exportOptimizationProfile,
  });
  errors.push(...lobbyArtifact.errors);

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
      lobbyArtifact: lobbyArtifact.value,
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

  const buildRequest = fields => {
    let request = supabase
      .from('community_projects')
      .select(fields, { count: 'exact' })
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
    return request.range(from, to);
  };

  let result = await buildRequest(COMMUNITY_PROJECT_FIELDS);
  if (result.error && isCommunityLobbySchemaError(result.error)) {
    result = await buildRequest(COMMUNITY_LEGACY_PROJECT_FIELDS);
  }
  const { data, error, count } = result;
  if (error) throw communityError(error, 'The community gallery could not be loaded.');
  return { projects: (data || []).map(normalizeProject), total: count || 0, configured: true };
}

export async function publishCommunityProject({ user, title, summary, authorName, tags, compatibilityStatus, snapshotCommit, projectVersion, metrics, document, lobbyCommands, optimizationProfile }) {
  if (!user?.id) throw new Error('Sign in before publishing a project.');
  const validation = validateCommunityPublication({
    title,
    summary,
    authorName,
    tags,
    document,
    lobbyCommands,
    optimizationProfile,
  });
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
      lobby_commands: values.lobbyArtifact.commands,
      export_optimization_profile: values.lobbyArtifact.optimizationProfile,
      lobby_slot_count: values.lobbyArtifact.slotCount,
      lobby_payload_chars: values.lobbyArtifact.payloadCharacters,
      status: 'published',
    })
    .select(COMMUNITY_PROJECT_FIELDS)
    .single();
  if (error) throw communityError(error, 'The project could not be published.');
  return normalizeProject(data);
}

export async function getCommunityLobbyCommands(projectId) {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Community lobby exports are not configured.');
  const { data, error } = await supabase.rpc('get_community_lobby_commands', { project_uuid: projectId });
  if (error) throw communityError(error, 'The lobby commands could not be loaded.');
  if (!data?.commands) throw new Error('This project does not include a lobby-ready export.');
  return {
    commands: data.commands,
    optimizationProfile: normalizeExportOptimizationProfile(data.optimizationProfile),
    slotCount: Number(data.slotCount) || 0,
    payloadCharacters: Number(data.payloadCharacters) || 0,
  };
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
