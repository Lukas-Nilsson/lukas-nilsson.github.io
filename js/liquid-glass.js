/**
 * Liquid Glass Effects
 * Handles scroll-based shimmer and interactive effects
 */

class LiquidGlassEffects {
  constructor() {
    this.scrollShimmer = null;
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.init();
  }

  init() {
    if (this.isReducedMotion) return;
    
    this.createScrollShimmer();
    this.setupScrollListener();
    this.setupMouseParallax();
  }

  createScrollShimmer() {
    this.scrollShimmer = document.createElement('div');
    this.scrollShimmer.className = 'liquid-glass-scroll-shimmer';
    document.body.appendChild(this.scrollShimmer);
  }

  setupScrollListener() {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.updateScrollShimmer();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  updateScrollShimmer() {
    if (!this.scrollShimmer) return;
    
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    // Calculate scroll progress (0 to 1)
    const scrollProgress = scrollY / (documentHeight - windowHeight);
    
    // Trigger shimmer effect at certain scroll positions
    if (scrollProgress > 0.1 && scrollProgress < 0.9) {
      this.triggerShimmer();
    }
  }

  triggerShimmer() {
    if (!this.scrollShimmer) return;
    
    // Reset animation
    this.scrollShimmer.style.transform = 'translateX(-100%)';
    
    // Trigger shimmer
    requestAnimationFrame(() => {
      this.scrollShimmer.style.transform = 'translateX(100%)';
    });
  }

  setupMouseParallax() {
    const panels = document.querySelectorAll('.liquid-glass-interactive');
    
    panels.forEach(panel => {
      panel.addEventListener('mousemove', (e) => {
        this.handleMouseMove(e, panel);
      });
      
      panel.addEventListener('mouseleave', () => {
        this.resetPanelTransform(panel);
      });
    });
  }

  handleMouseMove(e, panel) {
    const rect = panel.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = (y - centerY) / centerY * 2; // Max 2 degrees
    const rotateY = (x - centerX) / centerX * 2; // Max 2 degrees
    
    panel.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`;
  }

  resetPanelTransform(panel) {
    panel.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)';
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new LiquidGlassEffects();
});

// Export for potential use in other modules
export default LiquidGlassEffects;
