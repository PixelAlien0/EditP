-- BAR EditP temporary workshop chat
-- Run once in Supabase Dashboard > SQL Editor.

create extension if not exists pg_cron;

create table if not exists public.temporary_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null
    constraint temporary_chat_sender_id_format
    check (sender_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  sender_name text not null
    constraint temporary_chat_sender_name_format
    check (sender_name ~ '^Guest [0-9A-F]{4}$'),
  body text not null
    constraint temporary_chat_body_length
    check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now(),
  constraint temporary_chat_plain_text_no_links
    check (
      body !~* '(https?://|www\.|([[:alnum:]-]+\.)+[[:alpha:]]{2,}([/:?#][^[:space:]]*)?)'
    )
);

create index if not exists temporary_chat_messages_created_at_idx
  on public.temporary_chat_messages (created_at desc);

alter table public.temporary_chat_messages enable row level security;

revoke all on table public.temporary_chat_messages from public;
grant select, insert on table public.temporary_chat_messages to anon, authenticated;

drop policy if exists "Read recent temporary chat" on public.temporary_chat_messages;
create policy "Read recent temporary chat"
  on public.temporary_chat_messages
  for select
  to anon, authenticated
  using (created_at > now() - interval '8 minutes');

drop policy if exists "Send temporary plain text chat" on public.temporary_chat_messages;
create policy "Send temporary plain text chat"
  on public.temporary_chat_messages
  for insert
  to anon, authenticated
  with check (
    created_at > now() - interval '30 seconds'
    and created_at < now() + interval '30 seconds'
    and sender_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and sender_name ~ '^Guest [0-9A-F]{4}$'
    and char_length(btrim(body)) between 1 and 280
    and body !~* '(https?://|www\.|([[:alnum:]-]+\.)+[[:alpha:]]{2,}([/:?#][^[:space:]]*)?)'
  );

create or replace function public.rate_limit_temporary_chat()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.sender_id));

  if exists (
    select 1
    from public.temporary_chat_messages
    where sender_id = new.sender_id
      and created_at > now() - interval '3 seconds'
  ) then
    raise exception 'Please wait before sending another message.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.rate_limit_temporary_chat() from public;

drop trigger if exists rate_limit_temporary_chat_insert on public.temporary_chat_messages;
create trigger rate_limit_temporary_chat_insert
  before insert on public.temporary_chat_messages
  for each row execute function public.rate_limit_temporary_chat();

create or replace function public.purge_expired_temporary_chat_messages()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.temporary_chat_messages
  where created_at <= now() - interval '8 minutes';
$$;

revoke all on function public.purge_expired_temporary_chat_messages() from public;

-- Calling cron.schedule again with the same name updates the existing job.
select cron.schedule(
  'purge-editp-temporary-chat',
  '* * * * *',
  $$ select public.purge_expired_temporary_chat_messages(); $$
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'temporary_chat_messages'
  ) then
    alter publication supabase_realtime add table public.temporary_chat_messages;
  end if;
end
$$;

select public.purge_expired_temporary_chat_messages();
