// =====================================================================
//  Years and subjects.
//
//  To ADD a subject: copy any line in the right stage and change the id,
//  name and emoji. The id must be unique within that stage, lowercase,
//  no spaces (use dashes). group must be one of SUBJECT_GROUPS.
//  To REMOVE a subject: delete its line (its posts stay in the database).
// =====================================================================

// Colour-coded groups that subjects are arranged in
window.SUBJECT_GROUPS = [
  { id: "general",    name: "General",                      color: "#f59e0b" },
  { id: "science",    name: "Maths, Science & Computing",   color: "#0ea5e9" },
  { id: "languages",  name: "English & Languages",          color: "#ec4899" },
  { id: "humanities", name: "Humanities & Social Sciences", color: "#8b5cf6" },
  { id: "creative",   name: "Creative, Practical & PE",     color: "#f97316" },
  { id: "btec",       name: "BTEC & Vocational",            color: "#10b981" },
];

// Subjects for each key stage
window.STAGES = {
  ks3: {
    name: "Key Stage 3",
    subjects: [
      { id: "english",       name: "English",              emoji: "📖", group: "languages" },
      { id: "maths",         name: "Maths",                emoji: "➗", group: "science" },
      { id: "science",       name: "Science",              emoji: "🔬", group: "science" },
      { id: "computing",     name: "Computing",            emoji: "💻", group: "science" },
      { id: "languages",     name: "French / Spanish",     emoji: "🗣️", group: "languages" },
      { id: "history",       name: "History",              emoji: "🏛️", group: "humanities" },
      { id: "geography",     name: "Geography",            emoji: "🌍", group: "humanities" },
      { id: "re",            name: "Religious Education",  emoji: "🕊️", group: "humanities" },
      { id: "art",           name: "Art",                  emoji: "🎨", group: "creative" },
      { id: "dt",            name: "Design & Technology",  emoji: "🛠️", group: "creative" },
      { id: "food",          name: "Food",                 emoji: "🍳", group: "creative" },
      { id: "music",         name: "Music",                emoji: "🎵", group: "creative" },
      { id: "drama",         name: "Drama",                emoji: "🎭", group: "creative" },
      { id: "pe",            name: "PE",                   emoji: "🏃", group: "creative" },
    ],
  },
  gcse: {
    name: "GCSE",
    subjects: [
      { id: "english-lang",     name: "English Language",      emoji: "✍️", group: "languages" },
      { id: "english-lit",      name: "English Literature",    emoji: "📖", group: "languages" },
      { id: "french",           name: "French",                emoji: "🇫🇷", group: "languages" },
      { id: "spanish",          name: "Spanish",               emoji: "🇪🇸", group: "languages" },
      { id: "maths",            name: "Maths",                 emoji: "➗", group: "science" },
      { id: "combined-science", name: "Combined Science",      emoji: "🔬", group: "science" },
      { id: "biology",          name: "Biology",               emoji: "🧬", group: "science" },
      { id: "chemistry",        name: "Chemistry",             emoji: "⚗️", group: "science" },
      { id: "physics",          name: "Physics",               emoji: "⚛️", group: "science" },
      { id: "computer-science", name: "Computer Science",      emoji: "💻", group: "science" },
      { id: "history",          name: "History",               emoji: "🏛️", group: "humanities" },
      { id: "geography",        name: "Geography",             emoji: "🌍", group: "humanities" },
      { id: "re",               name: "Religious Studies",     emoji: "🕊️", group: "humanities" },
      { id: "business",         name: "Business",              emoji: "💼", group: "humanities" },
      { id: "sociology",        name: "Sociology",             emoji: "👥", group: "humanities" },
      { id: "art",              name: "Art & Design",          emoji: "🎨", group: "creative" },
      { id: "dt",               name: "Design & Technology",   emoji: "🛠️", group: "creative" },
      { id: "food",             name: "Food Prep & Nutrition", emoji: "🍳", group: "creative" },
      { id: "drama",            name: "Drama",                 emoji: "🎭", group: "creative" },
      { id: "music",            name: "Music",                 emoji: "🎵", group: "creative" },
      { id: "media",            name: "Media Studies",         emoji: "🎬", group: "creative" },
      { id: "pe",               name: "PE",                    emoji: "🏃", group: "creative" },
      { id: "sport",            name: "Sport (vocational)",    emoji: "⚽", group: "btec" },
      { id: "health-social",    name: "Health & Social Care",  emoji: "🩺", group: "btec" },
      { id: "enterprise",       name: "Enterprise",            emoji: "📊", group: "btec" },
      { id: "imedia",           name: "Creative iMedia",       emoji: "🖥️", group: "btec" },
    ],
  },
  post16: {
    name: "Sixth Form",
    subjects: [
      { id: "maths",             name: "Maths",                    emoji: "➗", group: "science" },
      { id: "further-maths",     name: "Further Maths",            emoji: "∑",  group: "science" },
      { id: "biology",           name: "Biology",                  emoji: "🧬", group: "science" },
      { id: "chemistry",         name: "Chemistry",                emoji: "⚗️", group: "science" },
      { id: "physics",           name: "Physics",                  emoji: "⚛️", group: "science" },
      { id: "computer-science",  name: "Computer Science",         emoji: "💻", group: "science" },
      { id: "english-lit",       name: "English Literature",       emoji: "📖", group: "languages" },
      { id: "english-lang",      name: "English Language",         emoji: "✍️", group: "languages" },
      { id: "french",            name: "French",                   emoji: "🇫🇷", group: "languages" },
      { id: "spanish",           name: "Spanish",                  emoji: "🇪🇸", group: "languages" },
      { id: "psychology",        name: "Psychology",               emoji: "🧠", group: "humanities" },
      { id: "sociology",         name: "Sociology",                emoji: "👥", group: "humanities" },
      { id: "history",           name: "History",                  emoji: "🏛️", group: "humanities" },
      { id: "geography",         name: "Geography",                emoji: "🌍", group: "humanities" },
      { id: "economics",         name: "Economics",                emoji: "📈", group: "humanities" },
      { id: "business",          name: "Business",                 emoji: "💼", group: "humanities" },
      { id: "politics",          name: "Politics",                 emoji: "🗳️", group: "humanities" },
      { id: "law",               name: "Law",                      emoji: "⚖️", group: "humanities" },
      { id: "religious-studies", name: "Religious Studies",        emoji: "🕊️", group: "humanities" },
      { id: "criminology",       name: "Criminology",              emoji: "🔍", group: "humanities" },
      { id: "art",               name: "Art & Design",             emoji: "🎨", group: "creative" },
      { id: "photography",       name: "Photography",              emoji: "📷", group: "creative" },
      { id: "media",             name: "Media Studies",            emoji: "🎬", group: "creative" },
      { id: "film",              name: "Film Studies",             emoji: "🎞️", group: "creative" },
      { id: "drama",             name: "Drama & Theatre",          emoji: "🎭", group: "creative" },
      { id: "music",             name: "Music",                    emoji: "🎵", group: "creative" },
      { id: "pe",                name: "PE",                       emoji: "🏃", group: "creative" },
      { id: "btec-applied-science", name: "BTEC Applied Science",        emoji: "🔬", group: "btec" },
      { id: "btec-business",        name: "BTEC Business",               emoji: "📊", group: "btec" },
      { id: "btec-health-social",   name: "BTEC Health & Social Care",   emoji: "🩺", group: "btec" },
      { id: "btec-it",              name: "BTEC IT",                     emoji: "🖥️", group: "btec" },
      { id: "btec-sport",           name: "BTEC Sport",                  emoji: "⚽", group: "btec" },
      { id: "btec-engineering",     name: "BTEC Engineering",            emoji: "⚙️", group: "btec" },
      { id: "btec-performing-arts", name: "BTEC Performing Arts",        emoji: "🎤", group: "btec" },
      { id: "btec-creative-media",  name: "BTEC Creative Digital Media", emoji: "🎧", group: "btec" },
    ],
  },
};

