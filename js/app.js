// =====================================================================
//  Student Advice — app
//  Three levels only:  #/  →  #/y/7  →  #/y/7/maths      (+ #/admin)
// =====================================================================
(function () {
  const cfg = window.SITE_CONFIG;
  const GROUPS = window.SUBJECT_GROUPS;
  const STAGES = window.STAGES;
  const YEARS = window.YEARS;
  const POSTING_YEARS = window.POSTING_YEARS;
  const groupById = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
  const yearInfo = Object.fromEntries(YEARS.map((y) => [y.year, y]));

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const app = $("#app");

  // ---------- storage helpers (never throw) ----------
  const store = {
    get(k, d, s = localStorage) { try { const v = s.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v, s = localStorage) { try { s.setItem(k, JSON.stringify(v)); } catch {} },
    del(k, s = localStorage) { try { s.removeItem(k); } catch {} },
  };

  let voterId = store.get("advicehub-voter", null);
  if (!voterId) { voterId = crypto.randomUUID(); store.set("advicehub-voter", voterId); }

  const state = {
    posts: [],
    queue: [],                                        // admin: posts being checked or reported
    loaded: false,
    error: null,
    voted: new Set(store.get("advicehub-voted", [])),
    reported: new Set(store.get("advicehub-reported", [])),
    expanded: new Set(),                              // tips opened with "Read more"
    adminPw: store.get("advicehub-admin", null, sessionStorage),
    yearPw: store.get("advicehub-year-pw", {}),       // remembered passwords, by posting year
    myYear: store.get("advicehub-my-year", null),
  };

  // ---------- years & subjects ----------
  function sectionsFor(year) {
    const y = yearInfo[year];
    if (!y) return [];
    const general = { id: "general", name: "General", emoji: "🌟", group: "general" };
    const extras = (y.extras || []).map((x) => ({ ...x, group: "general" }));
    return [general, ...extras, ...(STAGES[y.stage]?.subjects || [])];
  }
  const subjectOf = (year, id) =>
    sectionsFor(year).find((s) => s.id === id) || { id, name: id, emoji: "📁", group: "general" };
  const yearColor = (y) => yearInfo[y]?.color || cfg.brandColor;
  const postsFor = (year, subject) =>
    state.posts.filter((p) => p.audience_year === year && (subject == null || p.subject === subject));
  const best = (list) => [...list].sort((a, b) =>
    (b.pinned - a.pinned) || (b.helpful_count - a.helpful_count) || (new Date(b.created_at) - new Date(a.created_at)));

  // ---------- branding ----------
  const root = document.documentElement;
  root.style.setProperty("--brand", cfg.brandColor);
  if (cfg.accentColor) root.style.setProperty("--accent-brand", cfg.accentColor);
  $$("[data-school-full]").forEach((el) => (el.textContent = cfg.schoolFullName || cfg.schoolName));
  $$("[data-site-name]").forEach((el) => (el.textContent = cfg.siteName));
  document.title = cfg.siteName + " · " + cfg.schoolName;
  if (API.isDemo) $("#demo-banner").hidden = false;

  // ---------- utils ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
  function linkify(text) {
    return esc(text)
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, "<br>");
  }
  function toast(msg, ms = 2600) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), ms);
  }
  // The page takes the colour of the year you're in
  function setYearColour(year) {
    if (year) { root.style.setProperty("--yc", yearColor(year)); document.body.classList.add("in-year"); }
    else { root.style.removeProperty("--yc"); document.body.classList.remove("in-year"); }
  }

  // ---------- a tip ----------
  function tipCard(p, { full = false } = {}) {
    const link = safeUrl(p.link);
    const voted = state.voted.has(p.id);
    const reported = state.reported.has(p.id);
    const open = full || state.expanded.has(p.id);
    const by = p.author_year || 13;
    return `
      <article class="tip ${p.pinned ? "is-pinned" : ""}" data-id="${esc(p.id)}">
        ${p.pinned ? `<span class="pin" title="Pinned">📌</span>` : ""}
        <div class="tip-body ${open ? "" : "clamp"}">${p.title ? `<strong>${esc(p.title)}</strong><br>` : ""}${linkify(p.body)}</div>
        ${open ? "" : `<button class="more" data-action="expand" hidden>Read more</button>`}
        ${link ? `<a class="tip-link" href="${esc(link)}" target="_blank" rel="noopener">🔗 <span>${esc(hostOf(link))}</span> ↗</a>` : ""}
        ${full ? "" : `
        <footer class="tip-foot">
          <span class="by" style="--by:${yearColor(Math.min(by, 13))}" title="From a Year ${by} student">Y${by}</span>
          <button class="helpful ${voted ? "is-on" : ""}" data-action="helpful" aria-pressed="${voted}" aria-label="Helpful">👍 <b>${p.helpful_count}</b></button>
          <button class="dots" data-action="menu" aria-label="More">⋯</button>
        </footer>
        <div class="tip-menu" hidden>
          <button data-action="report" ${reported ? "disabled" : ""}>${reported ? "Reported" : "🚩 Report"}</button>
        </div>
        ${state.adminPw ? `
        <div class="admin-tools">
          <button data-action="edit">✏️ Edit</button>
          <button data-action="pin">${p.pinned ? "Unpin" : "📌 Pin"}</button>
          <button data-action="delete" class="danger">🗑️ Delete</button>
        </div>` : ""}`}
      </article>`;
  }
  // Show "Read more" only on tips that are actually cut off
  function markClamps() {
    $$(".tip-body.clamp").forEach((el) => {
      const more = el.parentElement.querySelector(".more");
      if (more) more.hidden = el.scrollHeight <= el.clientHeight + 2;
    });
  }

  // ---------- pages ----------
  function viewHome() {
    setYearColour(null);
    app.innerHTML = `
      <h1 class="ask">Which year are you in?</h1>
      <nav class="years">
        ${YEARS.map((y) => `
          <a class="year-tile" href="#/y/${y.year}" style="--yc:${y.color}">
            <small>Year</small><b>${y.year}</b>
          </a>`).join("")}
      </nav>`;
  }

  function viewYear(year) {
    const sections = sectionsFor(year);
    const count = (s) => postsFor(year, s.id).length;
    const general = sections.filter((s) => s.group === "general");
    const subjects = sections.filter((s) => s.group !== "general");
    // Subjects with tips first (most tips first), empty ones faded at the end
    const withTips = subjects.filter((s) => count(s)).sort((a, b) => count(b) - count(a));
    const empty = subjects.filter((s) => !count(s));
    // Only fade empty subjects once the year has some tips (so a brand-new site doesn't look dead)
    const fade = (s) => withTips.length && !count(s);
    const tile = (s, cls = "") => `
      <a class="tile ${cls} ${fade(s) ? "is-empty" : ""}" href="#/y/${year}/${esc(s.id)}" style="--gc:${groupById[s.group]?.color}">
        <span class="tile-emoji">${s.emoji}</span><span class="tile-name">${esc(s.name)}</span>
      </a>`;

    setYearColour(year);
    app.innerHTML = `
      <div class="page-head">
        <a class="back" href="#/" aria-label="Back">←</a>
        <h1 class="year-title">Year ${year}</h1>
      </div>
      <div class="tiles tiles-big">${general.map((s) => tile(s, "tile-big")).join("")}</div>
      <div class="tiles">${[...withTips, ...empty].map((s) => tile(s)).join("")}</div>`;
  }

  function viewSubject(year, id) {
    const s = subjectOf(year, id);
    const tips = best(postsFor(year, id));
    setYearColour(year);
    app.innerHTML = `
      <div class="page-head">
        <a class="back" href="#/y/${year}" aria-label="Back to Year ${year}">←</a>
        <h1 class="subject-title"><span>${s.emoji}</span> ${esc(s.name)}</h1>
        <span class="year-pill">Y${year}</span>
      </div>
      ${tips.length ? `
        <button class="add-tip" data-action="add">＋ Add a tip</button>
        <div class="tips">${tips.map((p) => tipCard(p)).join("")}</div>`
      : `
        <div class="empty">
          <p>No tips yet</p>
          <button class="big-btn" data-action="add">＋ Be the first</button>
        </div>`}`;
    markClamps();
  }

  function viewAdmin() {
    setYearColour(null);
    if (!state.adminPw) {
      app.innerHTML = `<div class="empty"><p>🔒</p><button class="big-btn" id="admin-login-inline">Admin log in</button></div>`;
      $("#admin-login-inline").addEventListener("click", openAdminLogin);
      return;
    }
    const p = state.queue[0];
    if (!p) {
      app.innerHTML = `<div class="empty done"><p class="done-tick">✓</p><p>All checked</p><a class="big-btn" href="#/">Done</a></div>`;
      return;
    }
    const s = subjectOf(p.audience_year, p.subject);
    const reported = p.status === "hidden";
    app.innerHTML = `
      <div class="check">
        <div class="check-top">
          <span class="check-left">${state.queue.length} to check</span>
          ${state.queue.length > 1 ? `<button class="link-btn" id="keep-all">✓ Keep all ${state.queue.length}</button>` : ""}
        </div>
        <div class="check-context">
          ${reported ? `<span class="flag">🚩 Reported</span>` : ""}
          <span class="year-pill" style="--yc:${yearColor(p.audience_year)}">For Y${p.audience_year}</span>
          <span>${s.emoji} ${esc(s.name)}</span>
          <span class="muted">from Y${p.author_year}</span>
        </div>
        ${tipCard(p, { full: true })}
        <div class="check-buttons">
          <button class="big-btn btn-remove" data-check="remove">✕ Remove</button>
          <button class="big-btn btn-keep" data-check="keep">✓ ${reported ? "Restore" : "Keep"}</button>
        </div>
        <button class="link-btn check-edit" data-check="edit">✏️ Edit first</button>
      </div>`;

    app.querySelectorAll("[data-check]").forEach((b) => b.addEventListener("click", async () => {
      const what = b.dataset.check;
      if (what === "edit") return openPostDialog({ post: p });
      app.querySelectorAll("[data-check]").forEach((x) => (x.disabled = true));
      try {
        if (what === "keep") await API.adminSetStatus(state.adminPw, [p.id], "approved");
        else await API.adminDeletePost(state.adminPw, p.id);
        state.queue.shift();
        updateQueueCount();
        toast(what === "keep" ? "Kept ✓" : "Removed");
        viewAdmin();
        if (what === "keep") loadPosts();
      } catch (err) { adminError(err); }
    }));
    $("#keep-all")?.addEventListener("click", async () => {
      if (!confirm(`Keep all ${state.queue.length}?`)) return;
      try {
        await API.adminSetStatus(state.adminPw, state.queue.map((x) => x.id), "approved");
        state.queue = [];
        updateQueueCount();
        toast("All kept ✓");
        viewAdmin();
        loadPosts();
      } catch (err) { adminError(err); }
    });
  }

  // ---------- router ----------
  let lastRoute = null;
  function route() {
    const [, view, a, b] = (location.hash.replace(/^#/, "") || "/").split("/");
    return { view, year: a && Number(a), subject: b && decodeURIComponent(b) };
  }
  function render() {
    if (!state.loaded) { app.innerHTML = `<div class="loading"><span class="spinner"></span></div>`; return; }
    if (state.error) {
      app.innerHTML = `<div class="empty"><p>😕 Couldn't load</p><button class="big-btn" onclick="location.reload()">Try again</button></div>`;
      return;
    }
    const r = route();
    const key = location.hash;
    if (key !== lastRoute) { if (lastRoute !== null) window.scrollTo(0, 0); lastRoute = key; }
    if (r.view === "y" && yearInfo[r.year] && r.subject) return viewSubject(r.year, r.subject);
    if (r.view === "y" && yearInfo[r.year]) return viewYear(r.year);
    if (r.view === "admin") return viewAdmin();
    viewHome();
  }
  window.addEventListener("hashchange", render);
  window.addEventListener("resize", () => markClamps());

  async function loadPosts() {
    try { state.posts = await API.listPosts(); state.error = null; }
    catch (e) { state.error = e.message; }
    state.loaded = true;
    // On the admin screen, don't reset the post being checked — only replace the loading spinner
    if (route().view !== "admin" || app.querySelector(".loading")) render();
  }
  async function loadQueue() {
    if (!state.adminPw) { state.queue = []; updateQueueCount(); return; }
    try { state.queue = await API.adminListUnapproved(state.adminPw); }
    catch (e) { adminError(e); return; }
    updateQueueCount();
    if (route().view === "admin" && state.loaded) render();
  }
  function updateQueueCount() {
    $("#queue-count").textContent = state.queue.length;
    $("#queue-btn").hidden = !state.adminPw;
    $("#queue-btn").classList.toggle("has-items", state.queue.length > 0);
  }

  // ---------- tip actions ----------
  const findPost = (id) => state.posts.find((p) => p.id === id) || state.queue.find((p) => p.id === id);

  app.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const card = btn.closest(".tip");
    const post = card && findPost(card.dataset.id);
    const action = btn.dataset.action;
    const r = route();

    if (action === "add") return openPostDialog({ year: r.year, subject: r.subject });
    if (!post) return;

    if (action === "expand") {
      state.expanded.add(post.id);
      card.querySelector(".tip-body").classList.remove("clamp");
      btn.remove();
    }
    if (action === "menu") card.querySelector(".tip-menu").hidden = !card.querySelector(".tip-menu").hidden;
    if (action === "helpful") {
      btn.disabled = true;
      try {
        post.helpful_count = await API.toggleHelpful(post.id, voterId);
        state.voted.has(post.id) ? state.voted.delete(post.id) : state.voted.add(post.id);
        store.set("advicehub-voted", [...state.voted]);
        btn.classList.toggle("is-on", state.voted.has(post.id));
        btn.setAttribute("aria-pressed", state.voted.has(post.id));
        btn.querySelector("b").textContent = post.helpful_count;
      } catch (err) { toast("Couldn't save"); }
      btn.disabled = false;
    }
    if (action === "report") {
      if (!confirm("Report this tip?")) return;
      try {
        await API.reportPost(post.id, voterId);
        state.reported.add(post.id);
        store.set("advicehub-reported", [...state.reported]);
        toast("Reported 🚩");
        await loadPosts();
      } catch (err) { toast("Couldn't report"); }
    }
    if (action === "edit") openPostDialog({ post });
    if (action === "pin") {
      try {
        Object.assign(post, await API.adminEditPost(state.adminPw, post.id, editData(post, { pinned: !post.pinned })));
        toast(post.pinned ? "Pinned 📌" : "Unpinned");
        render();
      } catch (err) { adminError(err); }
    }
    if (action === "delete") {
      if (!confirm("Delete this tip?")) return;
      try {
        await API.adminDeletePost(state.adminPw, post.id);
        state.posts = state.posts.filter((p) => p.id !== post.id);
        toast("Deleted");
        render();
      } catch (err) { adminError(err); }
    }
  });

  function adminError(err) {
    toast(err.message);
    if (/admin password/i.test(err.message)) setAdmin(null);
  }
  const editData = (p, over = {}) => ({
    audienceYear: p.audience_year, subject: p.subject, body: p.body, link: p.link, pinned: p.pinned, ...over,
  });

  // ---------- add / edit form ----------
  $$("dialog [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  $$("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

  const form = $("#post-form");
  const f = form.elements;
  const pick = { author: null, audience: null };
  let editing = null;

  function yearButtons(el, years, selected, kind) {
    el.innerHTML = years.map((y) => `
      <button type="button" class="yb ${y === selected ? "is-on" : ""}" data-${kind}="${y}" style="--yc:${yearColor(y)}">${y}</button>`).join("");
  }
  // Younger years only, except Year 13s can also post for next year's Year 13
  const allowedFor = (author) =>
    YEARS.map((y) => y.year).filter((y) => editing || !author || y < author || (author === 13 && y === 13));

  function drawForm() {
    yearButtons($("#author-buttons"), POSTING_YEARS, pick.author, "author");
    const allowed = allowedFor(pick.author);
    if (pick.audience && !allowed.includes(pick.audience)) pick.audience = null;
    yearButtons($("#audience-buttons"), allowed, pick.audience, "audience");
    drawSubjects();
    drawPassword();
  }
  function drawSubjects() {
    const keep = f.subject.value || f.subject.dataset.want;
    if (!pick.audience) {
      f.subject.innerHTML = `<option value="">Pick a year first</option>`;
      f.subject.disabled = true;
      return;
    }
    f.subject.disabled = false;
    const sections = sectionsFor(pick.audience);
    f.subject.innerHTML = `<option value="" disabled>Choose…</option>` +
      sections.map((s) => `<option value="${esc(s.id)}">${s.emoji} ${esc(s.name)}</option>`).join("");
    f.subject.value = sections.some((s) => s.id === keep) ? keep : "";
  }
  function drawPassword() {
    if (editing) { $("#password-field").hidden = true; return; }
    const known = state.adminPw || (pick.author && state.yearPw[pick.author]);
    $("#password-label").textContent = pick.author ? `Year ${pick.author} password` : "Password";
    $("#password-field").hidden = !!known;
    f.password.value = known || "";
  }

  $("#author-buttons").addEventListener("click", (e) => {
    const b = e.target.closest("[data-author]"); if (!b) return;
    pick.author = Number(b.dataset.author);
    drawForm();
  });
  $("#audience-buttons").addEventListener("click", (e) => {
    const b = e.target.closest("[data-audience]"); if (!b) return;
    pick.audience = Number(b.dataset.audience);
    drawForm();
  });

  function openPostDialog({ year, subject, post } = {}) {
    editing = post || null;
    form.reset();
    $("#post-error").hidden = true;
    $("#post-dialog-title").textContent = editing ? "Edit tip" : "Add a tip";
    $("#post-submit").textContent = editing ? "Save" : "Post";
    $("#author-field").hidden = !!editing;
    $("#pinned-field").hidden = !editing;

    if (editing) {
      pick.author = post.author_year;
      pick.audience = post.audience_year;
      f.subject.dataset.want = post.subject;
      f.body.value = post.body || "";
      f.link.value = post.link || "";
      f.pinned.checked = !!post.pinned;
    } else {
      // Remembered year — but it has to be allowed to post for the year we're looking at
      pick.author = state.myYear;
      if (year && pick.author && !allowedFor(pick.author).includes(year)) pick.author = null;
      pick.audience = year || null;
      f.subject.dataset.want = subject || "";
    }
    f.subject.value = "";
    drawForm();
    $("#post-dialog").showModal();
    if (!editing && pick.author && pick.audience && f.subject.value) f.body.focus();
    else $("#post-dialog").focus();
  }
  $("#add-btn").addEventListener("click", () => { const r = route(); openPostDialog({ year: r.year, subject: r.subject }); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#post-error");
    const data = {
      authorYear: pick.author, audienceYear: pick.audience, subject: f.subject.value,
      body: f.body.value.trim(), link: f.link.value.trim(), pinned: f.pinned.checked,
    };
    const pw = editing ? state.adminPw : f.password.value;
    const problem =
      !editing && !data.authorYear ? "Choose your year" :
      !data.audienceYear ? "Choose who it's for" :
      !data.subject ? "Choose a subject" :
      data.body.length < 3 && !data.link ? "Write your tip" :
      API.hasBadWords(data.body, data.link) ? "Please keep it friendly" :
      !pw ? "Enter the password" : null;
    if (problem) { err.textContent = problem; err.hidden = false; return; }

    const submit = $("#post-submit");
    submit.disabled = true;
    try {
      if (editing) {
        Object.assign(editing, await API.adminEditPost(pw, editing.id, data));
        toast("Saved ✓");
        $("#post-dialog").close();
        await Promise.all([loadPosts(), loadQueue()]);
        render();
      } else {
        const created = await API.submitPost(pw, data);
        state.myYear = data.authorYear; store.set("advicehub-my-year", data.authorYear);
        if (pw !== state.adminPw) { state.yearPw[data.authorYear] = pw; store.set("advicehub-year-pw", state.yearPw); }
        $("#post-dialog").close();
        if (created.status === "approved") {
          state.posts.unshift(created);
          toast("Posted ✓");
          const target = `#/y/${created.audience_year}/${encodeURIComponent(created.subject)}`;
          if (location.hash === target) render(); else location.hash = target;
        } else {
          toast("Being checked ✓", 3500);
          if (state.adminPw) loadQueue();
        }
      }
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      if (/password/i.test(ex.message)) {
        if (editing) setAdmin(null);
        else {
          delete state.yearPw[data.authorYear]; store.set("advicehub-year-pw", state.yearPw);
          $("#password-field").hidden = false;
          f.password.value = "";
          f.password.focus();
        }
      }
    } finally {
      submit.disabled = false;
    }
  });

  // ---------- admin ----------
  function setAdmin(pw) {
    state.adminPw = pw;
    if (pw) store.set("advicehub-admin", pw, sessionStorage); else store.del("advicehub-admin", sessionStorage);
    $("#admin-btn").textContent = pw ? "Exit admin" : "Admin";
    document.body.classList.toggle("is-admin", !!pw);
    if (pw) loadQueue(); else { state.queue = []; updateQueueCount(); }
    render();
  }
  function openAdminLogin() {
    $("#admin-form").reset();
    $("#admin-error").hidden = true;
    $("#admin-dialog").showModal();
  }
  $("#admin-btn").addEventListener("click", () => {
    if (state.adminPw) { setAdmin(null); toast("Admin off"); if (route().view === "admin") location.hash = "#/"; }
    else openAdminLogin();
  });
  $("#admin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = e.target.password.value;
    const err = $("#admin-error");
    try {
      if (await API.checkPassword("admin", pw)) {
        $("#admin-dialog").close();
        setAdmin(pw);
        toast("Admin on");
      } else { err.textContent = "Wrong password"; err.hidden = false; }
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });

  // ---------- go ----------
  $("#admin-btn").textContent = state.adminPw ? "Exit admin" : "Admin";
  document.body.classList.toggle("is-admin", !!state.adminPw);
  updateQueueCount();
  render();
  loadPosts();
  loadQueue();
})();
