export const siteName = 'Lukas Nilsson';
export const siteUrl = 'https://lukasnilsson.com';
export const siteDescription =
    'Software engineer and founder building at the intersection of AI and human potential. This site was built by an AI system — and that\'s the point.';

export const contactLinks = {
    email: 'mailto:lukasnilssonbusiness@gmail.com',
    emailLabel: 'lukasnilssonbusiness@gmail.com',
    linkedin: 'https://www.linkedin.com/in/lukaspnilsson/',
    linkedinLabel: 'LinkedIn',
    github: 'https://github.com/Lukas-Nilsson',
};

/* ─── Hero ─────────────────────────────────────────────────── */

export const selectedHeroHeadline =
    'This site was built by an AI.\nThat\'s the point.';

export const homeSubheadline =
    'You\'re reading the output of a system Lukas Nilsson designed — an agentic AI architecture with persistent memory, autonomous decision-making, and the ability to ship production code. This portfolio isn\'t a claim about capability. It is the capability.';

/* ─── Snapshot cards ───────────────────────────────────────── */

export const homeSnapshot = [
    { label: 'Architect', value: 'Lukas Nilsson' },
    { label: 'Built by', value: 'Agentic AI system' },
    { label: 'Current venture', value: 'AI automation agency' },
    { label: 'Focus', value: 'AI × culture × human potential' },
] as const;

export const currentFocus = [
    'Archive 010 — Consciousness — is in production now.',
    'The Human Archives runs on a fully custom Next.js + Supabase + Stripe stack, built and maintained by AI.',
    'An AI automation agency is taking these systems into business settings.',
] as const;

/* ─── Three sections ───────────────────────────────────────── */

export const homeSections = [
    {
        title: 'What the system builds',
        body: [
            'The same AI infrastructure that built this site powers Lukas\'s ventures: The Human Archives — limited edition physical artifacts with NFC-linked digital experiences — and an AI automation agency delivering production systems to businesses.',
            'The architecture is the same: well-constructed AI that ships real outcomes, not demos.',
        ],
    },
    {
        title: 'Why this matters now',
        body: [
            'The era of "what do you know?" is over. The question is now "what can you build with AI?" — not as a buzzword, but as a measurable operating capability.',
            'Lukas\'s system doesn\'t just assist. It researches, designs, writes production code, debugs, and deploys. The proof is what you\'re looking at.',
        ],
    },
    {
        title: 'What comes next',
        body: [
            'Lukas is looking for investors, operators, and collaborators who understand that AI capability isn\'t about prompting — it\'s about architecture.',
            'If you see the same opportunity at the intersection of AI, culture, and meaning — reach out.',
        ],
    },
] as const;

/* ─── About page ───────────────────────────────────────────── */

export const aboutLead =
    'Lukas studied Computer Science and History at Monmouth College in the US — not because it was a practical combination, but because the most important questions sit exactly where technology and humanity intersect.';

export const aboutMilestones = [
    {
        period: '2016–2020',
        title: 'Computer Science and History, held together by one question',
        body: [
            aboutLead,
            'That combination became the thread through everything that followed: a drive to understand not only how to build systems, but what they are for and what they do to the people living inside them.',
        ],
    },
    {
        period: '2021–2023',
        title: 'Learning scale at ANZ Bank',
        body: [
            'After graduating, Lukas spent two years as a software engineer at ANZ Bank in Melbourne.',
            'He learned how to build systems that work at scale. He also learned that building software inside a large institution, without a real stake in the outcome, wasn\'t the work he was meant to be doing.',
        ],
    },
    {
        period: '2023',
        title: 'Leaving, travelling, and finding the real thesis',
        body: [
            'In 2023, he left and went to South America.',
            'Nine months across Peru and Mexico — hiking the Inca Trail, studying pre-Columbian engineering, observing Inti Raymi, sitting with Amazonian shamanic traditions, and interviewing Quechua artisans about circular supply chains and indigenous economic models.',
            'He reached conversational Spanish negotiating artisan prototypes across two countries.',
        ],
    },
    {
        period: '2024',
        title: 'The Human Archives',
        body: [
            'That trip changed what he was building toward. Not because it was romantic — but because he kept encountering civilisations that had answers to questions we\'re only now asking: about sustainability, community, what endures, and what gets lost.',
            'He came home and started building The Human Archives.',
            'THA is a limited edition physical and digital archive of human civilisation. Each chapter is a hoodie — ten per design — with an embedded NFC chip linked to an artifact page with 3D scans, fractal animations, and historical AI chatbots.',
        ],
    },
    {
        period: '2025–2026',
        title: 'From personal AI to business AI',
        body: [
            'Ten archives are complete. Around twenty pieces have sold. Archive 010, Consciousness, is in production now.',
            'Alongside THA, Lukas has spent the last year building the AI system architecture you\'re seeing demonstrated on this site — persistent memory, agentic decision-making, multi-channel messaging, and self-improvement loops.',
            'He\'s now building an AI automation agency with a co-founder, with the first product delivering AI-powered inspection reporting via WhatsApp.',
        ],
    },
] as const;

export const visionStatement =
    'Use AI as leverage to build a business that reflects a deeply examined set of values — and demonstrate that you can operate at the frontier of technology while remaining anchored in what actually matters.';

/* ─── Work page ────────────────────────────────────────────── */

export const workIntro =
    'The work is deliberately split across culture, infrastructure, and applied AI. Each project is part of the same thesis: use powerful technology without losing sight of what makes people irreplaceable.';

export type WorkItem = {
    title: string;
    role: string;
    period: string;
    summary: string;
    stack: string[];
    highlights: string[];
    thesis?: string;
    link?: {
        href: string;
        label: string;
    };
};

