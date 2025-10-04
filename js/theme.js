// theme.js - Theme management (light/dark mode)

/**
 * Initialize theme system
 */
export function initTheme() {
  const toggle = document.querySelector('.theme-toggle');
  if (!toggle) return;
  
  // Load saved theme or use system preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
  
  // Handle theme toggle
  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
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

