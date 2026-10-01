-- =====================================================================
--  Year 12 Advice Hub — FULL Supabase setup (for a brand-new project)
--  Paste this whole file into Supabase → SQL Editor → "New query" → Run.
--  (The current project is already mostly set up — you only need
--   supabase/finish-setup.sql. This file is the complete backup copy.)
--
--  BEFORE RUNNING: change the two passwords at the bottom of this file.
--  It is safe to run this file again later (e.g. to change passwords).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  subject       text not null,
  type          text not null,
  title         text not null,
  body          text not null default '',
  link          text,
  author        text,
  pinned        boolean not null default false,
  helpful_count integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.helpful_votes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  voter_id   text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, voter_id)
);

-- Hashed passwords. Nobody can read this table from the website.
create table if not exists public.app_secrets (
  role text primary key,          -- 'contributor' or 'admin'
  hash text not null
);

-- ---------------------------------------------------------------------
-- Row level security: the website can only READ posts.
-- All writing goes through the password-checked functions below.
-- ---------------------------------------------------------------------
alter table public.posts         enable row level security;
alter table public.helpful_votes enable row level security;
alter table public.app_secrets   enable row level security;

drop policy if exists "Anyone can read posts" on public.posts;
create policy "Anyone can read posts" on public.posts for select using (true);
-- (no policies on helpful_votes / app_secrets → not readable or writable directly)
revoke insert, update, delete, truncate on public.posts, public.helpful_votes, public.app_secrets from anon, authenticated;
revoke select on public.helpful_votes, public.app_secrets from anon, authenticated;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public._password_ok(p_role text, p_password text)
returns boolean
language sql stable security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.app_secrets
    where role = p_role and hash = extensions.crypt(coalesce(p_password, ''), hash)
  );
$$;
revoke all on function public._password_ok(text, text) from public, anon, authenticated;

create or replace function public._clean_link(p_link text)
returns text language plpgsql immutable as $$
begin
  p_link := nullif(trim(coalesce(p_link, '')), '');
  if p_link is null then return null; end if;
  if p_link !~* '^https?://' then p_link := 'https://' || p_link; end if;
  if length(p_link) > 500 then raise exception 'Link is too long'; end if;
  return p_link;
end $$;

create or replace function public._validate_post(p_subject text, p_type text, p_title text, p_body text, p_author text)
returns void language plpgsql immutable as $$
begin
  if coalesce(trim(p_subject), '') = '' then raise exception 'Please choose a subject'; end if;
  if p_type not in ('advice', 'revision', 'exam', 'resource', 'link') then raise exception 'Please choose a type'; end if;
  if length(trim(coalesce(p_title, ''))) < 3 then raise exception 'Title is too short'; end if;
  if length(p_title) > 120 then raise exception 'Title is too long (max 120 characters)'; end if;
  if length(coalesce(p_body, '')) > 4000 then raise exception 'Advice is too long (max 4000 characters)'; end if;
  if length(coalesce(p_author, '')) > 60 then raise exception 'Name is too long'; end if;
end $$;

-- ---------------------------------------------------------------------
-- Public functions the website calls
-- ---------------------------------------------------------------------

-- Check a password without doing anything (used to unlock the form / admin mode)
create or replace function public.check_password(p_role text, p_password text)
returns boolean
language sql stable security definer
set search_path = public, extensions
as $$ select public._password_ok(p_role, p_password); $$;

-- Year 13s: add a post (needs contributor OR admin password). Cannot edit or delete.
create or replace function public.add_post(
  p_password text, p_subject text, p_type text, p_title text,
  p_body text, p_link text, p_author text
) returns public.posts
language plpgsql security definer
set search_path = public, extensions
as $$
declare new_post public.posts;
begin
  if not (public._password_ok('contributor', p_password) or public._password_ok('admin', p_password)) then
    raise exception 'Wrong password';
  end if;
  perform public._validate_post(p_subject, p_type, p_title, p_body, p_author);
  insert into public.posts (subject, type, title, body, link, author)
  values (trim(p_subject), p_type, trim(p_title), trim(coalesce(p_body, '')),
          public._clean_link(p_link), nullif(trim(coalesce(p_author, '')), ''))
  returning * into new_post;
  return new_post;
end $$;

-- Anyone: toggle "helpful" on a post (one vote per browser)
create or replace function public.toggle_helpful(p_post_id uuid, p_voter_id text)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare new_count integer;
begin
  if length(coalesce(p_voter_id, '')) < 10 or length(p_voter_id) > 64 then
    raise exception 'Invalid voter';
  end if;
  if exists (select 1 from public.helpful_votes where post_id = p_post_id and voter_id = p_voter_id) then
    delete from public.helpful_votes where post_id = p_post_id and voter_id = p_voter_id;
  else
    insert into public.helpful_votes (post_id, voter_id) values (p_post_id, p_voter_id);
  end if;
  update public.posts
     set helpful_count = (select count(*) from public.helpful_votes where post_id = p_post_id)
   where id = p_post_id
  returning helpful_count into new_count;
  return coalesce(new_count, 0);
end $$;

-- Admin only: edit / move / pin a post
create or replace function public.admin_update_post(
  p_password text, p_id uuid, p_subject text, p_type text, p_title text,
  p_body text, p_link text, p_author text, p_pinned boolean
) returns public.posts
language plpgsql security definer
set search_path = public, extensions
as $$
declare updated public.posts;
begin
  if not public._password_ok('admin', p_password) then raise exception 'Wrong admin password'; end if;
  perform public._validate_post(p_subject, p_type, p_title, p_body, p_author);
  update public.posts set
    subject = trim(p_subject), type = p_type, title = trim(p_title),
    body = trim(coalesce(p_body, '')), link = public._clean_link(p_link),
    author = nullif(trim(coalesce(p_author, '')), ''), pinned = coalesce(p_pinned, false)
  where id = p_id
  returning * into updated;
  return updated;
end $$;

-- Admin only: delete a post
create or replace function public.admin_delete_post(p_password text, p_id uuid)
returns void
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public._password_ok('admin', p_password) then raise exception 'Wrong admin password'; end if;
  delete from public.posts where id = p_id;
end $$;

revoke all on function public._clean_link(text) from public, anon, authenticated;
revoke all on function public._validate_post(text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.check_password(text, text) to anon, authenticated;
grant execute on function public.add_post(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.toggle_helpful(uuid, text) to anon, authenticated;
grant execute on function public.admin_update_post(text, uuid, text, text, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.admin_delete_post(text, uuid) to anon, authenticated;

-- =====================================================================
--  PASSWORDS — change these two values, then run.
--  contributor = the password you give to Year 13s (add only)
--  admin       = YOUR password (edit, move, pin, delete)
-- =====================================================================
insert into public.app_secrets (role, hash)
values ('contributor', extensions.crypt('CHANGE-ME-year13-password', extensions.gen_salt('bf')))
on conflict (role) do update set hash = excluded.hash;

insert into public.app_secrets (role, hash)
values ('admin', extensions.crypt('CHANGE-ME-admin-password', extensions.gen_salt('bf')))
on conflict (role) do update set hash = excluded.hash;
