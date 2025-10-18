// engine.rules.js - Rule-based fallback engine

/**
 * Rule-based response engine for portfolio Q&A
 */
export function replyRuleBased(input) {
  const text = input.toLowerCase().trim();
  
  // Intent detection patterns
  const intents = {
    projects: /projects?|work|portfolio|case|studies?|examples?|show|what.*built|what.*created/,
    resume: /resume|cv|download|pdf|experience|background|career|history/,
    skills: /skills?|stack|tools?|technologies?|languages?|frameworks?|what.*know|expertise/,
    contact: /contact|email|reach|get.*touch|hire|available|message|talk/,
    linkedin: /linkedin|linked.*in|social|profile|connect/,
    availability: /available|hire|freelance|contract|work.*with|collaborate|pricing|rate|cost/,
    about: /about|who.*are|story|background|person|philosophy|approach/,
    name: /name|last.*name|nilsson|what.*your.*name|who.*are.*you/,
    location: /location|where|timezone|based|live|remote/,
    theme: /theme|dark|light|mode|color|appearance/
  };
  
  // Find matching intent
  const matchedIntent = Object.entries(intents).find(([intent, pattern]) => 
    pattern.test(text)
  );
  
  if (matchedIntent) {
    const [intent] = matchedIntent;
    return getResponseForIntent(intent, text);
  }
  
  // Default response for unrecognized input
  return {
    text: "I'd be happy to help! You can ask me about my projects, skills, availability, or how to get in touch. Try clicking one of the shortcuts below.",
    actions: []
  };
}

/**
 * Get response for specific intent
 */
function getResponseForIntent(intent, originalText) {
  const responses = {
    projects: {
      text: "Here are some of my key projects:\n\n• **ANZ Plus Digital Platform** - Led design and development of next-generation mobile banking platform, improving user engagement by 40%\n\n• **The Human Archives** - Created an interactive platform to preserve and share cultural stories, connecting communities with their heritage\n\n• **Pachaayni Experience** - Designed an immersive cultural education platform that brings indigenous wisdom to modern audiences\n\n• **Design System Library** - Developed a comprehensive design system reducing design-to-dev handoff time by 60%\n\nYou can scroll to the Work section to see more details, or ask about a specific project!",
      actions: [
        { type: "jump", target: "#work", label: "View Work Section" }
      ]
    },
    
    resume: {
      text: "You can download my resume in PDF format. It includes my complete work history, skills, and experience at ANZ, The Human Archives, and other projects.",
      actions: [
        { type: "download", target: "assets/resume.pdf", label: "Download Resume" }
      ]
    },
    
    skills: {
      text: "My core skills include:\n\n**Design:**\n• Figma, Adobe XD, Prototyping, User Research\n\n**Development:**\n• HTML/CSS/JS, React, Python, Swift\n\n**Tools:**\n• Git/GitHub, Jira/Confluence, Analytics, AEM\n\nI specialize in creating elegant digital experiences that blend creativity with technical expertise. I'm particularly passionate about fintech platforms and cultural preservation initiatives.",
      actions: [
        { type: "jump", target: "#about", label: "Learn More About Me" }
      ]
    },
    
    contact: {
      text: "I'd love to hear from you! You can reach me directly at lukasnilssonbusiness@gmail.com or connect with me on LinkedIn at https://www.linkedin.com/in/lukaspnilsson/. I'm always interested in discussing new opportunities, collaborations, or just having a chat about design and technology.",
      actions: [
        { type: "email", target: "lukasnilssonbusiness@gmail.com", label: "Send Email" },
        { type: "link", target: "https://www.linkedin.com/in/lukaspnilsson/", label: "Connect on LinkedIn" },
        { type: "jump", target: "#contact", label: "Contact Form" }
      ]
    },
    
    linkedin: {
      text: "You can find me on LinkedIn at https://www.linkedin.com/in/lukaspnilsson/ where I share updates about my work in product design and development. I'm always happy to connect with fellow designers, developers, and anyone interested in creating meaningful digital experiences!",
      actions: [
        { type: "link", target: "https://www.linkedin.com/in/lukaspnilsson/", label: "Connect on LinkedIn" }
      ]
    },
    
    availability: {
      text: "I'm currently available for new projects and opportunities! I work on both freelance and full-time projects, with a focus on product design and development.\n\nI'm based in Melbourne and can work remotely or on-site. For project inquiries, please reach out via email and I'll get back to you within 24 hours.",
      actions: [
        { type: "email", target: "lukasnilssonbusiness@gmail.com", label: "Discuss Project" },
        { type: "jump", target: "#contact", label: "Contact Form" }
      ]
    },
    
    about: {
      text: "I'm a product designer and engineer based in Melbourne, blending creativity with technical expertise to build digital products that delight users.\n\nWith experience at ANZ and The Human Archives, I've led projects spanning fintech platforms, cultural preservation initiatives, and interactive experiences that connect people with stories.\n\nWhen I'm not designing or coding, you'll find me exploring new cultures, playing soccer, or diving into history books.",
      actions: [
        { type: "jump", target: "#about", label: "Read Full Story" }
      ]
    },
    
    name: {
      text: "My name is Lukas Nilsson! I'm a product designer and engineer based in Melbourne, Australia. I love creating digital experiences that blend design and technology to solve real problems.\n\nYou can call me Lukas, and I'm always excited to chat about design, development, or potential collaborations!",
      actions: [
        { type: "jump", target: "#about", label: "Learn More About Me" }
      ]
    },
    
    location: {
      text: "I'm based in Melbourne, Australia, and work with clients both locally and internationally. I'm comfortable working across different time zones and can accommodate remote collaboration.",
      actions: []
    },
    
    theme: {
      text: "I can help you change the site theme! Use the theme toggle in the header, or try these commands:\n\n• `/theme dark` - Switch to dark mode\n• `/theme light` - Switch to light mode",
      actions: [
        { type: "theme", target: "dark", label: "Dark Mode" },
        { type: "theme", target: "light", label: "Light Mode" }
      ]
    }
  };
  
  return responses[intent] || {
    text: "I'm not sure how to help with that. Try asking about my projects, skills, or how to get in touch!",
    actions: []
  };
}

/**
 * Get quick response for common greetings
 */
export function getGreetingResponse() {
  const greetings = [
    "Hi! I'm here to help you learn about Lukas's work and projects. What would you like to know?",
    "Hello! Ask me about projects, skills, availability, or anything else about Lukas's portfolio.",
    "Hey there! I can tell you about Lukas's work, help you navigate the site, or answer questions about his experience."
  ];
  
  return {
    text: greetings[Math.floor(Math.random() * greetings.length)],
    actions: [
      { type: "jump", target: "#work", label: "View Projects" },
      { type: "jump", target: "#about", label: "About Lukas" },
      { type: "jump", target: "#contact", label: "Get in Touch" }
    ]
  };
}
