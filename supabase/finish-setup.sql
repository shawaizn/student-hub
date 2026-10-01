-- =====================================================================
--  FINISH SETUP — paste into Supabase → SQL Editor → New query → Run
--
--  1. Change the two passwords at the bottom first.
--  2. Click Run (if Supabase warns about "destructive operations", that's
--     just because the admin delete function contains the word DELETE — OK to run).
--
--  Run this again any time you want to change the passwords.
-- =====================================================================

-- "Helpful" button (one vote per browser, click again to undo)
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

-- Website visitors can never delete rows directly (only via the admin function above)
revoke delete on public.posts, public.helpful_votes, public.app_secrets from anon, authenticated;

grant execute on function public.toggle_helpful(uuid, text) to anon, authenticated;
grant execute on function public.admin_delete_post(text, uuid) to anon, authenticated;

-- =====================================================================
--  PASSWORDS — change the text inside the quotes, then Run.
--  contributor = the password you give to Year 13s (they can only ADD)
--  admin       = YOUR password (edit, move, pin, delete)
-- =====================================================================
insert into public.app_secrets (role, hash)
values ('contributor', extensions.crypt('CHANGE-ME-year13-password', extensions.gen_salt('bf')))
on conflict (role) do update set hash = excluded.hash;

insert into public.app_secrets (role, hash)
values ('admin', extensions.crypt('CHANGE-ME-admin-password', extensions.gen_salt('bf')))
on conflict (role) do update set hash = excluded.hash;