// The years, in order. Each gets a "General" section automatically;
// "extras" adds more year-specific sections next to it.
window.YEARS = [
  { year: 7,  stage: "ks3",    color: "#f59e0b",
    extras: [{ id: "settling-in", name: "Settling In", emoji: "🏫" }] },
  { year: 8,  stage: "ks3",    color: "#f43f5e" },
  { year: 9,  stage: "ks3",    color: "#a855f7",
    extras: [{ id: "options", name: "GCSE Options", emoji: "🧭" }] },
  { year: 10, stage: "gcse",   color: "#3b82f6" },
  { year: 11, stage: "gcse",   color: "#06b6d4",
    extras: [{ id: "exams", name: "Mocks & Exams", emoji: "📝" },
             { id: "post-16", name: "Sixth Form & College", emoji: "🎓" }] },
  { year: 12, stage: "post16", color: "#10b981",
    extras: [{ id: "ucas", name: "UCAS & Next Steps", emoji: "🎓" }] },
  { year: 13, stage: "post16", color: "#6366f1",
    extras: [{ id: "applications", name: "Applications & Offers", emoji: "📨" },
             { id: "results-leaving", name: "Results Day & Leaving", emoji: "🎉" }] },
];

// Years that can post advice (each has its own password).
// Students post for younger years; Year 13s can also post for next year's Year 13.
window.POSTING_YEARS = [8, 9, 10, 11, 12, 13];
// Posts from Years 12–13 go live straight away; younger years are checked by the admin first.
// (That rule lives in the database, in submit_post.)
