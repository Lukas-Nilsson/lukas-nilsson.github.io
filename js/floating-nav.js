// floating-nav.js - Adaptive Floating Glass Menu
// Handles scroll-based transformation from top bar to side bar

class FloatingNav {
  constructor() {
    this.nav = document.getElementById('floating-nav');
    this.scrollThreshold = 100; // Pixels to scroll before transformation
    this.isScrolled = false;
    this.animationFrame = null;
    
    this.init();
  }
  
  init() {
    if (!this.nav) return;
    
    this.setupScrollListener();
    this.setupThemeToggle();
    this.setupPaletteTrigger();
    this.setupActiveSection();
  }
  
  setupScrollListener() {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const shouldBeScrolled = scrollY > this.scrollThreshold;
          
          if (shouldBeScrolled !== this.isScrolled) {
            this.isScrolled = shouldBeScrolled;
            this.updateNavState();
          }
          
          ticking = false;
        });
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial state
    this.updateNavState();
  }
  
  updateNavState() {
    if (!this.nav) return;
    
    if (this.isScrolled) {
      this.nav.classList.add('scrolled');
    } else {
      this.nav.classList.remove('scrolled');
    }
  }
  
  setupThemeToggle() {
    // Theme toggle is now handled by theme.js
    // This method is kept for compatibility but does nothing
  }
  
  setupPaletteTrigger() {
    // Handle both palette triggers
    const paletteTriggers = document.querySelectorAll('.palette-trigger, .palette-trigger-vertical');
    
    paletteTriggers.forEach(trigger => {
      trigger.addEventListener('click', () => {
        this.openPalette();
      });
    });
  }
  
  setupActiveSection() {
    // Update active section based on scroll position
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link, .nav-link-vertical');
    
    const updateActiveSection = () => {
      const scrollY = window.scrollY;
      let activeSection = '';
      
      sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        const sectionHeight = section.offsetHeight;
        
        if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
          activeSection = section.id;
        }
      });
      
      // Update active states
      navLinks.forEach(link => {
        const section = link.getAttribute('data-section');
        if (section === activeSection) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    };
    
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateActiveSection();
          ticking = false;
        });
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    updateActiveSection(); // Initial call
  }
  
  
  openPalette() {
    // Trigger existing palette functionality
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true
    });
    document.dispatchEvent(event);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new FloatingNav();
});

// Export for module usage
export default FloatingNav;
