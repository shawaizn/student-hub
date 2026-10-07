// =====================================================================
//  Student Advice Hub — app
// =====================================================================
(function () {
  const cfg = window.SITE_CONFIG;
  const GROUPS = window.SUBJECT_GROUPS;
  const STAGES = window.STAGES;
  const YEARS = window.YEARS;
  const TYPES = window.POST_TYPES;
  const POSTING_YEARS = window.POSTING_YEARS;
  const TRUSTED_YEARS = window.TRUSTED_YEARS;
  const groupById = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
  const typeById = Object.fromEntries(TYPES.map((t) => [t.id, t]));
  const yearInfo = Object.fromEntries(YEARS.map((y) => [y.year, y]));

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const app = $("#app");

  // ---------- small storage helpers (never throw) ----------
  const store = {
    get(k, d, s = localStorage) { try { const v = s.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v, s = localStorage) { try { s.setItem(k, JSON.stringify(v)); } catch {} },
    del(k, s = localStorage) { try { s.removeItem(k); } catch {} },
  };

  let voterId = store.get("advicehub-voter", null);
  if (!voterId) { voterId = crypto.randomUUID(); store.set("advicehub-voter", voterId); }

  const state = {
    posts: [],
    queue: [],            // admin only: pending + hidden posts
    loaded: false,
    error: null,
    voted: new Set(store.get("advicehub-voted", [])),
    reported: new Set(store.get("advicehub-reported", [])),
    adminPw: store.get("advicehub-admin", null, sessionStorage),
    yearPw: store.get("advicehub-year-pw", {}),   // remembered passwords, by posting year
    myYear: store.get("advicehub-my-year", null),
    filterType: "all",
    sort: "helpful",
    query: "",
  };

  // ---------- subjects for a year ----------
  function sectionsFor(year) {
    const y = yearInfo[year];
    if (!y) return [];
    const general = { id: "general", name: "General", emoji: "🌟", group: "general",
      blurb: "Anything and everything about being in Year " + year };
    const extras = (y.extras || []).map((x) => ({ ...x, group: "general" }));
    return [general, ...extras, ...(STAGES[y.stage]?.subjects || [])];
  }
  function subjectOf(year, id) {
    return sectionsFor(year).find((s) => s.id === id) || { id, name: id, emoji: "📁", group: "general" };
  }
  const subjectColor = (s) => (groupById[s?.group] || GROUPS[0]).color;
  const yearColor = (y) => yearInfo[y]?.color || cfg.accentColor;

  // ---------- branding ----------
  document.documentElement.style.setProperty("--brand", cfg.brandColor);
  if (cfg.accentColor) document.documentElement.style.setProperty("--accent-brand", cfg.accentColor);
  $$("[data-school]").forEach((el) => (el.textContent = cfg.schoolName));
  $$("[data-school-full]").forEach((el) => (el.textContent = cfg.schoolFullName || cfg.schoolName));
  $$("[data-motto]").forEach((el) => (el.textContent = cfg.motto || ""));
  $$("[data-site-name]").forEach((el) => (el.textContent = cfg.siteName));
  document.title = cfg.siteName + " · " + cfg.schoolName;
  if (API.isDemo) $("#demo-banner").hidden = false;

  // ---------- utils ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);
  function linkify(text) {
    return esc(text)
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, "<br>");
  }
  function timeAgo(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return "just now";
    const units = [[31536000, "year"], [2592000, "month"], [604800, "week"], [86400, "day"], [3600, "hour"], [60, "minute"]];
    for (const [n, name] of units) if (s >= n) { const v = Math.floor(s / n); return v + " " + name + (v > 1 ? "s" : "") + " ago"; }
  }
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

  function toast(msg, ms = 2800) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), ms);
  }

  function sortPosts(list, sort = state.sort) {
    return [...list].sort((a, b) =>
      (b.pinned - a.pinned) ||
      (sort === "helpful" ? b.helpful_count - a.helpful_count : 0) ||
      new Date(b.created_at) - new Date(a.created_at));
  }
  const postsFor = (year, subject) =>
    state.posts.filter((p) => p.audience_year === year && (subject == null || p.subject === subject));

  // ---------- rendering: post card ----------
  function postCard(p, { showContext = false, queue = false } = {}) {
    const t = typeById[p.type] || { name: p.type, emoji: "💬" };
    const subj = subjectOf(p.audience_year, p.subject);
    const link = safeUrl(p.link);
    const voted = state.voted.has(p.id);
    const reported = state.reported.has(p.id);
    const authorYear = p.author_year || 13;
    return `
      <article class="post ${p.pinned ? "is-pinned" : ""} ${queue ? "is-queued" : ""}" data-id="${esc(p.id)}" style="--accent:${subjectColor(subj)}">
        <div class="post-meta">
          <span class="chip chip-type type-${esc(p.type)}">${t.emoji} ${esc(t.name)}</span>
          ${showContext || queue ? `
            <a class="chip chip-year" href="#/y/${p.audience_year}" style="--yc:${yearColor(p.audience_year)}">For Year ${p.audience_year}</a>
            <a class="chip chip-subject" href="#/y/${p.audience_year}/${esc(subj.id)}">${subj.emoji} ${esc(subj.name)}</a>` : ""}
          ${p.pinned ? `<span class="chip chip-pin">📌 Pinned</span>` : ""}
          ${queue && p.status === "hidden" ? `<span class="chip chip-flag">🚩 Hidden after ${p.report_count} reports</span>` : ""}
          ${queue && p.status === "pending" ? `<span class="chip chip-wait">⏳ Waiting</span>` : ""}
        </div>
        <h3 class="post-title">${esc(p.title)}</h3>
        ${p.body ? `<div class="post-body">${linkify(p.body)}</div>` : ""}
        ${link ? `<a class="post-link" href="${esc(link)}" target="_blank" rel="noopener"><span>🔗</span><span class="post-link-host">${esc(hostOf(link))}</span><span class="post-link-arrow">↗</span></a>` : ""}
        <footer class="post-foot">
          <span class="post-author"><span class="avatar" style="--yc:${yearColor(Math.min(authorYear, 12))}">Y${authorYear}</span>A Year ${authorYear} student · <time datetime="${esc(p.created_at)}">${timeAgo(p.created_at)}</time></span>
          ${queue ? "" : `
          <span class="post-actions">
            <button class="report-btn ${reported ? "is-on" : ""}" data-action="report" title="${reported ? "You reported this" : "Report this post"}" aria-label="Report this post" ${reported ? "disabled" : ""}>🚩</button>
            <button class="helpful-btn ${voted ? "is-on" : ""}" data-action="helpful" aria-pressed="${voted}" title="${voted ? "Remove your vote" : "Mark as helpful"}">
              👍 <span>Helpful</span> <b>${p.helpful_count}</b>
            </button>
          </span>`}
        </footer>
        ${queue ? `
          <div class="admin-tools">
            <button class="btn btn-small btn-approve" data-action="approve">✅ ${p.status === "hidden" ? "Restore" : "Approve"}</button>
            <button class="btn btn-small" data-action="edit">✏️ Edit</button>
            <button class="btn btn-small btn-danger" data-action="delete">❌ ${p.status === "hidden" ? "Delete" : "Reject"}</button>
          </div>` : state.adminPw ? `
          <div class="admin-tools">
            <button class="btn btn-small" data-action="edit">✏️ Edit / move</button>
            <button class="btn btn-small" data-action="pin">${p.pinned ? "Unpin" : "📌 Pin"}</button>
            <button class="btn btn-small btn-danger" data-action="delete">🗑️ Delete</button>
          </div>` : ""}
      </article>`;
  }

  function emptyState(msg, year, subjectId) {
    return `<div class="empty">
      <div class="empty-emoji">🌱</div>
      <p>${msg}</p>
      <button class="btn btn-primary" data-action="add" data-year="${year || ""}" data-subject="${esc(subjectId || "")}">＋ Be the first to add advice</button>
    </div>`;
  }

  function searchBox(onPage) {
    return `<form class="search ${onPage ? "search-page" : ""}" id="search-form" role="search">
      <span class="search-icon">🔎</span>
      <input id="search-input" type="search" placeholder="Search all advice… e.g. revision, options, friends" value="${esc(state.query)}" aria-label="Search all advice">
    </form>`;
  }

  // ---------- views ----------
  function viewHome() {
    const top = sortPosts(state.posts.filter((p) => p.helpful_count > 0), "helpful").slice(0, 3);
    const recent = sortPosts(state.posts, "new").filter((p) => !top.includes(p)).slice(0, 4);
    const total = state.posts.length;
    const subjectsCovered = new Set(state.posts.map((p) => p.audience_year + "/" + p.subject)).size;
    const helpers = state.posts.length ? new Set(state.posts.map((p) => p.author_year)).size : 0;

    app.innerHTML = `
      <section class="hero">
        <div class="hero-text">
          <p class="eyebrow">${esc(cfg.schoolName)}${cfg.motto ? ` <span class="eyebrow-motto">${esc(cfg.motto)}</span>` : ""}</p>
          <h1>Advice from the people who've <span class="hl">just done it</span>.</h1>
          <p class="lead">${esc(cfg.tagline)} Pick your year to get started.</p>
          ${searchBox(false)}
        </div>
        <div class="hero-stats">
          <div class="stat"><b>${total}</b><span>pieces of advice</span></div>
          <div class="stat"><b>${subjectsCovered}</b><span>sections covered</span></div>
          <div class="stat"><b>${helpers}</b><span>year groups helping</span></div>
        </div>
      </section>

      <section class="years">
        <h2 class="section-title">👋 Which year are you in?</h2>
        <div class="year-grid">
          ${YEARS.map((y) => {
            const n = postsFor(y.year).length;
            return `<a class="year-card" href="#/y/${y.year}" style="--yc:${y.color}">
              <span class="year-badge"><small>Year</small>${y.year}</span>
              <span class="year-info">
                <span class="year-stage">${esc(STAGES[y.stage]?.name || "")}</span>
                <span class="year-blurb">${esc(y.blurb)}</span>
                <span class="year-count">${n ? `${n} piece${n > 1 ? "s" : ""} of advice` : "No advice yet — be the first"}</span>
              </span>
              <span class="year-arrow">→</span>
            </a>`;
          }).join("")}
        </div>
      </section>

      ${top.length ? `
        <section class="highlights">
          <h2 class="section-title">🏆 Most helpful across the school</h2>
          <div class="post-grid">${top.map((p) => postCard(p, { showContext: true })).join("")}</div>
        </section>` : ""}

      ${recent.length ? `
        <section class="highlights">
          <h2 class="section-title">🆕 Recently added</h2>
          <div class="post-grid">${recent.map((p) => postCard(p, { showContext: true })).join("")}</div>
        </section>` : ""}

      <section class="how">
        <h2 class="section-title small">How it works</h2>
        <div class="how-grid">
          <div class="how-step"><span>📖</span><b>Read</b> advice for your year, by subject or in General.</div>
          <div class="how-step"><span>👍</span><b>Vote</b> for the advice that helped you most, so the best rises to the top.</div>
          <div class="how-step"><span>✍️</span><b>Share</b> advice with any younger year using your year's password.</div>
          <div class="how-step"><span>🚩</span><b>Report</b> anything that isn't OK. It gets hidden and checked.</div>
        </div>
      </section>
    `;
    bindSearch();
  }

  function viewYear(year) {
    const y = yearInfo[year];
    if (!y) { location.hash = "#/"; return; }
    const sections = sectionsFor(year);
    const all = postsFor(year);
    const top = sortPosts(all.filter((p) => p.helpful_count > 0), "helpful").slice(0, 3);

    const groupsHtml = GROUPS.map((g) => {
      const subs = sections.filter((s) => s.group === g.id);
      if (!subs.length) return "";
      const big = g.id === "general";
      return `
        <section class="group">
          <h2 class="group-title"><span class="dot" style="background:${g.color}"></span>${esc(g.name)}</h2>
          <div class="subject-grid ${big ? "subject-grid-big" : ""}">
            ${subs.map((s) => {
              const n = postsFor(year, s.id).length;
              return `<a class="subject-card ${big ? "subject-card-big" : ""}" href="#/y/${year}/${esc(s.id)}" style="--accent:${g.color}">
                <span class="subject-emoji">${s.emoji}</span>
                <span class="subject-info">
                  <span class="subject-name">${esc(s.name)}</span>
                  ${big && s.blurb ? `<span class="subject-blurb">${esc(s.blurb)}</span>` : ""}
                  <span class="subject-count">${n ? `${n} post${n > 1 ? "s" : ""}` : "No posts yet"}</span>
                </span>
              </a>`;
            }).join("")}
          </div>
        </section>`;
    }).join("");

    app.innerHTML = `
      <nav class="crumbs"><a href="#/">← All years</a></nav>
      <section class="year-hero" style="--yc:${y.color}">
        <span class="year-badge year-badge-lg"><small>Year</small>${year}</span>
        <div>
          <p class="eyebrow">${esc(STAGES[y.stage]?.name || "")} · ${all.length} piece${all.length === 1 ? "" : "s"} of advice</p>
          <h1>Advice for Year ${year}</h1>
          <p class="lead">${esc(y.blurb)}</p>
        </div>
        <button class="btn btn-primary year-hero-add" data-action="add" data-year="${year}">＋ Add advice for Year ${year}</button>
      </section>
      <div class="year-switch">${YEARS.map((o) => `<a class="pill ${o.year === year ? "is-on" : ""}" href="#/y/${o.year}" style="--yc:${o.color}">Year ${o.year}</a>`).join("")}</div>
      ${top.length ? `
        <section class="highlights highlights-tight">
          <h2 class="section-title">🏆 Most helpful for Year ${year}</h2>
          <div class="post-grid">${top.map((p) => postCard(p, { showContext: true })).join("")}</div>
        </section>` : ""}
      <div class="groups">${groupsHtml}</div>
    `;
  }

  function filterBar(list) {
    const counts = Object.fromEntries(TYPES.map((t) => [t.id, list.filter((p) => p.type === t.id).length]));
    return `
      <div class="filter-bar">
        <div class="filters" role="tablist" aria-label="Filter by type">
          <button class="filter ${state.filterType === "all" ? "is-on" : ""}" data-filter="all">All <b>${list.length}</b></button>
          ${TYPES.filter((t) => counts[t.id]).map((t) => `<button class="filter ${state.filterType === t.id ? "is-on" : ""}" data-filter="${t.id}">${t.emoji} ${esc(t.name)} <b>${counts[t.id]}</b></button>`).join("")}
        </div>
        <label class="sort">Sort
          <select id="sort-select">
            <option value="helpful" ${state.sort === "helpful" ? "selected" : ""}>Most helpful</option>
            <option value="new" ${state.sort === "new" ? "selected" : ""}>Newest</option>
          </select>
        </label>
      </div>`;
  }

  function viewSubject(year, id) {
    if (!yearInfo[year]) { location.hash = "#/"; return; }
    const s = subjectOf(year, id);
    const color = subjectColor(s);
    const all = postsFor(year, id);
    const list = sortPosts(state.filterType === "all" ? all : all.filter((p) => p.type === state.filterType));
    const others = sectionsFor(year).filter((x) => x.group === s.group && x.id !== s.id);

    app.innerHTML = `
      <nav class="crumbs"><a href="#/">All years</a> <span>/</span> <a href="#/y/${year}">Year ${year}</a></nav>
      <section class="subject-hero" style="--accent:${color}">
        <span class="subject-hero-emoji">${s.emoji}</span>
        <div>
          <p class="eyebrow"><span class="chip chip-year" style="--yc:${yearColor(year)}">Year ${year}</span> ${esc((groupById[s.group] || {}).name || "")}</p>
          <h1>${esc(s.name)}</h1>
          <p class="lead">${s.blurb ? esc(s.blurb) : `Advice, revision tips and resources for Year ${year} ${esc(s.name)}, from students who've done it.`}</p>
        </div>
        <button class="btn btn-primary subject-hero-add" data-action="add" data-year="${year}" data-subject="${esc(s.id)}">＋ Add advice</button>
      </section>
      ${all.length ? filterBar(all) : ""}
      <div class="post-list">
        ${all.length ? (list.length ? list.map((p) => postCard(p)).join("") : `<p class="muted">Nothing of this type yet.</p>`)
                     : emptyState(`No ${esc(s.name)} advice for Year ${year} yet.`, year, s.id)}
      </div>
      ${others.length ? `
        <section class="related">
          <h2 class="section-title small">More for Year ${year}</h2>
          <div class="pill-row">${others.map((o) => `<a class="pill" href="#/y/${year}/${esc(o.id)}">${o.emoji} ${esc(o.name)}</a>`).join("")}</div>
        </section>` : ""}
    `;
  }

  function viewSearch() {
    const q = state.query.trim().toLowerCase();
    // ignore plurals so "papers" finds "paper"
    const words = q.split(/\s+/).filter(Boolean).map((w) => (w.length > 3 ? w.replace(/s$/, "") : w));
    const results = sortPosts(state.posts.filter((p) => {
      const hay = [p.title, p.body, subjectOf(p.audience_year, p.subject).name, (typeById[p.type] || {}).name, "year " + p.audience_year]
        .join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    }));
    app.innerHTML = `
      <nav class="crumbs"><a href="#/">← All years</a></nav>
      ${searchBox(true)}
      <h2 class="section-title small">${results.length} result${results.length === 1 ? "" : "s"} for “${esc(state.query)}”</h2>
      <div class="post-list">${results.map((p) => postCard(p, { showContext: true })).join("") || `<p class="muted">No advice matches that yet — try another word.</p>`}</div>
    `;
    bindSearch(true);
  }

  function viewAdmin() {
    if (!state.adminPw) {
      app.innerHTML = `<div class="empty"><div class="empty-emoji">🔒</div><p>Log in as admin to see the approval queue.</p>
        <button class="btn btn-primary" id="admin-login-inline">Admin login</button></div>`;
      $("#admin-login-inline").addEventListener("click", openAdminLogin);
      return;
    }
    const pending = state.queue.filter((p) => p.status === "pending");
    const hidden = state.queue.filter((p) => p.status === "hidden");
    app.innerHTML = `
      <nav class="crumbs"><a href="#/">← All years</a></nav>
      <section class="admin-head">
        <div>
          <h1>Approval queue</h1>
          <p class="lead">Posts from Years ${POSTING_YEARS.filter((y) => !TRUSTED_YEARS.includes(y)).join(", ")} wait here until you approve them.
            Posts reported by 3 people are hidden and also land here.</p>
        </div>
        <button class="btn" id="queue-refresh">↻ Refresh</button>
      </section>

      <section class="queue-section">
        <div class="queue-title">
          <h2 class="section-title">⏳ Waiting for approval <span class="count-pill">${pending.length}</span></h2>
          ${pending.length > 1 ? `<button class="btn btn-primary btn-small" id="approve-all">✅ Approve all ${pending.length}</button>` : ""}
        </div>
        <div class="post-list">${pending.map((p) => postCard(p, { queue: true })).join("") || `<p class="muted all-clear">🎉 All clear — nothing waiting.</p>`}</div>
      </section>

      <section class="queue-section">
        <h2 class="section-title">🚩 Hidden by reports <span class="count-pill">${hidden.length}</span></h2>
        <div class="post-list">${hidden.map((p) => postCard(p, { queue: true })).join("") || `<p class="muted all-clear">No reported posts.</p>`}</div>
      </section>
    `;
    $("#queue-refresh").addEventListener("click", async () => { await loadQueue(); toast("Queue refreshed"); });
    $("#approve-all")?.addEventListener("click", async () => {
      if (!confirm(`Approve all ${pending.length} waiting posts? Make sure you've read them first.`)) return;
      try {
        await API.adminSetStatus(state.adminPw, pending.map((p) => p.id), "approved");
        toast(`Approved ${pending.length} posts ✅`);
        await Promise.all([loadQueue(), loadPosts()]);
      } catch (err) { adminError(err); }
    });
  }

  function bindSearch(onSearchPage) {
    const form = $("#search-form"), input = $("#search-input");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      state.query = input.value;
      if (state.query.trim()) location.hash = "#/search/" + encodeURIComponent(state.query.trim());
    });
    if (onSearchPage) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      let t;
      input.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          state.query = input.value;
          history.replaceState(null, "", "#/search/" + encodeURIComponent(input.value.trim()));
          if (input.value.trim()) viewSearch(); else location.hash = "#/";
        }, 250);
      });
    }
  }

  // ---------- router ----------
  // #/  ·  #/y/7  ·  #/y/7/maths  ·  #/search/words  ·  #/admin
  let lastRoute = null;
  function currentRoute() {
    const [, view, a, b] = (location.hash.replace(/^#/, "") || "/").split("/");
    return { view, a: a && decodeURIComponent(a), b: b && decodeURIComponent(b) };
  }
  function render() {
    if (!state.loaded) {
      app.innerHTML = `<div class="loading"><div class="spinner"></div>Loading advice…</div>`;
      return;
    }
    if (state.error) {
      app.innerHTML = `<div class="empty"><div class="empty-emoji">😕</div><p>Couldn't load the advice right now.</p><p class="muted">${esc(state.error)}</p><button class="btn btn-primary" onclick="location.reload()">Try again</button></div>`;
      return;
    }
    const { view, a, b } = currentRoute();
    const routeKey = [view, a, b].join("/");
    if (routeKey !== lastRoute) {
      state.filterType = "all";
      if (lastRoute !== null) window.scrollTo(0, 0);
      lastRoute = routeKey;
    }
    if (view === "y" && a && b) return viewSubject(Number(a), b);
    if (view === "y" && a) return viewYear(Number(a));
    if (view === "search" && a) { state.query = a; return viewSearch(); }
    if (view === "admin") return viewAdmin();
    state.query = "";
    viewHome();
  }
  window.addEventListener("hashchange", render);

  async function loadPosts() {
    try {
      state.posts = await API.listPosts();
      state.error = null;
    } catch (e) {
      state.error = e.message;
    }
    state.loaded = true;
    render();
  }
  async function loadQueue() {
    if (!state.adminPw) { state.queue = []; updateQueueCount(); return; }
    try {
      state.queue = await API.adminListUnapproved(state.adminPw);
    } catch (e) { adminError(e); return; }
    updateQueueCount();
    if (currentRoute().view === "admin") render();
  }
  function updateQueueCount() {
    const n = state.queue.length;
    $("#queue-count").textContent = n;
    $("#queue-count").closest(".btn-queue").classList.toggle("has-items", n > 0);
  }

  // ---------- post actions (event delegation) ----------
  const findPost = (id) => state.posts.find((p) => p.id === id) || state.queue.find((p) => p.id === id);

  app.addEventListener("click", async (e) => {
    const filter = e.target.closest("[data-filter]");
    if (filter) { state.filterType = filter.dataset.filter; return render(); }

    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const card = btn.closest(".post");
    const post = card && findPost(card.dataset.id);
    const action = btn.dataset.action;

    if (action === "add") return openPostDialog({ year: Number(btn.dataset.year) || null, subject: btn.dataset.subject || null });
    if (!post) return;

    if (action === "helpful") {
      btn.disabled = true;
      try {
        const count = await API.toggleHelpful(post.id, voterId);
        post.helpful_count = count;
        state.voted.has(post.id) ? state.voted.delete(post.id) : state.voted.add(post.id);
        store.set("advicehub-voted", [...state.voted]);
        render();
      } catch (err) { toast("Couldn't save your vote: " + err.message); btn.disabled = false; }
    }
    if (action === "report") {
      if (!confirm("Report this post?\n\nIf 3 people report it, it's hidden until an admin checks it.")) return;
      try {
        await API.reportPost(post.id, voterId);
        state.reported.add(post.id);
        store.set("advicehub-reported", [...state.reported]);
        toast("Thanks — this post has been reported 🚩");
        await loadPosts();
      } catch (err) { toast("Couldn't report: " + err.message); }
    }
    if (action === "edit") openPostDialog({ post });
    if (action === "pin") {
      try {
        const updated = await API.adminEditPost(state.adminPw, post.id, toEditData(post, { pinned: !post.pinned }));
        Object.assign(post, updated);
        toast(post.pinned ? "Pinned 📌" : "Unpinned");
        render();
      } catch (err) { adminError(err); }
    }
    if (action === "approve") {
      try {
        await API.adminSetStatus(state.adminPw, [post.id], "approved");
        toast(post.status === "hidden" ? "Restored ✅" : "Approved ✅");
        await Promise.all([loadQueue(), loadPosts()]);
      } catch (err) { adminError(err); }
    }
    if (action === "delete") {
      if (!confirm(`Delete “${post.title}”?\n\nThis can't be undone.`)) return;
      try {
        await API.adminDeletePost(state.adminPw, post.id);
        state.posts = state.posts.filter((p) => p.id !== post.id);
        state.queue = state.queue.filter((p) => p.id !== post.id);
        updateQueueCount();
        toast("Post deleted");
        render();
      } catch (err) { adminError(err); }
    }
  });

  app.addEventListener("change", (e) => {
    if (e.target.id === "sort-select") { state.sort = e.target.value; render(); }
  });

  function adminError(err) {
    toast(err.message);
    if (/admin password/i.test(err.message)) setAdmin(null);
  }
  const toEditData = (p, over = {}) => ({
    audienceYear: p.audience_year, subject: p.subject, type: p.type, title: p.title,
    body: p.body, link: p.link, pinned: p.pinned, ...over,
  });

  // ---------- dialogs ----------
  $$("dialog [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  $$("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

  const postForm = $("#post-form");
  const f = postForm.elements;
  $("#type-picker").innerHTML = TYPES.map((t, i) => `
    <label class="type-option">
      <input type="radio" name="type" value="${t.id}" ${i === 0 ? "checked" : ""}>
      <span>${t.emoji} ${esc(t.name)}</span>
    </label>`).join("");
  f.authorYear.innerHTML = `<option value="" disabled selected>Your year…</option>` +
    POSTING_YEARS.map((y) => `<option value="${y}">Year ${y}</option>`).join("");
  const counter = $("[data-count]");
  f.body.addEventListener("input", () => (counter.textContent = f.body.value.length));

  let editing = null;

  function fillAudience(authorYear, wanted) {
    const options = YEARS.map((y) => y.year).filter((y) => editing || !authorYear || y < authorYear);
    f.audienceYear.innerHTML = `<option value="" disabled>For year…</option>` +
      options.map((y) => `<option value="${y}">Year ${y}</option>`).join("");
    const pick = options.includes(wanted) ? wanted : options.includes(Number(f.audienceYear.dataset.last)) ? Number(f.audienceYear.dataset.last) : options[options.length - 1];
    f.audienceYear.value = pick ?? "";
  }
  function fillSubjects(year, wanted) {
    const sections = sectionsFor(year);
    f.subject.innerHTML = `<option value="" disabled>Choose a subject…</option>` +
      GROUPS.map((g) => {
        const subs = sections.filter((s) => s.group === g.id);
        return subs.length ? `<optgroup label="${esc(g.name)}">${subs.map((s) => `<option value="${esc(s.id)}">${s.emoji} ${esc(s.name)}</option>`).join("")}</optgroup>` : "";
      }).join("");
    if (wanted && !sections.some((s) => s.id === wanted)) {
      f.subject.insertAdjacentHTML("beforeend", `<option value="${esc(wanted)}">${esc(wanted)}</option>`);
    }
    f.subject.value = wanted && [...f.subject.options].some((o) => o.value === wanted) ? wanted : "";
  }
  function updatePasswordField() {
    if (editing) { $("#password-field").hidden = true; $("#post-note").hidden = true; return; }
    const ay = Number(f.authorYear.value);
    const known = state.adminPw || (ay && state.yearPw[ay]);
    $("#password-label").textContent = ay ? `Year ${ay} password` : "Year password";
    $("#password-field").hidden = !!known;
    f.password.value = known || "";
    const note = $("#post-note");
    if (ay && !TRUSTED_YEARS.includes(ay) && !state.adminPw) {
      note.textContent = "⏳ Posts from Year " + ay + " are checked by an admin before they appear on the site.";
      note.hidden = false;
    } else if (ay) {
      note.textContent = "✨ Your post will appear on the site straight away.";
      note.hidden = false;
    } else note.hidden = true;
  }

  f.authorYear.addEventListener("change", () => {
    const ay = Number(f.authorYear.value);
    fillAudience(ay, Number(f.audienceYear.value));
    fillSubjects(Number(f.audienceYear.value), f.subject.value);
    updatePasswordField();
  });
  f.audienceYear.addEventListener("change", () => {
    f.audienceYear.dataset.last = f.audienceYear.value;
    fillSubjects(Number(f.audienceYear.value), f.subject.value);
  });

  function openPostDialog({ year, subject, post } = {}) {
    editing = post || null;
    postForm.reset();
    $("#post-error").hidden = true;
    const isEdit = !!post;
    $("#post-dialog-title").textContent = isEdit ? "Edit post" : "Share your advice";
    $("#post-dialog-sub").textContent = isEdit
      ? `Admin: change anything below, including moving it to another year or subject. Written by a Year ${post.author_year} student.`
      : "Help a younger year out! Say what you wish you'd known. Please keep it kind — no names of other students.";
    $("#post-submit").textContent = isEdit ? "Save changes" : "Post advice";
    $("#pinned-field").hidden = !isEdit;
    $("#author-year-field").hidden = isEdit;

    if (isEdit) {
      f.authorYear.value = post.author_year;
      fillAudience(null, post.audience_year);
      fillSubjects(post.audience_year, post.subject);
      postForm.querySelector(`input[name=type][value="${post.type}"]`)?.click();
      f.title.value = post.title;
      f.body.value = post.body || "";
      f.link.value = post.link || "";
      f.pinned.checked = !!post.pinned;
    } else {
      // Remembered "I'm in" year, but it must be older than the year we're posting for
      let ay = state.myYear;
      if (year && (!ay || ay <= year)) ay = Math.min(13, year + 1);
      f.authorYear.value = ay || "";
      f.audienceYear.dataset.last = year || "";
      fillAudience(ay, year);
      fillSubjects(Number(f.audienceYear.value), subject);
    }
    updatePasswordField();
    counter.textContent = f.body.value.length;
    $("#post-dialog").showModal();
    (!f.authorYear.value ? f.authorYear : !f.subject.value ? f.subject : f.title).focus();
  }

  $("#add-btn").addEventListener("click", () => {
    const { view, a, b } = currentRoute();
    openPostDialog(view === "y" ? { year: Number(a), subject: b || null } : {});
  });

  postForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = $("#post-error");
    const data = {
      authorYear: Number(f.authorYear.value), audienceYear: Number(f.audienceYear.value),
      subject: f.subject.value, type: postForm.querySelector("input[name=type]:checked")?.value,
      title: f.title.value.trim(), body: f.body.value.trim(), link: f.link.value.trim(), pinned: f.pinned.checked,
    };
    const pw = editing ? state.adminPw : f.password.value;
    const problem =
      !editing && !data.authorYear ? "Please choose which year you're in." :
      !data.audienceYear ? "Please choose which year the advice is for." :
      !data.subject ? "Please choose a subject." :
      data.title.length < 3 ? "Please give your post a title (at least 3 characters)." :
      !data.body && !data.link ? "Please write some advice or add a link." :
      API.hasBadWords(data.title, data.body, data.link) ? API.BAD_WORDS_MSG + "." :
      !pw ? `Please enter the Year ${data.authorYear} password.` : null;
    if (problem) { errEl.textContent = problem; errEl.hidden = false; return; }

    const submit = $("#post-submit");
    submit.disabled = true; submit.textContent = editing ? "Saving…" : "Posting…";
    try {
      if (editing) {
        const updated = await API.adminEditPost(pw, editing.id, data);
        Object.assign(editing, updated);
        toast("Post updated ✅");
        await Promise.all([loadPosts(), loadQueue()]);
      } else {
        const created = await API.submitPost(pw, data);
        state.myYear = data.authorYear; store.set("advicehub-my-year", data.authorYear);
        if (pw !== state.adminPw) { state.yearPw[data.authorYear] = pw; store.set("advicehub-year-pw", state.yearPw); }
        if (created.status === "approved") {
          state.posts.unshift(created);
          toast("Thanks! Your advice is live 🎉");
          location.hash = `#/y/${created.audience_year}/${encodeURIComponent(created.subject)}`;
        } else {
          toast("Thanks! 🙌 Your advice will appear once an admin has checked it.", 5000);
          if (state.adminPw) loadQueue();
        }
      }
      $("#post-dialog").close();
      render();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
      if (/password/i.test(err.message)) {
        if (editing) setAdmin(null);
        else {
          delete state.yearPw[data.authorYear]; store.set("advicehub-year-pw", state.yearPw);
          $("#password-field").hidden = false;
          f.password.value = "";
          f.password.focus();
        }
      }
    } finally {
      submit.disabled = false; submit.textContent = editing ? "Save changes" : "Post advice";
    }
  });

  // ---------- admin ----------
  function setAdmin(pw) {
    state.adminPw = pw;
    if (pw) store.set("advicehub-admin", pw, sessionStorage); else store.del("advicehub-admin", sessionStorage);
    $("#admin-bar").hidden = !pw;
    $("#admin-btn").hidden = !!pw;
    if (pw) loadQueue(); else { state.queue = []; updateQueueCount(); }
    render();
  }
  function openAdminLogin() {
    $("#admin-form").reset();
    $("#admin-error").hidden = true;
    $("#admin-dialog").showModal();
  }
  $("#admin-btn").addEventListener("click", openAdminLogin);
  $("#admin-logout").addEventListener("click", () => { setAdmin(null); toast("Left admin mode"); });
  $("#admin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = e.target.password.value;
    const err = $("#admin-error");
    try {
      if (await API.checkPassword("admin", pw)) {
        $("#admin-dialog").close();
        setAdmin(pw);
        toast("Admin mode on 🛠️");
      } else { err.textContent = "Wrong admin password."; err.hidden = false; }
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });

  // ---------- go ----------
  $("#admin-bar").hidden = !state.adminPw;
  $("#admin-btn").hidden = !!state.adminPw;
  render();
  loadPosts();
  loadQueue();
})();
