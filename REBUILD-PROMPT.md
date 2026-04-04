# lukasnilsson.com — Website Rebuild Prompt for Codex/Claude Code
*Created: 2026-04-04*

---

## Context

This is lukasnilsson.com — a personal portfolio site for Lukas Nilsson, software engineer and founder.

The site is built in **Next.js + Supabase + Vercel**. The repo is at `/dev/lukasnilsson.com` (or wherever the portfolio repo lives locally).

This task covers two things:
1. A full content/copy audit and rewrite
2. A technical audit of the site for improvements

---

## Part 1 — Content & Copy Rewrite

### Target Audience
Angel investors, well-connected operators, and influential intelligent people. They have pattern recognition. They've seen a thousand founders. What cuts through is coherence — where past, present, and future point in the same direction.

### Posture
Not "here's my CV, please consider me." More like: "I've already started building the thing. I know where it's going. I'm looking for people who see what I see and want in."

---

### Homepage — Rewrite

**Current:** "Tech creative · Founder · Truth seeker" + ChatGPT quote as hero.

**Replace with:**

Headline (choose one or implement all as options to review):
- Option A: `I build things at the intersection of AI and human potential.`
- Option B: `At the moment AI makes everything copyable, I'm building things that can't be.`
- Option C: `Software engineer. Founder. Building an AI-leveraged business with a clear purpose — and the conviction to match.`
- Option D: `I left a software engineering career to figure out what humans are actually for. Now I use AI to build it.`

Sub-headline:
> I'm Lukas Nilsson — a software engineer and founder based in Melbourne. I build at the intersection of AI, culture, and human potential. My work is the direct result of a question I've been obsessed with since studying pre-Columbian civilisations in Peru: *what do we preserve, and what do we become?*

Three homepage body sections (scannable):

**What I'm building**
> The Human Archives is a living monument to what makes us irreplaceable — limited edition physical artifacts (hoodies with NFC chips) linked to AI-powered digital archives exploring humanity's deepest questions. Ten archives. Ten limited drops. A growing record of what it means to be human at the moment we created artificial intelligence.
>
> Alongside THA, I'm building AI automation systems for businesses — helping organisations implement agentic AI that actually works, not just demos that look good.

**Why it matters**
> AI is the most consequential technology ever built. It will touch every business, every job, every human. Most of the people building it aren't asking whether they should — they're only asking whether they can. I think that's the wrong order. My work is an answer to that problem: build powerfully, build intentionally, build in service of human potential.

**What I'm looking for**
> I'm not looking for a job. I'm building something. If you're an investor, operator, or collaborator who sees the same opportunity at the intersection of AI, culture, and meaning — I want to talk.

---

### About Page — Full Rewrite

Replace existing about content with this full narrative:

> I studied Computer Science and History at Monmouth College in the US — not because I thought it was a practical combination, but because I've always believed the most important questions sit exactly where technology and humanity intersect.
>
> After graduating, I spent two years as a software engineer at ANZ Bank in Melbourne. I learned how to build systems that work at scale. I also learned that building software inside a large institution, without a stake in the outcome, wasn't the work I was meant to be doing.
>
> In 2023, I left and went to South America.
>
> I spent nine months in Peru and Mexico — hiking the Inca Trail, studying pre-Columbian engineering, observing Inti Raymi, sitting with Amazonian shamanic traditions, and spending months interviewing Quechua artisans about circular supply chains and indigenous economic models. I reached conversational Spanish negotiating artisan prototypes across two countries.
>
> That trip changed what I was building toward. Not because it was romantic — but because I kept encountering civilisations that had answers to questions we're only now asking. About sustainability. About community. About what endures. About what gets lost.
>
> I came home and started building The Human Archives.
>
> THA is a limited edition physical and digital archive of human civilisation — each chapter a hoodie (10 per design) with an embedded NFC chip, linked to an artifact page: 3D scans, fractal animations, historical AI chatbots. The premise is simple: while everyone races toward the future, someone should be making sure we understand where we came from.
>
> Ten archives. Archive 010 — Consciousness — in production now.
>
> Alongside THA, I've spent the last year building AI systems — first for myself (a full agentic personal assistant with memory, cron jobs, multi-channel messaging, and self-improvement loops), and now for businesses. I'm currently building an AI automation agency with a co-founder, with our first product delivering AI-powered inspection reporting via WhatsApp.
>
> My vision is clear: use AI as leverage to build a business that reflects a deeply examined set of values — and demonstrate that you can operate at the frontier of technology while remaining anchored in what actually matters.

