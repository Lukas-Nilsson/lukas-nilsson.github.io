// detector.js - Feature detection for WebGPU and device capabilities

/**
 * Check if WebGPU is supported
 */
export function supportsWebGPU() {
  return 'gpu' in navigator && navigator.gpu !== undefined;
}

/**
 * Check if device is likely capable of running local LLM
 */
export function isLikelyCapableDevice() {
  console.log('🔍 Checking device capabilities...');
  
  // Check for debug mode to force local engine
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('forcelocal') === '1' || urlParams.get('debug') === '1') {
    console.log('🔧 Debug mode: forcing local engine');
    return true;
  }
  
  // For demo purposes, be more permissive - allow most desktop devices
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|blackberry/i.test(userAgent);
  
  if (isMobile) {
    console.log('❌ Mobile device detected, using fallback');
    return false;
  }
  
  // Check for WebAssembly support (required for WebLLM)
  if (typeof WebAssembly === 'undefined') {
    console.log('❌ WebAssembly not supported');
    return false;
  }
  
  // For demo purposes, allow most desktop browsers
  console.log('✅ Desktop device detected, allowing local engine');
  return true;
}

/**
 * Get device capabilities summary
 */
export function getDeviceInfo() {
  return {
    webgpu: supportsWebGPU(),
    deviceMemory: navigator.deviceMemory || 'unknown',
    hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
    userAgent: navigator.userAgent,
    isLikelyCapable: isLikelyCapableDevice()
  };
}

/**
 * Check if local mode should be disabled via URL parameter
 */
export function isLocalModeDisabled() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('nolocal') === '1';
}
