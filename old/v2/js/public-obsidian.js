// public-obsidian.js - Public Obsidian note viewer

// Configuration - Your actual Obsidian GitHub repo details
const OBSIDIAN_CONFIG = {
  username: 'Lukas-Nilsson',
  repo: 'MindPalace',
  branch: 'main',
  apiUrl: 'https://api.github.com/repos'
};

// Cache for notes to avoid repeated API calls
let notesCache = null;
let filteredNotes = [];

/**
 * Initialize the Public Obsidian interface
 */
export function initPublicObsidian() {
  console.log('Initializing Public Obsidian...');
  
  // Set up event listeners
  setupEventListeners();
  
  // Load notes from GitHub
  loadPublicNotes();
  
  // Set current year
  document.getElementById('year').textContent = new Date().getFullYear();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Search functionality
  const searchInput = document.getElementById('note-search');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }
  
  // Tag filtering
  const tagFilter = document.getElementById('tag-filter');
  if (tagFilter) {
    tagFilter.addEventListener('change', handleTagFilter);
  }
  
  // Modal close button - use event delegation since modal might not exist yet
  document.addEventListener('click', (e) => {
    if (e.target.closest('.modal-close')) {
      console.log('Close button clicked');
      closeModal();
    }
  });
  
  // Modal overlay click to close - use event delegation
  document.addEventListener('click', (e) => {
    if (e.target.id === 'note-modal') {
      console.log('Modal overlay clicked');
      closeModal();
    }
  });
  
  // Retry button
  const retryBtn = document.getElementById('retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', loadPublicNotes);
  }
  
  // Keyboard navigation is handled by individual components
}

/**
 * Load public notes from GitHub API
 */
async function loadPublicNotes() {
  showLoadingState();
  
  try {
    // If we have cached notes, use them
    if (notesCache) {
      displayNotes(notesCache);
      return;
    }
    
    // Fetch notes from your actual GitHub repository
    const notes = await loadNotesFromGitHub();
    
    // Filter for public notes (those with "public" tag)
    const publicNotes = notes.filter(note => 
      note.tags && note.tags.includes('public')
    );
    
    notesCache = publicNotes;
    filteredNotes = [...publicNotes];
    
    displayNotes(publicNotes);
    
  } catch (error) {
    console.error('Error loading notes:', error);
    
    // If it's a CORS error during local testing, show sample notes
    if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
      console.log('CORS error detected - showing sample notes for local testing');
      const sampleNotes = getSampleNotes();
      notesCache = sampleNotes;
      filteredNotes = [...sampleNotes];
      displayNotes(sampleNotes);
      return;
    }
    
    // If it's a GitHub API error, show sample notes with a helpful message
    if (error.message.includes('GitHub API error')) {
      console.log('GitHub API error detected - showing sample notes');
      const sampleNotes = getSampleNotes();
      notesCache = sampleNotes;
      filteredNotes = [...sampleNotes];
      displayNotes(sampleNotes);
      
      // Show a toast notification about the issue
      showApiErrorNotification(error.message);
      return;
    }
    
    showErrorState();
  }
}

/**
 * Get sample notes for local testing when CORS prevents GitHub API access
 */
function getSampleNotes() {
  return [
    {
      id: 'sample-design-thinking',
      title: 'Design Thinking Principles',
      content: `# Design Thinking Principles

## Core Principles

Design thinking is a human-centered approach to innovation that draws from the designer's toolkit to integrate the needs of people, the possibilities of technology, and the requirements for business success.

### The Five Stages

1. **Empathize** - Understanding the human needs involved
2. **Define** - Re-framing and defining the problem in human-centric ways
3. **Ideate** - Creating many ideas in ideation sessions
4. **Prototype** - Adopting a hands-on approach in prototyping
5. **Test** - Developing a prototype/solution to the problem

### Key Insights

- Always start with the user, not the technology
- Embrace ambiguity and uncertainty
- Fail fast and learn quickly
- Iterate based on real feedback

## Resources

- [IDEO Design Thinking](https://designthinking.ideo.com/)
- [Stanford d.school](https://dschool.stanford.edu/)`,
      tags: ['public', 'design', 'thinking', 'methodology'],
      lastModified: '2024-01-15',
      wordCount: 156
    },
    {
      id: 'sample-ai-ethics',
      title: 'AI Ethics Framework',
      content: `# AI Ethics Framework

## Core Principles

As AI becomes more integrated into our daily lives, it's crucial to establish ethical guidelines for its development and deployment.

### Key Areas

1. **Transparency** - AI systems should be explainable
2. **Fairness** - Avoiding bias and discrimination
3. **Privacy** - Protecting user data and privacy
4. **Accountability** - Clear responsibility for AI decisions
5. **Human Agency** - Maintaining human control and choice

### Implementation Guidelines

- Regular bias audits
- Diverse development teams
- User consent and control
- Continuous monitoring
- Clear documentation

## Questions to Ask

- Who benefits from this AI system?
- Who might be harmed?
- How can we ensure fairness?
- What are the unintended consequences?`,
      tags: ['public', 'ai', 'ethics', 'framework'],
      lastModified: '2024-01-10',
      wordCount: 134
    }
  ];
}

