# AI Chatbot Implementation Guide

## Overview

The portfolio site includes a sophisticated chatbot with two operational modes:

1. **Local Mode**: On-device AI inference using WebLLM and WebGPU
2. **Fallback Mode**: Rule-based responses for universal compatibility

## Architecture

### Core Components

```
js/
├── detector.js          # Feature detection (WebGPU, device capabilities)
├── engine.local.js      # Local LLM engine (WebLLM integration)
├── engine.rules.js      # Rule-based fallback engine
├── chat.js              # UI management and interaction
└── chat.css             # Chat interface styling
```

### Data Flow

```
User Input → Chat UI → Mode Detection → Engine Selection → Response Generation → UI Update
```

## Implementation Details

### 1. Feature Detection (`detector.js`)

**Purpose**: Determine if device can run local LLM

**Key Functions**:
- `supportsWebGPU()`: Check WebGPU availability
- `isLikelyCapableDevice()`: Assess device capabilities
- `isLocalModeDisabled()`: Check URL parameter override

**Device Requirements**:
- WebGPU support
- 4GB+ RAM (estimated)
- 4+ CPU cores
- Desktop/laptop (not mobile)
- WebAssembly support

### 2. Local Engine (`engine.local.js`)

**Purpose**: On-device AI inference using WebLLM

**Model Configuration**:
```javascript
const MODEL_CONFIG = {
  modelUrl: 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/',
  wasmUrl: 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/',
  modelName: 'Llama-3.2-1B-Instruct-q4f16_1',
  maxTokens: 512,
  maxHistory: 10,
  timeoutMs: 10000
};
```

**Features**:
- Streaming token generation
- Conversation history management
- Safety limits (token cap, timeout)
- Graceful error handling

**Model Options**:
- **1B Model**: Fast, 1.5GB download, good for demo
- **3B Model**: Better quality, 3GB download, slower inference
- **7B+ Models**: High quality, large download, requires powerful hardware

### 3. Rule Engine (`engine.rules.js`)

**Purpose**: Intelligent fallback responses for portfolio Q&A

**Intent Detection**:
- Projects/Work: Portfolio showcase
- Resume/CV: Download links
- Skills/Stack: Technical expertise
- Contact: Communication options
- Availability: Hiring information
- About: Personal story
- Location: Geographic info
- Theme: UI customization

**Response Features**:
- Contextual answers
- Action buttons (jump, download, email)
- Natural language processing
- Portfolio-specific content

### 4. Chat UI (`chat.js`)

**Purpose**: User interface and interaction management

**Key Features**:
- Floating chat button
- Slide-up drawer interface
- Message threading
- Typing indicators
- Action button rendering
- Keyboard shortcuts
- Focus management
- Accessibility support

**Keyboard Shortcuts**:
- `⌘/Ctrl+K`: Toggle chat
- `Esc`: Close chat
- `Enter`: Send message
- `Shift+Enter`: New line

**Slash Commands**:
- `/theme dark|light`: Toggle theme
- `/jump <section>`: Navigate to section
- `/download resume`: Download PDF

## Usage Examples

### Basic Interaction

```javascript
// Open chat programmatically
const chatManager = new ChatManager();
chatManager.open();

// Send message
chatManager.sendMessage("Tell me about your projects");
```

### Custom Responses

```javascript
// Add custom rule in engine.rules.js
const customResponses = {
  pricing: {
    text: "I offer competitive rates for design and development work. Contact me for a detailed quote.",
    actions: [
      { type: "email", target: "hello@lukasnilsson.com", label: "Get Quote" }
    ]
  }
};
```

### Model Switching

```javascript
// Switch to larger model in engine.local.js
const MODEL_CONFIG = {
  modelUrl: 'https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC/resolve/main/',
  // ... other config
};
```

## Performance Considerations

### Local Mode
- **Initial Load**: 1.5GB model download
- **Memory Usage**: ~2-3GB RAM during inference
- **Inference Speed**: 10-50 tokens/second
- **Battery Impact**: High on laptops

### Fallback Mode
- **Load Time**: Instant
- **Memory Usage**: <10MB
- **Response Time**: <100ms
- **Battery Impact**: Minimal

### Optimization Strategies
- Lazy initialization (load only when chat opens)
- Model caching via Service Worker
- Timeout protection (10s max)
- Graceful degradation
- Rate limiting (1 message/second)

## Accessibility Features

### WCAG 2.2 AA Compliance
- **Focus Management**: Trapped within chat drawer
- **Screen Readers**: ARIA live regions for responses
- **Keyboard Navigation**: Full keyboard support
- **High Contrast**: Respects system preferences
- **Reduced Motion**: Disables animations when requested

