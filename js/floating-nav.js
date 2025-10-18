// floating-nav.js - Apple Liquid Style Navigation

class FloatingNavigation {
  constructor() {
    this.nav = null;
    this.isScrolled = false;
    this.isTransitioning = false;
    this.scrollThreshold = 100;
    this.lastScrollY = 0;
    this.scrollDirection = 'down';
    this.mobileMenuOpen = false;
    
    this.init();
  }
  
  init() {
    this.createNavigation();
    this.setupEventListeners();
    this.setupScrollDetection();
    this.setupMobileMenu();
    this.updateActiveLink();
  }
  
  createNavigation() {
    // Create floating nav container
    this.nav = document.createElement('nav');
    this.nav.className = 'floating-nav';
    this.nav.setAttribute('role', 'navigation');
    this.nav.setAttribute('aria-label', 'Main navigation');
    
    // Create background
    const background = document.createElement('div');
    background.className = 'nav-background';
    
    // Create content container
    const content = document.createElement('div');
    content.className = 'nav-content';
    
    // Create brand
    const brand = document.createElement('div');
    brand.className = 'nav-brand';
    brand.innerHTML = `
      <a href="#home" class="brand-link" aria-label="Home">LN</a>
    `;
    
    // Create menu
    const menu = document.createElement('ul');
    menu.className = 'nav-menu';
    menu.innerHTML = `
      <li><a href="#home" class="nav-link" data-section="home">Home</a></li>
      <li><a href="#work" class="nav-link" data-section="work">Work</a></li>
      <li><a href="#projects" class="nav-link" data-section="projects">Projects</a></li>
      <li><a href="#about" class="nav-link" data-section="about">About</a></li>
      <li><a href="#contact" class="nav-link" data-section="contact">Contact</a></li>
    `;
    
    // Create actions
    const actions = document.createElement('div');
    actions.className = 'nav-actions';
    actions.innerHTML = `
      <button class="theme-toggle" aria-label="Toggle theme" type="button">
        <svg class="sun-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        <svg class="moon-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </button>
      <button class="mobile-menu-toggle" aria-label="Open menu" type="button">
        <div class="hamburger-line"></div>
        <div class="hamburger-line"></div>
        <div class="hamburger-line"></div>
      </button>
    `;
    
    // Assemble navigation
    content.appendChild(brand);
    content.appendChild(menu);
    content.appendChild(actions);
    
    this.nav.appendChild(background);
    this.nav.appendChild(content);
    
    // Add to page
    document.body.appendChild(this.nav);
    
    // Store references
    this.brand = brand;
    this.menu = menu;
    this.actions = actions;
    this.themeToggle = actions.querySelector('.theme-toggle');
    this.mobileToggle = actions.querySelector('.mobile-menu-toggle');
  }
  
  setupEventListeners() {
    // Theme toggle
    if (this.themeToggle) {
      this.themeToggle.addEventListener('click', this.handleThemeToggle.bind(this));
    }
    
    // Mobile menu toggle
    if (this.mobileToggle) {
      this.mobileToggle.addEventListener('click', this.toggleMobileMenu.bind(this));
    }
    
    // Navigation links
    this.menu.addEventListener('click', this.handleNavClick.bind(this));
    
    // Close mobile menu on overlay click
    document.addEventListener('click', this.handleOutsideClick.bind(this));
    
    // Handle escape key
    document.addEventListener('keydown', this.handleKeydown.bind(this));
  }
  
