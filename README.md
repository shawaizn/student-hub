# Student Advice 💬

**Tap your year. Tap a subject. Read what older students wish they'd known.**

A website for Colton Hills Community School where older students leave tips for younger years.

- **Three levels only:** Year (7–13) → Subject → Tips. The page takes the colour of the year you're in.
- **A post is just a tip**, with an optional link. Long tips show the first few lines and a **Read more** link.
- **👍** moves the most helpful tips to the top. **⋯ → 🚩 Report** hides a tip once 3 people report it.
- **Years 8–13 post for younger years** using their year's password. Leaving Year 13s can also post for next year's Year 13. Posts are anonymous and show only a badge like **Y11**.
- **Years 12–13 go live straight away.** Years 8–11 are checked first.
- **A word filter** blocks swearing and slurs.
- **Admin** (small link at the bottom): 📥 shows the tips to check one at a time, with big **✕ Remove** and **✓ Keep** buttons and a **Keep all** option. In admin mode every tip also has Edit, Pin and Delete.

Try it without touching real data by adding `?demo` to the address.
Demo passwords: `year8` … `year13`, admin `admin`.

---

## Changing a password
In Supabase, open the **SQL Editor** and run this, replacing the year and the new password:
```sql
insert into public.app_secrets (role, hash)
values ('year9', extensions.crypt('new-password-here', extensions.gen_salt('bf')))
on conflict (role) do update set hash = excluded.hash;
```
Use `'admin'` instead of `'year9'` to change the admin password.

## Changing things

| I want to… | Edit this file |
|---|---|
| Add / remove / rename a subject | [`js/subjects.js`](js/subjects.js): one list for each of KS3, GCSE and Sixth Form |
| Add a special section to a year (like "GCSE Options") | `extras` for that year in [`js/subjects.js`](js/subjects.js) |
| Change a year's colour | `color` for that year in [`js/subjects.js`](js/subjects.js) |
| Change the site name or school colours | [`js/config.js`](js/config.js) |
| Add words to the filter | `BAD_WORDS` in [`js/api.js`](js/api.js) **and** `_has_bad_words` in the database |
| Change the look | [`css/style.css`](css/style.css) |

Removing a subject from the list does **not** delete its tips. Add it back and they reappear.

## How it's built
Plain HTML, CSS and JavaScript (no build step) plus a Supabase database.
Passwords are stored hashed in the database and checked there, so they never appear in the website code.
Visitors can only read approved tips. Posting, voting, reporting and admin actions all go through password-checked database functions.

- `index.html`: the page frame, the add-a-tip sheet and the admin login
- `js/app.js`: the pages (years, subjects, tips, admin check), voting, reporting and admin tools
- `js/api.js`: talks to Supabase (or browser storage in demo mode), plus the word filter
- `js/subjects.js`: years, colours and subjects
- `supabase/setup.sql`: full database setup (backup copy for rebuilding in a new project)