/**
 * Load notes from your actual GitHub MindPalace repository
 */
async function loadNotesFromGitHub() {
  try {
    console.log('Loading notes from GitHub repository...');
    
    // First, get the repository contents
    // Use CORS proxy for local development
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiUrl = isLocalDev 
      ? `https://cors-anywhere.herokuapp.com/${OBSIDIAN_CONFIG.apiUrl}/${OBSIDIAN_CONFIG.username}/${OBSIDIAN_CONFIG.repo}/contents`
      : `${OBSIDIAN_CONFIG.apiUrl}/${OBSIDIAN_CONFIG.username}/${OBSIDIAN_CONFIG.repo}/contents`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        ...(isLocalDev && { 'X-Requested-With': 'XMLHttpRequest' })
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        url: apiUrl,
        response: errorText
      });
      throw new Error(`GitHub API error: ${response.status} - ${response.statusText}. Response: ${errorText.substring(0, 200)}`);
    }
    
    const files = await response.json();
    console.log(`Found ${files.length} files in repository`);
    
    // Filter for markdown files
    const markdownFiles = files.filter(file => 
      file.name.endsWith('.md') && 
      file.type === 'file' &&
      !file.name.startsWith('.') // Exclude hidden files
    );
    
    console.log(`Found ${markdownFiles.length} markdown files`);
    
    // Process each markdown file
    const notes = await Promise.all(
      markdownFiles.map(async (file) => {
        try {
          // Use CORS proxy for local development
          const downloadUrl = isLocalDev 
            ? `https://cors-anywhere.herokuapp.com/${file.download_url}`
            : file.download_url;
            
          const contentResponse = await fetch(downloadUrl, {
            headers: isLocalDev ? { 'X-Requested-With': 'XMLHttpRequest' } : {}
          });
          if (!contentResponse.ok) {
            console.warn(`Failed to fetch ${file.name}: ${contentResponse.status}`);
            return null;
          }
          
          const content = await contentResponse.text();
          
          // Parse frontmatter and check for public tag
          const frontmatter = parseFrontmatter(content);
          const hasPublicTag = frontmatter.tags && 
            (frontmatter.tags.includes('public') || frontmatter.tags.includes('#public'));
          
          if (hasPublicTag) {
            console.log(`Found public note: ${file.name}`);
            return {
              id: file.name.replace('.md', ''),
              title: frontmatter.title || file.name.replace('.md', '').replace(/-/g, ' '),
              content: content,
              tags: frontmatter.tags || [],
              lastModified: frontmatter.lastModified || file.updated_at,
              wordCount: content.split(/\s+/).length
            };
          }
          
          return null;
        } catch (error) {
          console.warn(`Error processing ${file.name}:`, error);
          return null;
        }
      })
    );
    
    // Filter out null results
    const validNotes = notes.filter(note => note !== null);
    console.log(`Found ${validNotes.length} public notes`);
    
    return validNotes;
    
  } catch (error) {
    console.error('Error loading notes from GitHub:', error);
    
    // If it's a CORS error, show a helpful message
    if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
      throw new Error('Unable to fetch notes due to CORS restrictions. This is normal when testing locally. The integration will work when deployed to GitHub Pages.');
    }
    
    throw error;
  }
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { tags: [] };
  }
  
  const frontmatterText = match[1];
  const contentWithoutFrontmatter = match[2];
  
  try {
    // Simple YAML parsing for basic frontmatter
    const lines = frontmatterText.split('\n');
    const frontmatter = {};
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        let value = line.substring(colonIndex + 1).trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Handle array values (like tags)
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1).split(',').map(item => 
            item.trim().replace(/['"]/g, '')
          );
        }
        
        frontmatter[key] = value;
      }
    }
    
    return frontmatter;
  } catch (error) {
    console.warn('Error parsing frontmatter:', error);
    return { tags: [] };
  }
}

