# Lukas Nilsson - Portfolio

A modern, accessible, and performant portfolio site built with vanilla HTML, CSS, and JavaScript. Designed for GitHub Pages with offline-first capabilities.

## Features

✅ **Premium Design** - Clean, modern interface with fluid typography and generous spacing  
✅ **Dark Mode** - Automatic theme detection with manual toggle  
✅ **Command Palette** - Quick navigation with ⌘/Ctrl-K  
✅ **AI Chatbot** - Local LLM with graceful fallback  
✅ **Offline Ready** - Service Worker for offline functionality  
✅ **Accessible** - WCAG 2.2 AA compliant  
✅ **Fast** - Optimized Core Web Vitals  
✅ **Responsive** - Mobile-first design  
✅ **SEO Optimized** - Complete meta tags and sitemap  

## Quick Start

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/lukas-nilsson/lukas-nilsson.github.io.git
cd lukas-nilsson.github.io
```

2. Serve locally (Python):
```bash
python3 -m http.server 8080
```

3. Open http://localhost:8080 in your browser

### GitHub Pages Deployment

1. Push changes to the `main` branch
2. Go to repository Settings → Pages
3. Set Source to "Deploy from branch: main → / (root)"
4. Site will be live at https://lukas-nilsson.github.io

## Project Structure

```
/
├── index.html              # Main HTML file
├── /css
│   ├── base.css           # Layout, typography, components
│   └── theme.css          # Design tokens (colors, spacing)
├── /js
│   ├── app.js             # Application bootstrap
│   ├── router.js          # Hash-based routing
│   ├── palette.js         # Command palette
│   ├── theme.js           # Theme management
│   ├── forms.js           # Form validation
│   ├── toast.js           # Toast notifications
│   └── projects.js        # Project data & loading
├── /assets
│   ├── favicon.svg        # Site icon
│   ├── portrait.jpg       # Profile image
│   └── resume.pdf         # Downloadable resume
├── /old
│   └── index.html         # Archive index
├── /obsolete              # Previous site versions
├── sw.js                  # Service Worker
├── robots.txt             # SEO
├── sitemap.xml            # SEO
└── README.md              # This file
```

## Core Web Vitals Testing

### Prerequisites
- Chrome browser
- Chrome DevTools

### Testing LCP (Largest Contentful Paint)

1. Open DevTools (F12)
2. Go to **Lighthouse** tab
3. Select "Desktop" and "Performance"
4. Click "Analyze page load"
5. Check LCP score (target: ≤ 2.5s)

**Throttling:**
- Go to **Network** tab
- Select "Slow 4G" from throttling dropdown
- Reload page and check LCP again

### Testing CLS (Cumulative Layout Shift)

1. Open DevTools → **More tools** → **Rendering**
2. Check "Layout Shift Regions"
3. Scroll through the page
4. Observe any highlighted regions (target: ≤ 0.1)

### Testing INP (Interaction to Next Paint)

1. Open DevTools → **Performance** tab
2. Click **Record**
3. Interact with the page (click buttons, type in forms, open command palette)
4. Stop recording
5. Review interaction timings (target: "Good" rating)

### Automated Testing

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run Lighthouse
lighthouse http://localhost:8080 --view
```

## Features Guide

### Command Palette (⌘/Ctrl-K)

The command palette provides quick access to all site features:

- **Navigation**: Jump to Home, Work, About, Contact
- **Theme**: Toggle dark/light mode
- **Actions**: Download resume

**Usage:**
1. Press `⌘K` (Mac) or `Ctrl+K` (Windows/Linux)
2. Type to filter commands
3. Use `↑`/`↓` to navigate
4. Press `Enter` to execute
5. Press `Esc` to close

### AI Chatbot

The site includes an intelligent chatbot with two modes:

#### Local Mode (WebGPU)
- **Model**: Llama-3.2-1B-Instruct (1.5GB)
- **Inference**: On-device using WebLLM
- **Speed**: Fast after initial load
- **Privacy**: No data leaves your device
- **Requirements**: WebGPU-capable device with 4GB+ RAM

#### Fallback Mode (Rule-based)
- **Engine**: Curated responses for portfolio Q&A
- **Speed**: Instant responses
- **Compatibility**: Works on all devices
- **Features**: Smart intent detection, action buttons

#### Chat Features
- **Floating Button**: Bottom-right corner
- **Keyboard Shortcuts**: `⌘/Ctrl+K` to open, `Esc` to close
- **Slash Commands**: `/theme dark`, `/jump work`, `/download resume`
- **Quick Actions**: Project links, email, resume download
- **Accessibility**: Screen reader support, focus management

