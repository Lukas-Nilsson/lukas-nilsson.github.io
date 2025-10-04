// Chat interface functionality
(function() {
  'use strict';

  // DOM elements
  const chatMessages = document.getElementById('chat-messages');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const chatForm = document.getElementById('chat-form');
  const charCount = document.getElementById('char-count');

  // State
  let isTyping = false;
  let messageHistory = [];

  // Initialize
  function init() {
    setupEventListeners();
    updateCharCount();
    adjustTextareaHeight();
    setupPromptButtons();
  }

  // Event listeners
  function setupEventListeners() {
    // Form submission
    chatForm.addEventListener('submit', handleSubmit);
    
    // Input handling
    messageInput.addEventListener('input', handleInput);
    messageInput.addEventListener('keydown', handleKeydown);
    messageInput.addEventListener('paste', handlePaste);
    
    // Auto-resize textarea
    messageInput.addEventListener('input', adjustTextareaHeight);
  }

  // Setup prompt buttons
  function setupPromptButtons() {
    const promptButtons = document.querySelectorAll('.prompt-button');
    promptButtons.forEach(button => {
      button.addEventListener('click', () => {
        const prompt = button.getAttribute('data-prompt');
        messageInput.value = prompt;
        messageInput.focus();
        adjustTextareaHeight();
        updateCharCount();
        updateSendButton();
        
        // Auto-send after a brief delay
        setTimeout(() => {
          if (messageInput.value.trim() === prompt) {
            chatForm.dispatchEvent(new Event('submit'));
          }
        }, 500);
      });
    });
  }

  // Handle form submission
  function handleSubmit(e) {
    e.preventDefault();
    const message = messageInput.value.trim();
    
    if (!message || isTyping) return;
    
    sendMessage(message);
    messageInput.value = '';
    adjustTextareaHeight();
    updateCharCount();
  }

  // Handle input changes
  function handleInput() {
    updateCharCount();
    updateSendButton();
  }

  // Handle keyboard shortcuts
  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  }

  // Handle paste events
  function handlePaste(e) {
    // Allow paste to complete, then adjust height
    setTimeout(() => {
      adjustTextareaHeight();
      updateCharCount();
    }, 0);
  }

  // Send message
  function sendMessage(text) {
    // Add user message
    addMessage(text, 'user');
    
    // Show typing indicator
    showTypingIndicator();
    
    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      hideTypingIndicator();
      const response = generateResponse(text);
      addMessage(response, 'ai');
    }, 1000 + Math.random() * 2000); // Random delay 1-3 seconds
  }

  // Add message to chat
  function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Convert line breaks to <br> and escape HTML
    const formattedText = escapeHtml(text).replace(/\n/g, '<br>');
    contentDiv.innerHTML = `<p>${formattedText}</p>`;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = getCurrentTime();
    
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    
    // Store in history
    messageHistory.push({ text, sender, timestamp: Date.now() });
  }

  // Show typing indicator
  function showTypingIndicator() {
    if (isTyping) return;
    
    isTyping = true;
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai-message typing-indicator';
    typingDiv.id = 'typing-indicator';
    
    typingDiv.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;
    
    chatMessages.appendChild(typingDiv);
    scrollToBottom();
  }

  // Hide typing indicator
  function hideTypingIndicator() {
    isTyping = false;
    const typingDiv = document.getElementById('typing-indicator');
    if (typingDiv) {
      typingDiv.remove();
    }
  }

  // Generate AI response (placeholder)
  function generateResponse(userMessage) {
    const responses = [
      "That's a great question! Based on my knowledge about Lukas, I can tell you that he's passionate about building thoughtful software and exploring the intersection of technology and human experience.",
      "I'd be happy to help with that. Lukas has experience in full-stack development, with a focus on creating accessible and performant web applications.",
      "From what I know, Lukas is particularly interested in projects that combine technical excellence with meaningful impact, like The Human Archives project.",
      "That's an interesting topic! Lukas has a background in computer science, design, and various other fields that inform his approach to software development.",
      "I can share some insights about that. Lukas believes in honest, transparent communication about both successes and challenges in software development."
    ];
    
    // Simple keyword matching for more relevant responses
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('project') || lowerMessage.includes('work')) {
      return "Lukas has worked on several interesting projects, including The Human Archives (thehumanarchives.com) which explores memory and meaning through technology. He's also built this portfolio site with a focus on accessibility and performance.";
    }
    
    if (lowerMessage.includes('skill') || lowerMessage.includes('experience')) {
      return "Lukas has experience across the full stack, with particular strengths in frontend development, accessibility, and creating user-centered interfaces. He's worked with modern web technologies and has a strong foundation in computer science principles.";
    }
    
    if (lowerMessage.includes('about') || lowerMessage.includes('who')) {
      return "Lukas is a software developer who cares about clarity, craft, and making useful things. He's interested in the intersection of engineering and meaning, and believes in honest, transparent communication about the development process.";
    }
    
    if (lowerMessage.includes('contact') || lowerMessage.includes('reach')) {
      return "You can reach Lukas at lukaspnilsson@gmail.com. He's also active on GitHub (github.com/lukas-nilsson) and LinkedIn (linkedin.com/in/lukaspnilsson).";
    }
    
    // Default response
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Utility functions
  function updateCharCount() {
    const count = messageInput.value.length;
    charCount.textContent = `${count}/2000`;
    
    if (count > 1800) {
      charCount.style.color = '#ef4444';
    } else if (count > 1500) {
      charCount.style.color = '#f59e0b';
    } else {
      charCount.style.color = 'var(--muted)';
    }
  }

  function updateSendButton() {
    const hasText = messageInput.value.trim().length > 0;
    sendButton.disabled = !hasText || isTyping;
  }

  function adjustTextareaHeight() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function getCurrentTime() {
    return new Date().toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
