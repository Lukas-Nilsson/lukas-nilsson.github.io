# Visual Mode System

> Two distinct visual experiences: **Default** (clean & minimal) and **Enhanced** (animated & colorful)

## Overview

The site supports two visual modes that users can toggle between using the visual mode button in the navigation:

### 🎯 Default Mode (`data-visual-mode="default"`)
- **Philosophy**: Clean, minimal, professional
- **Background**: Solid colors (white for light mode, pure black for dark mode)
- **Focus**: Content-first, maximum clarity
- **Performance**: Minimal CSS, no animations
- **Use case**: Reading, professional context, accessibility

### ✨ Enhanced Mode (`data-visual-mode="enhanced"`)
- **Philosophy**: Immersive, modern, technical UX
- **Background**: Animated colorful gradient meshes with depth
- **Focus**: Visual delight, depth perception through blur
- **Performance**: GPU-accelerated animations, optimized for smooth 60fps
- **Use case**: Exploration, showcase, visual experience
- **Inspired by**: v2 liquid glass design, Apple VisionOS, macOS Sonoma

## Technical Implementation

### Architecture

1. **Data Attribute**: `data-visual-mode="default|enhanced"` on `<html>`
2. **Persistence**: User preference stored in `localStorage`
3. **Toggle**: Button in navigation capsule
4. **CSS**: Separate stylesheet (`enhanced-mode.css`) loaded for both modes
5. **Performance**: CSS uses `::before` and `::after` pseudo-elements for background layers

### Enhanced Mode Details

**Background Layers:**

**Layer 1 (::before)** - Primary animated gradient mesh
- 4 radial gradients (blue, purple, pink, yellow)
- 1 base linear gradient
- Animation: `enhancedFloat` (30s infinite)
- Effect: Subtle movement with hue rotation

**Layer 2 (::after)** - Floating particles
- 4 radial gradients at different positions
- Animation: `particleFloat` (35s infinite)
- Effect: Depth through parallax-like motion

**Colors:**

Light Mode Enhanced:
```css
--enhanced-blue: #dbeafe;
--enhanced-purple: #ede9fe;
--enhanced-pink: #fce7f3;
--enhanced-yellow: #fef3c7;
--enhanced-bg-base: #f0f4f8;
```

Dark Mode Enhanced:
```css
--enhanced-blue: rgba(59, 130, 246, 0.15);
--enhanced-purple: rgba(147, 51, 234, 0.12);
--enhanced-pink: rgba(236, 72, 153, 0.1);
--enhanced-yellow: rgba(251, 191, 36, 0.08);
--enhanced-bg-base: #0f172a; /* Slate base */
```

### Animations

**enhancedFloat** (30s):
- Subtle `translate3d` movement
- `hue-rotate` for color shifting
- Creates living, breathing background

**particleFloat** (35s):
- Similar to enhancedFloat but different timing
- Adds depth through parallax effect
- Slower to create layered motion

### Performance Optimizations

```css
transform: translate3d(0, 0, 0);  /* GPU acceleration */
backface-visibility: hidden;      /* Prevent flickering */
will-change: auto;                /* Let browser optimize */
contain: layout style paint;      /* Contain repaints */
```

### Accessibility

**Reduced Motion Support:**
```css
@media (prefers-reduced-motion: reduce) {
  [data-visual-mode="enhanced"]::before,
  [data-visual-mode="enhanced"]::after {
    animation: none !important;
    filter: none !important;
  }
}
```

- Respects user's motion preferences
- Disables all animations in enhanced mode
- Background still shows but static

## User Experience

### Toggle Button

**Location**: Right side of navigation capsule (desktop), after nav links

**Icons**:
- Default mode: Simple circle (minimal)
- Enhanced mode: Radiating sparkle pattern (dynamic)

**States**:
- Hover: Background highlight
- Active: Scale down (0.92)
- Enhanced mode active: Accent color

**Behavior**:
- Single click toggles between modes
- Preference saved to localStorage
- No page reload required
- Smooth transition

### First Load

1. Check localStorage for `visual-mode`
2. If not set, default to `'default'`
3. Apply `data-visual-mode` attribute immediately (no flash)
4. Script runs before page renders (in `<head>`)

