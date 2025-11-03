// palette.js - Command palette (⌘/Ctrl-K)

import { navigateTo } from './router.js';
import { setTheme, getTheme } from './theme.js';

let selectedIndex = 0;
let filteredCommands = [];

// Available commands
const commands = [
  {
    id: 'go-home',
    title: 'Go to Home',
    subtitle: 'Navigate to homepage',
    icon: '🏠',
    action: () => navigateTo('#home')
  },
  {
    id: 'go-work',
    title: 'Go to Work',
    subtitle: 'View projects and case studies',
    icon: '💼',
    action: () => navigateTo('#work')
  },
  {
    id: 'go-about',
    title: 'Go to About',
    subtitle: 'Learn more about me',
    icon: '👤',
    action: () => navigateTo('#about')
  },
  {
    id: 'go-contact',
    title: 'Go to Contact',
    subtitle: 'Get in touch',
    icon: '✉️',
    action: () => navigateTo('#contact')
  },
  {
    id: 'theme-dark',
    title: 'Theme: Dark',
    subtitle: 'Switch to dark mode',
    icon: '🌙',
    action: () => setTheme('dark')
  },
  {
    id: 'theme-light',
    title: 'Theme: Light',
    subtitle: 'Switch to light mode',
    icon: '☀️',
    action: () => setTheme('light')
  },
  {
    id: 'download-resume',
    title: 'Download Resume',
    subtitle: 'Download PDF resume',
    icon: '📄',
    action: () => {
      const link = document.createElement('a');
      link.href = 'assets/resume.pdf';
      link.download = 'Lukas_Nilsson_Resume.pdf';
      link.click();
    }
  }
];

/**
 * Initialize command palette
 */
export function initPalette() {
  const trigger = document.querySelector('.palette-trigger, .palette-trigger-mobile');
  const overlay = document.getElementById('palette-overlay');
  const input = document.getElementById('palette-input');
  
  if (!trigger || !overlay || !input) return;
  
  // Open with button click
  trigger.addEventListener('click', () => openPalette());
  
  // Open with keyboard shortcut (⌘/Ctrl-K)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openPalette();
    }
  });
  
  // Close with ESC or overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePalette();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) {
      closePalette();
    }
  });
  
  // Handle input
  input.addEventListener('input', (e) => {
    filterCommands(e.target.value);
  });
  
  // Handle keyboard navigation
  input.addEventListener('keydown', handleKeyboardNav);
}

/**
 * Open palette
 */
function openPalette() {
  const overlay = document.getElementById('palette-overlay');
  const input = document.getElementById('palette-input');
  
  overlay.hidden = false;
  input.value = '';
  input.focus();
  
  selectedIndex = 0;
  filterCommands('');
}

/**
 * Close palette
 */
function closePalette() {
  const overlay = document.getElementById('palette-overlay');
  overlay.hidden = true;
}

/**
 * Filter commands based on search query
 */
function filterCommands(query) {
  const lowerQuery = query.toLowerCase();
  
  filteredCommands = commands.filter(cmd => 
    cmd.title.toLowerCase().includes(lowerQuery) ||
    cmd.subtitle.toLowerCase().includes(lowerQuery)
  );
  
  selectedIndex = 0;
  renderResults();
}

/**
 * Render search results
 */
function renderResults() {
  const resultsContainer = document.getElementById('palette-results');
  
  if (filteredCommands.length === 0) {
    resultsContainer.innerHTML = `
      <div class="palette-empty">No commands found</div>
    `;
    return;
  }
  
  resultsContainer.innerHTML = filteredCommands.map((cmd, index) => `
    <button 
      class="palette-item ${index === selectedIndex ? 'selected' : ''}"
      data-index="${index}"
      onclick="window.paletteExecute(${index})"
    >
      <span style="font-size: 1.5rem">${cmd.icon}</span>
      <div class="palette-item-content">
        <div class="palette-item-title">${escapeHtml(cmd.title)}</div>
        <div class="palette-item-subtitle">${escapeHtml(cmd.subtitle)}</div>
      </div>
    </button>
  `).join('');
}

/**
 * Handle keyboard navigation
 */
function handleKeyboardNav(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1);
    renderResults();
    scrollToSelected();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    renderResults();
    scrollToSelected();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    executeCommand(selectedIndex);
  }
}

/**
 * Scroll selected item into view
 */
function scrollToSelected() {
  const selected = document.querySelector('.palette-item.selected');
  if (selected) {
    selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/**
 * Execute a command
 */
function executeCommand(index) {
  const cmd = filteredCommands[index];
  if (cmd) {
    cmd.action();
    closePalette();
  }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Expose execute function globally for onclick handlers
window.paletteExecute = executeCommand;

