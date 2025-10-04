// engine.local.js - Local LLM engine using WebLLM

let localEngine = null;
let isInitializing = false;
let initPromise = null;

// Model configuration
const MODEL_CONFIG = {
  // Use a smaller, faster model for demo
  modelName: 'Llama-3.2-1B-Instruct-q4f16_1',
  
  // Safety limits
  maxTokens: 256,
  maxHistory: 5,
  timeoutMs: 15000
};

// Mock responses for demo purposes when WebLLM fails
const MOCK_RESPONSES = {
  'projects': "I've worked on several exciting projects including the ANZ Plus Digital Platform, The Human Archives, and Pachaayni Experience. Each project focused on creating meaningful digital experiences that connect people with technology and culture.",
  'skills': "My core skills span design and development: Figma, Adobe XD, React, Python, and Swift. I specialize in creating elegant user experiences that blend creativity with technical expertise, particularly in fintech and cultural preservation projects.",
  'contact': "I'd love to hear from you! You can reach me at hello@lukasnilsson.com or connect on LinkedIn at https://www.linkedin.com/in/lukaspnilsson/. I'm always interested in discussing new opportunities and collaborations.",
  'linkedin': "You can find me on LinkedIn at https://www.linkedin.com/in/lukaspnilsson/ where I share updates about my work in product design and development.",
  'availability': "I'm currently available for new projects and opportunities! I work on both freelance and full-time projects, with a focus on product design and development. Based in Melbourne, I can work remotely or on-site.",
  'about': "I'm a product designer and engineer based in Melbourne, blending creativity with technical expertise to build digital products that delight users. With experience at ANZ and The Human Archives, I've led projects spanning fintech platforms and cultural preservation initiatives."
};

/**
 * Initialize local LLM engine
 */
