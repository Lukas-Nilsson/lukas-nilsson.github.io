# Deployment Guide

## ✅ What's Been Completed

Your personal portfolio has been completely rebuilt with Astro! Here's what's new:

### 🏗️ Architecture
- **Framework:** Astro v5 (static site generator)
- **Content Source:** Git submodule from `public-mindpalace` repo
- **Deployment:** GitHub Actions (automatic on push to main)
- **Hosting:** GitHub Pages

### 📄 Pages Created
- ✅ **Homepage** (`/`) - Custom design with large "Lukas Nilsson" typography
- ✅ **About** (`/about`) - Renders from `About/index.md`
- ✅ **Projects** (`/projects`) - Lists all projects + individual project pages
- ✅ **Writing** (`/writing`) - Renders from `Writing/index.md`
- ✅ **Contact** (`/contact`) - Renders from `Contact/index.md`
- ✅ **404 Page** - Custom error page

### 🎨 Design
- Clean, minimal aesthetic with generous whitespace
- Responsive navigation (hamburger menu on mobile)
- System fonts for optimal performance
- Mobile-first responsive design
- Semantic HTML and accessibility features

### 🚀 Next Steps to Deploy

#### 1. Configure GitHub Pages
Before pushing, you need to configure GitHub Pages:

1. Go to your repo: https://github.com/Lukas-Nilsson/lukas-nilsson.github.io
2. Settings → Pages
3. Under "Build and deployment":
   - **Source:** Select "GitHub Actions" (not "Deploy from a branch")
4. Save

#### 2. Push to Deploy
```bash
# Push both commits (archive + rebuild)
git push origin main

# The GitHub Action will automatically:
# - Install dependencies
# - Build the site
# - Deploy to GitHub Pages
```

#### 3. Monitor Deployment
- Go to Actions tab in your GitHub repo
- Watch the "Deploy to GitHub Pages" workflow
- Should complete in ~2-3 minutes

#### 4. Verify Live Site
Once deployed, visit: https://lukas-nilsson.github.io

---

## 🔄 Updating Content

Your content auto-syncs from `public-mindpalace`. To update:

```bash
# Update the submodule to latest
git submodule update --remote src/content/public

# Commit the submodule reference
git add src/content/public
git commit -m "Update content from public-mindpalace"
git push

# Site will rebuild automatically
```

---

## 🛠️ Local Development

```bash
# Install dependencies (first time only)
npm install

# Start dev server (localhost:4321)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📁 Project Structure

```
lukas-nilsson.github.io/
├── src/
│   ├── pages/              # Routes (index, about, projects, etc.)
│   ├── layouts/            # Page layouts
│   ├── components/         # Reusable components (Navigation)
│   ├── styles/             # Global CSS
│   └── content/
│       └── public/         # Submodule → public-mindpalace
├── public/                 # Static assets (favicon, robots.txt)
├── old/v2/                 # Archived previous site
└── .github/workflows/      # Deployment automation
```

---

## ✨ Features

✅ **SEO Optimized**
- Sitemap automatically generated
- Meta tags (title, description, OG tags, Twitter cards)
- Semantic HTML structure
- Canonical URLs

✅ **Performance**
- Static site (pre-rendered at build time)
- System fonts (no web font loading)
- Minimal JavaScript
- Optimized CSS

✅ **Accessibility**
- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigation support
- Focus states for interactive elements
- Responsive touch targets (44x44px minimum)

✅ **Responsive Design**
- Mobile-first approach
- Breakpoints: < 768px (mobile), 768-1024px (tablet), > 1024px (desktop)
- Fluid typography using `clamp()`
- Flexible layouts

---

## 🔧 Customization

### Change Colors
Edit `src/styles/global.css`:
```css
:root {
  --color-accent: #3b82f6;  /* Change this */
}
```

### Add Dark Mode
The design system is ready - just add:
```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #1e293b;
    --color-text: #f1f5f9;
    /* ... */
  }
}
```

### Update Navigation
Edit `src/components/Navigation.astro`:
```javascript
const navItems = [
  { name: 'About', href: '/about' },
  // Add more items here
];
```

---

## 📊 Build Info

- **Last Build:** November 3, 2025
- **Astro Version:** 5.15.3
- **Node Version:** 20.19.3
- **Dependencies:** Minimal (Astro + Sitemap plugin only)

---

## 🐛 Troubleshooting

### Build fails?
```bash
# Clear cache and rebuild
rm -rf .astro dist node_modules
npm install
npm run build
```

### Content not updating?
```bash
# Update submodule
git submodule update --remote --merge
git add src/content/public
git commit -m "Update content"
git push
```

### GitHub Actions failing?
- Check that GitHub Pages source is set to "GitHub Actions"
- Verify the workflow file: `.github/workflows/deploy.yml`
- Check Actions tab for error logs

---

## 📞 Support

If you encounter issues:
1. Check build logs in GitHub Actions
2. Test locally with `npm run build`
3. Review the README.md for full documentation

---

**Ready to deploy?** Run `git push origin main` 🚀

