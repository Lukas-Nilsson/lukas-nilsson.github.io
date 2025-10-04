// projects.js - Load and display projects

// Project data
const projects = [
  {
    id: 'anz-plus',
    title: 'ANZ Plus Digital Platform',
    description: 'Led design and development of next-generation mobile banking platform, improving user engagement by 40% and reducing support calls by 25%. Applied user-centered design methodologies, conducted usability testing, and implemented data-driven design decisions to create intuitive financial interfaces.',
    tag: 'FinTech',
    role: 'Product Designer',
    impact: '+40% engagement',
    stack: ['Figma', 'React', 'Adobe Analytics'],
    image: null // Placeholder
  },
  {
    id: 'human-archives',
    title: 'The Human Archives',
    description: 'Created an interactive platform to preserve and share cultural stories, connecting communities with their heritage through immersive digital experiences. Developed user research protocols, designed cultural storytelling interfaces, and built scalable content management systems. Features artifact collections, cultural timelines, and wearable stories that bring history to life.',
    tag: 'Culture',
    role: 'Lead Developer',
    impact: '10k+ stories archived',
    stack: ['React', 'Python', 'WordPress'],
    image: null,
    url: 'https://thehumanarchives.com',
    preview: true
  },
  {
    id: 'pachaayni',
    title: 'Pachaayni Experience',
    description: 'Designed and built an immersive cultural education platform that brings indigenous wisdom to modern audiences through interactive storytelling. Applied participatory design methodologies, conducted user research with diverse communities, and created culturally sensitive interface designs.',
    tag: 'Education',
    role: 'UX Designer',
    impact: '50k+ users reached',
    stack: ['Figma', 'JavaScript', 'AEM'],
    image: null
  },
  {
    id: 'portfolio-system',
    title: 'Design System Library',
    description: 'Developed a comprehensive design system to ensure consistency across products, reducing design-to-dev handoff time by 60%. Established component libraries, documentation protocols, and cross-functional collaboration frameworks to streamline the design-to-development process.',
    tag: 'Design System',
    role: 'Systems Designer',
    impact: '-60% handoff time',
    stack: ['Figma', 'Storybook', 'React'],
    image: null
  }
];

/**
 * Load projects with skeleton states
 */
export function loadProjects() {
  const grid = document.querySelector('.work-grid');
  if (!grid) return;
  
  // Show skeletons first
  grid.innerHTML = projects.map(() => `
    <div class="card skeleton skeleton-card" aria-busy="true"></div>
  `).join('');
  
  // Simulate loading delay (in real app, this would be an API call)
  setTimeout(() => {
    grid.innerHTML = projects.map(project => createProjectCard(project)).join('');
  }, 800);
}

/**
 * Create project card HTML
 */
function createProjectCard(project) {
  return `
    <article class="card" role="listitem">
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
      
      ${project.url ? `
        <div class="card-actions" style="margin-top: 1rem;">
          <a 
            href="${project.url}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="btn btn-outline btn-sm"
            aria-label="Preview ${escapeHtml(project.title)} website"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Preview Site
          </a>
        </div>
      ` : ''}
    </article>
  `;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

