// projects.js - Load and display projects

// Work projects (professional work)
const workProjects = [
  {
    id: 'anz-plus',
    title: 'ANZ Plus Digital Platform',
    description: 'Led design and development of next-generation mobile banking platform, improving user engagement by 40% and reducing support calls by 25%. Applied user-centered design methodologies, conducted usability testing, and implemented data-driven design decisions to create intuitive financial interfaces.',
    tag: 'FinTech',
    role: 'Product Designer',
    impact: '+40% engagement',
    stack: ['Figma', 'React', 'Adobe Analytics'],
    image: null,
    type: 'work'
  },
  {
    id: 'leverai-training',
    title: 'LeverAI Training',
    description: 'Founded and developed a comprehensive AI training program for businesses, focusing on practical implementation and strategic AI adoption. Created curriculum, training materials, and hands-on workshops to help organizations leverage AI effectively.',
    tag: 'AI Training',
    role: 'Founder & Lead Trainer',
    impact: 'Business AI adoption',
    stack: ['AI Strategy', 'Training Design', 'Business Development'],
    image: null,
    url: '/leverai.html',
    type: 'work'
  }
];

// Side projects (personal experiments)
const sideProjects = [
  {
    id: 'human-archives',
    title: 'The Human Archives',
    description: 'Created an interactive platform to preserve and share cultural stories, connecting communities with their heritage through immersive digital experiences. Developed user research protocols, designed cultural storytelling interfaces, and built scalable content management systems.',
    tag: 'Culture',
    role: 'Lead Developer',
    impact: '10k+ stories archived',
    stack: ['React', 'Python', 'WordPress'],
    image: null,
    url: 'https://thehumanarchives.com',
    type: 'project'
  },
  {
    id: 'pachaayni',
    title: 'Pachaayni Experience',
    description: 'Designed and built an immersive cultural education platform that brings indigenous wisdom to modern audiences through interactive storytelling. Applied participatory design methodologies, conducted user research with diverse communities, and created culturally sensitive interface designs.',
    tag: 'Education',
    role: 'UX Designer',
    impact: '50k+ users reached',
    stack: ['Figma', 'JavaScript', 'AEM'],
    image: null,
    type: 'project'
  },
  {
    id: 'human-timeline',
    title: 'Human Timeline (Pre AI)',
    description: 'An interactive timeline exploring human history and cultural evolution before the AI era. Features chronological storytelling, cultural milestones, and immersive historical narratives that connect users with our shared past.',
    tag: 'Education',
    role: 'Developer',
    impact: 'Historical exploration tool',
    stack: ['JavaScript', 'Timeline.js', 'D3.js'],
    image: null,
    type: 'project'
  },
  {
    id: 'pacha-ayni',
    title: 'Pacha Ayni (Pre AI)',
    description: 'A cultural preservation platform focused on indigenous wisdom and traditional knowledge systems. Built before AI integration to honor authentic cultural transmission and community-driven storytelling approaches.',
    tag: 'Culture',
    role: 'UX Designer',
    impact: 'Cultural preservation',
    stack: ['Figma', 'WordPress', 'Community Research'],
    image: null,
    type: 'project'
  },
  {
    id: 'solar',
    title: 'SolAR (Pre AI)',
    description: 'An augmented reality application for solar system exploration, built before AI integration. Features immersive 3D planetary experiences, educational content, and interactive space exploration using AR technology.',
    tag: 'AR/VR',
    role: 'AR Developer',
    impact: 'Educational AR experience',
    stack: ['Unity', 'ARCore', 'C#'],
    image: null,
    type: 'project'
  },
  {
    id: 'interactive-solar-system',
    title: 'Interactive Solar System (with AI)',
    description: 'An AI-enhanced interactive solar system visualization that combines real astronomical data with intelligent explanations. Features dynamic learning paths, personalized content, and AI-powered educational assistance for space exploration.',
    tag: 'AI + Education',
    role: 'Full-Stack Developer',
    impact: 'AI-powered learning',
    stack: ['Three.js', 'OpenAI API', 'WebGL', 'Machine Learning'],
    image: null,
    type: 'project'
  },
  {
    id: 'meteorite-visualization',
    title: 'Near-Earth Objects Visualization',
    description: 'Interactive 3D visualization of potentially hazardous asteroids and meteorites based on NASA\'s CNEOS Sentry data. Features realistic orbital mechanics with accurate relative sizes and distances for the Sun, Earth, Moon, and meteorites.',
    tag: 'Data Visualization',
    role: 'Developer',
    impact: 'Real-time NASA data',
    stack: ['Three.js', 'JavaScript', 'NASA API'],
    image: null,
    type: 'project'
  },
  {
    id: 'interactive-portfolio',
    title: 'Interactive Portfolio',
    description: 'This portfolio itself - built with accessibility, performance, and honest design principles. Features dark/light themes, smooth animations, and a focus on semantic HTML and progressive enhancement.',
    tag: 'Web Development',
    role: 'Full-Stack Developer',
    impact: '100% accessible',
    stack: ['HTML/CSS/JS', 'Accessibility', 'Performance'],
    image: null,
    type: 'project'
  }
];

