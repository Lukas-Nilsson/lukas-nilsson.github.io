# Design Philosophy & System

> A living document capturing design decisions, preferences, and the reasoning behind them. This is the source of truth for taste and refinement over time.

**Last Updated:** November 3, 2025  
**Version:** 1.0

---

## 🎯 Core Principles

### 1. Clarity Over Cleverness

**Philosophy:** Every element should have a clear purpose. If it doesn't serve the user or the content, it doesn't belong.

**Why:** Cleverness for its own sake creates cognitive load. Users should understand immediately what something does and how to interact with it.

**Examples:**
- Navigation labels are literal: "About", "Projects", not "Who", "Work"
- Buttons look like buttons (rounded corners, padding, clear hit area)
- Links are blue and underline on hover (web convention = clarity)

**Anti-patterns to avoid:**
- ❌ Cryptic icons without labels
- ❌ Hidden navigation that requires discovery
- ❌ Unusual interaction patterns that need explanation

---

### 2. Content is King

**Philosophy:** Design serves content, not the other way around. The hierarchy should always be: Content → Context → Chrome.

**Why:** People come for the content (writing, projects, ideas). The interface should get out of the way and let the content breathe.

**Examples:**
- Generous whitespace around text (never feels cramped)
- Navigation auto-hides on scroll down (more screen for content)
- Typography optimized for reading (1.7 line-height, comfortable measure)
- Minimal UI elements (no unnecessary decorations)

**Implementation:**
```css
/* Content gets the most space */
max-width: 800px;  /* Optimal reading width */
line-height: 1.7;  /* Comfortable reading rhythm */
padding: 2xl 0;    /* Generous vertical breathing room */
```

**Anti-patterns to avoid:**
- ❌ Decorative elements that compete with text
- ❌ Busy backgrounds
- ❌ Overly stylized text that hampers readability

---

### 3. Speed is a Feature

**Philosophy:** Every millisecond matters. A fast site feels more responsive, more professional, and more respectful of time.

**Why:** Speed affects perception of quality. Slow = sloppy. Fast = polished.

**Implementation:**
- Static site generation (pre-rendered HTML)
- System fonts (no web font loading)
- Minimal JavaScript (only for interactivity)
- CSS transforms (GPU-accelerated)
- Passive scroll listeners
- RequestAnimationFrame for smooth 60fps

**Measurements:**
- First Paint: < 100ms
- Time to Interactive: < 500ms
- Animation FPS: 60fps
- No layout shifts (CLS: 0)

**Anti-patterns to avoid:**
- ❌ Heavy JavaScript frameworks for simple sites
- ❌ Unnecessary animations that block interaction
- ❌ Large images without optimization
- ❌ Multiple web fonts

---

### 4. Physics Over Linear

**Philosophy:** Motion should feel natural, not mechanical. Things don't start and stop instantly in the real world.

**Why:** Linear transitions feel robotic. Spring physics feel human and delightful.