/**
 * Display notes in the grid
 */
function displayNotes(notes) {
  hideLoadingState();
  hideErrorState();
  
  const notesGrid = document.getElementById('notes-grid');
  const notesContainer = document.getElementById('notes-container');
  
  if (!notesGrid || !notesContainer) return;
  
  if (notes.length === 0) {
    notesGrid.innerHTML = `
      <div class="no-notes">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10,9 9,9 8,9"/>
        </svg>
        <h3>No public notes found</h3>
        <p>No notes with the "public" tag are available at the moment.</p>
      </div>
    `;
  } else {
    notesGrid.innerHTML = notes.map(note => createNoteCard(note)).join('');
    
    // Update tag filter options based on actual tags found
    updateTagFilter(notes);
  }
  
  notesContainer.style.display = 'block';
  
  // Add click handlers to note cards
  addNoteClickHandlers();
}

/**
 * Update tag filter dropdown with actual tags from notes
 */
function updateTagFilter(notes) {
  const tagFilter = document.getElementById('tag-filter');
  if (!tagFilter) return;
  
  // Collect all unique tags (excluding 'public')
  const allTags = new Set();
  notes.forEach(note => {
    if (note.tags) {
      note.tags.forEach(tag => {
        if (tag !== 'public' && tag !== '#public') {
          allTags.add(tag);
        }
      });
    }
  });
  
  // Sort tags alphabetically
  const sortedTags = Array.from(allTags).sort();
  
  // Update the filter options
  const currentValue = tagFilter.value;
  tagFilter.innerHTML = `
    <option value="">All Tags</option>
    ${sortedTags.map(tag => `<option value="${tag}">${tag}</option>`).join('')}
  `;
  
  // Restore previous selection if it still exists
  if (currentValue && sortedTags.includes(currentValue)) {
    tagFilter.value = currentValue;
  }
}

/**
 * Create a note card HTML element
 */
function createNoteCard(note) {
  const preview = note.content.substring(0, 150) + (note.content.length > 150 ? '...' : '');
  const tags = note.tags.filter(tag => tag !== 'public').map(tag => 
    `<span class="note-tag">${tag}</span>`
  ).join('');
  
  return `
    <article class="note-card clickable-card" role="listitem" data-note-id="${note.id}">
      <div class="note-header">
        <h3 class="note-title">${escapeHtml(note.title)}</h3>
        <div class="note-meta">
          <span class="note-date">${formatDate(note.lastModified)}</span>
          <span class="note-words">${note.wordCount} words</span>
        </div>
      </div>
      
      <div class="note-preview">
        <p>${escapeHtml(preview)}</p>
      </div>
      
      <div class="note-tags">
        ${tags}
      </div>
      
      <div class="note-actions">
        <button class="btn btn-primary btn-sm" aria-label="Read ${escapeHtml(note.title)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Read Note
        </button>
      </div>
    </article>
  `;
}

/**
 * Add click handlers to note cards
 */
function addNoteClickHandlers() {
  const noteCards = document.querySelectorAll('.note-card');
  noteCards.forEach(card => {
    // Card click handler
    card.addEventListener('click', (e) => {
      console.log('Card clicked, target:', e.target);
      // Don't trigger if clicking on a button
      if (e.target.closest('button')) {
        console.log('Button click detected, ignoring card click');
        return;
      }
      
      const noteId = card.getAttribute('data-note-id');
      const note = notesCache.find(n => n.id === noteId);
      console.log('Card note ID:', noteId, 'Note found:', !!note);
      if (note) {
        openNoteModal(note);
      }
    });
    
    // Button click handler
    const readButton = card.querySelector('.btn-primary');
    if (readButton) {
      readButton.addEventListener('click', (e) => {
        console.log('Read button clicked');
        e.preventDefault();
        e.stopPropagation();
        
        const noteId = card.getAttribute('data-note-id');
        const note = notesCache.find(n => n.id === noteId);
        console.log('Button note ID:', noteId, 'Note found:', !!note);
        if (note) {
          openNoteModal(note);
        }
      });
    }
    
    // Add keyboard support
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
    
    // Make cards focusable
    card.setAttribute('tabindex', '0');
  });
}

/**
 * Open note in modal
 */
