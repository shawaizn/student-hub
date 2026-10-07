# Student Advice Hub 💬

A website for Colton Hills Community School where older students leave advice, revision tips, exam advice, resources and useful links for younger years. Advice is organised **by year (7–12)**, then **by subject**, and each year also has a General section.

- **Anyone** can read posts and press 👍 **Helpful**. The most helpful posts rise to the top.
- **Students in Years 8–13** can post advice for any **younger** year using their year's password. Posts are anonymous and show as "A Year 10 student".
- **Posts from Years 12–13** go live straight away. **Posts from Years 8–11** wait in the admin **approval queue**.
- **A bad-word filter** blocks swearing and slurs before a post is sent.
- **🚩 Report:** if 3 people report a post, it's hidden automatically and moved to the queue.
- **Admin** (🔒 Admin): approve, reject, approve all, edit, move to another year or subject, pin, and delete.

Try it safely without touching real data by adding `?demo` to the address, e.g. `https://…/?demo`.
Demo passwords: `year8` … `year13`, admin `admin`.

---

## Setup

The Supabase database is already fully set up. To put the site online with GitHub Pages:

1. On GitHub, go to **Settings**, then **Pages**, then **Deploy from a branch**.
2. Pick the branch with this code and the `/ (root)` folder, then click **Save**.
3. After about a minute it's live at `https://shawaizn.github.io/year-12-advice/`.

To rebuild the database in a brand-new Supabase project, run [`supabase/setup.sql`](supabase/setup.sql) in the SQL Editor after changing the passwords at the bottom.

### Changing a password
In Supabase, open the **SQL Editor** and run this, replacing the year and the new password:
```sql
insert into public.app_secrets (role, hash)
values ('year9', extensions.crypt('new-password-here', extensions.gen_salt('bf')))
on conflict (role) do update set hash = excluded.hash;
```
Use `'admin'` instead of `'year9'` to change the admin password.

---

## Changing things

| I want to… | Edit this file |
|---|---|
| Add / remove / rename a subject | [`js/subjects.js`](js/subjects.js): each key stage (KS3, GCSE, Sixth Form) has its own list |
| Add a special section to a year (like "GCSE Options") | `extras` for that year in [`js/subjects.js`](js/subjects.js) |
| Change school name, site name, tagline or colours | [`js/config.js`](js/config.js) |
| Change which years skip the approval queue | `submit_post` in the database, and `TRUSTED_YEARS` in `js/subjects.js` |
| Add words to the filter | `BAD_WORDS` in [`js/api.js`](js/api.js) **and** `_has_bad_words` in the database |
| Change the look | [`css/style.css`](css/style.css) |

Removing a subject from the list does **not** delete its posts. Add it back and they reappear.

## How it's built
Plain HTML, CSS and JavaScript (no build step) plus a Supabase database.
Passwords are stored hashed in the database and checked there, so they never appear in the website code.
Visitors can only read approved posts. All posting, voting, reporting and admin actions go through password-checked database functions.

- `index.html`: page layout and the add/admin forms
- `js/app.js`: pages (home, year, subject, search, approval queue), voting, reporting, admin tools
- `js/api.js`: talks to Supabase (or browser storage in demo mode), plus the word filter
- `js/subjects.js`: years, key stages and subjects
- `supabase/setup.sql`: full database setup (backup copy)