### Implementation
```css
@media (prefers-reduced-motion: reduce) {
  .chat-drawer {
    transition: opacity var(--duration-fast) var(--ease-out);
    transform: none;
  }
}
```

## Security Considerations

### Local Mode
- **No External Calls**: All inference on-device
- **No Data Collection**: Conversations not stored
- **Model Integrity**: Downloaded from trusted CDN
- **Memory Safety**: WebAssembly sandboxing

### Fallback Mode
- **No External Dependencies**: Pure JavaScript
- **Input Sanitization**: XSS protection
- **Rate Limiting**: Prevents abuse
- **Error Handling**: Graceful failures

## Testing

### Manual Testing Checklist

#### Local Mode
- [ ] WebGPU-capable device loads model within 10s
- [ ] Status dot shows green "Running locally"
- [ ] Responses are contextually relevant
- [ ] Streaming works smoothly
- [ ] Memory usage stays reasonable

#### Fallback Mode
- [ ] Non-WebGPU device uses fallback
- [ ] Status dot shows amber "Fast fallback"
- [ ] Intent detection works accurately
- [ ] Action buttons function correctly
- [ ] Responses are helpful and relevant

#### UI/UX
- [ ] Chat opens/closes smoothly
- [ ] Keyboard shortcuts work
- [ ] Focus management correct
- [ ] Mobile responsive
- [ ] Dark/light theme support

#### Accessibility
- [ ] Screen reader announces responses
- [ ] Focus trapped in drawer
- [ ] High contrast mode works
- [ ] Reduced motion respected
- [ ] All interactive elements accessible

### Automated Testing

```javascript
// Example test structure
describe('Chatbot', () => {
  test('detects WebGPU capability', () => {
    expect(supportsWebGPU()).toBeDefined();
  });
  
  test('fallback responses work', () => {
    const response = replyRuleBased('show me projects');
    expect(response.text).toContain('projects');
    expect(response.actions).toBeDefined();
  });
  
  test('slash commands work', () => {
    // Test /theme, /jump, /download commands
  });
});
```

## Troubleshooting

### Common Issues

#### Local Mode Not Loading
- **Cause**: WebGPU not supported
- **Solution**: Automatically falls back to rule engine
- **Debug**: Check `navigator.gpu` in console

#### Model Download Fails
- **Cause**: Network issues or CDN down
- **Solution**: Falls back to rule engine after timeout
- **Debug**: Check network tab for failed requests

#### Slow Inference
- **Cause**: Underpowered device or large model
- **Solution**: Switch to smaller model or disable local mode
- **Debug**: Monitor memory usage and inference time

#### Memory Issues
- **Cause**: Model too large for device
- **Solution**: Use fallback mode or smaller model
- **Debug**: Check `navigator.deviceMemory`

### Debug Mode

Add `?debug=1` to URL for verbose logging:

```javascript
if (new URLSearchParams(window.location.search).get('debug') === '1') {
  console.log('Device info:', getDeviceInfo());
  console.log('WebGPU support:', supportsWebGPU());
  console.log('Local mode disabled:', isLocalModeDisabled());
}
```

## Future Enhancements

### Planned Features
- **Voice Input**: Speech-to-text integration
- **Multi-language**: Internationalization support
- **Custom Models**: User-uploaded model support
- **Analytics**: Usage tracking (privacy-preserving)
- **Plugins**: Extensible response system

### Model Improvements
- **Quantization**: Smaller model sizes
- **Optimization**: Faster inference
- **Specialization**: Portfolio-specific fine-tuning
- **Streaming**: Real-time response generation

## Configuration Reference

### Environment Variables
```javascript
// URL parameters
?nolocal=1          // Disable local mode
?debug=1            // Enable debug logging
?model=3b           // Force specific model size
```

### Customization Points
```javascript
// engine.local.js
const MODEL_CONFIG = {
  modelUrl: '...',     // Model download URL
  wasmUrl: '...',      // WebAssembly files URL
  maxTokens: 512,      // Response length limit
  timeoutMs: 10000,    // Initialization timeout
};

// engine.rules.js
const intents = {
  // Add custom intent patterns
  custom: /your-pattern/,
};
```

## Support

### Browser Compatibility
- **Chrome 100+**: Full support
- **Firefox 100+**: Full support
- **Safari 15+**: Full support
- **Edge 100+**: Full support
- **Mobile**: Fallback mode only

### Performance Targets
- **LCP**: <2.5s (with fallback)
- **FID**: <100ms
- **CLS**: <0.1
- **Bundle Size**: <50KB (excluding model)

### Resources
- [WebLLM Documentation](https://mlc.ai/web-llm/)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [Portfolio Repository](https://github.com/lukas-nilsson/lukas-nilsson.github.io)