function openNoteModal(note) {
  console.log('Opening modal for note:', note.title);
  
  const modal = document.getElementById('note-modal');
  const modalTitle = document.getElementById('modal-title');
  const noteContent = document.getElementById('note-content');
  
  if (!modal || !modalTitle || !noteContent) {
    console.error('Modal elements not found');
    return;
  }
  
  modalTitle.textContent = note.title;
  
  // Convert markdown to HTML
  const htmlContent = marked.parse(note.content);
  noteContent.innerHTML = htmlContent;
  
  // Show modal
  modal.style.display = 'flex';
  modal.removeAttribute('hidden');
  modal.setAttribute('aria-hidden', 'false');
  
  // Focus the modal for accessibility
  modal.focus();
  
  // Prevent body scroll
  document.body.style.overflow = 'hidden';
  
  // Add escape key handler
  document.addEventListener('keydown', handleEscapeKey);
  
  console.log('Modal opened successfully');
}

/**
 * Close note modal
 */
function closeModal() {
  console.log('Closing modal');
  
  const modal = document.getElementById('note-modal');
  if (!modal) {
    console.error('Modal not found');
    return;
  }
  
  // Hide modal
  modal.style.display = 'none';
  modal.setAttribute('hidden', 'true');
  modal.setAttribute('aria-hidden', 'true');
  
  // Restore body scroll
  document.body.style.overflow = '';
  
  // Remove escape key handler
  document.removeEventListener('keydown', handleEscapeKey);
  
  console.log('Modal closed successfully');
}

/**
 * Handle escape key press
 */
function handleEscapeKey(e) {
  if (e.key === 'Escape') {
    closeModal();
  }
}

/**
 * Handle search input
 */
function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  
  if (!notesCache) return;
  
  filteredNotes = notesCache.filter(note => 
    note.title.toLowerCase().includes(query) ||
    note.content.toLowerCase().includes(query) ||
    note.tags.some(tag => tag.toLowerCase().includes(query))
  );
  
  displayNotes(filteredNotes);
}

/**
 * Handle tag filtering
 */
function handleTagFilter(e) {
  const selectedTag = e.target.value;
  
  if (!notesCache) return;
  
  if (selectedTag === '') {
    filteredNotes = notesCache;
  } else {
    filteredNotes = notesCache.filter(note => 
      note.tags.includes(selectedTag)
    );
  }
  
  displayNotes(filteredNotes);
}


/**
 * Show loading state
 */
function showLoadingState() {
  const loadingState = document.getElementById('loading-state');
  const errorState = document.getElementById('error-state');
  const notesContainer = document.getElementById('notes-container');
  
  if (loadingState) loadingState.style.display = 'block';
  if (errorState) errorState.style.display = 'none';
  if (notesContainer) notesContainer.style.display = 'none';
}

/**
 * Hide loading state
 */
function hideLoadingState() {
  const loadingState = document.getElementById('loading-state');
  if (loadingState) loadingState.style.display = 'none';
}

/**
 * Show error state
 */
function showErrorState() {
  const loadingState = document.getElementById('loading-state');
  const errorState = document.getElementById('error-state');
  const notesContainer = document.getElementById('notes-container');
  
  if (loadingState) loadingState.style.display = 'none';
  if (errorState) errorState.style.display = 'block';
  if (notesContainer) notesContainer.style.display = 'none';
}

/**
 * Show API error notification
 */
function showApiErrorNotification(errorMessage) {
  // Create a toast notification
  const toast = document.createElement('div');
  toast.className = 'toast warning';
  toast.innerHTML = `
    <div class="toast-title">GitHub API Error</div>
    <div class="toast-message">
      Unable to connect to your MindPalace repository. Showing sample notes instead. 
      <br><br>
      <strong>Error:</strong> ${errorMessage.substring(0, 100)}...
      <br><br>
      <strong>Solutions:</strong>
      <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
        <li>Check if your MindPalace repository exists and is public</li>
        <li>Ensure the repository has some .md files</li>
        <li>Try refreshing the page</li>
      </ul>
    </div>
  `;
  
  // Add to toast container
  const toastContainer = document.getElementById('toast-container');
  if (toastContainer) {
    toastContainer.appendChild(toast);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 10000);
  }
}

/**
 * Hide error state
 */
function hideErrorState() {
  const errorState = document.getElementById('error-state');
  if (errorState) errorState.style.display = 'none';
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPublicObsidian);
} else {
  initPublicObsidian();
}
