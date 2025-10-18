// LeverAI Training - Interactive Functionality
(function() {
  'use strict';

  // DOM Elements
  const nav = document.querySelector('.nav-container');
  const navLinks = document.querySelectorAll('.nav-link');
  const ctaButtons = document.querySelectorAll('.btn-primary');
  const contactForm = document.getElementById('contact-form');
  const assessmentButtons = document.querySelectorAll('[href="#assessment"]');

  // State
  let isScrolling = false;
  let lastScrollY = 0;

  // Initialize
  function init() {
    setupEventListeners();
    setupSmoothScrolling();
    setupFormValidation();
    setupScrollAnimations();
    setupNavbarBehavior();
    setupCTATracking();
  }

  // Event Listeners
  function setupEventListeners() {
    // Navbar scroll behavior
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Form submission
    if (contactForm) {
      contactForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Assessment button clicks
    assessmentButtons.forEach(button => {
      button.addEventListener('click', handleAssessmentClick);
    });
    
    // CTA button clicks
    ctaButtons.forEach(button => {
      button.addEventListener('click', handleCTAClick);
    });
    
    // Mobile menu toggle (if needed)
    setupMobileMenu();
  }

  // Smooth Scrolling
  function setupSmoothScrolling() {
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        
        if (href.startsWith('#')) {
          e.preventDefault();
          const targetId = href.substring(1);
          const targetElement = document.getElementById(targetId);
          
          if (targetElement) {
            const headerHeight = nav.offsetHeight;
            const targetPosition = targetElement.offsetTop - headerHeight - 20;
            
            window.scrollTo({
              top: targetPosition,
              behavior: 'smooth'
            });
          }
        }
      });
    });
  }

  // Navbar Behavior
  function setupNavbarBehavior() {
    let ticking = false;
    
    function updateNavbar() {
      const scrollY = window.scrollY;
      
      if (scrollY > 100) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
      
      // Hide/show navbar on scroll
      if (scrollY > lastScrollY && scrollY > 200) {
        nav.style.transform = 'translateY(-100%)';
      } else {
        nav.style.transform = 'translateY(0)';
      }
      
      lastScrollY = scrollY;
      ticking = false;
    }
    
    function requestTick() {
      if (!ticking) {
        requestAnimationFrame(updateNavbar);
        ticking = true;
      }
    }
    
    window.addEventListener('scroll', requestTick, { passive: true });
  }

  // Scroll Animations
  function setupScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, observerOptions);
    
    // Observe elements for animation
    const animateElements = document.querySelectorAll('.timeline-item, .result-stat, .testimonial, .resource-card');
    animateElements.forEach(el => {
      observer.observe(el);
    });
  }

  // Form Validation
  function setupFormValidation() {
    if (!contactForm) return;
    
    const inputs = contactForm.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      input.addEventListener('blur', validateField);
      input.addEventListener('input', clearFieldError);
    });
  }

  function validateField(e) {
    const field = e.target;
    const value = field.value.trim();
    const fieldName = field.name;
    let isValid = true;
    let errorMessage = '';
    
    // Required field validation
    if (field.hasAttribute('required') && !value) {
      isValid = false;
      errorMessage = `${fieldName} is required`;
    }
    
    // Email validation
    if (fieldName === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        isValid = false;
        errorMessage = 'Please enter a valid email address';
      }
    }
    
    // Team size validation
    if (fieldName === 'team-size' && !value) {
      isValid = false;
      errorMessage = 'Please select your team size';
    }
    
    // Show/hide error
    if (!isValid) {
      showFieldError(field, errorMessage);
    } else {
      clearFieldError(e);
    }
    
    return isValid;
  }

  function showFieldError(field, message) {
    clearFieldError({ target: field });
    
    field.classList.add('error');
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    
    field.parentNode.appendChild(errorDiv);
  }

  function clearFieldError(e) {
    const field = e.target;
    field.classList.remove('error');
    
    const errorDiv = field.parentNode.querySelector('.field-error');
    if (errorDiv) {
      errorDiv.remove();
    }
  }

  // Form Submission
  function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(contactForm);
    const data = Object.fromEntries(formData);
    
    // Validate all fields
    const inputs = contactForm.querySelectorAll('input, select, textarea');
    let isFormValid = true;
    
    inputs.forEach(input => {
      if (!validateField({ target: input })) {
        isFormValid = false;
      }
    });
    
    if (!isFormValid) {
      showNotification('Please fix the errors above', 'error');
      return;
    }
    
    // Show loading state
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Sending...';
    submitButton.disabled = true;
    
    // Simulate form submission (replace with actual API call)
    setTimeout(() => {
      showNotification('Thank you! We\'ll get back to you within 24 hours.', 'success');
      contactForm.reset();
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }, 2000);
  }

  // Assessment Click Handler
  function handleAssessmentClick(e) {
    e.preventDefault();
    
    // Track assessment clicks
    trackEvent('assessment_click', {
      source: e.target.textContent.trim(),
      timestamp: new Date().toISOString()
    });
    
    // Show assessment modal or redirect
    showAssessmentModal();
  }

  // CTA Click Handler
  function handleCTAClick(e) {
    const buttonText = e.target.textContent.trim();
    
    // Track CTA clicks
    trackEvent('cta_click', {
      button_text: buttonText,
      timestamp: new Date().toISOString()
    });
    
    // Scroll to contact form or show enrollment modal
    if (buttonText.includes('Start') || buttonText.includes('Transform')) {
      const contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  // Assessment Modal
  function showAssessmentModal() {
    const modal = createModal(`
      <div class="assessment-modal">
        <h2>AI Readiness Assessment</h2>
        <p>Discover your team's AI readiness level and get personalized recommendations.</p>
        
        <form class="assessment-form">
          <div class="form-group">
            <label>Company Name</label>
            <input type="text" name="company" required>
          </div>
          
          <div class="form-group">
            <label>Team Size</label>
            <select name="team-size" required>
              <option value="">Select team size</option>
              <option value="1-10">1-10 people</option>
              <option value="11-50">11-50 people</option>
              <option value="51-200">51-200 people</option>
              <option value="200+">200+ people</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Current AI Usage</label>
            <select name="ai-usage" required>
              <option value="">Select current usage</option>
              <option value="none">Not using AI</option>
              <option value="basic">Basic tools (ChatGPT, etc.)</option>
              <option value="moderate">Some AI integration</option>
              <option value="advanced">Advanced AI implementation</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" name="email" required>
          </div>
          
          <button type="submit" class="btn btn-primary btn-full">Get My Assessment</button>
        </form>
      </div>
    `);
    
    document.body.appendChild(modal);
    
    // Handle assessment form submission
    const assessmentForm = modal.querySelector('.assessment-form');
    assessmentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      showNotification('Assessment submitted! Check your email for results.', 'success');
      closeModal(modal);
    });
  }

  // Modal Utilities
  function createModal(content) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close">&times;</button>
        ${content}
      </div>
    `;
    
    // Close modal handlers
    modal.querySelector('.modal-close').addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
    
    return modal;
  }

  function closeModal(modal) {
    modal.remove();
  }

  // Mobile Menu
  function setupMobileMenu() {
    // Add mobile menu toggle if needed
    const mobileMenuButton = document.createElement('button');
    mobileMenuButton.className = 'mobile-menu-toggle';
    mobileMenuButton.innerHTML = '☰';
    mobileMenuButton.setAttribute('aria-label', 'Toggle mobile menu');
    
    nav.appendChild(mobileMenuButton);
    
    mobileMenuButton.addEventListener('click', () => {
      nav.classList.toggle('mobile-menu-open');
    });
  }

  // Notifications
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Auto remove
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }

  // Analytics Tracking
  function trackEvent(eventName, properties = {}) {
    // Replace with actual analytics implementation
    console.log('Event tracked:', eventName, properties);
    
    // Example: Google Analytics 4
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, properties);
    }
  }

  // Scroll Handler
  function handleScroll() {
    if (isScrolling) return;
    
    isScrolling = true;
    requestAnimationFrame(() => {
      // Add scroll-based animations here
      isScrolling = false;
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

// Additional CSS for JavaScript functionality
const additionalStyles = `
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }
  
  .modal-content {
    background: white;
    border-radius: 12px;
    padding: 32px;
    max-width: 500px;
    width: 100%;
    position: relative;
    max-height: 90vh;
    overflow-y: auto;
  }
  
  .modal-close {
    position: absolute;
    top: 16px;
    right: 16px;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #64748b;
  }
  
  .assessment-modal h2 {
    margin-bottom: 16px;
    color: #1e293b;
  }
  
  .assessment-modal p {
    margin-bottom: 24px;
    color: #64748b;
  }
  
  .assessment-form .form-group {
    margin-bottom: 20px;
  }
  
  .assessment-form label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #374151;
  }
  
  .assessment-form input,
  .assessment-form select {
    width: 100%;
    padding: 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 16px;
  }
  
  .field-error {
    color: #dc2626;
    font-size: 14px;
    margin-top: 4px;
  }
  
  .form-input.error,
  .form-select.error,
  .form-textarea.error {
    border-color: #dc2626;
  }
  
  .notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    z-index: 1001;
    transform: translateX(100%);
    transition: transform 0.3s ease;
  }
  
  .notification.show {
    transform: translateX(0);
  }
  
  .notification-success {
    background: #059669;
  }
  
  .notification-error {
    background: #dc2626;
  }
  
  .notification-info {
    background: #3b82f6;
  }
  
  .mobile-menu-toggle {
    display: none;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #64748b;
  }
  
  @media (max-width: 767px) {
    .mobile-menu-toggle {
      display: block;
    }
    
    .nav-menu {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border-top: 1px solid #e2e8f0;
      padding: 20px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .nav-container.mobile-menu-open .nav-menu {
      display: block;
    }
    
    .nav-menu {
      flex-direction: column;
      gap: 16px;
    }
  }
  
  .animate-in {
    animation: slideInUp 0.6s ease-out;
  }
  
  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .nav-container {
    transition: transform 0.3s ease;
  }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);