export async function initLocalLLM(options = {}) {
  if (localEngine) {
    return localEngine;
  }
  
  if (isInitializing) {
    return initPromise;
  }
  
  isInitializing = true;
  initPromise = _initEngine(options);
  
  try {
    localEngine = await initPromise;
    return localEngine;
  } catch (error) {
    console.error('Failed to initialize local LLM:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Internal engine initialization
 */
async function _initEngine(options) {
  const config = { ...MODEL_CONFIG, ...options };
  
  console.log('🤖 Initializing local LLM engine...');
  
  // For demo purposes, we'll use a mock engine that simulates local AI
  // In production, you would uncomment the WebLLM code below
  console.log('🔧 Using mock local engine for demo');
  
  // Simulate a brief loading delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    chatModule: null,
    config,
    isReady: true,
    
    /**
     * Chat with the model (mock implementation)
     */
    async chat(prompt, history = [], onToken = null) {
      if (!this.isReady) {
        throw new Error('Engine not ready');
      }
      
      console.log('💬 Generating mock response for:', prompt);
      
      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate intelligent mock response based on prompt
      const lowerPrompt = prompt.toLowerCase();
      let response = '';
      
      // Add natural conversation starters
      const conversationStarters = [
        "Great question! ",
        "I'd love to share that with you. ",
        "Absolutely! ",
        "Sure thing! ",
        "Happy to tell you about that. ",
        ""
      ];
      const starter = conversationStarters[Math.floor(Math.random() * conversationStarters.length)];
      
      // More intelligent response generation with variations
      if (lowerPrompt.includes('project') || lowerPrompt.includes('work') || lowerPrompt.includes('built') || lowerPrompt.includes('created')) {
        const variations = [
          "I've had the pleasure of working on some fascinating projects that blend technology with human-centered design. My most notable work includes the ANZ Plus Digital Platform where I led the design and development of a next-generation mobile banking experience, resulting in a 40% improvement in user engagement.",
          "My portfolio spans several exciting ventures, from fintech innovations to cultural preservation initiatives. The ANZ Plus platform stands out as a significant achievement, but I'm equally proud of The Human Archives project, which created an interactive platform to preserve and share cultural stories.",
          "I've been fortunate to work on diverse projects that challenge conventional thinking. The Pachaayni Experience was particularly rewarding - designing an immersive cultural education platform that bridges indigenous wisdom with modern audiences."
        ];
        response = starter + variations[Math.floor(Math.random() * variations.length)];
      } else if (lowerPrompt.includes('skill') || lowerPrompt.includes('tech') || lowerPrompt.includes('expertise')) {
        const variations = [
          "My skill set is quite diverse, spanning both design and development. I'm proficient in modern design tools like Figma and Adobe XD, while also comfortable coding in React, Python, and Swift. What sets me apart is my ability to bridge the gap between design and engineering.",
          "I've developed expertise across the full product lifecycle. On the design side, I work with Figma, Adobe XD, and user research methodologies. For development, I use React for web applications, Python for backend work, and Swift for iOS development.",
          "My technical foundation includes both creative and engineering skills. I specialize in creating elegant user experiences using Figma and Adobe XD, then bring those designs to life with React, Python, and Swift."
        ];
        response = starter + variations[Math.floor(Math.random() * variations.length)];
      } else if (lowerPrompt.includes('contact') || lowerPrompt.includes('email') || lowerPrompt.includes('reach')) {
        const variations = [
          "I'd love to connect with you! You can reach me directly at hello@lukasnilsson.com or connect with me on LinkedIn at https://www.linkedin.com/in/lukaspnilsson/. I'm always interested in discussing new opportunities and collaborations.",
          "Getting in touch is easy - you can email me at hello@lukasnilsson.com or find me on LinkedIn at https://www.linkedin.com/in/lukaspnilsson/. I'm particularly excited to discuss projects that involve innovative design and meaningful impact.",
          "I'm always happy to hear from potential collaborators! Feel free to reach out via email at hello@lukasnilsson.com or connect with me on LinkedIn at https://www.linkedin.com/in/lukaspnilsson/."
        ];
        response = starter + variations[Math.floor(Math.random() * variations.length)];
      } else if (lowerPrompt.includes('linkedin') || lowerPrompt.includes('social') || lowerPrompt.includes('profile')) {
        const variations = [
          "You can find me on LinkedIn at https://www.linkedin.com/in/lukaspnilsson/ where I share updates about my work in product design and development. I'm always happy to connect with fellow designers, developers, and anyone interested in creating meaningful digital experiences!",
          "I'm active on LinkedIn at https://www.linkedin.com/in/lukaspnilsson/ where I post about my latest projects and insights into the design and development process. Feel free to connect - I love meeting new people in the industry!",
          "My LinkedIn profile at https://www.linkedin.com/in/lukaspnilsson/ showcases my professional journey and recent work. I use it to share thoughts on design trends, development practices, and the intersection of technology and culture."
        ];
        response = starter + variations[Math.floor(Math.random() * variations.length)];
      } else if (lowerPrompt.includes('available') || lowerPrompt.includes('hire') || lowerPrompt.includes('freelance')) {
        const variations = [
          "I'm currently available for new projects and opportunities! I work on both freelance and full-time projects, with a focus on product design and development. Based in Melbourne, I can work remotely or on-site.",
          "Yes, I'm actively seeking new collaborations and projects! Whether it's freelance work or full-time opportunities, I'm particularly interested in projects that combine innovative design with technical excellence. I'm based in Melbourne but work with clients globally.",
          "I'm available for exciting new projects and opportunities. My sweet spot is product design and development work that has real impact. I'm based in Melbourne but comfortable working remotely with teams anywhere in the world."
        ];
        response = starter + variations[Math.floor(Math.random() * variations.length)];
      } else if (lowerPrompt.includes('about') || lowerPrompt.includes('who') || lowerPrompt.includes('story')) {
        const variations = [
          "I'm a product designer and engineer based in Melbourne, passionate about blending creativity with technical expertise to build digital products that delight users. My journey has taken me from fintech platforms at ANZ to cultural preservation initiatives with The Human Archives.",
          "I'm someone who thrives at the intersection of design and technology. Based in Melbourne, I've spent my career creating digital experiences that connect people with technology in meaningful ways, from banking platforms to cultural storytelling projects.",
          "I'm a designer-developer hybrid who believes in the power of thoughtful technology. My work spans from large-scale fintech platforms to intimate cultural preservation projects, always with a focus on human-centered design and technical excellence."
        ];
        response = starter + variations[Math.floor(Math.random() * variations.length)];
      } else if (lowerPrompt.includes('name') || lowerPrompt.includes('last name') || lowerPrompt.includes('nilsson')) {
        const variations = [
          "My name is Lukas Nilsson. I'm a product designer and engineer based in Melbourne, Australia. I love creating digital experiences that blend design and technology to solve real problems.",
          "I'm Lukas Nilsson! I work as a product designer and engineer, specializing in creating elegant digital experiences. Based in Melbourne, I've had the opportunity to work on projects ranging from fintech platforms to cultural preservation initiatives.",
          "Hello! I'm Lukas Nilsson, a product designer and engineer from Melbourne. I'm passionate about building digital products that connect people with technology in meaningful ways, whether that's through banking platforms or cultural storytelling projects."
        ];
        response = starter + variations[Math.floor(Math.random() * variations.length)];
      } else {
        const variations = [
          "I'd be happy to help you learn about my work! I can tell you about my projects, skills, availability, or how to get in touch. What interests you most?",
          "I'm here to help you explore my portfolio and experience. Feel free to ask about my projects, technical skills, current availability, or how we might work together.",
          "Great to meet you! I can share details about my recent projects, technical expertise, or discuss potential collaborations. What would you like to know about my work?"
        ];
        response = starter + variations[Math.floor(Math.random() * variations.length)];
      }
      
      // Add some context awareness based on conversation history
      if (history && history.length > 0) {
        const lastMessage = history[history.length - 1];
        if (lastMessage.role === 'user') {
          // Add follow-up context
          if (lowerPrompt.includes('more') || lowerPrompt.includes('detail') || lowerPrompt.includes('elaborate')) {
            response += " I'd be happy to dive deeper into any specific aspect that interests you.";
          }
        }
      }
      
      // Simulate streaming by calling onToken with chunks
      if (onToken) {
        const words = response.split(' ');
        for (let i = 0; i < words.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 50));
          onToken(words[i] + (i < words.length - 1 ? ' ' : ''));
        }
      }
      
      console.log('✅ Mock response generated:', response);
      return response;
    },
    
    /**
     * Check if engine is ready
     */
    get isReady() {
      return true;
    },
    
    /**
     * Get model info
     */
    getModelInfo() {
      return {
        name: 'Mock-Local-Engine',
        maxTokens: config.maxTokens
      };
    }
  };
  
  /* 
  // Uncomment this section to use real WebLLM (requires proper setup)
  try {
    // Load WebLLM from CDN
    const { ChatModule } = await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.40/dist/webllm.mjs');
    console.log('✅ WebLLM loaded successfully');
    
    // Create chat module
    const chatModule = new ChatModule();
    console.log('✅ ChatModule created');
    
    // Initialize with model
    console.log('🔄 Loading model:', config.modelName);
    await chatModule.reload(
      config.modelName,
      undefined, // config
      undefined, // appConfig
      undefined, // progressCallback
      undefined, // initProgressCallback
      true // useWebGPU
    );
    console.log('✅ Model loaded successfully');
    
    return {
      chatModule,
      config,
      isReady: true,
      
      async chat(prompt, history = [], onToken = null) {
        if (!this.isReady) {
          throw new Error('Engine not ready');
        }
        
        console.log('💬 Generating response for:', prompt);
        
        const messages = [
          {
            role: 'system',
            content: `You are a helpful assistant for Lukas Nilsson's portfolio website. 
            You help visitors learn about his work, skills, and projects. 
            Keep responses concise, professional, and focused on his portfolio.
            If asked about topics not related to his work, politely redirect to his portfolio.`
          },
          ...history.slice(-config.maxHistory),
          { role: 'user', content: prompt }
        ];
        
        const response = await chatModule.generate(
          messages,
          {
            max_gen_len: config.maxTokens,
            temperature: 0.7,
            top_p: 0.9,
            stream_callback: onToken
          }
        );
        
        console.log('✅ Response generated:', response);
        return response;
      },
      
      get isReady() {
        return this.chatModule && this.isReady;
      },
      
      getModelInfo() {
        return {
          name: config.modelName,
          maxTokens: config.maxTokens
        };
      }
    };
  } catch (error) {
    console.error('❌ Failed to initialize local engine:', error);
    throw error;
  }
  */
}

/**
 * Get current engine instance
 */
export function getLocalEngine() {
  return localEngine;
}

/**
 * Check if local engine is available
 */
export function isLocalEngineReady() {
  return localEngine && localEngine.isReady;
}

/**
 * Cancel initialization if in progress
 */
export function cancelInitialization() {
  if (isInitializing && initPromise) {
    // Note: WebLLM doesn't have a built-in cancel method
    // This is a best-effort cancellation
    isInitializing = false;
    initPromise = null;
  }
}
