// forms.js - Form validation and handling

import { showToast } from './toast.js';

/**
 * Initialize form handling
 */
export function initForms() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  
  // Real-time validation on blur
  form.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => {
      if (input.classList.contains('error')) {
        validateField(input);
      }
    });
  });
  
  // Form submission
  form.addEventListener('submit', handleSubmit);
}

/**
 * Validate a single field
 */
function validateField(input) {
  const group = input.closest('.form-group');
  const error = group.querySelector('.form-error');
  
  // Clear previous state
  input.classList.remove('error', 'success');
  group.classList.remove('has-error');
  
  // Validation rules
  let errorMessage = '';
  
  if (input.hasAttribute('required') && !input.value.trim()) {
    errorMessage = 'This field is required';
  } else if (input.type === 'email' && input.value) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(input.value)) {
      errorMessage = 'Please enter a valid email address';
    }
  }
  
  // Show error or success
  if (errorMessage) {
    input.classList.add('error');
    group.classList.add('has-error');
    error.textContent = errorMessage;
    error.setAttribute('role', 'alert');
  } else if (input.value) {
    input.classList.add('success');
  }
  
  return !errorMessage;
}

/**
 * Handle form submission
 */
async function handleSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const inputs = form.querySelectorAll('.form-input');
  
  // Validate all fields
  let isValid = true;
  inputs.forEach(input => {
    if (!validateField(input)) {
      isValid = false;
    }
  });
  
  if (!isValid) {
    showToast('Validation Error', 'Please fix the errors before submitting', 'error');
    return;
  }
  
  // Get form data
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  
  // In a real app, you would send this to a server
  // For this static site, we'll just show a success message
  console.log('Form data:', data);
  
  // Show success message
  showToast('Message Sent!', 'Thank you for reaching out. I\'ll get back to you soon.', 'success');
  
  // Reset form
  form.reset();
  inputs.forEach(input => {
    input.classList.remove('error', 'success');
    input.closest('.form-group').classList.remove('has-error');
  });
}

