-- BAR EditP Community Gallery
-- Public metadata browsing + authenticated publishing, owner deletion, reporting,
-- and sanitized "open as copy" delivery. No comments or external links are stored.
-- Run in Supabase Dashboard > SQL Editor, then enable Email auth.

create table if not exists public.community_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  summary text not null default '',
  author_name text not null default 'Community creator',
  tags text[] not null default '{}',
  compatibility_status text not null default 'review',
  snapshot_commit text not null default '',
  project_version text not null default '',
  metrics jsonb not null default '{}'::jsonb,
  project_document jsonb not null default '{}'::jsonb,
  status text not null default 'published',
  download_count bigint not null default 0,
  fork_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz default now()
);

alter table public.community_projects
  add column if not exists project_document jsonb not null default '{}'::jsonb;

alter table public.community_projects
  alter column published_at set default now();

alter table public.community_projects
  add column if not exists has_project_copy boolean
  generated always as (project_document <> '{}'::jsonb) stored;

create table if not exists public.community_project_reports (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.community_projects(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('broken', 'unsafe', 'misleading', 'copyright', 'other')),
  created_at timestamptz not null default now(),
  unique (project_id, reporter_id)
);

create or replace function public.community_project_is_safe(
  project_title text,
  project_summary text,
  project_author text,
  project_tags text[],
  project_payload jsonb
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    char_length(btrim(project_title)) between 3 and 80
    and char_length(btrim(project_summary)) between 12 and 500
    and char_length(btrim(project_author)) between 2 and 48
    and cardinality(project_tags) <= 8
    and jsonb_typeof(project_payload) = 'object'
    and octet_length(project_payload::text) <= 1048576
    and not exists (
      select 1
      from jsonb_object_keys(project_payload) as supplied(key)
      where supplied.key not in (
        'version', 'tweaks', 'clones', 'disabledUnitIds', 'buildMenuSteps', 'buildMenuPacks',
        'unitDescriptions', 'weaponLibrary', 'supportingWeaponDefs', 'unitCollections',
        'tweakModules', 'lobbySetup', 'projectName', 'projectAuthor', 'projectDesc',
        'includeTweaks', 'includeClones', 'includeRosters', 'includeHeader',
        'exportOptimizationProfile'
      )
    )
    and project_payload::text !~* '"(rawLua|originalPayload)"\s*:'
    and coalesce(jsonb_array_length(coalesce(project_payload -> 'tweakModules', '[]'::jsonb)), 0) = 0
    and coalesce(jsonb_array_length(coalesce(project_payload -> 'lobbySetup' -> 'commands', '[]'::jsonb)), 0) = 0
    and concat_ws(' ', project_title, project_summary, project_author, array_to_string(project_tags, ' '), project_payload::text)
      !~* '(https?://|www\.)';
$$;

alter table public.community_projects drop constraint if exists community_project_title_length;
alter table public.community_projects add constraint community_project_title_length check (char_length(btrim(title)) between 3 and 80);
alter table public.community_projects drop constraint if exists community_project_summary_length;
alter table public.community_projects add constraint community_project_summary_length check (char_length(btrim(summary)) between 12 and 500) not valid;
alter table public.community_projects drop constraint if exists community_project_author_length;
alter table public.community_projects add constraint community_project_author_length check (char_length(btrim(author_name)) between 2 and 48);
alter table public.community_projects drop constraint if exists community_project_tag_limit;
alter table public.community_projects add constraint community_project_tag_limit check (cardinality(tags) <= 8);
alter table public.community_projects drop constraint if exists community_project_compatibility;
alter table public.community_projects add constraint community_project_compatibility check (compatibility_status in ('compatible', 'review', 'outdated', 'experimental'));
alter table public.community_projects drop constraint if exists community_project_status;
alter table public.community_projects add constraint community_project_status check (status in ('published', 'archived'));
alter table public.community_projects drop constraint if exists community_project_metrics_shape;
alter table public.community_projects add constraint community_project_metrics_shape check (jsonb_typeof(metrics) = 'object');
alter table public.community_projects drop constraint if exists community_project_publication_date;
alter table public.community_projects add constraint community_project_publication_date check (status <> 'published' or published_at is not null);
alter table public.community_projects drop constraint if exists community_project_safe_payload;
alter table public.community_projects add constraint community_project_safe_payload check (
  public.community_project_is_safe(title, summary, author_name, tags, project_document)
) not valid;

create index if not exists community_projects_public_gallery_idx
  on public.community_projects (published_at desc)
  where status = 'published';

create index if not exists community_projects_compatibility_idx
  on public.community_projects (compatibility_status, published_at desc)
  where status = 'published';

create index if not exists community_projects_tags_idx
  on public.community_projects using gin (tags)
  where status = 'published';

create or replace function public.set_community_project_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists community_projects_updated_at on public.community_projects;
create trigger community_projects_updated_at
before update on public.community_projects
for each row execute function public.set_community_project_updated_at();

alter table public.community_projects enable row level security;
alter table public.community_project_reports enable row level security;

revoke all on table public.community_projects from public, anon, authenticated;
revoke all on table public.community_project_reports from public, anon, authenticated;

grant select (
  id, owner_id, title, summary, author_name, tags, compatibility_status,
  snapshot_commit, project_version, metrics, status, download_count, fork_count,
  created_at, updated_at, published_at, has_project_copy
) on public.community_projects to anon, authenticated;

grant insert (
  owner_id, title, summary, author_name, tags, compatibility_status,
  snapshot_commit, project_version, metrics, project_document, status
) on public.community_projects to authenticated;

grant delete on public.community_projects to authenticated;
grant insert (project_id, reporter_id, reason) on public.community_project_reports to authenticated;

drop policy if exists "Browse published community projects" on public.community_projects;
create policy "Browse published community projects"
  on public.community_projects
  for select
  to anon, authenticated
  using (status = 'published' and published_at <= now());

drop policy if exists "Publish own sanitized community project" on public.community_projects;
create policy "Publish own sanitized community project"
  on public.community_projects
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and status = 'published'
    and published_at <= now()
    and public.community_project_is_safe(title, summary, author_name, tags, project_document)
  );

drop policy if exists "Delete own community project" on public.community_projects;
create policy "Delete own community project"
  on public.community_projects
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Report published community project" on public.community_project_reports;
create policy "Report published community project"
  on public.community_project_reports
  for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1 from public.community_projects project
      where project.id = project_id and project.status = 'published'
    )
  );

create or replace function public.open_community_project_copy(project_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  update public.community_projects
  set fork_count = fork_count + 1
  where id = project_uuid
    and status = 'published'
    and published_at <= now()
    and has_project_copy
  returning jsonb_build_object(
    'id', id,
    'title', title,
    'document', project_document
  ) into result;

  if result is null then
    raise exception 'Published project copy not found';
  end if;
  return result;
end;
$$;

revoke all on function public.open_community_project_copy(uuid) from public;
grant execute on function public.open_community_project_copy(uuid) to anon, authenticated;

-- Intentionally absent: comments, URLs, raw Lua fields, and direct public access
-- to project_document. Safe copies are returned only by the RPC above.
