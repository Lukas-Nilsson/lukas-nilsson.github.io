# Public MindPalace

> A living, evolving public record of work, ideas, and projects — synced directly from my private Obsidian vault.

---

## What is this?

This repository contains the public-facing content from my personal knowledge base. It's automatically synced from my private vault, making it a real-time mirror of my thinking and work.

Think of it as:
- **A living portfolio** that updates itself
- **An open notebook** of ideas and projects
- **The public layer** of my MindPalace

Everything here is intentionally published — filtered, refined, and ready to share.

---

## Structure

- [`/About`](./About/) — Background, philosophy, and story
- [`/Projects`](./Projects/) — Portfolio pieces and creative works
- [`/Writing`](./Writing/) — Essays, reflections, and short pieces
- [`/Contact`](./Contact/) — Ways to connect
- [`index.md`](./index.md) — Homepage overview

---

## 🌐 Website Integration (Astro)

This repository powers [lukas-nilsson.github.io](https://lukas-nilsson.github.io) via **Astro** static site generation.

### How It Works

1. **Git Submodule:** The website repo includes this repo as a git submodule at `src/content/public/`
2. **Content Collections:** Astro reads all `.md` files as a content collection
3. **Build Time:** Pages are generated statically when the site builds
4. **Auto-Deploy:** Pushing to `main` triggers GitHub Actions → rebuild → live site

### File-to-Route Mapping

| Content File | Website Route | Page Type |
|-------------|---------------|-----------|
| `About/index.md` | `/about` | Single page |
| `Projects/*.md` | `/projects/:slug` | Dynamic pages |
| `Writing/index.md` | `/writing` | Single page |
| `Contact/index.md` | `/contact` | Single page |
| `index.md` | *(not used)* | Custom homepage instead |

### Link Normalization ⚠️

**Important:** The website automatically normalizes internal links:

- **Case:** Capitalized paths (`/Contact/`, `/Projects/`) → lowercase (`/contact`, `/projects`)
- **Extensions:** `.md` files (`Projects/example.md`) → routes (`/projects/example`)
- **Paths:** Relative links → absolute paths

**Why?** Obsidian uses capitalized folder names, but Astro routes are lowercase. The site handles this automatically via client-side JavaScript.

**Best Practice:** When linking between pages, use either:
```markdown
[Contact](/Contact/)           ✅ Works (auto-normalized)
[Contact](/contact/)           ✅ Works (already lowercase)
[Project](Projects/example.md) ✅ Works (auto-normalized)
```

---

## 📝 Content Guidelines

### Frontmatter Schema

Every `.md` file should include YAML frontmatter. The website uses these fields:

```yaml
---
title: "Page Title"              # Required - Used in <title> and <h1>
summary: "Brief description"     # Optional - Used in meta tags & cards
publish: true                    # Required - Only `true` pages are shown
tags: [tag1, tag2]              # Optional - For organization
updated: 2025-11-03             # Optional - Shows last update date
---
```

**Field Usage:**
- `title` → Page title, SEO, Open Graph
- `summary` → Meta description, social media previews
- `publish` → **Must be `true`** or page won't appear
- `tags` → Currently informational (not displayed)
- `updated` → Date metadata (not currently displayed)

### Markdown Features Supported

The Astro site renders standard markdown with these features:

#### ✅ Supported

- **Headings:** `# H1` through `###### H6`
- **Paragraphs:** Standard text blocks
- **Bold:** `**bold text**`
- **Italic:** `*italic text*`
- **Links:** `[text](url)` (internal & external)
- **Lists:** Ordered (`1.`) and unordered (`-`, `*`)
- **Blockquotes:** `> quoted text`
- **Code:**
  - Inline: `` `code` ``
  - Blocks: ` ```language\ncode\n``` `
- **Horizontal rules:** `---`
- **Images:** `![alt](url)` (will be styled responsively)

#### ⚠️ Limited Support

- **Obsidian wikilinks:** `[[Page]]` → Won't work, use markdown links instead
- **Embeds:** `![[file]]` → Won't render, use regular markdown
- **Callouts:** Obsidian-specific syntax → Will render as blockquotes
- **Dataview:** Dynamic queries → Won't process (static site)
- **Tags inline:** `#tag` → Will render as text, not interactive

#### 📐 Styling Applied

The website applies these styles to your markdown:

- **Typography:** System fonts, fluid sizing (responsive)
- **Line height:** 1.75 for readability
- **Links:** Blue accent color, underline on hover
- **Code blocks:** Light gray background, monospace font
- **Images:** Max width 100%, rounded corners, responsive
- **Spacing:** Generous margins between elements

### Writing Best Practices

1. **Use Standard Markdown:** Avoid Obsidian-specific syntax for best rendering
2. **Test Links:** Internal links should work in both Obsidian and on the web
3. **Alt Text:** Always add alt text to images: `![description](url)`
4. **Semantic Structure:** Use proper heading hierarchy (H1 → H2 → H3)
5. **Frontmatter First:** Always include complete frontmatter
6. **Line Length:** Keep lines reasonable for readability (optional but helpful)

### Example Well-Formed Document

```markdown
---
title: "Example Project"
summary: "A brief description of what this project is about"
publish: true
tags: [projects, web-development]
updated: 2025-11-03
---

# Example Project

A compelling introduction paragraph that explains the project.

---

## Overview

Main content goes here with **bold** and *italic* text.

### Subsection

- Bullet point one
- Bullet point two

[Link to another page](/projects/other-project)

---

## Technical Details

```javascript
const example = "code block";
```

More content...
```

---

## 🔄 Update Workflow

### For Content Creators (You)

1. **Write in Obsidian** (private vault)
2. **Move to `/Public` folder** when ready
3. **Run sync script** → pushes to this GitHub repo
4. **Website auto-rebuilds** (~2-3 minutes)
5. **Live on site** at lukas-nilsson.github.io

### For Website Developers

When this repo updates, the website needs to update its submodule reference:

```bash
# In the website repo
cd src/content/public
git pull origin main
cd ../..
git add src/content/public
git commit -m "Update content from public-mindpalace"
git push
```

This triggers GitHub Actions → rebuild → deploy.

---

## 🛠️ Technical Stack

**Website Framework:** Astro v5
- **Build:** Static Site Generation (SSG)
- **Deploy:** GitHub Actions → GitHub Pages
- **Hosting:** lukas-nilsson.github.io
- **Content:** This repo (as git submodule)

**Rendering Pipeline:**
1. Astro content collections parse `.md` files
2. YAML frontmatter → Zod schema validation
3. Markdown → HTML (via Astro's built-in processor)
4. Static pages generated at build time
5. JavaScript adds link normalization on page load

**Performance:**
- Pre-rendered HTML (no client-side rendering)
- System fonts (no web font loading)
- Minimal JavaScript (only for nav & link fixing)
- Lighthouse scores: 95+ across the board

---

## 📂 Special Files & Folders

| Path | Purpose | Rendered? |
|------|---------|-----------|
| `README.md` | This file (GitHub repo docs) | ❌ No |
| `System/README.md` | System documentation | ❌ No |
| `index.md` | Content overview | ❌ No (custom homepage instead) |
| `About/index.md` | About page | ✅ Yes → `/about` |
| `Projects/*.md` | Project pages | ✅ Yes → `/projects/*` |
| `Writing/index.md` | Writing page | ✅ Yes → `/writing` |
| `Contact/index.md` | Contact page | ✅ Yes → `/contact` |

**Note:** Only files with `publish: true` in frontmatter will appear on the website.

---

## 🐛 Troubleshooting

### "My page isn't showing on the website"

Check:
1. ✅ `publish: true` in frontmatter?
2. ✅ Valid frontmatter YAML syntax?
3. ✅ File in correct folder (`/About`, `/Projects`, `/Writing`, `/Contact`)?
4. ✅ Website submodule updated to latest commit?

### "Links are broken"

Remember:
- Internal links are auto-normalized (case & `.md` extensions)
- Use standard markdown links: `[text](path)`
- Avoid Obsidian wikilinks: `[[page]]`

### "Formatting looks wrong"

Check:
- Valid markdown syntax?
- Using Obsidian-specific features? (won't render)
- Code blocks properly fenced with triple backticks?

### "Changes not appearing"

Ensure:
1. Committed and pushed to this repo
2. Website submodule updated
3. Website rebuilt (check GitHub Actions)
4. Hard refresh browser (Cmd/Ctrl + Shift + R)

---

## 🎨 Content Design Philosophy

**Why this structure works:**

1. **Obsidian-first:** Write naturally in your private vault
2. **Selective publishing:** Only `/Public` folder syncs
3. **Git-powered:** Version control, history, collaboration
4. **Static output:** Fast, secure, cacheable
5. **Automatic:** Write → sync → live (minimal friction)

**The separation:**

- **Private vault:** Raw notes, drafts, personal organization
- **`/Public` folder:** Refined, ready-to-share content
- **This repo:** Public mirror, version controlled
- **Website:** Beautiful presentation layer

---

## 📄 License

Content is published here with the intent to share ideas openly. Feel free to reference, quote, or remix with attribution.

---

## 🔗 Links

- **Website:** [lukas-nilsson.github.io](https://lukas-nilsson.github.io)
- **Website Repo:** [github.com/Lukas-Nilsson/lukas-nilsson.github.io](https://github.com/Lukas-Nilsson/lukas-nilsson.github.io)
- **This Repo:** [github.com/Lukas-Nilsson/public-mindpalace](https://github.com/Lukas-Nilsson/public-mindpalace)

---

**Note:** This is a work in progress. Content evolves, structure refines, and new sections emerge over time. That's by design — it's meant to be a living archive.

---

*For more on the system behind this, see [`/System/README.md`](./System/README.md)*

