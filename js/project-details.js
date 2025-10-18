// project-details.js - Handle individual project pages

// Extended project data with more details
const projectDetails = {
  'anz-plus': {
    title: 'ANZ Plus Digital Platform',
    tag: 'FinTech',
    type: 'Professional Work',
    role: 'Product Designer',
    impact: '+40% user engagement, -25% support calls',
    stack: ['Figma', 'React', 'Adobe Analytics', 'Jira', 'Confluence'],
    description: 'Led design and development of next-generation mobile banking platform, improving user engagement by 40% and reducing support calls by 25%. Applied user-centered design methodologies, conducted usability testing, and implemented data-driven design decisions to create intuitive financial interfaces.',
    features: [
      'Mobile-first responsive design',
      'Intuitive transaction flows',
      'Real-time notifications',
      'Biometric authentication',
      'Personalized dashboard',
      'Accessibility compliance (WCAG 2.1 AA)'
    ],
    challenges: `
      <p><strong>Challenge:</strong> Creating a banking interface that felt both secure and approachable for users of all technical levels.</p>
      <p><strong>Solution:</strong> Conducted extensive user research with diverse age groups, implemented progressive disclosure patterns, and used familiar visual metaphors while maintaining enterprise-grade security standards.</p>
    `,
    links: []
  },
  'pachaayni': {
    title: 'Pachaayni Experience',
    tag: 'Education',
    type: 'Side Project',
    role: 'UX Designer',
    impact: '50k+ users reached across diverse communities',
    stack: ['Figma', 'JavaScript', 'AEM', 'Adobe Analytics'],
    description: 'Designed and built an immersive cultural education platform that brings indigenous wisdom to modern audiences through interactive storytelling. Applied participatory design methodologies, conducted user research with diverse communities, and created culturally sensitive interface designs.',
    features: [
      'Interactive storytelling modules',
      'Multilingual support',
      'Cultural sensitivity guidelines',
      'Community feedback integration',
      'Mobile-optimized experience',
      'Accessibility features'
    ],
    challenges: `
      <p><strong>Challenge:</strong> Balancing cultural authenticity with modern UX expectations while ensuring the platform was accessible to all community members.</p>
      <p><strong>Solution:</strong> Worked directly with community elders and cultural advisors, implemented flexible content management systems, and created user testing protocols that respected cultural protocols.</p>
    `,
    links: []
  },
  'leverai-training': {
    title: 'LeverAI Training',
    tag: 'AI Training',
    type: 'Professional Work',
    role: 'Founder & Lead Trainer',
    impact: 'Business AI adoption and strategic implementation',
    stack: ['AI Strategy', 'Training Design', 'Business Development', 'Curriculum Design'],
    description: 'Founded and developed a comprehensive AI training program for businesses, focusing on practical implementation and strategic AI adoption. Created curriculum, training materials, and hands-on workshops to help organizations leverage AI effectively while maintaining ethical standards and business value.',
    features: [
      'Comprehensive AI strategy workshops',
      'Hands-on implementation training',
      'Customized business solutions',
      'Ethical AI guidelines and best practices',
      'ROI measurement frameworks',
      'Ongoing support and consultation'
    ],
    challenges: `
      <p><strong>Challenge:</strong> Creating training programs that bridge the gap between AI hype and practical business implementation, while ensuring organizations understand both opportunities and limitations.</p>
      <p><strong>Solution:</strong> Developed a hands-on, project-based curriculum that combines strategic thinking with practical implementation, using real business scenarios and case studies to demonstrate tangible value.</p>
    `,
    links: [
      { text: 'Visit LeverAI', url: '/leverai.html', external: false }
    ]
  },
  'human-archives': {
    title: 'The Human Archives',
    tag: 'Culture',
    type: 'Side Project',
    role: 'Lead Developer',
    impact: '10k+ stories archived and shared',
    stack: ['React', 'Python', 'WordPress', 'MySQL'],
    description: 'Created an interactive platform to preserve and share cultural stories, connecting communities with their heritage through immersive digital experiences. Developed user research protocols, designed cultural storytelling interfaces, and built scalable content management systems.',
    features: [
      'Interactive story timelines',
      'Multimedia content support',
      'Community contribution system',
      'Search and discovery tools',
      'Mobile-responsive design',
      'Cultural sensitivity features'
    ],
    challenges: `
      <p><strong>Challenge:</strong> Building a platform that could handle diverse content types while maintaining cultural sensitivity and technical performance.</p>
      <p><strong>Solution:</strong> Developed flexible content models, implemented robust moderation tools, and created user-friendly interfaces that guided contributors through culturally appropriate content creation.</p>
    `,
    links: [
      { text: 'Visit Website', url: 'https://thehumanarchives.com', external: true }
    ]
  },
  'human-timeline': {
    title: 'Human Timeline (Pre AI)',
    tag: 'Education',
    type: 'Side Project',
    role: 'Developer',
    impact: 'Historical exploration and learning tool',
    stack: ['JavaScript', 'Timeline.js', 'D3.js', 'Historical APIs'],
    description: 'An interactive timeline exploring human history and cultural evolution before the AI era. Features chronological storytelling, cultural milestones, and immersive historical narratives that connect users with our shared past through engaging visualizations.',
    features: [
      'Interactive chronological timeline',
      'Cultural milestone markers',
      'Historical event filtering',
      'Multimedia historical content',
      'Responsive design for all devices',
      'Educational quiz integration'
    ],
    challenges: `
      <p><strong>Challenge:</strong> Creating an engaging way to present thousands of years of human history without overwhelming users or oversimplifying complex historical narratives.</p>
      <p><strong>Solution:</strong> Implemented progressive disclosure, interactive filtering, and visual storytelling techniques that allowed users to explore at their own pace while maintaining historical accuracy and cultural sensitivity.</p>
    `,
    links: []
  },
  'pacha-ayni': {
    title: 'Pacha Ayni (Pre AI)',
    tag: 'Culture',
    type: 'Side Project',
    role: 'UX Designer',
    impact: 'Cultural preservation and community engagement',
    stack: ['Figma', 'WordPress', 'Community Research', 'Cultural Protocols'],
    description: 'A cultural preservation platform focused on indigenous wisdom and traditional knowledge systems. Built before AI integration to honor authentic cultural transmission and community-driven storytelling approaches, emphasizing human-to-human knowledge sharing.',
    features: [
      'Community-driven content creation',
      'Cultural protocol integration',
      'Multilingual support',
      'Elder consultation features',
      'Traditional knowledge categorization',
      'Respectful cultural representation'
    ],
    challenges: `
      <p><strong>Challenge:</strong> Designing a digital platform that respects traditional knowledge systems and cultural protocols while making content accessible to broader audiences.</p>
      <p><strong>Solution:</strong> Worked directly with community elders and cultural advisors to develop design principles that honored traditional ways of sharing knowledge while creating intuitive digital interfaces that supported rather than replaced cultural practices.</p>
    `,
    links: []
  },
  'solar': {
    title: 'SolAR (Pre AI)',
    tag: 'AR/VR',
    type: 'Side Project',
    role: 'AR Developer',
    impact: 'Educational AR experience for space learning',
    stack: ['Unity', 'ARCore', 'C#', '3D Modeling', 'Mobile Development'],
    description: 'An augmented reality application for solar system exploration, built before AI integration. Features immersive 3D planetary experiences, educational content, and interactive space exploration using AR technology to bring the cosmos into users\' physical space.',
    features: [
      'Real-time AR planet rendering',
      'Interactive planetary information',
      'Scale-accurate solar system',
      'Educational content integration',
      'Mobile-optimized AR experience',
      'Offline functionality'
    ],
    challenges: `
      <p><strong>Challenge:</strong> Creating accurate 3D representations of celestial bodies in AR while maintaining smooth performance on mobile devices and ensuring educational value.</p>
      <p><strong>Solution:</strong> Implemented level-of-detail rendering, optimized 3D models, and created adaptive quality settings that worked across different device capabilities while maintaining scientific accuracy.</p>
    `,
    links: []
  },
  'interactive-solar-system': {
    title: 'Interactive Solar System (with AI)',
    tag: 'AI + Education',
    type: 'Side Project',
    role: 'Full-Stack Developer',
    impact: 'AI-powered personalized learning experience',
    stack: ['Three.js', 'OpenAI API', 'WebGL', 'Machine Learning', 'Educational Analytics'],
    description: 'An AI-enhanced interactive solar system visualization that combines real astronomical data with intelligent explanations. Features dynamic learning paths, personalized content, and AI-powered educational assistance for space exploration, adapting to each user\'s learning style and interests.',
    features: [
      'AI-powered learning recommendations',
      'Personalized educational content',
      'Real-time astronomical data',
      'Interactive 3D solar system',
      'Adaptive difficulty levels',
      'Learning progress tracking'
    ],
    challenges: `
      <p><strong>Challenge:</strong> Integrating AI assistance in a way that enhances rather than replaces the educational experience, while maintaining scientific accuracy and user engagement.</p>
      <p><strong>Solution:</strong> Developed a hybrid approach where AI provides contextual explanations and learning guidance while users maintain agency in their exploration, with careful prompt engineering to ensure accurate scientific information.</p>
    `,
    links: []
  },
  'meteorite-visualization': {
    title: 'Near-Earth Objects Visualization',
    tag: 'Data Visualization',
    type: 'Side Project',
    role: 'Developer',
    impact: 'Real-time NASA data visualization',
    stack: ['Three.js', 'JavaScript', 'NASA API', 'WebGL'],
    description: 'Interactive 3D visualization of potentially hazardous asteroids and meteorites based on NASA\'s CNEOS Sentry data. Features realistic orbital mechanics with accurate relative sizes and distances for the Sun, Earth, Moon, and meteorites.',
    features: [
      'Real-time NASA data integration',
      '3D orbital mechanics simulation',
      'Interactive object selection',
      'Detailed impact probability data',
      'Responsive WebGL rendering',
      'Educational tooltips and information'
    ],
    challenges: `
      <p><strong>Challenge:</strong> Creating an accurate 3D representation of orbital mechanics while maintaining smooth performance across different devices.</p>
      <p><strong>Solution:</strong> Implemented level-of-detail rendering, optimized WebGL shaders, and created fallback 2D visualizations for lower-end devices.</p>
    `,
    links: [
      { text: 'View Visualization', url: 'meteorite.html', external: false }
    ]
  },
  'interactive-portfolio': {
    title: 'Interactive Portfolio',
    tag: 'Web Development',
    type: 'Side Project',
    role: 'Full-Stack Developer',
    impact: '100% accessible, 95+ Lighthouse score',
    stack: ['HTML/CSS/JS', 'Accessibility', 'Performance', 'Progressive Enhancement'],
    description: 'This portfolio itself - built with accessibility, performance, and honest design principles. Features dark/light themes, smooth animations, and a focus on semantic HTML and progressive enhancement.',
    features: [
      'Semantic HTML structure',
      'WCAG 2.1 AA accessibility compliance',
      'Dark/light theme support',
      'Progressive enhancement',
      'Mobile-first responsive design',
      'Performance optimization'
    ],
    challenges: `
      <p><strong>Challenge:</strong> Creating a portfolio that demonstrates both technical skills and design sensibility while maintaining excellent performance and accessibility.</p>
      <p><strong>Solution:</strong> Focused on semantic HTML, CSS custom properties for theming, and minimal JavaScript with progressive enhancement to ensure the site works for all users.</p>
    `,
    links: [
      { text: 'View Source', url: 'https://github.com/lukas-nilsson/lukas-nilsson.github.io', external: true }
    ]
  }
};

