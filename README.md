# Lukas Nilsson - Personal Portfolio

> Tech creative, founder, and truth seeker building at the intersection of philosophy, technology, and human potential.

🌐 **Live Site:** [lukas-nilsson.github.io](https://lukas-nilsson.github.io)

---

## 🏗️ Tech Stack

- **Framework:** [Astro](https://astro.build) v5
- **Styling:** Custom CSS with CSS Variables
- **Content:** Markdown from [public-mindpalace](https://github.com/Lukas-Nilsson/public-mindpalace) (git submodule)
- **Deployment:** GitHub Actions → GitHub Pages
- **Typography:** System fonts (optimized for performance)

---

## 📁 Project Structure

```
lukas-nilsson.github.io/
├── src/
│   ├── pages/
│   │   ├── index.astro           # Custom homepage
│   │   ├── about.astro
│   │   ├── writing.astro
│   │   ├── contact.astro
│   │   ├── 404.astro
│   │   └── projects/
│   │       ├── index.astro       # Projects list
│   │       └── [slug].astro      # Individual project pages
│   ├── layouts/
│   │   ├── BaseLayout.astro      # Base HTML structure
│   │   └── ContentPage.astro     # Markdown content layout
│   ├── components/
│   │   └── Navigation.astro      # Responsive nav
│   ├── styles/
│   │   └── global.css            # Design system
│   └── content/
│       ├── config.ts             # Content collections config
│       └── public/               # Submodule → public-mindpalace
├── public/
│   ├── favicon.svg
│   └── robots.txt
├── old/                          # Archived versions
│   ├── index.html
│   └── v2/                       # Previous site (2024-2025)
└── .github/
    └── workflows/
        └── deploy.yml            # Deployment automation
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
# Clone the repository
git clone https://github.com/Lukas-Nilsson/lukas-nilsson.github.io.git
cd lukas-nilsson.github.io

# Initialize submodules (content)
git submodule update --init --recursive

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build for production to `./dist/` |
| `npm run preview` | Preview production build locally |

---

## 📝 Content Management

Content is sourced from the [public-mindpalace](https://github.com/Lukas-Nilsson/public-mindpalace) repository, which auto-syncs from a private Obsidian vault.

### Content Structure

```
src/content/public/
├── About/index.md
├── Projects/
│   └── the-human-archives.md
├── Writing/index.md
└── Contact/index.md
```

### Frontmatter Schema

All content pages use this YAML frontmatter:

```yaml
---
title: "Page Title"
summary: "Brief description"
publish: true
tags: [tag1, tag2]
updated: 2025-11-03
---
```

### Updating Content

Content updates automatically when the submodule is updated:

```bash
# Update content from public-mindpalace
git submodule update --remote src/content/public

# Commit the submodule reference
git add src/content/public
git commit -m "Update content"
git push
```

GitHub Actions will automatically rebuild and deploy the site.

---

## 🎨 Design Philosophy

**Principles:**
- Minimal, clean aesthetics
- Generous whitespace
- System fonts (performance-first)
- Mobile-first responsive design
- Semantic HTML
- Accessible (WCAG 2.1)

**Color Palette:**
- Neutral grays (black/white)
- Single accent: Blue (`#3b82f6`)
- High contrast for readability

**Typography:**
- System font stack
- Fluid typography (clamp-based)
- Line height: 1.7 for body, 1.2 for headings

---

## 🚢 Deployment

Deployment is fully automated via GitHub Actions.

### Workflow

1. Push to `main` branch
2. GitHub Actions builds the site
3. Output deploys to GitHub Pages
4. Live in ~2-3 minutes

### Manual Deployment

```bash
# Build locally
npm run build

# Deploy (handled by GitHub Actions automatically)
```

### GitHub Pages Configuration

- **Source:** GitHub Actions
- **Branch:** `main`
- **Directory:** `dist/` (built by Astro)
- **Custom domain:** Not configured (using default)

---

## 🧪 Testing

```bash
# Build production version
npm run build

# Preview locally
npm run preview

# Check for accessibility issues
# (Use browser DevTools Lighthouse)
```

---

## 📦 Dependencies

**Production:**
- `astro` - Static site framework
- `@astrojs/sitemap` - SEO sitemap generation

**Dev:**
- TypeScript (strict mode)
- Astro content collections

---

## 📜 Version History

- **v3.0** (2025) - Astro rebuild, content from public-mindpalace
- **v2.0** (2024-2025) - Vanilla JS with command palette ([archived](old/v2/))
- **v1.0** (2024) - Original portfolio ([archived](obsolete/))

---

## 📧 Contact

**Lukas Nilsson**
- Email: [lukasnilssonbusiness@gmail.com](mailto:lukasnilssonbusiness@gmail.com)
- GitHub: [@Lukas-Nilsson](https://github.com/Lukas-Nilsson)
- LinkedIn: [lukaspnilsson](https://www.linkedin.com/in/lukaspnilsson/)
- Website: [lukas-nilsson.github.io](https://lukas-nilsson.github.io)

---

## 📄 License

Content and code © 2025 Lukas Nilsson. All rights reserved.

---

*Built with [Astro](https://astro.build) 🚀*
