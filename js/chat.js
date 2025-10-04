// chat.js - Chat UI and interaction management

import { initLocalLLM, isLocalEngineReady, cancelInitialization } from './engine.local.js';
import { replyRuleBased, getGreetingResponse } from './engine.rules.js';
import { supportsWebGPU, isLikelyCapableDevice, isLocalModeDisabled, getDeviceInfo } from './detector.js';
import { setTheme, getTheme } from './theme.js';
import { navigateTo } from './router.js';
import { showToast } from './toast.js';

class ChatManager {
  constructor() {
    this.isOpen = false;
    this.mode = 'fallback'; // 'local' | 'fallback'
    this.isInitializing = false;
    this.messages = [];
    this.localEngine = null;
    this.rateLimit = new Map();
    
    this.init();
  }
  
  init() {
    this.createUI();
    this.setupEventListeners();
    this.addGreeting();
  }
  
  createUI() {
    // Create chat button
    const chatButton = document.createElement('button');
    chatButton.className = 'chat-button';
    chatButton.setAttribute('aria-label', 'Open chat');
    chatButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    `;
    
    // Create chat drawer
    const chatDrawer = document.createElement('div');
    chatDrawer.className = 'chat-drawer';
    chatDrawer.setAttribute('aria-hidden', 'true');
    chatDrawer.innerHTML = `
      <div class="chat-header">
        <div class="chat-title">
          <h3>Ask me about my work</h3>
          <div class="chat-status">
            <div class="status-dot" id="status-dot"></div>
            <span class="status-text" id="status-text">Fast fallback</span>
          </div>
        </div>
        <button class="chat-close" aria-label="Close chat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="chat-messages" id="chat-messages" role="log" aria-live="polite"></div>
      
      <div class="chat-shortcuts">
        <button class="shortcut-chip" data-prompt="Show me your projects">Show projects</button>
        <button class="shortcut-chip" data-prompt="Download resume">Download resume</button>
        <button class="shortcut-chip" data-prompt="How can I contact you?">Contact</button>
      </div>
      
      <div class="chat-composer">
        <div class="composer-input-wrapper">
          <textarea 
            class="composer-input" 
            id="composer-input"
            placeholder="Ask about projects, skills, availability..."
            rows="1"
            aria-label="Type your message"
          ></textarea>
          <button class="composer-send" id="composer-send" aria-label="Send message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
            </svg>
          </button>
        </div>
        <div class="composer-hint">
          Press <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line
        </div>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(chatButton);
    document.body.appendChild(chatDrawer);
    
    // Store references
    this.chatButton = chatButton;
    this.chatDrawer = chatDrawer;
    this.messagesContainer = document.getElementById('chat-messages');
    this.statusDot = document.getElementById('status-dot');
    this.statusText = document.getElementById('status-text');
    this.composerInput = document.getElementById('composer-input');
    this.composerSend = document.getElementById('composer-send');
  }
  
