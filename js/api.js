// =====================================================================
//  Data layer. Talks to Supabase, or to localStorage in demo mode.
// =====================================================================
(function () {
  const cfg = window.SITE_CONFIG;
  // Demo mode: no Supabase details yet, or add ?demo to the URL to try it out safely.
  const isDemo = !cfg.supabaseUrl || !cfg.supabaseAnonKey || new URLSearchParams(location.search).has("demo");

  // Same word filter as the database (_has_bad_words), so people get told straight away.
  const BAD_WORDS = /(^|[^a-z0-9_])(f+u+c+k\w*|fck\w*|sh[i1]t\w*|bitch\w*|cunt\w*|wank\w*|twat\w*|prick|pricks|dick|dicks|dickhead\w*|bollock\w*|bastard\w*|slag|slags|slut\w*|whore\w*|piss\w*|arse|arsehole\w*|asshole\w*|nigg\w*|fag|fags|faggot\w*|retard\w*|paki|pakis|spastic\w*|spaz\w*|tosser\w*|knobhead\w*|bellend\w*|nonce\w*|stfu|wtf|kys|kill yourself)(?![a-z0-9_])/i;
  const hasBadWords = (...texts) => texts.some((t) => BAD_WORDS.test(t || ""));
  const BAD_WORDS_MSG = "Please keep it friendly: your post contains words that are not allowed";

  // ---------- Supabase (REST, no library needed) ----------
  async function sb(path, options = {}) {
    const res = await fetch(cfg.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + path, {
      ...options,
      headers: {
        apikey: cfg.supabaseAnonKey,
        // Old-style anon keys (JWTs) also go in Authorization; new sb_publishable_ keys must not.
        ...(cfg.supabaseAnonKey.startsWith("eyJ") ? { Authorization: "Bearer " + cfg.supabaseAnonKey } : {}),
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const msg = (data && (data.message || data.hint)) || "Something went wrong (" + res.status + ")";
      throw new Error(msg);
    }
    return data;
  }
  const rpc = (fn, args) => sb("rpc/" + fn, { method: "POST", body: JSON.stringify(args) });

  const remote = {
    listPosts: () => sb("posts?select=*&order=created_at.desc"),
    checkPassword: (role, password) => rpc("check_password", { p_role: role, p_password: password }),
    submitPost: (password, p) =>
      rpc("submit_post", {
        p_password: password, p_author_year: p.authorYear, p_audience_year: p.audienceYear,
        p_subject: p.subject, p_type: p.type, p_title: p.title, p_body: p.body, p_link: p.link,
      }),
    toggleHelpful: (postId, voterId) => rpc("toggle_helpful", { p_post_id: postId, p_voter_id: voterId }),
    reportPost: (postId, voterId) => rpc("report_post", { p_post_id: postId, p_voter_id: voterId }),
    adminListUnapproved: (password) => rpc("admin_list_unapproved", { p_password: password }),
    adminSetStatus: (password, ids, status) => rpc("admin_set_status", { p_password: password, p_ids: ids, p_status: status }),
    adminEditPost: (password, id, p) =>
      rpc("admin_edit_post", {
        p_password: password, p_id: id, p_audience_year: p.audienceYear, p_subject: p.subject, p_type: p.type,
        p_title: p.title, p_body: p.body, p_link: p.link, p_pinned: !!p.pinned,
      }),
    adminDeletePost: (password, id) => rpc("admin_delete_post", { p_password: password, p_id: id }),
  };

  // ---------- Demo mode (localStorage) ----------
  const DEMO_KEY = "advicehub-demo-posts";
  const DEMO_VOTES = "advicehub-demo-votes";
  const DEMO_REPORTS = "advicehub-demo-reports";
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const ago = (days) => new Date(Date.now() - days * 864e5).toISOString();
  const checkPw = (role, pw) => pw === (role === "admin" ? "admin" : role); // demo: "year8" … "year13", "admin"

  function seed() {
    const s = (audience_year, author_year, subject, type, title, body, helpful, days, link, extra) => ({
      id: crypto.randomUUID(), audience_year, author_year, subject, type, title, body, helpful_count: helpful,
      created_at: ago(days), link: link || null, pinned: false, status: "approved", report_count: 0, ...extra,
    });
    return [
      s(7, 8, "settling-in", "advice", "Join a club in your first month",
        "It's the easiest way to make friends outside your form. There's loads at lunchtime and nobody minds if you just turn up.", 21, 2, null, { pinned: true }),
      s(7, 10, "general", "advice", "Pack your bag the night before",
        "Check your timetable every evening. Forgetting your PE kit or planner is the most common way to get a negative point.", 9, 4),
      s(7, 9, "maths", "revision", "Learn your times tables properly",
        "It makes literally everything in maths easier for the next five years.", 6, 6),
      s(9, 11, "options", "advice", "Pick subjects you actually enjoy",
        "Don't pick something just because your friends are. You'll be doing it for two years.", 17, 3),
      s(10, 11, "english-lit", "revision", "Make quote flashcards early",
        "Five quotes per character with the technique on the back. Test yourself on the bus.", 12, 5, "https://www.bbc.co.uk/bitesize"),
      s(11, 12, "exams", "exam", "Do past papers under timed conditions",
        "Find them on the exam board website. Mark them yourself and write down every question you got wrong.", 25, 1, "https://www.physicsandmathstutor.com/"),
      s(12, 13, "general", "advice", "Treat free periods like lessons",
        "The biggest jump from GCSE is how much free time you get. Lock in 2–3 frees a week for study in the library.", 19, 2),
      s(12, 13, "maths", "revision", "Do every past paper on Physics & Maths Tutor",
        "Timed conditions, mark it yourself, and redo the questions you got wrong a week later.", 14, 7, "https://www.physicsandmathstutor.com/"),
      s(8, 9, "general", "advice", "Waiting for approval example",
        "This post is from Year 9, so it waits in the admin approval queue.", 0, 0, null, { status: "pending" }),
    ];
  }

  function demoPosts() {
    let posts = read(DEMO_KEY, null);
    if (!posts) { posts = seed(); write(DEMO_KEY, posts); }
    return posts;
  }
  const delay = (v) => new Promise((r) => setTimeout(() => r(v), 150));
  function cleanLink(l) {
    l = (l || "").trim();
    if (!l) return null;
    return /^https?:\/\//i.test(l) ? l : "https://" + l;
  }
  const needAdmin = (pw) => { if (!checkPw("admin", pw)) throw new Error("Wrong admin password"); };

  const demo = {
    listPosts: async () => delay(demoPosts().filter((p) => p.status === "approved")),
    checkPassword: async (role, pw) => delay(checkPw(role, pw)),
    submitPost: async (pw, p) => {
      if (p.audienceYear >= p.authorYear) throw new Error("You can only post advice for younger years");
      const isAdmin = checkPw("admin", pw);
      if (!isAdmin && !checkPw("year" + p.authorYear, pw)) throw new Error("Wrong password for Year " + p.authorYear);
      if (hasBadWords(p.title, p.body, p.link)) throw new Error(BAD_WORDS_MSG);
      const post = {
        id: crypto.randomUUID(), audience_year: p.audienceYear, author_year: p.authorYear, subject: p.subject,
        type: p.type, title: p.title.trim(), body: (p.body || "").trim(), link: cleanLink(p.link),
        pinned: false, helpful_count: 0, report_count: 0, created_at: new Date().toISOString(),
        status: isAdmin || p.authorYear >= 12 ? "approved" : "pending",
      };
      write(DEMO_KEY, [post, ...demoPosts()]);
      return delay(post);
    },
    toggleHelpful: async (postId, voterId) => {
      const votes = read(DEMO_VOTES, {});
      const k = postId + ":" + voterId;
      const posts = demoPosts();
      const post = posts.find((x) => x.id === postId);
      if (!post) return 0;
      if (votes[k]) { delete votes[k]; post.helpful_count = Math.max(0, post.helpful_count - 1); }
      else { votes[k] = 1; post.helpful_count += 1; }
      write(DEMO_VOTES, votes); write(DEMO_KEY, posts);
      return delay(post.helpful_count);
    },
    reportPost: async (postId, voterId) => {
      const reports = read(DEMO_REPORTS, {});
      const posts = demoPosts();
      const post = posts.find((x) => x.id === postId);
      if (!post) return 0;
      if (!reports[postId + ":" + voterId]) { reports[postId + ":" + voterId] = 1; post.report_count += 1; }
      if (post.report_count >= 3) post.status = "hidden";
      write(DEMO_REPORTS, reports); write(DEMO_KEY, posts);
      return delay(post.report_count);
    },
    adminListUnapproved: async (pw) => { needAdmin(pw); return delay(demoPosts().filter((p) => p.status !== "approved")); },
    adminSetStatus: async (pw, ids, status) => {
      needAdmin(pw);
      const posts = demoPosts();
      posts.filter((p) => ids.includes(p.id)).forEach((p) => {
        p.status = status;
        if (status === "approved") p.report_count = 0;
      });
      write(DEMO_KEY, posts);
      return delay(ids.length);
    },
    adminEditPost: async (pw, id, p) => {
      needAdmin(pw);
      const posts = demoPosts();
      const post = posts.find((x) => x.id === id);
      Object.assign(post, {
        audience_year: p.audienceYear, subject: p.subject, type: p.type, title: p.title.trim(),
        body: (p.body || "").trim(), link: cleanLink(p.link), pinned: !!p.pinned,
      });
      write(DEMO_KEY, posts);
      return delay(post);
    },
    adminDeletePost: async (pw, id) => {
      needAdmin(pw);
      write(DEMO_KEY, demoPosts().filter((x) => x.id !== id));
      return delay(null);
    },
  };

  window.API = { isDemo, hasBadWords, BAD_WORDS_MSG, ...(isDemo ? demo : remote) };
})();
