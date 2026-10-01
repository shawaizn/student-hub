// =====================================================================
//  Data layer. Talks to Supabase, or to localStorage in demo mode.
// =====================================================================
(function () {
  const cfg = window.SITE_CONFIG;
  // Demo mode: no Supabase details yet, or add ?demo to the URL to try it out safely.
  const isDemo = !cfg.supabaseUrl || !cfg.supabaseAnonKey || new URLSearchParams(location.search).has("demo");

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
    addPost: (password, p) =>
      rpc("add_post", {
        p_password: password, p_subject: p.subject, p_type: p.type, p_title: p.title,
        p_body: p.body, p_link: p.link, p_author: p.author,
      }),
    toggleHelpful: (postId, voterId) => rpc("toggle_helpful", { p_post_id: postId, p_voter_id: voterId }),
    updatePost: (password, id, p) =>
      rpc("admin_update_post", {
        p_password: password, p_id: id, p_subject: p.subject, p_type: p.type, p_title: p.title,
        p_body: p.body, p_link: p.link, p_author: p.author, p_pinned: !!p.pinned,
      }),
    deletePost: (password, id) => rpc("admin_delete_post", { p_password: password, p_id: id }),
  };

  // ---------- Demo mode (localStorage) ----------
  const DEMO_KEY = "y12hub-demo-posts";
  const DEMO_VOTES = "y12hub-demo-votes";
  const DEMO_PW = { contributor: "year13", admin: "admin" };
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const ago = (days) => new Date(Date.now() - days * 864e5).toISOString();

  function seed() {
    const s = (subject, type, title, body, author, helpful, days, link, pinned) => ({
      id: crypto.randomUUID(), subject, type, title, body, author, helpful_count: helpful,
      created_at: ago(days), link: link || null, pinned: !!pinned,
    });
    return [
      s("general", "advice", "Treat free periods like lessons",
        "Honestly the biggest jump from GCSE is how much free time you get. Pick 2–3 frees a week that are 'locked in' for independent study in the library. Future you will thank you in May.",
        "Aisha, Y13", 24, 2, null, true),
      s("general", "advice", "Don't leave UCAS until the summer",
        "Start thinking about your personal statement in Year 12 summer term. Keep a note on your phone of anything you read, watch or do that relates to your course.",
        "Josh, Y13", 15, 5),
      s("maths", "revision", "Do every past paper on Physics & Maths Tutor",
        "Do them under timed conditions and mark them yourself with the mark scheme. Keep a list of every question type you get wrong and redo those a week later.",
        "Priya, Y13", 19, 3, "https://www.physicsandmathstutor.com/"),
      s("maths", "exam", "Write down every step",
        "Method marks are where the grades are. Even if your final answer is wrong you can still get most of the marks.",
        "Liam", 8, 6),
      s("biology", "resource", "Free flashcards for the whole spec",
        "Seneca has the full AQA Biology course for free — great for active recall on the bus.",
        "Hannah, Y13", 11, 4, "https://senecalearning.com/"),
      s("psychology", "exam", "Learn the 16-markers structure",
        "AO1 then AO3. Plan for 2 minutes before you start writing — it stops you rambling.",
        "Mo, Y13", 7, 8),
      s("btec-applied-science", "advice", "Coursework deadlines are everything",
        "Your BTEC grade is mostly coursework. Hit every internal deadline and ask for feedback on your drafts — teachers can give you a lot of guidance before final submission.",
        "Ellie, Y13", 13, 1),
    ];
  }

  function demoPosts() {
    let posts = read(DEMO_KEY, null);
    if (!posts) { posts = seed(); write(DEMO_KEY, posts); }
    return posts;
  }
  const delay = (v) => new Promise((r) => setTimeout(() => r(v), 150));
  const checkPw = (role, pw) => pw === DEMO_PW[role];
  function cleanLink(l) {
    l = (l || "").trim();
    if (!l) return null;
    return /^https?:\/\//i.test(l) ? l : "https://" + l;
  }

  const demo = {
    listPosts: async () => delay(demoPosts()),
    checkPassword: async (role, pw) => delay(checkPw(role, pw)),
    addPost: async (pw, p) => {
      if (!checkPw("contributor", pw) && !checkPw("admin", pw)) throw new Error("Wrong password");
      const post = {
        id: crypto.randomUUID(), subject: p.subject, type: p.type, title: p.title.trim(),
        body: (p.body || "").trim(), link: cleanLink(p.link), author: (p.author || "").trim() || null,
        pinned: false, helpful_count: 0, created_at: new Date().toISOString(),
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
    updatePost: async (pw, id, p) => {
      if (!checkPw("admin", pw)) throw new Error("Wrong admin password");
      const posts = demoPosts();
      const post = posts.find((x) => x.id === id);
      Object.assign(post, {
        subject: p.subject, type: p.type, title: p.title.trim(), body: (p.body || "").trim(),
        link: cleanLink(p.link), author: (p.author || "").trim() || null, pinned: !!p.pinned,
      });
      write(DEMO_KEY, posts);
      return delay(post);
    },
    deletePost: async (pw, id) => {
      if (!checkPw("admin", pw)) throw new Error("Wrong admin password");
      write(DEMO_KEY, demoPosts().filter((x) => x.id !== id));
      return delay(null);
    },
  };

  window.API = { isDemo, ...(isDemo ? demo : remote) };
})();
