-- =====================================================================
--  Student Advice Hub — FULL Supabase setup (backup copy)
--
--  The live project is already set up; you do NOT need to run this.
--  It's here so the whole database can be rebuilt in a brand-new
--  Supabase project: SQL Editor → New query → paste → change the
--  passwords at the bottom → Run.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id                 uuid primary key default gen_random_uuid(),
  audience_year      integer not null default 12,         -- year the advice is FOR (7–12)
  author_year        integer not null default 13,         -- year of the student who wrote it (8–13)
  subject            text not null,
  type               text not null,
  title              text not null,
  body               text not null default '',
  link               text,
  author             text,                                -- unused (posts are anonymous)
  status             text not null default 'approved',    -- approved | pending | hidden
  pinned             boolean not null default false,
  helpful_count      integer not null default 0,
  report_count       integer not null default 0,
  reports_cleared_at timestamptz not null default '2000-01-01',
  created_at         timestamptz not null default now()
);
create index if not exists posts_status_idx on public.posts (status);
create index if not exists posts_audience_idx on public.posts (audience_year, subject);

create table if not exists public.helpful_votes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  voter_id   text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, voter_id)
);

create table if not exists public.post_reports (
  post_id    uuid not null,
  voter_id   text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, voter_id)
);

-- Hashed passwords: 'year8' … 'year13' and 'admin'. Nobody can read this from the website.
create table if not exists public.app_secrets (
  role text primary key,
  hash text not null
);

-- ---------------------------------------------------------------------
-- Security: the website can only READ approved posts.
-- Everything else goes through the password-checked functions below.
-- ---------------------------------------------------------------------
alter table public.posts         enable row level security;
alter table public.helpful_votes enable row level security;
alter table public.post_reports  enable row level security;
alter table public.app_secrets   enable row level security;

drop policy if exists "Anyone can read posts" on public.posts;
create policy "Anyone can read posts" on public.posts for select using (status = 'approved');
revoke insert, update, delete, truncate on public.posts from anon, authenticated;
revoke all on public.helpful_votes, public.post_reports, public.app_secrets from anon, authenticated;

-- ---------------------------------------------------------------------
-- Helpers (not callable from the website)
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

create or replace function public._clean_link(p_link text)
returns text language plpgsql immutable
set search_path = public
as $$
begin
  p_link := nullif(trim(coalesce(p_link, '')), '');
  if p_link is null then return null; end if;
  if p_link !~* '^https?://' then p_link := 'https://' || p_link; end if;
  if length(p_link) > 500 then raise exception 'Link is too long'; end if;
  return p_link;
end $$;

create or replace function public._validate_post(p_subject text, p_type text, p_title text, p_body text, p_author text)
returns void language plpgsql immutable
set search_path = public
as $$
begin
  if coalesce(trim(p_subject), '') = '' then raise exception 'Please choose a subject'; end if;
  if p_type not in ('advice', 'revision', 'exam', 'resource', 'link') then raise exception 'Please choose a type'; end if;
  if length(trim(coalesce(p_title, ''))) < 3 then raise exception 'Title is too short'; end if;
  if length(p_title) > 120 then raise exception 'Title is too long (max 120 characters)'; end if;
  if length(coalesce(p_body, '')) > 4000 then raise exception 'Advice is too long (max 4000 characters)'; end if;
  if length(coalesce(p_author, '')) > 60 then raise exception 'Name is too long'; end if;
end $$;

-- Word filter (keep in sync with BAD_WORDS in js/api.js)
create or replace function public._has_bad_words(p_text text)
returns boolean language sql immutable
set search_path = public
as $$
  select coalesce(p_text, '') ~* '\m(f+u+c+k\w*|fck\w*|sh[i1]t\w*|bitch\w*|cunt\w*|wank\w*|twat\w*|prick|pricks|dick|dicks|dickhead\w*|bollock\w*|bastard\w*|slag|slags|slut\w*|whore\w*|piss\w*|arse|arsehole\w*|asshole\w*|nigg\w*|fag|fags|faggot\w*|retard\w*|paki|pakis|spastic\w*|spaz\w*|tosser\w*|knobhead\w*|bellend\w*|nonce\w*|stfu|wtf|kys|kill yourself)\M';
$$;

-- ---------------------------------------------------------------------
-- Functions the website calls
-- ---------------------------------------------------------------------
create or replace function public.check_password(p_role text, p_password text)
returns boolean
language sql stable security definer
set search_path = public, extensions
as $$ select public._password_ok(p_role, p_password); $$;

-- Students: add a post for a younger year. Years 12–13 go live; younger years wait for approval.
create or replace function public.submit_post(
  p_password text, p_author_year integer, p_audience_year integer,
  p_subject text, p_type text, p_title text, p_body text, p_link text
) returns public.posts
language plpgsql security definer
set search_path = public, extensions
as $$
declare new_post public.posts; is_admin boolean; new_status text;
begin
  if p_author_year is null or p_author_year not between 8 and 13 then raise exception 'Please choose your year'; end if;
  if p_audience_year is null or p_audience_year not between 7 and 12 then raise exception 'Please choose which year the advice is for'; end if;
  if p_audience_year >= p_author_year then raise exception 'You can only post advice for younger years'; end if;
  is_admin := public._password_ok('admin', p_password);
  if not (is_admin or public._password_ok('year' || p_author_year, p_password)) then
    raise exception 'Wrong password for Year %', p_author_year;
  end if;
  perform public._validate_post(p_subject, p_type, p_title, p_body, null);
  if public._has_bad_words(p_title) or public._has_bad_words(p_body) or public._has_bad_words(p_link) then
    raise exception 'Please keep it friendly: your post contains words that are not allowed';
  end if;
  new_status := case when is_admin or p_author_year >= 12 then 'approved' else 'pending' end;
  insert into public.posts (subject, type, title, body, link, author, author_year, audience_year, status)
  values (trim(p_subject), p_type, trim(p_title), trim(coalesce(p_body, '')),
          public._clean_link(p_link), null, p_author_year, p_audience_year, new_status)
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

