// =====================================================================
//  Year 12 Advice Hub — app
// =====================================================================
(function () {
  const cfg = window.SITE_CONFIG;
  const SUBJECTS = window.SUBJECTS;
  const GROUPS = window.SUBJECT_GROUPS;
  const TYPES = window.POST_TYPES;
  const subjectById = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));
  const groupById = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
  const typeById = Object.fromEntries(TYPES.map((t) => [t.id, t]));

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const app = $("#app");

  // ---------- small storage helpers (never throw) ----------
  const store = {
    get(k, d, s = localStorage) { try { const v = s.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v, s = localStorage) { try { s.setItem(k, JSON.stringify(v)); } catch {} },
    del(k, s = localStorage) { try { s.removeItem(k); } catch {} },
  };

  let voterId = store.get("y12hub-voter", null);
  if (!voterId) { voterId = crypto.randomUUID(); store.set("y12hub-voter", voterId); }

  const state = {
    posts: [],
    loaded: false,
    error: null,
    voted: new Set(store.get("y12hub-voted", [])),
    adminPw: store.get("y12hub-admin", null, sessionStorage),
    contribPw: store.get("y12hub-contrib", null),
    filterType: "all",
    sort: "helpful",
    query: "",
  };

  // ---------- branding ----------
  document.documentElement.style.setProperty("--brand", cfg.brandColor);
  $$("[data-school]").forEach((el) => (el.textContent = cfg.schoolName));
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
  const subjectColor = (s) => (groupById[s?.group] || GROUPS[0]).color;
  const subjectOf = (id) => subjectById[id] || { id, name: id, emoji: "📁", group: "general" };

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2600);
  }

  function sortPosts(list, sort = state.sort) {
    return [...list].sort((a, b) =>
      (b.pinned - a.pinned) ||
      (sort === "helpful" ? b.helpful_count - a.helpful_count : 0) ||
      new Date(b.created_at) - new Date(a.created_at));
  }
  const countFor = (id) => state.posts.filter((p) => p.subject === id).length;

  // ---------- rendering: post card ----------
  function postCard(p, { showSubject = false } = {}) {
    const t = typeById[p.type] || { name: p.type, emoji: "💬" };
    const subj = subjectOf(p.subject);
    const link = safeUrl(p.link);
    const voted = state.voted.has(p.id);
    return `
      <article class="post ${p.pinned ? "is-pinned" : ""}" data-id="${esc(p.id)}" style="--accent:${subjectColor(subj)}">
        <div class="post-meta">
          <span class="chip chip-type type-${esc(p.type)}">${t.emoji} ${esc(t.name)}</span>
          ${showSubject ? `<a class="chip chip-subject" href="#/s/${esc(subj.id)}">${subj.emoji} ${esc(subj.name)}</a>` : ""}
          ${p.pinned ? `<span class="chip chip-pin">📌 Pinned</span>` : ""}
        </div>
        <h3 class="post-title">${esc(p.title)}</h3>
        ${p.body ? `<div class="post-body">${linkify(p.body)}</div>` : ""}
        ${link ? `<a class="post-link" href="${esc(link)}" target="_blank" rel="noopener"><span>🔗</span><span class="post-link-host">${esc(hostOf(link))}</span><span class="post-link-arrow">↗</span></a>` : ""}
        <footer class="post-foot">
          <span class="post-author">${p.author ? `<span class="avatar">${esc(p.author.trim()[0].toUpperCase())}</span>${esc(p.author)}` : `<span class="avatar">?</span>A Year 13`} · <time datetime="${esc(p.created_at)}">${timeAgo(p.created_at)}</time></span>
          <button class="helpful-btn ${voted ? "is-on" : ""}" data-action="helpful" aria-pressed="${voted}" title="${voted ? "Remove your vote" : "Mark as helpful"}">
            👍 <span>Helpful</span> <b>${p.helpful_count}</b>
          </button>
        </footer>
        ${state.adminPw ? `
          <div class="admin-tools">
            <button class="btn btn-small" data-action="edit">✏️ Edit / move</button>
            <button class="btn btn-small" data-action="pin">${p.pinned ? "Unpin" : "📌 Pin"}</button>
            <button class="btn btn-small btn-danger" data-action="delete">🗑️ Delete</button>
          </div>` : ""}
      </article>`;
  }

  function emptyState(msg, subjectId) {
    return `<div class="empty">
      <div class="empty-emoji">🌱</div>
      <p>${msg}</p>
      <button class="btn btn-primary" data-action="add" ${subjectId ? `data-subject="${esc(subjectId)}"` : ""}>＋ Be the first to add advice</button>
    </div>`;
  }

  // ---------- views ----------
  function viewHome() {
    const top = sortPosts(state.posts.filter((p) => p.helpful_count > 0), "helpful").slice(0, 3);
    const recent = sortPosts(state.posts, "new").filter((p) => !top.includes(p)).slice(0, 4);
    const total = state.posts.length;
    const contributors = new Set(state.posts.map((p) => (p.author || "").toLowerCase()).filter(Boolean)).size;
    const subjectsCovered = new Set(state.posts.map((p) => p.subject)).size;

    const groupsHtml = GROUPS.map((g) => {
      const subs = SUBJECTS.filter((s) => s.group === g.id);
      if (!subs.length) return "";
      const big = g.id === "general";
      return `
        <section class="group">
          <h2 class="group-title"><span class="dot" style="background:${g.color}"></span>${esc(g.name)}</h2>
          <div class="subject-grid ${big ? "subject-grid-big" : ""}">
            ${subs.map((s) => {
              const n = countFor(s.id);
              return `<a class="subject-card ${big ? "subject-card-big" : ""}" href="#/s/${esc(s.id)}" style="--accent:${g.color}">
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
      <section class="hero">
        <div class="hero-text">
          <p class="eyebrow">${esc(cfg.schoolName)} Sixth Form</p>
          <h1>Advice from the people who've <span class="hl">just done it</span>.</h1>
          <p class="lead">${esc(cfg.tagline)} Pick your subject, or start with the General section.</p>
          <form class="search" id="search-form" role="search">
            <span class="search-icon">🔎</span>
            <input id="search-input" type="search" placeholder="Search all advice… e.g. past papers, UCAS, essays" value="${esc(state.query)}" aria-label="Search all advice">
          </form>
        </div>
        <div class="hero-stats">
          <div class="stat"><b>${total}</b><span>pieces of advice</span></div>
          <div class="stat"><b>${subjectsCovered}</b><span>subjects covered</span></div>
          <div class="stat"><b>${contributors}</b><span>Year 13s helping</span></div>
        </div>
      </section>

      ${top.length ? `
        <section class="highlights">
          <h2 class="section-title">🏆 Most helpful right now</h2>
          <div class="post-grid">${top.map((p) => postCard(p, { showSubject: true })).join("")}</div>
        </section>` : ""}

      <div class="groups">${groupsHtml}</div>

      ${recent.length ? `
        <section class="highlights">
          <h2 class="section-title">🆕 Recently added</h2>
          <div class="post-grid">${recent.map((p) => postCard(p, { showSubject: true })).join("")}</div>
        </section>` : ""}
    `;
    bindSearch();
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

  function viewSubject(id) {
    const s = subjectOf(id);
    const color = subjectColor(s);
    const all = state.posts.filter((p) => p.subject === id);
    const list = sortPosts(state.filterType === "all" ? all : all.filter((p) => p.type === state.filterType));
    const others = SUBJECTS.filter((x) => x.group === s.group && x.id !== s.id);

    app.innerHTML = `
      <nav class="crumbs"><a href="#/">← All subjects</a></nav>
      <section class="subject-hero" style="--accent:${color}">
        <span class="subject-hero-emoji">${s.emoji}</span>
        <div>
          <p class="eyebrow">${esc((groupById[s.group] || {}).name || "")}</p>
          <h1>${esc(s.name)}</h1>
          ${s.blurb ? `<p class="lead">${esc(s.blurb)}</p>` : `<p class="lead">Advice, revision tips and resources from Year 13 ${esc(s.name)} students.</p>`}
        </div>
        <button class="btn btn-primary subject-hero-add" data-action="add" data-subject="${esc(s.id)}">＋ Add ${esc(s.name)} advice</button>
      </section>
      ${all.length ? filterBar(all) : ""}
      <div class="post-list">
        ${all.length ? (list.length ? list.map((p) => postCard(p)).join("") : `<p class="muted">Nothing of this type yet.</p>`)
                     : emptyState(`No ${esc(s.name)} advice yet.`, s.id)}
      </div>
      ${others.length ? `
        <section class="related">
          <h2 class="section-title small">Related subjects</h2>
          <div class="pill-row">${others.map((o) => `<a class="pill" href="#/s/${esc(o.id)}">${o.emoji} ${esc(o.name)}</a>`).join("")}</div>
        </section>` : ""}
    `;
  }

  function viewSearch() {
    const q = state.query.trim().toLowerCase();
    // ignore plurals so "papers" finds "paper"
    const words = q.split(/\s+/).filter(Boolean).map((w) => (w.length > 3 ? w.replace(/s$/, "") : w));
    const results = sortPosts(state.posts.filter((p) => {
      const hay = [p.title, p.body, p.author, subjectOf(p.subject).name, (typeById[p.type] || {}).name].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    }));
    const subjMatches = SUBJECTS.filter((s) => s.name.toLowerCase().includes(q));
    app.innerHTML = `
      <nav class="crumbs"><a href="#/">← All subjects</a></nav>
      <form class="search search-page" id="search-form" role="search">
        <span class="search-icon">🔎</span>
        <input id="search-input" type="search" placeholder="Search all advice…" value="${esc(state.query)}" aria-label="Search all advice">
      </form>
      ${subjMatches.length ? `<div class="pill-row">${subjMatches.map((o) => `<a class="pill" href="#/s/${esc(o.id)}">${o.emoji} ${esc(o.name)}</a>`).join("")}</div>` : ""}
      <h2 class="section-title small">${results.length} result${results.length === 1 ? "" : "s"} for “${esc(state.query)}”</h2>
      <div class="post-list">${results.map((p) => postCard(p, { showSubject: true })).join("") || `<p class="muted">No advice matches that yet — try another word.</p>`}</div>
    `;
    bindSearch(true);
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
  let lastRoute = null;
  function render() {
    if (!state.loaded) {
      app.innerHTML = `<div class="loading"><div class="spinner"></div>Loading advice…</div>`;
      return;
    }
    if (state.error) {
      app.innerHTML = `<div class="empty"><div class="empty-emoji">😕</div><p>Couldn't load the advice right now.</p><p class="muted">${esc(state.error)}</p><button class="btn btn-primary" onclick="location.reload()">Try again</button></div>`;
      return;
    }
    const hash = location.hash.replace(/^#/, "") || "/";
    const [, view, arg] = hash.split("/");
    const route = view + "/" + (arg || "");
    if (route !== lastRoute) {
      if (view !== "s" || lastRoute?.split("/")[1] !== arg) state.filterType = "all";
      if (lastRoute !== null) window.scrollTo(0, 0);
      lastRoute = route;
    }
    if (view === "s" && arg) return viewSubject(decodeURIComponent(arg));
    if (view === "search" && arg) { state.query = decodeURIComponent(arg); return viewSearch(); }
    state.query = "";
    viewHome();
  }
  window.addEventListener("hashchange", render);

  async function load() {
    try {
      state.posts = await API.listPosts();
      state.error = null;
    } catch (e) {
      state.error = e.message;
    }
    state.loaded = true;
    render();
  }

  // ---------- post actions (event delegation) ----------
  app.addEventListener("click", async (e) => {
    const filter = e.target.closest("[data-filter]");
    if (filter) { state.filterType = filter.dataset.filter; return render(); }

    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const card = btn.closest(".post");
    const post = card && state.posts.find((p) => p.id === card.dataset.id);
    const action = btn.dataset.action;

    if (action === "add") return openPostDialog({ subject: btn.dataset.subject });
    if (!post) return;

    if (action === "helpful") {
      btn.disabled = true;
      try {
        const count = await API.toggleHelpful(post.id, voterId);
        post.helpful_count = count;
        state.voted.has(post.id) ? state.voted.delete(post.id) : state.voted.add(post.id);
        store.set("y12hub-voted", [...state.voted]);
        render();
      } catch (err) { toast("Couldn't save your vote: " + err.message); btn.disabled = false; }
    }
    if (action === "edit") openPostDialog({ post });
    if (action === "pin") {
      try {
        const updated = await API.updatePost(state.adminPw, post.id, { ...post, pinned: !post.pinned });
        Object.assign(post, updated);
        toast(post.pinned ? "Pinned 📌" : "Unpinned");
        render();
      } catch (err) { adminError(err); }
    }
    if (action === "delete") {
      if (!confirm(`Delete “${post.title}”?\n\nThis can't be undone.`)) return;
      try {
        await API.deletePost(state.adminPw, post.id);
        state.posts = state.posts.filter((p) => p.id !== post.id);
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
    if (/password/i.test(err.message)) setAdmin(null);
  }

  // ---------- dialogs ----------
  $$("dialog [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  $$("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

  // Build subject <select> and type picker once
  const postForm = $("#post-form");
  const subjectSelect = postForm.subject;
  subjectSelect.innerHTML = `<option value="" disabled selected>Choose a subject…</option>` +
    GROUPS.map((g) => {
      const subs = SUBJECTS.filter((s) => s.group === g.id);
      return subs.length ? `<optgroup label="${esc(g.name)}">${subs.map((s) => `<option value="${esc(s.id)}">${s.emoji} ${esc(s.name)}</option>`).join("")}</optgroup>` : "";
    }).join("");
  $("#type-picker").innerHTML = TYPES.map((t, i) => `
    <label class="type-option">
      <input type="radio" name="type" value="${t.id}" ${i === 0 ? "checked" : ""}>
      <span>${t.emoji} ${esc(t.name)}</span>
    </label>`).join("");
  const counter = $("[data-count]");
  postForm.body.addEventListener("input", () => (counter.textContent = postForm.body.value.length));

  let editing = null;
  function openPostDialog({ subject, post } = {}) {
    editing = post || null;
    postForm.reset();
    $("#post-error").hidden = true;
    const isEdit = !!post;
    $("#post-dialog-title").textContent = isEdit ? "Edit post" : "Share your advice";
    $("#post-dialog-sub").textContent = isEdit
      ? "Admin: change anything below, including moving it to another subject."
      : "Thanks for helping out! Your post will appear on the site straight away. Posts can't be deleted, so check it before you post.";
    $("#post-submit").textContent = isEdit ? "Save changes" : "Post advice";
    $("#pinned-field").hidden = !isEdit;

    // Edits use the admin password; new posts use the Year 13 password unless already known.
    const knownPw = isEdit ? state.adminPw : (state.contribPw || state.adminPw);
    $("#password-field").hidden = !!knownPw;
    postForm.password.value = knownPw || "";

    if (isEdit) {
      if (!subjectById[post.subject]) {
        subjectSelect.insertAdjacentHTML("beforeend", `<option value="${esc(post.subject)}">${esc(post.subject)}</option>`);
      }
      subjectSelect.value = post.subject;
      postForm.querySelector(`input[name=type][value="${post.type}"]`)?.click();
      postForm.title.value = post.title;
      postForm.body.value = post.body || "";
      postForm.link.value = post.link || "";
      postForm.author.value = post.author || "";
      postForm.pinned.checked = !!post.pinned;
    } else if (subject) {
      subjectSelect.value = subject;
    }
    counter.textContent = postForm.body.value.length;
    $("#post-dialog").showModal();
    (isEdit || subject ? postForm.title : subjectSelect).focus();
  }

  $("#add-btn").addEventListener("click", () => {
    const m = location.hash.match(/^#\/s\/([^/]+)/);
    openPostDialog({ subject: m ? decodeURIComponent(m[1]) : undefined });
  });

  postForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = postForm;
    const errEl = $("#post-error");
    const data = {
      subject: f.subject.value, type: f.type.value, title: f.title.value.trim(), body: f.body.value.trim(),
      link: f.link.value.trim(), author: f.author.value.trim(), pinned: f.pinned.checked,
    };
    const pw = f.password.value;
    const problem =
      !data.subject ? "Please choose a subject." :
      data.title.length < 3 ? "Please give your post a title (at least 3 characters)." :
      !data.body && !data.link ? "Please write some advice or add a link." :
      !pw ? "Please enter the Year 13 password." : null;
    if (problem) { errEl.textContent = problem; errEl.hidden = false; return; }

    const submit = $("#post-submit");
    submit.disabled = true; submit.textContent = editing ? "Saving…" : "Posting…";
    try {
      if (editing) {
        const updated = await API.updatePost(pw, editing.id, data);
        Object.assign(editing, updated);
        toast("Post updated ✅");
      } else {
        const created = await API.addPost(pw, data);
        state.posts.unshift(created);
        if (!state.adminPw || pw !== state.adminPw) { state.contribPw = pw; store.set("y12hub-contrib", pw); }
        toast("Thanks! Your advice is live 🎉");
        location.hash = "#/s/" + encodeURIComponent(created.subject);
      }
      $("#post-dialog").close();
      render();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
      if (/password/i.test(err.message)) {
        if (editing) setAdmin(null);
        else { state.contribPw = null; store.del("y12hub-contrib"); }
        $("#password-field").hidden = false;
        f.password.value = "";
        f.password.focus();
      }
    } finally {
      submit.disabled = false; submit.textContent = editing ? "Save changes" : "Post advice";
    }
  });

  // ---------- admin ----------
  function setAdmin(pw) {
    state.adminPw = pw;
    if (pw) store.set("y12hub-admin", pw, sessionStorage); else store.del("y12hub-admin", sessionStorage);
    $("#admin-bar").hidden = !pw;
    $("#admin-btn").hidden = !!pw;
    render();
  }
  $("#admin-btn").addEventListener("click", () => {
    $("#admin-form").reset();
    $("#admin-error").hidden = true;
    $("#admin-dialog").showModal();
  });
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
  load();
})();
