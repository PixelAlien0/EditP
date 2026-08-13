-- BAR EditP public Community Gallery (read-only phase)
-- Run once in Supabase Dashboard > SQL Editor.

create table if not exists public.community_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  summary text not null default '' check (char_length(summary) <= 500),
  author_name text not null default 'Community creator' check (char_length(author_name) between 2 and 48),
  tags text[] not null default '{}',
  compatibility_status text not null default 'review'
    check (compatibility_status in ('compatible', 'review', 'outdated', 'experimental')),
  snapshot_commit text not null default '' check (char_length(snapshot_commit) <= 64),
  project_version text not null default '' check (char_length(project_version) <= 24),
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object'),
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'published', 'rejected', 'archived')),
  download_count bigint not null default 0 check (download_count >= 0),
  fork_count bigint not null default 0 check (fork_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint community_project_publication_date check (status <> 'published' or published_at is not null),
  constraint community_project_tag_limit check (cardinality(tags) <= 8)
);

create index if not exists community_projects_public_gallery_idx
  on public.community_projects (published_at desc)
  where status = 'published';

create index if not exists community_projects_compatibility_idx
  on public.community_projects (compatibility_status, published_at desc)
  where status = 'published';

alter table public.community_projects enable row level security;

revoke all on table public.community_projects from public;
grant select on table public.community_projects to anon, authenticated;

drop policy if exists "Browse published community projects" on public.community_projects;
create policy "Browse published community projects"
  on public.community_projects
  for select
  to anon, authenticated
  using (status = 'published' and published_at <= now());

-- Publishing policies and project payload storage are intentionally omitted.
-- Add them only with the authenticated publishing and server-validation phase.