/**
 * Load work projects with skeleton states
 */
export function loadWorkProjects() {
  const grid = document.querySelector('.work-grid');
  if (!grid) return;
  
  // Show skeletons first
  grid.innerHTML = workProjects.map(() => `
    <div class="card skeleton skeleton-card" aria-busy="true"></div>
  `).join('');
  
  // Simulate loading delay (in real app, this would be an API call)
  setTimeout(() => {
    grid.innerHTML = workProjects.map(project => createProjectCard(project)).join('');
    addCardClickHandlers('.work-grid');
  }, 800);
}

/**
 * Load side projects with skeleton states
 */
export function loadSideProjects() {
  const grid = document.querySelector('.projects-grid');
  if (!grid) return;
  
  // Show skeletons first
  grid.innerHTML = sideProjects.map(() => `
    <div class="card skeleton skeleton-card" aria-busy="true"></div>
  `).join('');
  
  // Simulate loading delay (in real app, this would be an API call)
  setTimeout(() => {
    grid.innerHTML = sideProjects.map(project => createProjectCard(project)).join('');
    addCardClickHandlers('.projects-grid');
  }, 800);
}

/**
 * Create project card HTML
 */
function createProjectCard(project) {
  return `
    <article class="card clickable-card" role="listitem" data-project-id="${project.id}" data-project-type="${project.type}">
      ${project.image ? `
        <img 
          src="${project.image}" 
          alt="${project.title}" 
          class="card-image"
          width="400"
          height="225"
          loading="lazy"
        >
      ` : ''}
      
      <span class="card-tag">${escapeHtml(project.tag)}</span>
      
      <h3 class="card-title">${escapeHtml(project.title)}</h3>
      
      <p class="card-description">${escapeHtml(project.description)}</p>
      
      <div class="card-meta">
        <span>${escapeHtml(project.role)}</span>
        <span>•</span>
        <span>${escapeHtml(project.impact)}</span>
      </div>
      
      <div class="card-meta" style="margin-top: 0.5rem;">
        ${project.stack.map(tech => `<span style="color: var(--color-accent);">${escapeHtml(tech)}</span>`).join(' • ')}
      </div>
      
      <div class="card-actions" style="margin-top: 1rem;">
        <button class="btn btn-primary btn-sm" aria-label="View details for ${escapeHtml(project.title)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          View Details
        </button>
        ${project.url ? `
          <a 
            href="${project.url}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="btn btn-outline btn-sm"
            aria-label="Preview ${escapeHtml(project.title)} website"
            onclick="event.stopPropagation()"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Preview Site
          </a>
        ` : ''}
      </div>
    </article>
  `;
}

/**
 * Add click handlers to project cards
 */
function addCardClickHandlers(selector) {
  const cards = document.querySelectorAll(`${selector} .clickable-card`);
  cards.forEach(card => {
    // Add click handler for the entire card
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking on a button or link
      if (e.target.closest('button, a')) return;
      
      const projectId = card.getAttribute('data-project-id');
      const projectType = card.getAttribute('data-project-type');
      
      // Navigate to project page
      window.location.href = `project.html?id=${projectId}&type=${projectType}`;
    });
    
    // Add specific click handler for "View Details" button
    const viewDetailsBtn = card.querySelector('.btn-primary');
    if (viewDetailsBtn) {
      viewDetailsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const projectId = card.getAttribute('data-project-id');
        const projectType = card.getAttribute('data-project-type');
        
        // Navigate to project page
        window.location.href = `project.html?id=${projectId}&type=${projectType}`;
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
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

