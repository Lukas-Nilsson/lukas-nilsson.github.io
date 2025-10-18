// app.js - Application bootstrap and initialization

import { initRouter } from './router.js';
import { initPalette } from './palette.js';
import { initForms } from './forms.js';
import { initTheme } from './theme.js';
import { loadWorkProjects, loadSideProjects } from './projects.js';
import { showToast } from './toast.js';
import { MeteoriteVisualization } from './meteorite-visualization.js';
import './chat.js'; // Initialize chat interface
import './floating-nav.js'; // Initialize floating navigation

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
  
  // Initialize meteorite visualization
  initMeteoriteVisualization();
  
  // Register service worker
  registerServiceWorker();
  
  console.log('✅ App initialized successfully');
});

/**
 * Initialize meteorite visualization
 */
function initMeteoriteVisualization() {
  const canvasContainer = document.getElementById('meteorite-canvas');
  if (!canvasContainer) {
    console.log('Meteorite canvas container not found');
    return;
  }

  // Wait for Three.js to load
  const initViz = () => {
    if (typeof THREE === 'undefined') {
      console.log('Three.js not loaded yet, retrying...');
      setTimeout(initViz, 100);
      return;
    }

    try {
      const visualization = new MeteoriteVisualization(canvasContainer);
      
      // Store reference for cleanup if needed
      window.meteoriteVisualization = visualization;
      
      console.log('✅ Meteorite visualization initialized');
    } catch (error) {
      console.error('Failed to initialize meteorite visualization:', error);
      canvasContainer.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 2rem;">Failed to load 3D visualization. Please check your browser supports WebGL.</p>';
    }
  };

  // Start initialization
  initViz();
}

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