#### Device Requirements
- **Local Mode**: Modern laptop/desktop with WebGPU
- **Fallback Mode**: Any device with JavaScript
- **Disable Local**: Add `?nolocal=1` to URL

#### Model Configuration
Edit `js/engine.local.js` to change models:
```javascript
const MODEL_CONFIG = {
  // Current: Llama-3.2-1B-Instruct (1.5GB)
  modelUrl: 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/',
  
  // Alternative: Llama-3.2-3B-Instruct (3GB)
  // modelUrl: 'https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC/resolve/main/',
};
```

### Theme Management

The site automatically detects your system preference and offers manual override:

- **Auto:** Follows system theme (prefers-color-scheme)
- **Manual:** Click theme toggle in header
- **Persistent:** Preference saved in localStorage

### Forms

Contact form includes:
- Real-time inline validation
- Descriptive error messages
- Success confirmation
- ARIA live regions for screen readers

### Offline Support

After first visit, the site works offline:
- Core assets cached by Service Worker
- "Ready offline" toast on successful installation
- Cache-first strategy for static assets

## Accessibility Features

### WCAG 2.2 AA Compliance

✅ **Focus Management**
- Visible focus rings (3px)
- Focus never obscured by other elements
- Skip to content link (first tabbable element)

✅ **Target Sizes**
- All interactive elements ≥ 44×44 px
- Adequate spacing between tap targets

✅ **Motion Preferences**
- Animations disabled when prefers-reduced-motion is set
- Instant state changes replace transitions
- Skeleton animations become static

✅ **Semantic HTML**
- Proper heading hierarchy (h1 → h2 → h3)
- Landmark regions (header, main, nav, footer)
- Form labels and ARIA attributes
- Alt text for all images

### Keyboard Navigation

- `Tab` / `Shift+Tab`: Navigate through interactive elements
- `Enter` / `Space`: Activate buttons and links
- `⌘/Ctrl+K`: Open command palette
- `↑` / `↓`: Navigate palette options
- `Esc`: Close palette/modals

## Performance Optimization

### LCP Optimization
- Critical CSS inlined in `<head>`
- Hero image preloaded
- System fonts (no web font loading)
- Minimal render-blocking resources

### CLS Prevention
- Reserved space for images (width/height attributes)
- `font-display: swap` for any web fonts
- No layout-shifting ads or embeds

### INP Optimization
- Minimal JavaScript
- Modular ES6 code (tree-shakeable)
- No heavy main-thread tasks
- Debounced input handlers

## SEO

### Meta Tags
- Title and description
- Open Graph (Facebook/LinkedIn)
- Twitter Cards
- Canonical URLs

### Structured Data
- robots.txt for crawler instructions
- sitemap.xml for search engines
- Clean hash-based URLs

## Archiving Old Versions

Before major updates:

1. Create version directory:
```bash
mkdir -p old/v2
cp -r *.html css/ js/ assets/ old/v2/
```

2. Update `/old/index.html` with new link

3. Commit changes:
```bash
git add old/
git commit -m "Archive v2 before redesign"
```

## Customization

### Update Content

**Personal Info:**
- Edit `index.html` sections (Hero, About, Contact)
- Replace `assets/portrait.jpg` with your image
- Update `assets/resume.pdf` with your resume

**Projects:**
- Edit `js/projects.js` data array
- Add project images to `assets/`

### Update Colors

Edit `css/theme.css` variables:

```css
:root {
  --color-accent: #3b82f6;        /* Primary brand color */
  --color-accent-hover: #2563eb;  /* Hover state */
  --color-accent-subtle: #eff6ff; /* Subtle backgrounds */
}
```

### Update Typography

Edit `css/theme.css` font stack:

```css
:root {
  --font-base: -apple-system, BlinkMacSystemFont, ...;
}
```

## Browser Support

- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Benchmarks

**Target Metrics:**
- LCP: ≤ 2.5s ✅
- CLS: ≤ 0.1 ✅
- INP: "Good" ✅
- First Contentful Paint: ≤ 1.8s ✅
- Time to Interactive: ≤ 3.8s ✅

**Tested On:**
- Desktop: MacBook Pro M1
- Mobile: iPhone 13 Pro
- Network: 4G Throttled

## License

© 2025 Lukas Nilsson. All rights reserved.

## Contact

- Email: lukasnilssonbusiness@gmail.com
- LinkedIn: [linkedin.com/in/lukas-nilsson](https://linkedin.com/in/lukas-nilsson)
- GitHub: [github.com/lukas-nilsson](https://github.com/lukas-nilsson)