  setupScrollDetection() {
    let ticking = false;
    
    const updateScrollState = () => {
      const scrollY = window.scrollY;
      const direction = scrollY > this.lastScrollY ? 'down' : 'up';
      
      // Update scroll direction
      this.scrollDirection = direction;
      this.lastScrollY = scrollY;
      
      // Determine if scrolled
      const shouldBeScrolled = scrollY > this.scrollThreshold;
      
      if (shouldBeScrolled !== this.isScrolled) {
        this.toggleScrolledState(shouldBeScrolled);
      }
      
      // Update active link
      this.updateActiveLink();
      
      ticking = false;
    };
    
    const requestTick = () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollState);
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', requestTick, { passive: true });
  }
  
  toggleScrolledState(scrolled) {
    if (this.isTransitioning) return;
    
    this.isScrolled = scrolled;
    this.isTransitioning = true;
    
    // Add transitioning class for liquid animation
    this.nav.classList.add('transitioning');
    
    if (scrolled) {
      this.nav.classList.add('scrolled');
    } else {
      this.nav.classList.remove('scrolled');
    }
    
    // Remove transitioning class after animation
    setTimeout(() => {
      this.nav.classList.remove('transitioning');
      this.isTransitioning = false;
    }, 600);
  }
  
  setupMobileMenu() {
    // Create mobile menu overlay
    this.mobileOverlay = document.createElement('div');
    this.mobileOverlay.className = 'mobile-menu-overlay';
    
    // Create mobile menu panel
    this.mobilePanel = document.createElement('div');
    this.mobilePanel.className = 'mobile-menu-panel';
    this.mobilePanel.innerHTML = `
      <div class="mobile-menu-content">
        <a href="#home" class="nav-link" data-section="home">Home</a>
        <a href="#work" class="nav-link" data-section="work">Work</a>
        <a href="#projects" class="nav-link" data-section="projects">Projects</a>
        <a href="#about" class="nav-link" data-section="about">About</a>
        <a href="#contact" class="nav-link" data-section="contact">Contact</a>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(this.mobileOverlay);
    document.body.appendChild(this.mobilePanel);
    
    // Add click handlers for mobile menu links
    this.mobilePanel.addEventListener('click', this.handleMobileNavClick.bind(this));
  }
  
  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    
    if (this.mobileMenuOpen) {
      this.mobileOverlay.classList.add('open');
      this.mobilePanel.classList.add('open');
      this.mobileToggle.setAttribute('aria-label', 'Close menu');
      this.mobileToggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    } else {
      this.mobileOverlay.classList.remove('open');
      this.mobilePanel.classList.remove('open');
      this.mobileToggle.setAttribute('aria-label', 'Open menu');
      this.mobileToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  }
  
  handleNavClick(e) {
    const link = e.target.closest('.nav-link');
    if (!link) return;
    
    e.preventDefault();
    const section = link.getAttribute('data-section');
    this.scrollToSection(section);
  }
  
  handleMobileNavClick(e) {
    const link = e.target.closest('.nav-link');
    if (!link) return;
    
    e.preventDefault();
    const section = link.getAttribute('data-section');
    this.scrollToSection(section);
    this.toggleMobileMenu(); // Close mobile menu
  }
  
  handleOutsideClick(e) {
    if (this.mobileMenuOpen && 
        !this.mobilePanel.contains(e.target) && 
        !this.mobileToggle.contains(e.target)) {
      this.toggleMobileMenu();
    }
  }
  
  handleKeydown(e) {
    if (e.key === 'Escape' && this.mobileMenuOpen) {
      this.toggleMobileMenu();
    }
  }
  
  scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    const offsetTop = section.offsetTop - 100; // Account for fixed nav
    
    window.scrollTo({
      top: offsetTop,
      behavior: 'smooth'
    });
  }
  
  updateActiveLink() {
    const sections = ['home', 'work', 'projects', 'about', 'contact'];
    const scrollY = window.scrollY + 150; // Offset for better detection
    
    let activeSection = 'home';
    
    for (const sectionId of sections) {
      const section = document.getElementById(sectionId);
      if (section && scrollY >= section.offsetTop) {
        activeSection = sectionId;
      }
    }
    
    // Update active states
    this.menu.querySelectorAll('.nav-link').forEach(link => {
      const isActive = link.getAttribute('data-section') === activeSection;
      link.classList.toggle('active', isActive);
    });
    
    this.mobilePanel.querySelectorAll('.nav-link').forEach(link => {
      const isActive = link.getAttribute('data-section') === activeSection;
      link.classList.toggle('active', isActive);
    });
  }
  
  handleThemeToggle() {
    // This would integrate with your existing theme system
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }
}

// Initialize floating navigation when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new FloatingNavigation();
  });
} else {
  new FloatingNavigation();
}
