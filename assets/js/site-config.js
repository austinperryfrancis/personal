export const libraryBooks = [
  {
    id: "about",
    tone: "tone-navy",
    shelfTitle: "About",
    viewIndex: "Profile",
    viewKicker: "About",
    viewTitle: "About",
    viewSubtitle: "An editorial introduction to research interests, methods, and ongoing work.",
    widthRem: 5.4,
    heightRem: 23.5,
    pages: [
      {
        id: "overview",
        label: "Overview",
        blocks: [
          {
            type: "text",
            kicker: "Overview",
            title: "Quietly ambitious work, presented with restraint.",
            paragraphs: [
              "My practice brings together research, writing, and product-minded technical work. I care about projects that are methodologically rigorous, visually precise, and legible to more than one audience.",
              "This site is designed as a working library rather than a stream of updates. Each section holds a different mode of work: published writing, selected projects, developing ideas, and reference material that can be expanded over time.",
            ],
          },
          {
            type: "meta",
            items: [
              { label: "Focus", value: "Research design, digital methods, editorial presentation" },
              { label: "Formats", value: "Essays, prototypes, data tools, lectures" },
              { label: "Next step", value: "Replace this text with a concise biography and current institutional affiliation." },
            ],
          },
        ],
      },
      {
        id: "profile",
        label: "Profile",
        blocks: [
          {
            type: "profile",
            monogram: "AF",
            name: "Austin Francis",
            role: "Researcher, writer, and builder",
            meta: "Based in Chicago, working across digital scholarship, software, and public-facing research tools.",
          },
          {
            type: "text",
            kicker: "Position",
            paragraphs: [
              "Use this page for a concise biography, a current institutional home, and the kinds of collaborations or appointments you want visitors to understand immediately.",
            ],
          },
        ],
      },
      {
        id: "interests",
        label: "Current Interests",
        blocks: [
          {
            type: "list",
            kicker: "Current interests",
            style: "bullet",
            items: [
              "Computational methods for historical and cultural analysis",
              "Carefully designed software for research communication",
              "Writing that moves between technical clarity and public readability",
            ],
          },
          {
            type: "text",
            kicker: "Method",
            paragraphs: [
              "This page can hold the shorter statement of what is actively underway: current archives, methodological experiments, or a sentence or two on the next paper or build.",
            ],
          },
        ],
      },
      {
        id: "approach",
        label: "Approach",
        blocks: [
          {
            type: "text",
            kicker: "Working style",
            title: "Editorial structure matters as much as technical execution.",
            paragraphs: [
              "I tend to favor projects with clear constraints, stable systems, and presentation choices that slow the reader down just enough to make the work legible.",
              "The through-line is less a discipline than a standard: work should be rigorous, durable, and careful about how it meets the public.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "research",
    tone: "tone-oxblood",
    shelfTitle: "Research",
    viewIndex: "Research & CV",
    viewKicker: "Research",
    viewTitle: "Research / CV",
    viewSubtitle: "Areas of inquiry, selected papers, and a place to add a downloadable curriculum vitae.",
    widthRem: 5.95,
    heightRem: 24,
    pages: [
      {
        id: "overview",
        label: "Overview",
        blocks: [
          {
            type: "text",
            kicker: "Current agenda",
            title: "Methods-led work with a public-facing edge.",
            paragraphs: [
              "Current research can be presented here as a short framing statement: the central question, the archive or data involved, and the broader intellectual stakes.",
              "This is the landing page for the book, so it should orient someone quickly before they move into papers, themes, or a CV download.",
            ],
          },
        ],
      },
      {
        id: "themes",
        label: "Themes",
        blocks: [
          {
            type: "list",
            kicker: "Selected themes",
            style: "bullet",
            items: [
              "Digital humanities and computational interpretation",
              "Archival method, metadata, and historical interfaces",
              "Designing scholarly work for broader readerships",
            ],
          },
        ],
      },
      {
        id: "papers",
        label: "Selected Papers",
        blocks: [
          {
            type: "list",
            kicker: "Selected papers",
            style: "entries",
            items: [
              { title: "Paper title placeholder", meta: "Journal or conference, 2026" },
              { title: "Working paper placeholder", meta: "In revision" },
              { title: "Talk or invited lecture placeholder", meta: "Institution name, 2025" },
            ],
          },
        ],
      },
      {
        id: "cv",
        label: "Curriculum Vitae",
        blocks: [
          {
            type: "callout",
            label: "Curriculum vitae",
            text: "Add a final PDF link here once the public CV is ready for download.",
          },
          {
            type: "text",
            kicker: "Suggested contents",
            paragraphs: [
              "This subpage works well as a concise summary: education, appointments, selected awards, and one clear download action.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "projects",
    tone: "tone-green",
    shelfTitle: "Projects",
    viewIndex: "Projects",
    viewKicker: "Projects",
    viewTitle: "Projects",
    viewSubtitle: "Selected software, research tools, and design experiments with a clear editorial frame.",
    widthRem: 5.55,
    heightRem: 23.2,
    pages: [
      {
        id: "overview",
        label: "Overview",
        blocks: [
          {
            type: "text",
            kicker: "Approach",
            paragraphs: [
              "I prefer projects with clear constraints: strong information architecture, durable code, and interfaces that are visually composed rather than merely functional.",
            ],
          },
          {
            type: "meta",
            items: [
              { label: "Stack", value: "Static sites, data pipelines, maps, interfaces" },
              { label: "Priority", value: "Fast load times and long-lived maintainability" },
              { label: "Replace", value: "Swap in screenshots, repositories, and case studies here." },
            ],
          },
        ],
      },
      {
        id: "featured",
        label: "Featured Work",
        blocks: [
          {
            type: "cards",
            kicker: "Featured work",
            items: [
              {
                title: "Ancestry Map",
                copy: "A geospatial storytelling tool that turns genealogical records into a legible animated map with a research-friendly workflow.",
              },
              {
                title: "Editorial Portfolio System",
                copy: "A static publishing framework for presenting essays, notes, and archival materials with careful typography and reliable performance.",
              },
            ],
          },
        ],
      },
      {
        id: "case-studies",
        label: "Case Studies",
        blocks: [
          {
            type: "text",
            kicker: "Suggested direction",
            title: "Use this page for one project at a time.",
            paragraphs: [
              "A stronger structure is to give each case study a short problem statement, a solution summary, a note on technical constraints, and one or two screenshots.",
            ],
          },
        ],
      },
      {
        id: "notes",
        label: "Build Notes",
        blocks: [
          {
            type: "list",
            kicker: "Working principles",
            style: "bullet",
            items: [
              "Keep interactions legible before making them clever",
              "Prefer fewer moving parts with clearer ownership",
              "Treat visual presentation as part of the system, not a skin on top",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "writing",
    tone: "tone-brown",
    shelfTitle: "Writing",
    viewIndex: "Writing",
    viewKicker: "Writing",
    viewTitle: "Writing",
    viewSubtitle: "Essays, shorter notes, and a slower archive of finished and in-progress writing.",
    widthRem: 5.15,
    heightRem: 23.9,
    pages: [
      {
        id: "overview",
        label: "Overview",
        blocks: [
          {
            type: "text",
            kicker: "Editorial note",
            paragraphs: [
              "This section works best as a selective archive rather than a high-frequency feed. A small number of considered pieces will feel more aligned with the rest of the site than a running stream of posts.",
              "If you plan to publish longer essays, add a dedicated index page later and keep this opening spread focused on only a few highlighted entries.",
            ],
          },
        ],
      },
      {
        id: "essays",
        label: "Recent Essays",
        blocks: [
          {
            type: "list",
            kicker: "Recent essays",
            style: "entries",
            items: [
              { title: "Designing research tools that invite reading", meta: "Essay, forthcoming" },
              { title: "What a static personal website can still do well", meta: "Notebook entry" },
              { title: "On interfaces for public-facing scholarship", meta: "Lecture draft" },
            ],
          },
        ],
      },
      {
        id: "notes",
        label: "Notes",
        blocks: [
          {
            type: "text",
            kicker: "Notebook",
            paragraphs: [
              "This subpage is a good place for shorter notes, fragments, and half-formed observations that are still worth keeping public.",
            ],
          },
        ],
      },
      {
        id: "archive",
        label: "Archive",
        blocks: [
          {
            type: "callout",
            label: "Archive strategy",
            text: "If you accumulate enough writing, split featured pieces from the long archive and keep the opening page selective.",
          },
        ],
      },
    ],
  },
  {
    id: "photography",
    tone: "tone-sand",
    shelfTitle: "Photography",
    viewIndex: "Photography",
    viewKicker: "Photography",
    viewTitle: "Photography",
    viewSubtitle: "A restrained image portfolio for field notes, landscapes, and close observation.",
    widthRem: 5.5,
    heightRem: 23.45,
    pages: [
      {
        id: "overview",
        label: "Overview",
        blocks: [
          {
            type: "text",
            kicker: "Practice",
            title: "Photography as observation rather than spectacle.",
            paragraphs: [
              "Use this spread to present a short statement about subject matter, process, and the kinds of places or details that return across the work.",
            ],
          },
          {
            type: "list",
            kicker: "Suggested categories",
            style: "bullet",
            items: [
              "Landscape and built environment",
              "Archival objects and material detail",
              "Travel notes and study photographs",
            ],
          },
        ],
      },
      {
        id: "southern-utah",
        label: "Southern Utah",
        blocks: [
          {
            type: "gallery",
            ariaLabel: "Southern Utah placeholders",
            items: [
              { caption: "Desert road", wide: true },
              { caption: "Cliff edge" },
              { caption: "Evening wash" },
              { caption: "Stone shadow", wide: true },
            ],
          },
        ],
      },
      {
        id: "portraits",
        label: "Portraits",
        blocks: [
          {
            type: "gallery",
            ariaLabel: "Portrait placeholders",
            items: [
              { caption: "Window light", wide: true },
              { caption: "Profile study" },
              { caption: "Kitchen table" },
              { caption: "Blue jacket", wide: true },
            ],
          },
        ],
      },
      {
        id: "family-photos",
        label: "Family Photos",
        blocks: [
          {
            type: "gallery",
            ariaLabel: "Family photo placeholders",
            items: [
              { caption: "Back porch", wide: true },
              { caption: "Holiday table" },
              { caption: "Driveway dusk" },
              { caption: "Summer lake", wide: true },
            ],
          },
        ],
      },
      {
        id: "film-photography",
        label: "Film Photography",
        blocks: [
          {
            type: "text",
            kicker: "Process",
            paragraphs: [
              "Use this page to talk about cameras, stocks, scanning, or the reasons film belongs in the wider body of work.",
            ],
          },
          {
            type: "gallery",
            ariaLabel: "Film photography placeholders",
            items: [
              { caption: "Grain test", wide: true },
              { caption: "Contact sheet" },
              { caption: "Night exposure" },
              { caption: "Washed sky", wide: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "contact",
    tone: "tone-charcoal",
    shelfTitle: "Contact",
    viewIndex: "Contact",
    viewKicker: "Contact",
    viewTitle: "Contact",
    viewSubtitle: "A clear, minimal place for correspondence, collaboration notes, and public profiles.",
    widthRem: 4.95,
    heightRem: 22.9,
    pages: [
      {
        id: "overview",
        label: "Overview",
        blocks: [
          {
            type: "text",
            kicker: "Correspondence",
            paragraphs: [
              "For research collaborations, speaking invitations, or project inquiries, add the primary contact details here and keep response expectations clear.",
            ],
          },
        ],
      },
      {
        id: "email",
        label: "Email",
        blocks: [
          {
            type: "callout",
            label: "Email",
            text: "Use a primary address that you actually check and keep the label simple.",
            link: {
              href: "mailto:austin.francis@example.com",
              label: "austin.francis@example.com",
            },
          },
        ],
      },
      {
        id: "profiles",
        label: "Public Profiles",
        blocks: [
          {
            type: "list",
            kicker: "Public profiles",
            style: "bullet",
            items: [
              "Add GitHub, Google Scholar, or LinkedIn links once the final URLs are ready",
              "Note whether you are open to consulting, speaking, or editorial collaborations",
              "Include a city or time zone if regular meetings matter for your work",
            ],
          },
        ],
      },
      {
        id: "collaboration",
        label: "Collaboration",
        blocks: [
          {
            type: "text",
            kicker: "Working together",
            paragraphs: [
              "A short note here can set expectations on timelines, the kinds of projects you accept, and whether you are open to research, design, or software collaborations.",
            ],
          },
        ],
      },
    ],
  },
];

export const libraryBookMap = new Map(libraryBooks.map((book) => [book.id, book]));