  setupEventListeners() {
    // Chat button
    this.chatButton.addEventListener('click', () => this.toggle());
    
    // Close button
    this.chatDrawer.querySelector('.chat-close').addEventListener('click', () => this.close());
    
    // Send button
    this.composerSend.addEventListener('click', () => this.sendMessage());
    
    // Input events
    this.composerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    // Auto-resize textarea
    this.composerInput.addEventListener('input', () => {
      this.composerInput.style.height = 'auto';
      this.composerInput.style.height = Math.min(this.composerInput.scrollHeight, 120) + 'px';
    });
    
    // Shortcut chips
    this.chatDrawer.querySelectorAll('.shortcut-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        this.composerInput.value = prompt;
        this.sendMessage();
      });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.toggle();
      }
      
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
    
    // Click outside to close
    this.chatDrawer.addEventListener('click', (e) => {
      if (e.target === this.chatDrawer) {
        this.close();
      }
    });
  }
  
  async toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      await this.open();
    }
  }
  
  async open() {
    this.isOpen = true;
    this.chatDrawer.setAttribute('aria-hidden', 'false');
    this.chatButton.setAttribute('aria-expanded', 'true');
    
    // Focus management
    this.composerInput.focus();
    
    // Initialize local engine if not already done
    if (!this.localEngine && !this.isInitializing) {
      await this.initializeEngine();
    }
    
    // Add entrance animation
    this.chatDrawer.classList.add('chat-drawer-open');
  }
  
  close() {
    this.isOpen = false;
    this.chatDrawer.setAttribute('aria-hidden', 'true');
    this.chatButton.setAttribute('aria-expanded', 'false');
    this.chatDrawer.classList.remove('chat-drawer-open');
  }
  
  async initializeEngine() {
    if (this.isInitializing) return;
    
    console.log('🔍 Checking device capabilities...');
    
    // Check if local mode is disabled
    if (isLocalModeDisabled()) {
      console.log('🚫 Local mode disabled via URL parameter');
      this.setMode('fallback');
      return;
    }
    
    // Check device capabilities
    const deviceInfo = getDeviceInfo();
    console.log('📱 Device info:', deviceInfo);
    
    // For demo purposes, always try local engine first (unless explicitly disabled)
    console.log('✅ Attempting local engine...');
    this.isInitializing = true;
    this.setMode('initializing');
    
    try {
      // Show loading message
      this.addMessage('bot', 'Loading on-device model (~1.5GB)...', true);
      
      // Initialize with timeout
      const initPromise = initLocalLLM();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 15000)
      );
      
      this.localEngine = await Promise.race([initPromise, timeoutPromise]);
      
      console.log('🎉 Local engine initialized successfully!');
      this.setMode('local');
      this.addMessage('bot', 'Local AI model ready! Ask me anything about the portfolio.', true);
      
    } catch (error) {
      console.warn('❌ Local engine failed, using fallback:', error);
      this.setMode('fallback');
      this.addMessage('bot', `Local model unavailable: ${error.message}. Using fast fallback responses.`, true);
    } finally {
      this.isInitializing = false;
    }
  }
  
  setMode(mode) {
    this.mode = mode;
    
    const statusDot = this.statusDot;
    const statusText = this.statusText;
    
    statusDot.className = 'status-dot';
    
    switch (mode) {
      case 'local':
        statusDot.classList.add('status-local');
        statusText.textContent = 'Local AI';
        statusDot.title = 'Using local AI model';
        break;
      case 'fallback':
        statusDot.classList.add('status-fallback');
        statusText.textContent = 'Fast fallback';
        statusDot.title = 'Using rule-based responses';
        break;
      case 'initializing':
        statusDot.classList.add('status-initializing');
        statusText.textContent = 'Loading...';
        statusDot.title = 'Initializing local model';
        break;
    }
  }
  
  addGreeting() {
    const greeting = getGreetingResponse();
    this.addMessage('bot', greeting.text, false, greeting.actions);
    
    // Add debug info if in debug mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === '1') {
      const deviceInfo = getDeviceInfo();
      this.addMessage('bot', `Debug info: WebGPU=${deviceInfo.webgpu}, Memory=${deviceInfo.deviceMemory}GB, Cores=${deviceInfo.hardwareConcurrency}`, true);
    }
    
    // Auto-initialize local engine after greeting
    setTimeout(() => {
      this.initializeEngine();
    }, 1000);
  }
  
  async sendMessage() {
    const input = this.composerInput.value.trim();
    if (!input) return;
    
    // Rate limiting
    const now = Date.now();
    const lastMessage = this.rateLimit.get('lastMessage') || 0;
    if (now - lastMessage < 1000) {
      showToast('Please wait', 'Sending messages too quickly', 'error');
      return;
    }
    this.rateLimit.set('lastMessage', now);
    
    // Handle slash commands
    if (input.startsWith('/')) {
      this.handleSlashCommand(input);
      this.composerInput.value = '';
      return;
    }
    
    // Add user message
    this.addMessage('user', input);
    this.composerInput.value = '';
    this.composerInput.style.height = 'auto';
    
    // Show typing indicator
    const typingId = this.addTypingIndicator();
    
    try {
      let response;
      
      if (this.mode === 'local' && this.localEngine) {
        response = await this.getLocalResponse(input);
      } else {
        response = replyRuleBased(input);
      }
      
      // Remove typing indicator
      this.removeTypingIndicator(typingId);
      
      // Add bot response
      this.addMessage('bot', response.text, false, response.actions);
      
    } catch (error) {
      console.error('Chat error:', error);
      this.removeTypingIndicator(typingId);
      this.addMessage('bot', 'Sorry, I encountered an error. Please try again.', false);
    }
  }
  
  async getLocalResponse(input) {
    // Build conversation history
    const history = this.messages
      .filter(msg => msg.role !== 'system')
      .slice(-10)
      .map(msg => ({ role: msg.role, content: msg.text }));
    
    // Stream response
    let fullResponse = '';
    const responseId = this.addMessage('bot', '', true);
    const responseElement = document.getElementById(`message-${responseId}`);
    
    const onToken = (token) => {
      fullResponse += token;
      this.updateStreamingMessage(responseId, fullResponse);
    };
    
    await this.localEngine.chat(input, history, onToken);
    
    return { text: fullResponse, actions: [] };
  }
  
  handleSlashCommand(command) {
    const [cmd, ...args] = command.slice(1).split(' ');
    
    switch (cmd) {
      case 'theme':
        const theme = args[0] || (getTheme() === 'dark' ? 'light' : 'dark');
        setTheme(theme);
        this.addMessage('bot', `Switched to ${theme} mode`, false);
        break;
        
      case 'jump':
        const target = args[0];
        if (target) {
          navigateTo(`#${target}`);
          this.addMessage('bot', `Jumped to ${target} section`, false);
        }
        break;
        
      case 'download':
        if (args[0] === 'resume') {
          const link = document.createElement('a');
          link.href = 'assets/resume.pdf';
          link.download = 'Lukas_Nilsson_Resume.pdf';
          link.click();
          this.addMessage('bot', 'Resume download started', false);
        }
        break;
        
      default:
        this.addMessage('bot', `Unknown command: /${cmd}. Try /theme, /jump, or /download`, false);
    }
  }
  
  addMessage(role, text, isSystem = false, actions = []) {
    const messageId = Date.now() + Math.random();
    const message = { id: messageId, role, text, isSystem, actions };
    
    if (!isSystem) {
      this.messages.push(message);
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message chat-message-${role}`;
    messageElement.id = `message-${messageId}`;
    
    const avatar = role === 'user' ? '👤' : '🤖';
    const messageContent = isSystem ? 
      `<div class="message-text system-message">${text}</div>` :
      `<div class="message-avatar">${avatar}</div>
       <div class="message-content">
         <div class="message-text">${text}</div>
         ${actions.length ? `<div class="message-actions">${this.renderActions(actions)}</div>` : ''}
       </div>`;
    
    messageElement.innerHTML = messageContent;
    this.messagesContainer.appendChild(messageElement);
    
    // Scroll to bottom
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    
    return messageId;
  }
  
  addTypingIndicator() {
    const messageId = Date.now() + Math.random();
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message chat-message-bot typing';
    messageElement.id = `typing-${messageId}`;
    messageElement.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;
    
    this.messagesContainer.appendChild(messageElement);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    
    return messageId;
  }
  
  removeTypingIndicator(typingId) {
    const element = document.getElementById(`typing-${typingId}`);
    if (element) {
      element.remove();
    }
  }
  
  updateStreamingMessage(messageId, text) {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      const textElement = element.querySelector('.message-text');
      if (textElement) {
        textElement.textContent = text;
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }
    }
  }
  
  renderActions(actions) {
    return actions.map(action => {
      const button = document.createElement('button');
      button.className = 'action-button';
      button.textContent = action.label;
      
      button.addEventListener('click', () => {
        this.handleAction(action);
      });
      
      return button.outerHTML;
    }).join('');
  }
  
  handleAction(action) {
    switch (action.type) {
      case 'jump':
        navigateTo(action.target);
        break;
      case 'download':
        const link = document.createElement('a');
        link.href = action.target;
        link.download = action.label;
        link.click();
        break;
      case 'email':
        window.location.href = `mailto:${action.target}`;
        break;
      case 'link':
        window.open(action.target, '_blank', 'noopener,noreferrer');
        break;
      case 'theme':
        setTheme(action.target);
        break;
    }
  }
}

// Initialize chat when DOM is ready
let chatManager = null;
document.addEventListener('DOMContentLoaded', () => {
  chatManager = new ChatManager();
});

export { ChatManager };
