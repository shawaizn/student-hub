// =====================================================================
//  Subjects list.
//  To ADD a subject: copy any line and change the id, name and emoji.
//    - id must be unique, lowercase, no spaces (use dashes)
//    - group must be one of the groups listed in SUBJECT_GROUPS
//  To REMOVE a subject: delete its line (its posts stay in the database).
// =====================================================================
window.SUBJECT_GROUPS = [
  { id: "general",    name: "General",                 color: "#f59e0b" },
  { id: "science",    name: "Maths & Sciences",        color: "#0ea5e9" },
  { id: "humanities", name: "Humanities & Social Sciences", color: "#8b5cf6" },
  { id: "languages",  name: "English & Languages",     color: "#ec4899" },
  { id: "creative",   name: "Creative & Performing Arts", color: "#f97316" },
  { id: "btec",       name: "BTEC & Vocational",       color: "#10b981" },
];

window.SUBJECTS = [
  // General (always shown first)
  { id: "general",           name: "General",                  emoji: "🌟", group: "general",
    blurb: "Sixth form life, motivation, UCAS, wellbeing, time management" },
  { id: "ucas",              name: "UCAS & Next Steps",        emoji: "🎓", group: "general",
    blurb: "Personal statements, uni choices, apprenticeships, open days" },

  // Maths & Sciences
  { id: "maths",             name: "Maths",                    emoji: "➗", group: "science" },
  { id: "further-maths",     name: "Further Maths",            emoji: "∑",  group: "science" },
  { id: "biology",           name: "Biology",                  emoji: "🧬", group: "science" },
  { id: "chemistry",         name: "Chemistry",                emoji: "⚗️", group: "science" },
  { id: "physics",           name: "Physics",                  emoji: "⚛️", group: "science" },
  { id: "computer-science",  name: "Computer Science",         emoji: "💻", group: "science" },

  // Humanities & Social Sciences
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

  // English & Languages
  { id: "english-lit",       name: "English Literature",       emoji: "📖", group: "languages" },
  { id: "english-lang",      name: "English Language",         emoji: "✍️", group: "languages" },
  { id: "french",            name: "French",                   emoji: "🇫🇷", group: "languages" },
  { id: "spanish",           name: "Spanish",                  emoji: "🇪🇸", group: "languages" },

  // Creative & Performing Arts
  { id: "art",               name: "Art & Design",             emoji: "🎨", group: "creative" },
  { id: "photography",       name: "Photography",              emoji: "📷", group: "creative" },
  { id: "media",             name: "Media Studies",            emoji: "🎬", group: "creative" },
  { id: "film",              name: "Film Studies",             emoji: "🎞️", group: "creative" },
  { id: "drama",             name: "Drama & Theatre",          emoji: "🎭", group: "creative" },
  { id: "music",             name: "Music",                    emoji: "🎵", group: "creative" },
  { id: "pe",                name: "PE",                       emoji: "🏃", group: "creative" },

  // BTEC & Vocational
  { id: "btec-applied-science", name: "BTEC Applied Science",       emoji: "🔬", group: "btec" },
  { id: "btec-business",        name: "BTEC Business",              emoji: "📊", group: "btec" },
  { id: "btec-health-social",   name: "BTEC Health & Social Care",  emoji: "🩺", group: "btec" },
  { id: "btec-it",              name: "BTEC IT",                    emoji: "🖥️", group: "btec" },
  { id: "btec-sport",           name: "BTEC Sport",                 emoji: "⚽", group: "btec" },
  { id: "btec-engineering",     name: "BTEC Engineering",           emoji: "⚙️", group: "btec" },
  { id: "btec-performing-arts", name: "BTEC Performing Arts",       emoji: "🎤", group: "btec" },
  { id: "btec-creative-media",  name: "BTEC Creative Digital Media", emoji: "🎧", group: "btec" },
];

// Types of post. (If you add one here, also add it to the list in supabase/setup.sql.)
window.POST_TYPES = [
  { id: "advice",   name: "Advice",        emoji: "💡" },
  { id: "revision", name: "Revision tip",  emoji: "🧠" },
  { id: "exam",     name: "Exam advice",   emoji: "📝" },
  { id: "resource", name: "Resource",      emoji: "📚" },
  { id: "link",     name: "Useful link",   emoji: "🔗" },
];