-- Anyone: report a post (one report per browser). 3 reports hide it until an admin checks.
create or replace function public.report_post(p_post_id uuid, p_voter_id text)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare n integer; cleared timestamptz;
begin
  if length(coalesce(p_voter_id, '')) < 10 or length(p_voter_id) > 64 then raise exception 'Invalid voter'; end if;
  select reports_cleared_at into cleared from public.posts where id = p_post_id and status = 'approved';
  if not found then return 0; end if;
  insert into public.post_reports (post_id, voter_id) values (p_post_id, p_voter_id)
  on conflict (post_id, voter_id) do update set created_at = now()
    where public.post_reports.created_at <= cleared;
  select count(*) into n from public.post_reports where post_id = p_post_id and created_at > cleared;
  update public.posts
     set report_count = n,
         status = case when n >= 3 then 'hidden' else status end
   where id = p_post_id;
  return n;
end $$;

-- Admin: list posts waiting for approval or hidden by reports
create or replace function public.admin_list_unapproved(p_password text)
returns setof public.posts
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if not public._password_ok('admin', p_password) then raise exception 'Wrong admin password'; end if;
  return query select * from public.posts where status <> 'approved' order by created_at;
end $$;

-- Admin: approve / restore (or hide) one or many posts
create or replace function public.admin_set_status(p_password text, p_ids uuid[], p_status text)
returns integer
language plpgsql security definer
set search_path = public, extensions
as $$
declare n integer;
begin
  if not public._password_ok('admin', p_password) then raise exception 'Wrong admin password'; end if;
  if p_status not in ('approved', 'pending', 'hidden') then raise exception 'Invalid status'; end if;
  update public.posts
     set status = p_status,
         report_count = case when p_status = 'approved' then 0 else report_count end,
         reports_cleared_at = case when p_status = 'approved' then now() else reports_cleared_at end
   where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- Admin: edit / move / pin a post
create or replace function public.admin_edit_post(
  p_password text, p_id uuid, p_audience_year integer, p_subject text, p_type text,
  p_title text, p_body text, p_link text, p_pinned boolean
) returns public.posts
language plpgsql security definer
set search_path = public, extensions
as $$
declare updated public.posts;
begin
  if not public._password_ok('admin', p_password) then raise exception 'Wrong admin password'; end if;
  if p_audience_year is null or p_audience_year not between 7 and 12 then raise exception 'Please choose which year the advice is for'; end if;
  perform public._validate_post(p_subject, p_type, p_title, p_body, null);
  update public.posts set
    audience_year = p_audience_year, subject = trim(p_subject), type = p_type, title = trim(p_title),
    body = trim(coalesce(p_body, '')), link = public._clean_link(p_link), pinned = coalesce(p_pinned, false)
  where id = p_id
  returning * into updated;
  return updated;
end $$;

-- Admin: delete / reject a post
create or replace function public.admin_delete_post(p_password text, p_id uuid)
returns void
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public._password_ok('admin', p_password) then raise exception 'Wrong admin password'; end if;
  delete from public.posts where id = p_id;
end $$;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
revoke all on function public._password_ok(text, text) from public, anon, authenticated;
revoke all on function public._clean_link(text) from public, anon, authenticated;
revoke all on function public._validate_post(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public._has_bad_words(text) from public, anon, authenticated;

grant execute on function public.check_password(text, text) to anon, authenticated;
grant execute on function public.submit_post(text, integer, integer, text, text, text, text, text) to anon, authenticated;
grant execute on function public.toggle_helpful(uuid, text) to anon, authenticated;
grant execute on function public.report_post(uuid, text) to anon, authenticated;
grant execute on function public.admin_list_unapproved(text) to anon, authenticated;
grant execute on function public.admin_set_status(text, uuid[], text) to anon, authenticated;
grant execute on function public.admin_edit_post(text, uuid, integer, text, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.admin_delete_post(text, uuid) to anon, authenticated;

-- =====================================================================
--  PASSWORDS — change the text inside the quotes, then Run.
--  To change just one password later, run only its line (plus the
--  "on conflict" line) on its own.
-- =====================================================================
insert into public.app_secrets (role, hash) values
  ('year8',  extensions.crypt('CHANGE-ME-year8',  extensions.gen_salt('bf'))),
  ('year9',  extensions.crypt('CHANGE-ME-year9',  extensions.gen_salt('bf'))),
  ('year10', extensions.crypt('CHANGE-ME-year10', extensions.gen_salt('bf'))),
  ('year11', extensions.crypt('CHANGE-ME-year11', extensions.gen_salt('bf'))),
  ('year12', extensions.crypt('CHANGE-ME-year12', extensions.gen_salt('bf'))),
  ('year13', extensions.crypt('CHANGE-ME-year13', extensions.gen_salt('bf'))),
  ('admin',  extensions.crypt('CHANGE-ME-admin',  extensions.gen_salt('bf')))
on conflict (role) do update set hash = excluded.hash;