**Remove from the current About page:**
- The named philosophy "disciplined optimism" — cut or bury
- The Philosophy skills section (Philosophy of mind, Epistemology, etc.) — leads with the wrong foot for this audience
- "Truth seeker" from any taglines
- The ChatGPT quote ("A visionary builder — philosopher, artist, and teacher...") — remove entirely

---

### Work / Projects Section — Add or update

Add the following project entries (create a /work page or projects section if it doesn't exist):

**1. The Human Archives**
- Role: Founder & Lead Developer (2024–present)
- A living archive of human civilisation in physical artifacts. Each drop is a limited edition hoodie (10 units) with NFC chip → digital artifact page (3D scans, fractal animations, historical AI chatbots).
- Stack: Next.js, Supabase, Stripe, Vercel (migrated from Shopify, fully custom)
- 10 archives completed. ~20 units sold.
- Link: thehumanarchives.com

**2. AI Automation Agency**
- Role: Co-founder (2026–present)
- Building and selling AI automation implementations to businesses. First product: AI-powered supervisor inspection reports via WhatsApp (photo + voice → annotated image → approval → distribution).
- Stack: FastAPI, Whisper, GPT-4o vision, WhatsApp Business API

**3. Agentic AI Personal System**
- Role: Builder (2026)
- Full personal AI assistant running on Mac mini — multi-channel (Telegram, WhatsApp, iMessage), persistent memory, cron automation, 10 custom skill modules, self-improvement loops, live dashboard.
- Stack: Node.js, Python, Supabase, Claude, GPT, Google Calendar API, WHOOP API, ClickUp API

**4. AI Education (2022–2024)**
- **September 21, 2023 — Sandwich Chamber of Commerce, Sandwich, Illinois, USA.** Hosted an AI adoption talk for ~30 local small business owners covering ChatGPT, Dolly, and practical AI use-cases. One of the first people actively running AI education for business owners — before mainstream adoption.
- Also presented "The Foundations of AI" to ~30 businesses in Australia.

---

### CTA / Contact — Rewrite

Replace current contact with:

> If you're building something at the frontier and you think our work could intersect — reach out directly. I respond to genuine conversations.
> [email] | [LinkedIn]

Remove:
- "Chat with my AI — it knows me well" (undermines authority)
- "Ask Lukas anything" AI chat widget from the homepage (move it to a secondary page if keeping at all)

---

## Part 2 — Technical Audit

Do a full technical audit of the site. Check for and fix:

### Performance
- [ ] Lighthouse score — run and report (aim for 90+ on performance, accessibility, SEO)
- [ ] Image optimisation — are images using `next/image` with proper sizing?
- [ ] Font loading — any layout shift? Use `font-display: swap`
- [ ] Unused JS/CSS — any heavy dependencies that can be trimmed?
- [ ] Core Web Vitals — LCP, CLS, FID

### SEO
- [ ] Meta title + description on every page
- [ ] OG tags for social sharing (title, description, image)
- [ ] Canonical URLs
- [ ] Sitemap.xml exists and is correct
- [ ] robots.txt
- [ ] Structured data (JSON-LD) — at minimum Person schema on homepage
- [ ] H1 hierarchy — one H1 per page, logical heading structure

### Accessibility
- [ ] All images have alt text
- [ ] Colour contrast passes WCAG AA
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] ARIA labels on interactive elements

### Code quality
- [ ] Remove any unused components, pages, or dead routes
- [ ] Check for console errors
- [ ] Check for broken links (internal + external)
- [ ] Environment variables — nothing hardcoded that should be in .env
- [ ] TypeScript errors — run `tsc --noEmit` and resolve

### Mobile
- [ ] All pages render correctly on 375px viewport
- [ ] Touch targets are at least 44x44px
- [ ] No horizontal scroll

---

## Part 3 — Design Direction Notes (for reference, not code changes)

When Lukas reviews the content and decides to update the visual design:
- Aesthetic: sparse, considered, dark-leaning — not startup-bright
- Typography: strong, editorial — confident without being loud
- No testimonials section needed yet
- One clear CTA per page
- The dashboard (/dashboard) stays as a live data page — keep it

---

## Files to Reference

- Current copy context: `~/.openclaw/workspace/profile/context.md`
- Full site copy draft: `~/.openclaw/workspace/profile/site-copy-draft.md`
- This prompt: `~/.openclaw/workspace/profile/website-rebuild-prompt.md`

---

## Deliverables

1. Updated homepage copy (hero + body sections)
2. Rewritten About page
3. New Work/Projects section with 4 entries
4. Updated Contact/CTA
5. Technical audit report (Lighthouse scores, issues found, fixes applied)
6. List of anything removed and why