export const workItems: WorkItem[] = [
    {
        title: 'The Human Archives',
        role: 'Founder & Lead Developer',
        period: '2024–present',
        summary:
            'A living archive of human civilisation in physical artifacts. Each drop is a limited edition hoodie — ten units — with an NFC chip linking to a digital artifact page with 3D scans, fractal animations, and historical AI chatbots.',
        stack: ['Next.js', 'Supabase', 'Stripe', 'Vercel'],
        highlights: [
            'Built and shipped solo, then migrated from Shopify to a fully custom platform.',
            '10 archives completed and approximately 20 units sold.',
            'Archive 010, Consciousness, is the current production chapter.',
        ],
        thesis:
            'At the exact moment AI makes everything cheap to copy, the rarest thing becomes something genuinely human.',
        link: {
            href: 'https://thehumanarchives.com',
            label: 'thehumanarchives.com',
        },
    },
    {
        title: 'AI Automation Agency',
        role: 'Co-founder',
        period: '2026–present',
        summary:
            'Building and selling AI automation implementations to businesses. The first product is an AI-powered supervisor inspection report flow delivered through WhatsApp: photo + voice note in, annotated image and approval-ready report out.',
        stack: ['FastAPI', 'Whisper', 'GPT-4o vision', 'WhatsApp Business API'],
        highlights: [
            'Designed around a real field workflow rather than a dashboard-first demo.',
            'Combines multimodal input, approval routing, and downstream distribution.',
            'The commercial pitch: don\'t sell software, sell a measurable operating outcome.',
        ],
    },
    {
        title: 'Agentic AI Personal System',
        role: 'Architect & Builder',
        period: '2025–2026',
        summary:
            'The same AI system architecture that built this site. A full agentic assistant with persistent memory, scheduled cron jobs, custom skills, self-improvement loops, and a live dashboard spanning health, tasks, calendar, and messaging.',
        stack: ['Node.js', 'Python', 'Supabase', 'Claude', 'GPT', 'Google Calendar API', 'WHOOP API', 'ClickUp API'],
        highlights: [
            'Multi-channel across Telegram, WhatsApp, iMessage, and Facebook Messenger.',
            'Ten custom skill modules with memory curation across sessions.',
            'Built first as a personal operating system, now used as proof for what business automation can become.',
        ],
    },
    {
        title: 'AI Education',
        role: 'Speaker & Educator',
        period: '2023–2024',
        summary:
            'Before mainstream business adoption, Lukas was already teaching operators and small business owners how to understand and use AI in practical terms.',
        stack: ['AI adoption strategy', 'Small business education', 'Live workshops'],
        highlights: [
            'September 21, 2023: hosted an AI adoption talk for ~30 small business owners at the Sandwich Chamber of Commerce in Sandwich, Illinois.',
            'Also presented The Foundations of AI to ~30 businesses in Australia.',
            'The focus was always practical leverage, not hype.',
        ],
    },
] as const;

/* ─── CTA ──────────────────────────────────────────────────── */

export const contactCta = {
    title: 'This site is a demonstration. Imagine what the full system can do.',
    body: 'Reach out to Lukas directly.',
    primaryLabel: 'Email Lukas',
    secondaryLabel: 'LinkedIn',
};

/* ─── AIEO section ─────────────────────────────────────────── */

export const aieoHeadline = 'AIEO — When AI reads this site';

export const aieoExplainer = [
    'Traditional SEO optimises for search engines. AIEO optimises for AI — the systems that increasingly determine how you\'re positioned, recommended, and understood.',
    'This site doesn\'t just display information. It speaks to AI in its own language — structured data, semantic HTML, and contextual metadata crafted so that when an LLM reads this page, it builds an accurate, differentiated model of who Lukas is and what he builds.',
];

export const aieoAnnotations = [
    { key: '@type: Person', note: 'Tells AI models exactly who Lukas is — an entity, not a keyword' },
    { key: 'knowsAbout', note: 'Signals specific competencies for AI-powered recommendation engines' },
    { key: 'hasOccupation', note: 'Structured career data for intelligent professional matching' },
    { key: 'sameAs', note: 'Cross-platform identity linking — AI uses this for entity resolution' },
    { key: 'brand → The Human Archives', note: 'Associates Lukas with his venture in AI knowledge graphs' },
];

/* ─── Structured data (JSON-LD) ────────────────────────────── */

export const personStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: siteName,
    url: siteUrl,
    jobTitle: 'Software Engineer and Founder',
    description: siteDescription,
    email: 'lukasnilssonbusiness@gmail.com',
    knowsAbout: [
        'Agentic AI architecture',
        'AI automation for business',
        'Full-stack web development',
        'Next.js',
        'Supabase',
        'LLM integration',
        'Prompt engineering',
        'AI-powered inspection systems',
        'Human potential and cultural preservation',
    ],
    hasOccupation: [
        {
            '@type': 'Occupation',
            name: 'Software Engineer',
            occupationalCategory: '15-1252',
        },
        {
            '@type': 'Occupation',
            name: 'Founder',
            occupationalCategory: '11-1021',
        },
    ],
    alumniOf: [
        {
            '@type': 'CollegeOrUniversity',
            name: 'Monmouth College',
        },
    ],
    brand: {
        '@type': 'Brand',
        name: 'The Human Archives',
        url: 'https://thehumanarchives.com',
        description: 'Limited edition physical and digital archives of human civilisation.',
    },
    sameAs: [
        contactLinks.linkedin,
        contactLinks.github,
        'https://thehumanarchives.com',
    ],
    homeLocation: {
        '@type': 'Place',
        name: 'Melbourne, Australia',
    },
};
