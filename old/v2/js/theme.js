// theme.js - Theme management (light/dark mode)

/**
 * Set theme immediately to prevent flash
 */
function setThemeImmediately() {
  // Load saved theme or default to light
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

// Set theme immediately when script loads
setThemeImmediately();

/**
 * Initialize theme system
 */
export function initTheme() {
  // Handle all theme toggles (top bar, side bar, and mobile)
  const themeToggles = document.querySelectorAll('.theme-toggle, .theme-toggle-vertical, .theme-toggle-mobile');
  
  themeToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const current = document.documentElement.getAttribute('data-theme');
      const newTheme = current === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      
      // Add smooth transition
      document.documentElement.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      
      setTimeout(() => {
        document.documentElement.style.transition = '';
      }, 300);
    });
  });
}

/**
 * Get current theme
 */
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

/**
 * Set theme programmatically
 */
export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