/**
 * Load project details based on URL parameters
 */
export function loadProjectDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');
  const projectType = urlParams.get('type');
  
  if (!projectId || !projectDetails[projectId]) {
    showError('Project not found');
    return;
  }
  
  const project = projectDetails[projectId];
  
  // Update page title
  document.getElementById('page-title').textContent = `${project.title} - Lukas Nilsson`;
  
  // Update project header
  document.getElementById('project-tag').textContent = project.tag;
  document.getElementById('project-type').textContent = project.type;
  document.getElementById('project-title').textContent = project.title;
  document.getElementById('project-subtitle').textContent = project.description;
  
  // Update project details
  document.getElementById('project-description').textContent = project.description;
  document.getElementById('project-role').textContent = project.role;
  document.getElementById('project-impact').textContent = project.impact;
  
  // Update technologies
  const stackContainer = document.getElementById('project-stack');
  stackContainer.innerHTML = project.stack.map(tech => 
    `<span class="tech-tag">${tech}</span>`
  ).join('');
  
  // Update features
  const featuresContainer = document.getElementById('project-features');
  featuresContainer.innerHTML = project.features.map(feature => 
    `<li>${feature}</li>`
  ).join('');
  
  // Update challenges
  document.getElementById('project-challenges').innerHTML = project.challenges;
  
  // Update links
  const linksContainer = document.getElementById('project-links');
  if (project.links.length > 0) {
    linksContainer.innerHTML = project.links.map(link => 
      `<a href="${link.url}" ${link.external ? 'target="_blank" rel="noopener noreferrer"' : ''} class="btn btn-primary">
        ${link.text}
        ${link.external ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' : ''}
      </a>`
    ).join('');
  } else {
    linksContainer.innerHTML = '<p class="no-links">No external links available for this project.</p>';
  }
}

/**
 * Show error message
 */
function showError(message) {
  document.getElementById('project-title').textContent = 'Project Not Found';
  document.getElementById('project-subtitle').textContent = message;
}

// Load project details when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadProjectDetails);
} else {
  loadProjectDetails();
}
