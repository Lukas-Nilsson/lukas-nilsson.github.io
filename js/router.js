// router.js - Hash-based routing for sections

/**
 * Initialize router
 */
export function initRouter() {
  // Handle initial hash on load
  handleHashChange();
  
  // Listen for hash changes
  window.addEventListener('hashchange', handleHashChange);
  
  // Intercept navigation links
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const hash = link.getAttribute('href');
      if (hash === '#') return;
      
      e.preventDefault();
      navigateTo(hash);
    });
  });
}

/**
 * Handle hash changes
 */
function handleHashChange() {
  const hash = window.location.hash || '#home';
  const section = document.querySelector(hash);
  
  if (section) {
    // Smooth scroll to section
    const headerOffset = 80;
    const elementPosition = section.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
    
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
    
    // Update active nav link
    updateActiveNav(hash);
  }
}

/**
 * Navigate to a section
 */
export function navigateTo(hash) {
  window.location.hash = hash;
}

/**
 * Update active navigation link
 */
function updateActiveNav(hash) {
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === hash) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

