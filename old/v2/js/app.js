// app.js - Application bootstrap and initialization

import { initRouter } from './router.js';
import { initPalette } from './palette.js';
import { initForms } from './forms.js';
import { initTheme } from './theme.js';
import { loadWorkProjects, loadSideProjects } from './projects.js';
import { showToast } from './toast.js';
import './chat.js'; // Initialize chat interface
import './floating-nav.js'; // Initialize floating navigation
import './liquid-glass.js'; // Initialize liquid glass effects

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing portfolio app...');
  
  // Initialize core modules
  initTheme();
  initRouter();
  initPalette();
  initForms();
  
  // Load dynamic content
  loadWorkProjects();
  loadSideProjects();
  
  
  // Register service worker
  registerServiceWorker();
  
  console.log('✅ App initialized successfully');
});


/**
 * Register service worker for offline functionality
 */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration);
    
    // Show toast on first install
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      showToast('Ready offline', 'Site is now available offline', 'success');
    });
  } catch (error) {
    console.error('Service Worker registration failed:', error);
  }
}

// Export utilities for other modules
export { showToast };

