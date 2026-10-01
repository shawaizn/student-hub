# Year 12 Advice Hub 💬

A website where Year 13s leave advice, revision tips, exam advice, resources and useful links for Year 12, organised by subject, with a General section too.

- **Anyone** can read posts and press 👍 **Helpful** (once per browser; the most helpful posts rise to the top).
- **Year 13s** use the shared Year 13 password to **add** posts through a form. They can't edit or delete anything.
- **Admin** (you) logs in with 🔒 Admin to **edit, move to another subject, pin, or delete** posts.

Try it safely without touching real data by adding `?demo` to the address, e.g. `https://…/?demo`.
Demo passwords: `year13` / `admin`.

---

## One-time setup

### 1. Finish the database (2 minutes)
The Supabase project `year-12-advice` is already created and mostly set up.

1. Open the Supabase dashboard, then your **year-12-advice** project, then **SQL Editor**, then **New query**.
2. Copy everything in [`supabase/finish-setup.sql`](supabase/finish-setup.sql) and paste it in.
3. At the bottom, change `CHANGE-ME-year13-password` and `CHANGE-ME-admin-password` to your real passwords.
4. Click **Run**. If it warns about destructive operations, that's expected, so confirm.

To change a password later, run just the bottom part again with new passwords.

### 2. Put the website online (GitHub Pages, free)
1. Merge this branch into `main`.
2. On GitHub: **Settings**, then **Pages**, then **Source: Deploy from a branch**, then **Branch: `main` / root**, then **Save**.
3. After about a minute the site is live at `https://shawaizn.github.io/year-12-advice/`.

---

## Changing things

| I want to… | Edit this file |
|---|---|
| Add / remove / rename a subject | [`js/subjects.js`](js/subjects.js): copy a line and change the id, name and emoji |
| Change school name, title, tagline or main colour | [`js/config.js`](js/config.js) |
| Change the look | [`css/style.css`](css/style.css) |

Removing a subject from the list does **not** delete its posts. Add it back and they reappear.

## How it's built
Plain HTML, CSS and JavaScript (no build step) plus a Supabase database.
Passwords are stored hashed in the database and checked there, so they never appear in the website code.
Visitors can only read posts. All adding, editing and deleting goes through password-checked database functions.

- `index.html`: page layout and the add/admin forms
- `js/app.js`: pages, search, filters, helpful button, admin tools
- `js/api.js`: talks to Supabase (or browser storage in demo mode)
- `supabase/setup.sql`: full database setup for a brand-new project
- `supabase/finish-setup.sql`: the last step plus the passwords for the current project