**Implementation:**
- **Spring curve:** `cubic-bezier(0.32, 0.72, 0, 1)` (Apple's signature)
- **Duration sweet spot:** 200-400ms (fast enough to feel responsive, slow enough to see)
- **Avoid:** Linear, ease, ease-in-out (they feel mechanical)

**Examples:**
```css
/* ✅ Good - Spring physics */
transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);

/* ❌ Avoid - Mechanical feel */
transition: transform 200ms ease;
```

**Why this specific curve?**
- `0.32, 0.72` - Quick acceleration
- `0, 1` - Smooth deceleration
- Result: Snappy start, gentle finish (like a spring settling)

---

### 5. Feedback is Required

**Philosophy:** Every interaction must have a visible response. Silence is confusing.

**Why:** Users need confirmation that their action registered. Without feedback, they'll click again or assume it's broken.

**Implementation:**
- **Hover:** Color/scale change (shows it's interactive)
- **Active:** Scale down + opacity (shows it's being pressed)
- **Focus:** Prominent outline (keyboard navigation clarity)
- **Disabled:** Opacity 0.5 + cursor: not-allowed

**Timing:**
- Immediate feedback (< 16ms, same frame)
- Use `:active` pseudo-class (no JavaScript needed)
- Touch devices: `-webkit-tap-highlight-color: transparent` (custom feedback)

**Anti-patterns to avoid:**
- ❌ Hover states only (excludes touch devices)
- ❌ Delayed feedback (waiting for animation)
- ❌ No feedback on press

---

### 6. Mobile First, Always

**Philosophy:** Design for mobile first, then enhance for desktop. Not the reverse.

**Why:** Mobile constraints force clarity. If it works on a 375px screen, it'll work everywhere.

**Implementation:**
- Default styles = mobile (< 768px)
- `@media (min-width: 768px)` for tablet+
- `@media (min-width: 1024px)` for desktop
- Touch targets: 44x44px minimum (Apple HIG standard)
- Test on real devices, not just simulators

**Anti-patterns to avoid:**
- ❌ Desktop-first CSS with mobile overrides
- ❌ Assuming hover (tablets don't have precise hover)
- ❌ Small touch targets

---

### 7. Accessibility is Non-Negotiable

**Philosophy:** If someone can't use it, it's broken. Accessibility isn't a nice-to-have.

**Why:** It's the right thing to do, and it often improves experience for everyone.

**Implementation:**
- Semantic HTML (use `<nav>`, `<main>`, `<article>`)
- Proper heading hierarchy (h1 → h2 → h3)
- Alt text for images
- ARIA labels for icons/buttons
- Keyboard navigation (Tab, Enter, Escape)
- Focus states (prominent, not subtle)
- `prefers-reduced-motion` support
- Color contrast (WCAG AA minimum)

**Testing:**
- Keyboard-only navigation (unplug mouse)
- Screen reader (VoiceOver on Mac)
- `prefers-reduced-motion: reduce` in system settings

---

## 🎨 Visual Language

### Color Palette

**Philosophy:** Neutral by default, accent for action.

**Rationale:** 
- Black/white/gray creates calm, focused environment
- Single accent color provides clear visual hierarchy
- Easy to scan, eyes drawn to what matters

**Current Palette:**
```css
--color-bg: #ffffff          /* Clean white background */
--color-text: #1e293b        /* Deep slate (not pure black - softer) */
--color-text-muted: #64748b  /* Medium slate (hierarchy) */
--color-border: #e2e8f0      /* Light slate (subtle separation) */
--color-accent: #3b82f6      /* Blue (action, links, progress) */
```

**Why these specific values?**
- **Not pure black/white:** Softer on eyes, more refined
- **Slate family:** Warmer than pure grays, more human
- **Blue accent:** Universal understanding (links are blue), trust, calm
- **No multiple accent colors:** Single accent = clear hierarchy

**Future consideration:**
- Dark mode: Invert palette, reduce contrast slightly
- Keep same accent color (works in both themes)

---

### Typography

**Philosophy:** System fonts for speed, fluid sizing for responsiveness, generous line-height for readability.

**Rationale:**
- System fonts = instant, no loading, native feel
- Fluid sizing = smooth scaling, no awkward breakpoints
- Generous spacing = easier to read, more elegant

**Implementation:**
```css
/* Font stack (system fonts) */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

/* Fluid sizing (clamp) */
--text-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
--text-xl: clamp(1.5rem, 1.3rem + 1vw, 2rem);
--text-4xl: clamp(4rem, 3rem + 5vw, 6rem);

/* Line height */
line-height: 1.7;  /* Body text */
line-height: 1.2;  /* Headings */
```

**Why system fonts?**
- Zero load time
- Consistent with OS (feels native)
- Optimized for screen rendering
- Accessible (respects system font size settings)

**Why fluid sizing?**
- No jarring size changes at breakpoints
- Scales smoothly from 320px to 2560px
- Better responsive experience

---

### Spacing Scale

**Philosophy:** Consistent, predictable rhythm. Use the scale, don't invent sizes.

**Rationale:** Visual rhythm creates polish. Random spacing feels amateurish.

**Scale:**
```css
--space-xs: 0.5rem    /* 8px - Tight, within components */
--space-sm: 1rem      /* 16px - Default, comfortable */
--space-md: 1.5rem    /* 24px - Breathing room */
--space-lg: 2rem      /* 32px - Section spacing */
--space-xl: 3rem      /* 48px - Major sections */
--space-2xl: 4rem     /* 64px - Page sections */
--space-3xl: 6rem     /* 96px - Hero spacing */
```

**How to use:**
- Related items: `xs` or `sm`
- Unrelated items: `md` or `lg`
- Major sections: `xl` or `2xl`
- Heroes: `2xl` or `3xl`

**Why powers of 2?**
- Mathematically harmonious
- Easy to remember
- Scales well across devices

---

### Animation Timing

**Philosophy:** Fast enough to feel responsive, slow enough to see. Never instant, never sluggish.

**Timing Guide:**
```css
100ms - Instant feedback (hover color change)
200ms - Standard interaction (button press, link hover)
300ms - UI element (nav show/hide)
400ms - Panel/overlay (mobile menu slide)
600ms - Page elements (hero fade-in)
```

**Why these durations?**
- < 100ms feels instant (no perceived delay)
- 100-200ms feels responsive (just barely perceptible)
- 300-400ms feels smooth (clearly animated, not slow)
- > 500ms starts feeling slow (use sparingly)

**Anti-patterns:**
- ❌ < 50ms: Too fast to see
- ❌ > 800ms: Feels sluggish, users lose patience

---

## 🧩 Component Patterns

### Navigation

**Design Decision:** Sticky top nav that auto-hides on scroll down.

**Reasoning:**
- **Sticky:** Always accessible (don't make users scroll back up)
- **Auto-hide:** More screen for content when reading
- **Show on scroll up:** User signals they want nav
- **Shadow on scroll:** Visual feedback that content is scrolled

**Why not:**
- ❌ Fixed always-visible: Wastes screen space
- ❌ Static top: Users have to scroll to access
- ❌ Sidebar: Works poorly on mobile, takes horizontal space
- ❌ Footer-only: Hidden too often

**Mobile menu philosophy:**
- Overlay, don't push (no layout shift)
- Slide from right (iOS convention)
- Backdrop blur (iOS aesthetic)
- Large touch targets (44px minimum)
- Close via backdrop or Escape (expected behavior)

---

### Links

**Design Decision:** Blue, underline animates from center on hover, scale on press.

**Reasoning:**
- **Blue:** Web convention = instant recognition
- **Underline grows from center:** More elegant than left-to-right
- **Scale on press:** Tactile feedback (feels like pressing a button)
- **Not underlined by default:** Cleaner, modern (but still blue for recognition)

**Why not:**
- ❌ Always underlined: Visual clutter
- ❌ No color: Harder to identify as links
- ❌ No hover state: No affordance
- ❌ Underline left-to-right: Less elegant (arbitrary direction)

---

### Buttons

**Design Decision:** (Future) Solid background, rounded corners, clear padding, scale feedback.

**Reasoning:**
- **Solid background:** Clear affordance (this is pressable)
- **Rounded corners:** Softer, more friendly
- **Clear padding:** Easy to hit, comfortable
- **Scale on press:** Tactile feedback

**Future implementation:**
```css
.button {
  background: var(--color-accent);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-weight: 500;
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.button:hover {
  transform: scale(1.02);
}

.button:active {
  transform: scale(0.98);
}
```

---

### Forms

**Design Decision:** (Future) Single column, clear labels above fields, generous spacing.

**Reasoning:**
- **Single column:** Easier to scan, works on mobile
- **Labels above:** Clear association, room for field
- **Generous spacing:** Easier to tap, more comfortable
- **Focus states:** Clear indication of active field

---

## 📏 Layout Patterns

### Content Width

**Decision:** Max 800px for reading content.

**Reasoning:**
- **45-75 characters per line:** Optimal reading range (66 is ideal)
- **800px ≈ 65 characters** at base font size
- Wider = harder to track to next line
- Narrower = too much eye movement, choppy

**Implementation:**
```css
.content-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 var(--space-md);
}
```

---

### Page Width

**Decision:** Max 1200px for overall layout.

**Reasoning:**
- **Wide screens:** Don't let content stretch to 2560px (absurd)
- **Reading experience:** Keep content comfortably centered
- **Balance:** Wide enough to not feel cramped, narrow enough to feel cozy

---

### Vertical Rhythm

**Decision:** Consistent spacing between sections, generous at top/bottom.

**Pattern:**
```css
/* Page sections */
padding: var(--space-2xl) 0;  /* 64px top/bottom */

/* Within sections */
margin-bottom: var(--space-md);  /* 24px between elements */

/* Major breaks */
margin: var(--space-xl) 0;  /* 48px for hr, major headings */
```

**Why:** Visual rhythm creates polish and readability.

---

## 🎭 Interaction Patterns

### Hover States

**Rule:** Always provide hover feedback on interactive elements.

**Pattern:**
```css
/* Color shift */
.element:hover {
  color: var(--color-accent);
}

/* Scale (subtle) */
.element:hover {
  transform: scale(1.02);
}

/* Combined */
.element:hover {
  color: var(--color-accent);
  transform: scale(1.02);
}
```

**Why both?**
- Color: Shows it's interactive
- Scale: Adds delight, tactile feel
- Together: Clear feedback without being overwhelming

---

### Active States

**Rule:** All pressable elements should compress.

**Pattern:**
```css
.element:active {
  transform: scale(0.95);
  opacity: 0.6;
}
```

**Why:**
- **Scale down:** Mimics physical pressing
- **Opacity:** Reinforces the press
- **Together:** Clear tactile feedback

---

### Focus States

**Rule:** Keyboard focus must be prominent (not subtle).

**Pattern:**
```css
.element:focus-visible {
  outline: 3px solid var(--color-accent);
  outline-offset: 4px;
  border-radius: 4px;
}
```

**Why:**
- **3px:** Thick enough to see clearly
- **Offset:** Breathing room, not cramped
- **Rounded:** Softer, more polished
- **:focus-visible:** Only on keyboard (not mouse clicks)

---

## 🚫 Anti-Patterns (Things to Avoid)

### 1. Carousel/Sliders
**Why:** Users rarely interact beyond first slide. If content is important, show it.
**Alternative:** Vertical stack with good hierarchy.

### 2. Modals for Primary Content
**Why:** Disrupt flow, feel like pop-ups, easy to dismiss accidentally.
**Alternative:** Dedicated page or inline expansion.

### 3. Infinite Scroll
**Why:** No footer, no sense of completion, SEO issues.
**Alternative:** Pagination with clear page numbers.

### 4. Hover-Only Interactions
**Why:** Excludes touch devices (tablets, phones).
**Alternative:** Tap/click to trigger, hover for preview only.

### 5. Tiny Text
**Why:** Hard to read, especially on mobile. Accessibility issue.
**Alternative:** Minimum 16px (1rem) for body text.

### 6. Pure Icons Without Labels
**Why:** Icons are ambiguous (does hamburger mean menu or home?).
**Alternative:** Icon + label, or very common icons only (search, close).

### 7. Complex Navigation
**Why:** Users get lost, cognitive load.
**Alternative:** Flat structure, max 5-7 top-level items.

### 8. Autoplay Anything
**Why:** Annoying, accessibility issue, uses bandwidth.
**Alternative:** User-initiated play only.

---

## 📊 Performance Budget

**Rules:**
- First Paint: < 100ms
- Time to Interactive: < 500ms
- Total JS: < 50KB (gzipped)
- Total CSS: < 20KB (gzipped)
- Animation FPS: 60fps (no janky animations)
- CLS Score: 0 (no layout shifts)

**How to maintain:**
- No heavy frameworks (React, Vue) for simple sites
- No large dependencies (use vanilla JS when possible)
- Code splitting (only load what's needed)
- Lazy load images
- System fonts (no web fonts)

---

## 🔄 Decision Log

### November 3, 2025 (Evening) - Further Refinements

**Decision:** Browser-specific page transitions (Firefox needs black overlay, Chrome doesn't).

**Problem:**
- Chrome/Safari: Simple fade worked perfectly (no flash)
- Firefox: Showed black flash during navigation (browser quirk)
- One-size-fits-all solution was overkill for Chrome

**Reasoning:**
- Different browsers have different rendering behaviors
- Firefox has a known flash issue during navigation
- Chrome doesn't need the black overlay (adds unnecessary complexity)
- Best solution: Detect browser and apply appropriate transition

**Solution:**
- Detect Firefox via user agent
- **Firefox:** Use black overlay system (fade to/from black)
- **Chrome/Safari:** Simple body opacity fade (cleaner, faster)
- Hide overlay element on non-Firefox browsers
- Each browser gets the optimal experience

**Why this is better:**
- Chrome users get the cleaner, simpler fade (no black overlay)
- Firefox users get the fix they need (black overlay prevents flash)
- No unnecessary complexity for browsers that don't need it
- Performance: Overlay only rendered/used where needed

**Result:** Each browser gets the best experience for its rendering behavior.

---

**Decision:** Make blur transition start immediately when menu opens.

**Problem:**
- Blur was transitioning but only started after overlay opacity finished
- Created delay before blur appeared
- Felt like blur "popped" in after menu panel appeared

**Reasoning:**
- Overlay had its own opacity transition (400ms)
- Backdrop blur was waiting for overlay to finish
- Should start simultaneously for smoother effect

**Solution:**
- Remove overlay opacity transition (show immediately)
- Backdrop blur transition starts as soon as `aria-hidden="false"`
- Use `will-change` for performance hint
- Force reflow to ensure transition kicks in immediately

**Result:** Blur fades in smoothly alongside menu panel, not after it.

---

### November 3, 2025 (Evening) - Initial Refinements

**Decision:** Gradual backdrop blur instead of instant pop-in.

**Reasoning:**
- Backdrop blur was transitioning opacity but blur appeared at full strength instantly
- Created jarring "pop" effect when menu opened
- Felt unpolished, not smooth

**Solution:**
- Transition both `background` AND `backdrop-filter` properties
- Start at `blur(0px)`, transition to `blur(10px)`
- Start at `rgba(0,0,0,0)`, transition to `rgba(0,0,0,0.4)`
- 400ms spring curve for smooth ramp-up

**Result:** Blur fades in gradually, feels much smoother and more polished.

---

**Decision:** Add page transition fade to prevent jarring flash when navigating.

**Problem:**
- When clicking between pages, screen would flash white/black
- Content would "pop" in abruptly
- Felt jarring, not smooth

**Reasoning:**
- Browser loads new page, briefly showing blank screen
- Breaks the flow, feels cheap
- No continuity between pages

**Solution:**
- Fade out current page (150ms)
- Navigate while faded
- Fade in new page (200ms)
- Only applies to internal navigation
- Respects modified clicks (Cmd+click for new tab)

**Implementation:**
```javascript
// Fade out on click
body.opacity = 0 (150ms)
// Navigate
window.location.href = href
// Fade in on load
body.opacity = 1 (200ms)
```

**Why these timings:**
- 150ms fade out: Fast enough to feel responsive, visible enough to see
- 200ms fade in: Slightly slower for smoother entrance
- Total ~350ms: Feels intentional, not accidental

**Result:** Smooth, clean transitions between pages. No jarring flashes.

---

### November 3, 2025

**Decision:** Implement iOS-style overlay menu instead of dropdown.

**Reasoning:**
- Previous dropdown pushed content down (jarring layout shift)
- Overlay prevents layout shift (better UX)
- Backdrop blur feels polished (iOS aesthetic)
- Slide animation feels smooth (spring physics)

**Result:** Menu feels native, no layout shifts, better mobile experience.

---

**Decision:** Auto-hide navigation on scroll down.

**Reasoning:**
- More screen space for content when reading
- User signals intent by scrolling up (show nav then)
- iOS Safari does this (familiar pattern)
- Shadow on scroll provides context (page is scrolled)

**Result:** More immersive reading, nav available when needed.

---

**Decision:** Use system fonts instead of web fonts.

**Reasoning:**
- Zero load time (instant)
- Feels native to OS
- Respects user's font size settings
- One less thing to maintain/update

**Result:** Faster site, native feel, better accessibility.

---

**Decision:** Spring animations instead of linear/ease.

**Reasoning:**
- Linear feels robotic
- Ease feels generic
- Spring feels natural, delightful
- Apple uses this curve extensively

**Curve:** `cubic-bezier(0.32, 0.72, 0, 1)`

**Result:** Interactions feel more polished, less generic.

---

## 🎯 Future Considerations

### Dark Mode
**When:** When content reaches critical mass (more pages).
**How:** 
- Use same accent color
- Invert palette (dark bg, light text)
- Reduce contrast slightly (pure white on pure black is harsh)
- Respect `prefers-color-scheme`

### Search
**When:** When content exceeds 20 pages.
**How:**
- Fuzzy search (typo-tolerant)
- Cmd+K to open (familiar pattern)
- Results with context (show surrounding text)
- Keyboard navigable

### Page Transitions
**When:** After View Transitions API has broader support.
**How:**
- Subtle fade between pages
- Maintain scroll position when appropriate
- Don't overdo it (subtlety is key)

---

## 📝 Review Checklist

Before implementing any new feature:

- [ ] Does it serve the content or the user?
- [ ] Is it accessible (keyboard, screen reader, reduced motion)?
- [ ] Is it performant (adds < 5KB, runs at 60fps)?
- [ ] Does it work on mobile first?
- [ ] Does it provide clear feedback?
- [ ] Does it use spring animations?
- [ ] Is the timing 200-400ms?
- [ ] Does it respect the spacing scale?
- [ ] Is there a simpler solution?
- [ ] Will it age well (not trendy)?

---

## 🎓 Principles in Practice

**When adding a new feature, ask:**

1. **Does it add value or complexity?**
   - Value = keep
   - Complexity = remove or simplify

2. **Can it be simpler?**
   - Always try to simplify first
   - Complexity should be necessary, not accidental

3. **Does it feel right?**
   - Trust your gut
   - If it feels off, it probably is
   - Test on real devices with real content

4. **Will it scale?**
   - Works with 1 page? With 100?
   - Fast with little content? With lots?

---

**Remember:** This document should evolve but not bloat. Remove ideas that don't work. Refine those that do. Question everything. Keep what serves. Delete what doesn't.

---

*This is a living document. Update it as taste refines, patterns emerge, and lessons are learned.*