### Persistence

```javascript
localStorage.setItem('visual-mode', 'enhanced'); // Save preference
const visualMode = localStorage.getItem('visual-mode') || 'default'; // Load preference
```

## Design Decisions

### Why Two Modes?

**Default Mode:**
- Professional, clean aesthetic
- Better for reading and focus
- Lower resource usage
- Universally accessible

**Enhanced Mode:**
- Showcases technical capability
- Creates memorable visual experience
- Demonstrates modern web capabilities
- Appeals to creative/technical audience

### Why Not Always Enhanced?

1. **Accessibility**: Some users prefer minimal motion
2. **Context**: Professional vs. exploratory browsing
3. **Performance**: Not all devices handle complex animations well
4. **Choice**: Empowers users to customize their experience

### Color Philosophy

**Light Mode Enhanced:**
- Soft pastels (blue, purple, pink, yellow)
- High luminosity, low saturation
- Feels airy and open
- Gradients create depth without heaviness

**Dark Mode Enhanced:**
- Semi-transparent colored shadows
- Very low opacity to maintain darkness
- Subtle hints of color
- Feels like colored light in darkness

### Animation Timing

- **30s & 35s**: Slow enough to feel calm, fast enough to feel alive
- **ease-in-out**: Smooth acceleration/deceleration
- **Offset timing**: Different speeds create depth perception
- **hue-rotate**: Adds subtle color variation over time

## Development

### Adding New Enhanced Mode Effects

To add new effects to enhanced mode:

1. Use `[data-visual-mode="enhanced"]` selector
2. Ensure performance (GPU-accelerated transforms)
3. Add reduced-motion fallback
4. Test in both light and dark modes
5. Consider mobile performance

Example:
```css
[data-visual-mode="enhanced"] .my-element {
  backdrop-filter: blur(40px);
  transform: translate3d(0, 0, 0);
}

@media (prefers-reduced-motion: reduce) {
  [data-visual-mode="enhanced"] .my-element {
    backdrop-filter: blur(20px);
  }
}
```

### Testing

**Test Matrix:**
- [ ] Default mode + light theme
- [ ] Default mode + dark theme
- [ ] Enhanced mode + light theme
- [ ] Enhanced mode + dark theme
- [ ] Toggle preserves preference
- [ ] Reduced motion disables animations
- [ ] Mobile performance (60fps)
- [ ] Desktop performance (60fps)

### Files

- `src/styles/enhanced-mode.css` - Enhanced mode styles
- `src/layouts/BaseLayout.astro` - Visual mode initialization script
- `src/components/Navigation.astro` - Toggle button and logic
- `VISUAL-MODES.md` - This documentation

## Future Considerations

### Potential Enhancements

1. **More granular control**: Intensity slider for enhanced mode
2. **Presets**: Multiple enhanced mode themes (warm, cool, vivid)
3. **Auto mode**: Time-based switching (enhanced at night, default during day)
4. **Parallax**: Mouse movement affects background layers
5. **Custom colors**: User-defined color schemes

### Performance Monitoring

Enhanced mode uses:
- 2 pseudo-elements (`::before`, `::after`)
- 2 CSS animations (30s, 35s infinite)
- GPU compositing
- Minimal JavaScript (toggle only)

Monitor:
- Frame rate (target: 60fps)
- Memory usage (pseudo-elements are lightweight)
- Battery impact on mobile

### Browser Support

**Enhanced mode works on:**
- Chrome/Edge 88+
- Firefox 94+
- Safari 15.4+
- Mobile browsers with backdrop-filter support

**Fallback:**
- Browsers without `::before`/`::after` support: Default mode
- Browsers without CSS animations: Static enhanced background
- All features degrade gracefully

## Maintenance

### When to Update

- New design trends emerge
- Performance improvements available
- User feedback suggests changes
- Accessibility standards evolve

### Versioning

Track major visual mode changes:
- v1.0: Initial implementation (Default + Enhanced)
- Future: Document significant changes here

---

*Last updated: November 3, 2025*  
*Visual Mode System v1.0*

