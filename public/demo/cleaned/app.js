/**
 * CLEANED Demo — Chat UI Logic
 */

const API_URL = "https://cleaned-demo-backend-hpogfshfba-uc.a.run.app";

async function processSafariBlobs(wrapper) {
    const list = [];
    const imgs = wrapper.querySelectorAll('img[data-raw], img[src^="data:"]');
    for (const img of imgs) {
        try {
            // CRITICAL: Store original dimensions BEFORE swapping src
            const origW = img.naturalWidth;
            const origH = img.naturalHeight;
            img.dataset._origNatW = origW;
            img.dataset._origNatH = origH;

            const w = wrapper.offsetWidth * 1.5 || 800;
            const h = wrapper.offsetHeight * 1.5 || 800;
            const memCanvas = document.createElement("canvas");
            memCanvas.width = w;
            memCanvas.height = h;
            memCanvas.getContext("2d").drawImage(img, 0, 0, w, h);
            
            const safeBase64 = memCanvas.toDataURL("image/jpeg", 0.85);
            
            const miniCanvas = document.createElement("canvas");
            miniCanvas.width = 120;
            miniCanvas.height = 120;
            miniCanvas.getContext("2d").drawImage(memCanvas, 0, 0, 120, 120);
            const miniBase64 = miniCanvas.toDataURL("image/jpeg", 0.3);
            
            const oldSrc = img.src;
            img.dataset._originalFullSrc = oldSrc;
            img.dataset.miniUrl = miniBase64;
            img.src = safeBase64;
            
            list.push({ img, oldSrc });
        } catch(e) { console.error(e); }
    }
    await new Promise(r => setTimeout(r, 60));
    return list;
}
function restoreSafariBlobs(list) {
    for (const item of list) {
        item.img.src = item.oldSrc;
        delete item.img.dataset.miniUrl;
        delete item.img.dataset._originalFullSrc;
        delete item.img.dataset._origNatW;
        delete item.img.dataset._origNatH;
    }
}

async function generateSafeComposite(wrapper, rawImg, isExport = false) {
    console.log(`\n[COMPOSITE] Starting ${isExport ? 'LOSSLESS EXPORT' : 'Internal'} composite...`);
    const startTime = performance.now();
    
    const w = wrapper.offsetWidth;
    const h = wrapper.offsetHeight;
    
    // Retrieve the ORIGINAL full-resolution src (before processSafariBlobs downgraded it), using the clean user upload if possible.
    const originalFullSrc = rawImg ? (rawImg.dataset.cleanUrl || rawImg.dataset._originalFullSrc || rawImg.src) : null;
    
    // Read ORIGINAL natural dimensions (stored before Safari downgrade mutated them)
    const origNatW = rawImg ? (parseInt(rawImg.dataset._origNatW) || rawImg.naturalWidth) : 0;
    const origNatH = rawImg ? (parseInt(rawImg.dataset._origNatH) || rawImg.naturalHeight) : 0;
    
    // For export: match the original image's native resolution
    // Overlay DPR capped at 5 for crisp text (rawImg hidden = mostly transparent = low memory)
    let targetW, targetH, overlayDpr;
    if (isExport && origNatW > 0) {
        targetW = origNatW;
        targetH = origNatH;
        overlayDpr = Math.min(targetW / w, 5);
    } else {
        overlayDpr = 2;
        targetW = Math.round(w * overlayDpr);
        targetH = Math.round(h * overlayDpr);
    }

    console.log(`[COMPOSITE] Layout: ${w}x${h} → Canvas: ${targetW}x${targetH}, Overlay DPR: ${overlayDpr.toFixed(2)}`);
    
    // Step 1: Capture the UI overlay (everything EXCEPT the base image)
    const oldVis = rawImg ? rawImg.style.visibility : "";
    if (rawImg) rawImg.style.visibility = "hidden";
    
    const t0 = performance.now();
    const overlayDataUrl = await htmlToImage.toPng(wrapper, {
        pixelRatio: overlayDpr,
        quality: 1.0,
        skipFonts: true,
        style: { width: w + "px", height: h + "px" }
    });
    console.log(`[COMPOSITE] Overlay captured in ${(performance.now() - t0).toFixed(0)}ms (${(overlayDataUrl.length/1024).toFixed(0)}kb)`);
    
    if (rawImg) rawImg.style.visibility = oldVis;
    if (!rawImg) return overlayDataUrl;

    // Step 2: Build the final canvas at full resolution
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    
    // Step 3: Draw the ORIGINAL full-res base image
    const base = new Image();
    base.crossOrigin = "anonymous";
    const t1 = performance.now();
    await new Promise((resolve) => {
        base.onload = resolve;
        base.onerror = () => resolve();
        base.src = originalFullSrc;
    });
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
    console.log(`[COMPOSITE] Base image (${base.naturalWidth}x${base.naturalHeight}) drawn in ${(performance.now() - t1).toFixed(0)}ms`);
    
    // Step 4: Draw glass panel blur regions directly on canvas
    // CSS backdrop-filter CANNOT be captured by html-to-image (SVG foreignObject has no backdrop).
    // We only simulate the underlying blur. 
    // The panel's background color, borders, and box-shadow are natively captured by html-to-image.
    {
        const scaleX = canvas.width / w;
        const scaleY = canvas.height / h;
        const wrapperRect = wrapper.getBoundingClientRect();
        const panels = wrapper.querySelectorAll('.ai-panel');
        
        panels.forEach(panel => {
            const pRect = panel.getBoundingClientRect();
            const px = (pRect.left - wrapperRect.left) * scaleX;
            const py = (pRect.top - wrapperRect.top) * scaleY;
            const pw = pRect.width * scaleX;
            const ph = pRect.height * scaleY;
            // Match CSS: border-radius: 12px (scaled to canvas resolution)
            const borderRadius = 12 * scaleX;
            // Scale blur to canvas pixels (28 CSS px → 28 * scaleX canvas px)
            const blurRadius = Math.round(28 * scaleX);
            
            if (pw <= 0 || ph <= 0) return;
            
            // Helper: draw rounded rect path
            function roundedRectPath(x, y, rw, rh, r) {
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.lineTo(x + rw - r, y);
                ctx.quadraticCurveTo(x + rw, y, x + rw, y + r);
                ctx.lineTo(x + rw, y + rh - r);
                ctx.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh);
                ctx.lineTo(x + r, y + rh);
                ctx.quadraticCurveTo(x, y + rh, x, y + rh - r);
                ctx.lineTo(x, y + r);
                ctx.quadraticCurveTo(x, y, x + r, y);
                ctx.closePath();
            }
            
            // ONLY draw the blurred base image under the panel
            // html-to-image handles the panel's tint, borders, and shadow.
            ctx.save();
            roundedRectPath(px, py, pw, ph, borderRadius);
            ctx.clip();
            
            ctx.filter = `blur(${blurRadius}px)`;
            ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
            ctx.filter = "none";
            
            ctx.restore();
            
            console.log(`[COMPOSITE] Glass panel blur at (${px.toFixed(0)},${py.toFixed(0)}) ${pw.toFixed(0)}x${ph.toFixed(0)}, blur=${blurRadius}px`);
        });
    }
    
    // Step 5: Composite the overlay on top (text, polygons, icons)
    const overlay = new Image();
    const t2 = performance.now();
    await new Promise((resolve) => {
        overlay.onload = resolve;
        overlay.onerror = () => resolve();
        overlay.src = overlayDataUrl;
    });
    ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);
    console.log(`[COMPOSITE] Overlay composited in ${(performance.now() - t2).toFixed(0)}ms`);
    
    // Step 6: Output
    const t3 = performance.now();
    if (isExport) {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                const finalUrl = URL.createObjectURL(blob);
                console.log(`[COMPOSITE] PNG blob: ${(blob.size/1024/1024).toFixed(2)}MB in ${(performance.now() - t3).toFixed(0)}ms. Total: ${(performance.now() - startTime).toFixed(0)}ms`);
                resolve(finalUrl);
            }, "image/png");
        });
    } else {
        const finalJpeg = canvas.toDataURL("image/jpeg", 0.92);
        console.log(`[COMPOSITE] JPEG: ${(finalJpeg.length/1024/1024).toFixed(2)}MB in ${(performance.now() - t3).toFixed(0)}ms. Total: ${(performance.now() - startTime).toFixed(0)}ms`);
        return finalJpeg;
    }
}


// DOM elements
const chat = document.getElementById("chat");
const fileInput = document.getElementById("fileInput");
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");
const attachBtn = document.getElementById("attachBtn");
const previewBar = document.getElementById("previewBar");
const previewImage = document.getElementById("previewImage");
const previewRemove = document.getElementById("previewRemove");
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = document.getElementById("lightboxClose");
const appEl = document.querySelector(".app");
const inputArea = document.getElementById("inputArea");

// ===========================
// Mobile Keyboard Handling
// ===========================

// Set exact height immediately to prevent any initial scroll
if (appEl) {
    appEl.style.height = window.innerHeight + "px";
}

if (window.visualViewport) {
    const vv = window.visualViewport;
    function adjustForKeyboard() {
        if (appEl) {
            appEl.style.height = vv.height + "px";
        }
    }
    vv.addEventListener("resize", adjustForKeyboard);
    vv.addEventListener("scroll", adjustForKeyboard);
} else {
    // Fallback for browsers without visualViewport
    window.addEventListener("resize", () => {
        if (appEl) appEl.style.height = window.innerHeight + "px";
    });
}

// Scroll chat to bottom when input is focused (mobile keyboard pushes content)
if (textInput) {
    textInput.addEventListener("focus", () => {
        setTimeout(() => {
            chat.scrollTop = chat.scrollHeight;
        }, 300);
    });
}

let selectedFile = null;
let globalActiveImageFile = null;
// Global pointer for edit syncing
window._lastImageWrapper = null;
let globalPreviousAnalysisData = null;
let globalUndoStack = [];
window.approvedPhotos = [];

window.updateCartUI = function() {
    const cartBtn = document.getElementById("cartBtn");
    const cartCount = document.getElementById("cartCount");
    if (cartBtn && cartCount) {
        cartCount.textContent = window.approvedPhotos.length;
        if (window.approvedPhotos.length > 0) {
            cartBtn.style.display = "flex";
        } else {
            cartBtn.style.display = "none";
        }
    }
};

window.buildTextSummary = function(data) {
    if (!data) return "";
    let html = '';
    const locName = data.location_name ? data.location_name.toUpperCase() : "INSPECTION AREA";
    html += `<div style="margin-bottom: 12px; line-height: 1.3;"><strong style="color: var(--text-primary); letter-spacing: 0.5px;">225 GEORGE ST</strong><br>`;
    html += `<span style="opacity: 0.6; font-size: 11px; font-weight: 500; letter-spacing: 0.5px;">${locName}</span></div>`;
    
    const FALLBACK_COLORS = [
        [255, 90, 40], [100, 160, 255], [255, 200, 60], [200, 100, 255], [255, 100, 130],
    ];
    
    if (data.issues && data.issues.length > 0) {
        data.issues.forEach((issue, idx) => {
            const rgb = issue.frontend_color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
            const solid = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`;
            html += `<div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: flex-start; line-height: 1.4;">
                <span style="background: ${solid}; color: white; width: 17px; height: 17px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 10px; font-weight: 800; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.3); margin-top: 1px;">${idx + 1}</span>
                <span style="color: rgba(255,255,255,0.95); font-size: 13px;">${escapeHtml(issue.description || "Issue identified")}</span>
            </div>`;
        });
    }
    
    if (data.praise && data.praise.length > 0) {
        data.praise.forEach((pr) => {
            const solid = `rgba(40, 200, 100, 0.9)`;
            html += `<div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: flex-start; line-height: 1.4;">
                <span style="background: ${solid}; color: white; width: 17px; height: 17px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 11px; font-weight: 800; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.3); margin-top: 1px;">✓</span>
                <span style="color: rgba(255,255,255,0.95); font-size: 13px;">${escapeHtml(pr.description || "Positive point identified")}</span>
            </div>`;
        });
    }
    
    return html;
};

// ===========================
// File Selection
// ===========================

// Supported image extensions (covers all common phone formats)
const IMAGE_EXTENSIONS = [
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif",
    ".heic", ".heif", ".avif", ".dng", ".svg"
];

function isImageFile(file) {
    if (file.type.startsWith("image/")) return true;
    // Fallback: check extension (HEIC on some browsers reports empty MIME)
    const ext = "." + file.name.split(".").pop().toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
}

function canPreviewInBrowser(file) {
    // Browsers can natively display these
    const ext = "." + file.name.split(".").pop().toLowerCase();
    return [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".avif"].includes(ext);
}

fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file && isImageFile(file)) {
        selectedFile = file;
        showPreview(file);
        updateSendState();
    }
});

previewRemove.addEventListener("click", () => {
    clearFile();
});

function showPreview(file) {
    if (canPreviewInBrowser(file)) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            previewBar.classList.add("visible");
            attachBtn.classList.add("has-file");
        };
        reader.readAsDataURL(file);
    } else {
        // Show a file badge for formats browsers can't render (HEIC, TIFF, DNG)
        previewImage.src = "";
        previewImage.alt = file.name;
        previewImage.style.display = "none";
        previewBar.classList.add("visible");
        attachBtn.classList.add("has-file");
        // Inject a text badge into the preview item
        const badge = document.createElement("div");
        badge.className = "preview-badge";
        badge.textContent = `📎 ${file.name}`;
        badge.style.cssText = "padding: 6px 10px; font-size: 12px; color: white; background: rgba(255,255,255,0.1); border-radius: 6px; white-space: nowrap;";
        const previewItem = document.getElementById("previewItem");
        previewItem.insertBefore(badge, previewItem.firstChild);
    }
}

function clearFile() {
    selectedFile = null;
    fileInput.value = "";
    previewBar.classList.remove("visible");
    attachBtn.classList.remove("has-file");
    previewImage.src = "";
    previewImage.style.display = "";
    // Remove any file badge we inserted
    const badge = document.querySelector(".preview-badge");
    if (badge) badge.remove();
    updateSendState();
}

// ===========================
// Drag & Drop
// ===========================

let dragCounter = 0;

appEl.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragCounter++;
    appEl.classList.add("drag-over");
});

appEl.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) appEl.classList.remove("drag-over");
});

appEl.addEventListener("dragover", (e) => {
    e.preventDefault();
});

appEl.addEventListener("drop", (e) => {
    e.preventDefault();
    dragCounter = 0;
    appEl.classList.remove("drag-over");
    
    const file = e.dataTransfer.files[0];
    if (file && isImageFile(file)) {
        selectedFile = file;
        showPreview(file);
        updateSendState();
        textInput.focus();
    }
});

// ===========================
// Send State
// ===========================

function updateSendState() {
    const hasText = textInput.value.trim().length > 0;
    const hasFile = selectedFile !== null;
    const hasContext = globalActiveImageFile !== null;
    sendBtn.disabled = !(hasText && (hasFile || hasContext));
}

textInput.addEventListener("input", updateSendState);

textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !sendBtn.disabled) {
        e.preventDefault();
        send();
    }
});

sendBtn.addEventListener("click", () => {
    if (!sendBtn.disabled) send();
});

// ===========================
// Dictation (Voice Input)
// ===========================

const dictateBtn = document.getElementById("dictateBtn");
let recognition = null;
let isRecording = false;

if (dictateBtn && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false; 
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onstart = function() {
        isRecording = true;
        if (dictateBtn) dictateBtn.classList.add("recording");
        finalTranscript = textInput.value;
        if (finalTranscript.length > 0 && !finalTranscript.endsWith(' ')) {
            finalTranscript += ' ';
        }
    };

    recognition.onresult = function(event) {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        textInput.value = finalTranscript + interimTranscript;
        updateSendState();
    };

    recognition.onerror = function(event) {
        console.error("Speech recognition error:", event.error);
        stopDictation();
    };

    recognition.onend = function() {
        stopDictation();
    };

    dictateBtn.addEventListener("click", () => {
        if (isRecording) {
            recognition.stop();
        } else {
            try {
                recognition.start();
            } catch (err) {
                console.error("Failed to start SpeechRecognition", err);
            }
        }
    });
} else if (dictateBtn) {
    dictateBtn.style.display = "none";
}

function stopDictation() {
    isRecording = false;
    if (dictateBtn) dictateBtn.classList.remove("recording");
    updateSendState();
}

// ===========================
// Send Message
// ===========================

async function send() {
    const text = textInput.value.trim();
    
    // Use selectedfile, or fallback to active context image
    const isNewFile = selectedFile !== null;
    
    if (!text || (!selectedFile && !globalActiveImageFile)) return;
    
    if (isNewFile) {
        globalActiveImageFile = selectedFile;
        globalPreviousAnalysisData = null; // Reset context on new upload
    }
       // Add user message (defer showing raw file if it's HEIC, the server will process it)
    addUserMessage(text, isNewFile ? globalActiveImageFile : null);
    
    // Clear input
    textInput.value = "";
    clearFile();
    updateSendState();
    
    // Show processing state
    const processingEl = addProcessingMessage();
    
    try {
        const formData = new FormData();
        formData.append("image", globalActiveImageFile);
        formData.append("description", text);
        if (globalPreviousAnalysisData) {
            formData.append("previous_analysis", JSON.stringify(globalPreviousAnalysisData));
        }
        
        const response = await fetch(`${API_URL}/api/process`, {
            method: "POST",
            body: formData,
        });
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || `Server error (${response.status})`);
        }
        
        const data = await response.json();
        
        // Remove processing indicator
        processingEl.remove();

        if (data.is_inspection_complete) {
            compileAndDownloadReport();
            return;
        }
        
        // Add AI response
        addAIResponse(data);
        
    } catch (err) {
        processingEl.remove();
        addErrorMessage(err.message);
    }
}

// ===========================
// Message Rendering
// ===========================

function addUserMessage(text, file) {
    const msg = document.createElement("div");
    msg.className = "message user";
    
    if (file) {
        // Append msg to chat immediately with placeholder text
        msg.innerHTML = `
            <div class="message-avatar">LN</div>
            <div class="message-content">
                <p>${escapeHtml(text)}</p>
            </div>
        `;
        chat.appendChild(msg);
        scrollToBottom();

        // Then async-load the image preview into the message
        const reader = new FileReader();
        reader.onload = (e) => {
            const isHeic = file.name.toLowerCase().endsWith(".heic");
            const imgContent = isHeic 
                ? `<div style="padding: 8px 12px; background: rgba(255,255,255,0.1); border-radius: 6px; font-size: 13px; margin-bottom: 8px;">📎 ${file.name}</div>`
                : `<img src="${e.target.result}" alt="Inspection photo" onclick="openLightbox(this.src)">`;

            msg.innerHTML = `
                <div class="message-avatar">LN</div>
                <div class="message-content">
                    ${imgContent}
                    <p>${escapeHtml(text)}</p>
                </div>
            `;
            scrollToBottom();
        };
        reader.readAsDataURL(file);
    } else {
        // No new file attached, simple text block
        msg.innerHTML = `
            <div class="message-avatar">LN</div>
            <div class="message-content">
                <p>${escapeHtml(text)}</p>
            </div>
        `;
        chat.appendChild(msg);
        scrollToBottom();
    }
}

function addProcessingMessage() {
    const msg = document.createElement("div");
    msg.className = "message ai";
    msg.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-content">
            <div class="processing">
                <div class="processing-dots">
                    <span></span><span></span><span></span>
                </div>
                Processing photo...
            </div>
        </div>
    `;
    chat.appendChild(msg);
    scrollToBottom();
    return msg;
}

function addAIResponse(data) {
    const msg = document.createElement("div");
    msg.className = "message ai";
    
    // Fallback: server raw -> server annotated
    let imgSrc = `data:image/png;base64,${data.annotated_image}`;
    let rawSrc = data.raw_image ? `data:image/png;base64,${data.raw_image}` : imgSrc;
    
    // Best case: The actual file uploaded by the user, totally uncompressed and untouched.
    // This absolutely guarantees zero OpenCV lines/polygons baked into the base image.
    let cleanSrc = rawSrc;
    if (window.globalActiveImageFile && window.globalActiveImageFile.type && window.globalActiveImageFile.type.startsWith("image/")) {
        try {
            cleanSrc = URL.createObjectURL(window.globalActiveImageFile);
        } catch (e) { console.warn(e); }
    }
    
    const confidence = data.confidence || 0;
    const confLabel = confidence >= 0.8 ? "high" : confidence >= 0.5 ? "medium" : "low";
    const confText = `${Math.round(confidence * 100)}% confidence`;
    
    // Store active memory reference for next turn + manual edits
    globalPreviousAnalysisData = {
        issues: data.issues,
        exclusions: data.exclusions,
        praise: data.praise,
        location_name: data.location_name,
        location_specified: data.location_specified
    };

    msg.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span>✅ Annotated:</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button class="undo-btn" onclick="window.undoRemove()" style="display: none; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: none; background: rgba(50, 150, 255, 0.2); color: #60a5fa; cursor: pointer;">↩️ Undo</button>
                    <button class="expand-btn" onclick="window.openStandardEditorModal(globalPreviousAnalysisData, this.closest('.message-content').querySelector('img').src)" style="font-size: 11px; padding: 4px 8px; border-radius: 4px; border: none; background: rgba(255,255,255,0.1); color: white; cursor: pointer; display: flex; align-items: center; gap: 4px;">⛶ Edit</button>
                    <button class="toggle-btn" onclick="toggleAnnotation(this)" style="font-size: 11px; padding: 4px 8px; border-radius: 4px; border: none; background: rgba(255,255,255,0.1); color: white; cursor: pointer;">👁️ Hide</button>
                    <button class="export-btn" onclick="exportMergedImage(this)" style="font-size: 11px; padding: 4px 8px; border-radius: 4px; border: none; background: rgba(255,255,255,0.1); color: white; cursor: pointer;">⬇️ Export</button>
                </div>
            </div>
            <div class="image-wrapper" style="position: relative; display: inline-block; width: 100%; border-radius: 8px; overflow: hidden; line-height: 0;">
                <img src="${cleanSrc}" data-annotated="${rawSrc}" data-raw="${rawSrc}" data-clean-url="${cleanSrc}" data-is-clean="false" alt="Annotated inspection photo" style="width: 100%; height: auto; display: block;" crossorigin="anonymous">
            </div>
            <div class="dynamic-message-text" style="margin-top: 12px; background: rgba(0,0,0,0.15); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">${window.buildTextSummary(data)}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
                <span class="confidence-badge ${confLabel}" style="margin-top: 0;">${confText}</span>
                <button class="approve-btn" onclick="approveAndProceed(this)" style="background: var(--success); color: white; border: none; border-radius: 6px; padding: 6px 12px; font-weight: 600; font-size: 12px; cursor: pointer; transition: transform 0.1s;">✅ Approve</button>
            </div>
        </div>
    `;
    
    chat.appendChild(msg);
    
    // Attach interactive SVG editor layer AFTER image dimensions are finalized
    const wrapper = msg.querySelector(".image-wrapper");
    const img = wrapper.querySelector("img");
    
    const initImageLayer = () => {
        if (window.buildInteractiveSVG && data.issues) {
            window.buildInteractiveSVG(wrapper, globalPreviousAnalysisData, false);
        }
        
        const textContainer = document.querySelector('.message.ai:last-child .dynamic-message-text');
        if (textContainer) {
            textContainer.innerHTML = window.buildTextSummary(globalPreviousAnalysisData);
        }
        
        scrollToBottom();
    };

    if (img.complete) {
        initImageLayer();
    } else {
        img.addEventListener('load', initImageLayer);
    }
}

// ===========================
// Fast Re-Render & Undo
// ===========================

window.globalUndoStack = window.globalUndoStack || [];

window.removeIssue = function(issueIdx) {
    if (!globalPreviousAnalysisData || !globalActiveImageFile) return;

    window.globalUndoStack.push(JSON.parse(JSON.stringify(globalPreviousAnalysisData)));
    globalPreviousAnalysisData.issues.splice(issueIdx, 1);
    
    const wrapper = window._lastImageWrapper || document.querySelector('.message.ai:last-child .image-wrapper');
    if (wrapper && window.buildInteractiveSVG) {
        window.buildInteractiveSVG(wrapper, globalPreviousAnalysisData, false);
    }
    
    const undoBtn = document.querySelector('.message.ai:last-child .undo-btn');
    if (undoBtn) undoBtn.style.display = "inline-block";
};

window.removePraise = function(praiseIdx) {
    if (!globalPreviousAnalysisData || !globalActiveImageFile) return;

    window.globalUndoStack.push(JSON.parse(JSON.stringify(globalPreviousAnalysisData)));
    globalPreviousAnalysisData.praise.splice(praiseIdx, 1);
    
    const wrapper = window._lastImageWrapper || document.querySelector('.message.ai:last-child .image-wrapper');
    if (wrapper && window.buildInteractiveSVG) {
        window.buildInteractiveSVG(wrapper, globalPreviousAnalysisData, false);
    }
    
    const undoBtn = document.querySelector('.message.ai:last-child .undo-btn');
    if (undoBtn) undoBtn.style.display = "inline-block";
};

window.undoRemove = function() {
    if (window.globalUndoStack.length === 0) return;
    globalPreviousAnalysisData = window.globalUndoStack.pop();
    
    const wrapper = window._lastImageWrapper || document.querySelector('.message.ai:last-child .image-wrapper');
    if (wrapper && window.buildInteractiveSVG) {
        window.buildInteractiveSVG(wrapper, globalPreviousAnalysisData, false);
    }
    
    const undoBtn = document.querySelector('.message.ai:last-child .undo-btn');
    if (undoBtn && window.globalUndoStack.length === 0) {
        undoBtn.style.display = "none";
    }
};

// ===========================
// Toggles & Interactivity
// ===========================

window.toggleAnnotation = function(btn) {
    const wrapper = btn.closest(".message-content").querySelector(".image-wrapper");
    if (!wrapper) return;
    
    if (wrapper.classList.contains("hide-ui")) {
        wrapper.classList.remove("hide-ui");
        btn.textContent = "👁️ Hide UI";
    } else {
        wrapper.classList.add("hide-ui");
        btn.textContent = "👁️ Show UI";
    }
};

window.exportMergedImage = async function(btn) {
    const wrapper = btn.closest(".message-content").querySelector(".image-wrapper");
    if (!window.htmlToImage) {
        addErrorMessage("html-to-image library is not loaded. Ensure you have an internet connection to fetch the CDN.");
        return;
    }

    try {
        const ogBtnText = btn.innerHTML;
        btn.innerHTML = "⏳ Exporting...";
        btn.disabled = true;

        // Hide UI handles
        const handles = wrapper.querySelector(".warp-handles");
        if (handles) handles.style.display = "none";
        const expandBtn = wrapper.querySelector(".expand-inline-btn");
        if (expandBtn) expandBtn.style.display = "none";
        const allResizers = wrapper.querySelectorAll('.custom-resizer, [style*="nwse-resize"], [style*="nesw-resize"]');
        allResizers.forEach(r => r.style.display = "none");

        // FREEZE COMPUTED STYLES for html-to-image compatibility
        const locks = [];
        const freezeElements = wrapper.querySelectorAll('.ai-panel, .ai-panel *, svg, svg circle');
        freezeElements.forEach(el => {
            const comp = window.getComputedStyle(el);
            locks.push({ el, css: el.style.cssText });
            if (el.tagName !== "svg" && el.tagName !== "SVG" && el.tagName !== "path") {
                el.style.fontSize = comp.fontSize;
                el.style.padding = comp.padding;
                el.style.width = comp.width;
                el.style.height = comp.height;
                el.style.borderRadius = comp.borderRadius;
                el.style.gap = comp.gap;
            }
        });

        // Ensure Wrapper aspect matches bounding exact.
        const preWrapCSS = wrapper.style.cssText;
        wrapper.style.width = wrapper.offsetWidth + "px";
        wrapper.style.height = wrapper.offsetHeight + "px";

        // Safari webkit workaround for base64 image rendering
        const mainPanel = wrapper.querySelector('.ai-panel');
        const rawImg = wrapper.querySelector('img[data-raw]');
        let safariBlobs = await processSafariBlobs(wrapper);
        
        // Disable uncapturable CSS effects for the overlay capture.
        // We KEEP the background color so text remains legible.
        // The canvas in generateSafeComposite handles the actual blur behind it.
        let oldPanelStyles = null;
        if (mainPanel) {
            oldPanelStyles = {
                backdropFilter: mainPanel.style.backdropFilter,
                webkitBackdropFilter: mainPanel.style.webkitBackdropFilter
            };
            mainPanel.style.backdropFilter = "none";
            mainPanel.style.webkitBackdropFilter = "none";
        }

        let dataUrl;
        try {
            dataUrl = await generateSafeComposite(wrapper, rawImg, true);
        } catch (memError) {
            console.warn("High-res export failed, attempting internal resolution fallback...", memError);
            dataUrl = await generateSafeComposite(wrapper, rawImg, false);
        }
        
        // RESTORE
        if (typeof safariBlobs !== 'undefined') restoreSafariBlobs(safariBlobs);
        wrapper.style.cssText = preWrapCSS;
        locks.forEach(lock => lock.el.style.cssText = lock.css);
        if (mainPanel && oldPanelStyles) {
            mainPanel.style.backdropFilter = oldPanelStyles.backdropFilter;
            mainPanel.style.webkitBackdropFilter = oldPanelStyles.webkitBackdropFilter;
        }

        const link = document.createElement("a");
        link.download = `cleaned_report_${Date.now()}.png`;
        link.href = dataUrl;
        link.click();

        btn.innerHTML = ogBtnText;
        btn.disabled = false;
        if (handles) handles.style.display = "";
        if (expandBtn) expandBtn.style.display = "";
        allResizers.forEach(r => r.style.display = "");
    } catch (e) {
        console.error("Export failed:", e);
        addErrorMessage("Failed to export image. Check console for details.");
        btn.innerHTML = "⬇️ Export";
        btn.disabled = false;
    }
};

window.approveAndProceed = async function(btn) {
    const aiMessageDiv = btn.closest(".message.ai");
    const wrapper = aiMessageDiv.querySelector(".image-wrapper");
    if (!window.htmlToImage) {
        addErrorMessage("html-to-image library is not loaded.");
        return;
    }

    try {
        const ogBtnText = btn.innerHTML;
        btn.innerHTML = "⏳ Saving...";
        btn.disabled = true;

        // Hide UI handles
        const handles = wrapper.querySelector(".warp-handles");
        if (handles) handles.style.display = "none";
        const expandBtn = wrapper.querySelector(".expand-inline-btn");
        if (expandBtn) expandBtn.style.display = "none";
        const allResizers = wrapper.querySelectorAll('.custom-resizer, [style*="nwse-resize"], [style*="nesw-resize"]');
        allResizers.forEach(r => r.style.display = "none");

        const locks = [];
        const freezeElements = wrapper.querySelectorAll('.ai-panel, .ai-panel *, svg, svg circle');
        freezeElements.forEach(el => {
            const comp = window.getComputedStyle(el);
            locks.push({ el, css: el.style.cssText });
            if (el.tagName !== "svg" && el.tagName !== "SVG" && el.tagName !== "path") {
                el.style.fontSize = comp.fontSize;
                el.style.padding = comp.padding;
                el.style.width = comp.width;
                el.style.height = comp.height;
                el.style.borderRadius = comp.borderRadius;
                el.style.gap = comp.gap;
            }
        });

        const preWrapCSS = wrapper.style.cssText;
        wrapper.style.width = wrapper.offsetWidth + "px";
        wrapper.style.height = wrapper.offsetHeight + "px";

        const mainPanel = wrapper.querySelector('.ai-panel');
        const rawImg = wrapper.querySelector('img[data-raw]') || wrapper.querySelector('img');
        let safariBlobs = await processSafariBlobs(wrapper);
        
        let oldPanelStyles = null;
        if (mainPanel) {
            oldPanelStyles = {
                backdropFilter: mainPanel.style.backdropFilter,
                webkitBackdropFilter: mainPanel.style.webkitBackdropFilter
            };
            mainPanel.style.backdropFilter = "none";
            mainPanel.style.webkitBackdropFilter = "none";
        }

        let dataUrl = await generateSafeComposite(wrapper, rawImg, false);

        // RESTORE
        if (typeof safariBlobs !== 'undefined') restoreSafariBlobs(safariBlobs);
        wrapper.style.cssText = preWrapCSS;
        locks.forEach(lock => lock.el.style.cssText = lock.css);
        if (mainPanel && oldPanelStyles) {
            mainPanel.style.backdropFilter = oldPanelStyles.backdropFilter;
            mainPanel.style.webkitBackdropFilter = oldPanelStyles.webkitBackdropFilter;
        }
        if (handles) handles.style.display = "";
        if (expandBtn) expandBtn.style.display = "";
        allResizers.forEach(r => r.style.display = "");

        // Extract raw image string
        const rawImgSrc = rawImg ? rawImg.src : null;
        
        // Extract notes
        const notes = [];
        if (globalPreviousAnalysisData && globalPreviousAnalysisData.issues) {
            globalPreviousAnalysisData.issues.forEach(iss => notes.push("- Issue: " + iss.description));
        }
        if (globalPreviousAnalysisData && globalPreviousAnalysisData.praise) {
            globalPreviousAnalysisData.praise.forEach(pr => notes.push("- Praise: " + pr.description));
        }
        
        const locName = (globalPreviousAnalysisData && globalPreviousAnalysisData.location_name) 
            ? globalPreviousAnalysisData.location_name 
            : "";
        const locSpecified = (globalPreviousAnalysisData && globalPreviousAnalysisData.location_specified) || false;

        // Save
        window.approvedPhotos.push({
            annotated_image: dataUrl,
            raw_image: rawImgSrc,
            location_name: locName,
            location_specified: locSpecified,
            notes: notes.join("\n")
        });
        window.updateCartUI();

        btn.innerHTML = "✅ Approved";
        btn.style.background = "var(--bg-tertiary)";
        btn.style.color = "var(--text-secondary)";
        btn.disabled = true;

        // 1. Post a user message indicating approval
        const userMsg = document.createElement("div");
        userMsg.className = "message user";
        userMsg.innerHTML = `
            <div class="message-avatar">LN</div>
            <div class="message-content">
                <p>Approve.</p>
            </div>
        `;
        chat.appendChild(userMsg);
        scrollToBottom();

        // 2. Post the AI response
        setTimeout(() => {
            const aiReply = document.createElement("div");
            aiReply.className = "message ai";
            aiReply.innerHTML = `
                <div class="message-avatar">AI</div>
                <div class="message-content">
                    <p style="margin-bottom: 8px;">Observation logged. Proceed to the next area.</p>
                    <div style="font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; margin-top: 4px;">
                        <span>Or finalize the report:</span>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
                            <button onclick="window.shareReportZip(this)" style="background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 4px; padding: 4px 10px; cursor: pointer; transition: 0.1s; display: flex; align-items: center; gap: 4px;">📤 Share Sheet</button>
                            <button onclick="window.compileAndDownloadEmail(this)" style="background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 4px; padding: 4px 10px; cursor: pointer; transition: 0.1s; display: flex; align-items: center; gap: 4px;">📧 .EML Draft</button>
                            <button onclick="window.compileAndDownloadReport(this)" style="background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 4px; padding: 4px 10px; cursor: pointer; transition: 0.1s; display: flex; align-items: center; gap: 4px;">📦 Zip</button>
                        </div>
                    </div>
                </div>
            `;
            chat.appendChild(aiReply);
            scrollToBottom();
        }, 600);

    } catch (e) {
        console.error("Approve failed:", e);
        addErrorMessage("Failed to approve image. Check console for details.");
        btn.innerHTML = "✅ Approve";
        btn.disabled = false;
    }
};

function addErrorMessage(errorText) {
    const msg = document.createElement("div");
    msg.className = "message ai";
    msg.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-content">
            <p>❌ ${escapeHtml(errorText)}</p>
            <p>Please try again later or check your network connection.</p>
        </div>
    `;
    chat.appendChild(msg);
    scrollToBottom();
}

// ===========================
// Lightbox
// ===========================

function openLightbox(src) {
    lightboxImage.src = src;
    lightbox.classList.add("visible");
}

lightboxClose.addEventListener("click", () => {
    lightbox.classList.remove("visible");
});

lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) lightbox.classList.remove("visible");
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox.classList.contains("visible")) {
        lightbox.classList.remove("visible");
    }
});

// ===========================
// Expanded Editor Modal
// ===========================

const editorModal = document.getElementById("editorModal");
const editorClose = document.getElementById("editorClose");
const editorContent = document.getElementById("editorContent");

window.openStandardEditorModal = function(data, imgSrc) {
    editorContent.innerHTML = "";
    
    const wrapper = document.createElement("div");
    wrapper.className = "image-wrapper";
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-block";
    
    const img = document.createElement("img");
    img.src = imgSrc;
    img.style.maxWidth = "100%";
    img.style.maxHeight = "calc(100svh - 90px)";
    img.style.display = "block";
    img.style.margin = "0 auto";
    
    wrapper.appendChild(img);
    editorContent.appendChild(wrapper);
    
    // Pass true for isEditable
    if (window.buildInteractiveSVG && data) {
        if (img.complete) {
            window.buildInteractiveSVG(wrapper, data, true);
        } else {
            img.onload = () => window.buildInteractiveSVG(wrapper, data, true);
        }
    }
    
    if (editorModal) editorModal.classList.add("visible");
};

if (editorClose) {
    editorClose.addEventListener("click", () => {
        editorModal.classList.remove("visible");
        
        // Auto-sync: re-render the inline SVG in the chat.
        const lastWrapper = document.querySelector('.message.ai:last-child .image-wrapper');
        const img = lastWrapper ? lastWrapper.querySelector('img') : null;
        if (lastWrapper && img && globalPreviousAnalysisData && window.buildInteractiveSVG) {
            const dataRaw = img.getAttribute('data-raw') || img.src;
            // Unmount old interactive SVG logic entirely
            lastWrapper.innerHTML = `<img src="${img.src}" data-raw="${dataRaw}" style="width: 100%; height: auto; display: block;" crossorigin="anonymous">`;
            window.buildInteractiveSVG(lastWrapper, globalPreviousAnalysisData, false);
        }
        
        const textContainer = document.querySelector('.message.ai:last-child .dynamic-message-text');
        if (textContainer && globalPreviousAnalysisData) {
            textContainer.innerHTML = window.buildTextSummary(globalPreviousAnalysisData);
        }
    });
}


// ===========================
// Utilities
// ===========================

function scrollToBottom() {
    requestAnimationFrame(() => {
        chat.scrollTop = chat.scrollHeight;
    });
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ===========================
// Mobile Viewport Handling
// ===========================

if (window.visualViewport) {
    const handleViewportChange = () => {
        // Adjust the app to fit inside the visible area when the mobile keyboard is open
        document.body.style.height = `${window.visualViewport.height}px`;
        appEl.style.height = `${window.visualViewport.height}px`;
        // Scroll to bottom whenever keyboard pops so we can still see input
        setTimeout(scrollToBottom, 50);
    };
    window.visualViewport.addEventListener("resize", handleViewportChange);
    // Initial setup
    handleViewportChange();
}

// Ensure tapping outside inputs drops keyboard
document.addEventListener('pointerdown', (e) => {
    if (e.target.tagName !== 'INPUT' && !e.target.isContentEditable) {
        // Find focused input if any and blur it
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.isContentEditable) && active !== e.target) {
            active.blur();
        }
    }
});

// ===========================
// Review Modal & Email Flow
// ===========================

const cartBtn = document.getElementById("cartBtn");
const reviewModal = document.getElementById("reviewModal");
const closeReviewBtn = document.getElementById("closeReviewBtn");
const reviewGrid = document.getElementById("reviewGrid");
const sendEmailBtn = document.getElementById("sendEmailBtn");

if (cartBtn) {
    cartBtn.addEventListener("click", () => {
        renderReviewGrid();
        reviewModal.classList.add("visible");
    });
}

if (closeReviewBtn) {
    closeReviewBtn.addEventListener("click", () => {
        reviewModal.classList.remove("visible");
    });
}

function renderReviewGrid() {
    reviewGrid.innerHTML = "";
    if (window.approvedPhotos.length === 0) {
        reviewGrid.innerHTML = '<div style="color: var(--text-muted); padding: 20px;">No approved photos yet.</div>';
        sendEmailBtn.disabled = true;
        return;
    }
    
    sendEmailBtn.disabled = false;
    window.approvedPhotos.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "review-item";
        div.innerHTML = `
            <img src="${item.annotated_image}">
            <button class="review-item-delete" onclick="window.removeApprovedPhoto(${idx})" title="Remove">×</button>
        `;
        reviewGrid.appendChild(div);
    });
}

window.removeApprovedPhoto = function(idx) {
    window.approvedPhotos.splice(idx, 1);
    window.updateCartUI();
    renderReviewGrid();
};

window.compileAndDownloadReport = async function(btnOverride) {
    if (window.approvedPhotos.length === 0) return;
    
    let originalText = "";
    if (btnOverride) {
        btnOverride.disabled = true;
        originalText = btnOverride.innerHTML;
        btnOverride.innerHTML = "Compiling Zip...";
    }
    
    // Show AI processing message
    const msg = document.createElement("div");
    msg.className = "message ai";
    msg.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-content">
            <div class="processing">
                <div class="processing-dots">
                    <span></span><span></span><span></span>
                </div>
                Compiling all rooms into zip...
            </div>
        </div>
    `;
    chat.appendChild(msg);
    scrollToBottom();
    
    try {
        const res = await fetch(`${API_URL}/api/compile-zip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rooms: window.approvedPhotos,
                building_name: "225 George St" // Or get from UI
            })
        });
        
        if (res.ok) {
            // Initiate zip download
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Inspection_225_George_St.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            
            if (btnOverride) {
                btnOverride.innerHTML = "✅ Compiled Successfully!";
                btnOverride.style.background = "var(--success)";
            }
            
            setTimeout(() => {
                // Reset everything
                window.approvedPhotos = [];
                window.updateCartUI();
                reviewModal.classList.remove("visible");
                if (btnOverride) {
                    btnOverride.innerHTML = originalText;
                    btnOverride.style.background = "";
                    btnOverride.disabled = false;
                }
                
                // Remove processing and show AI success
                msg.remove();
                const successMsg = document.createElement("div");
                successMsg.className = "message ai";
                successMsg.innerHTML = `
                    <div class="message-avatar">AI</div>
                    <div class="message-content" style="background: rgba(52, 211, 153, 0.1); border-color: rgba(52, 211, 153, 0.3);">
                        <p>✅ <strong>All Rooms Done</strong></p>
                        <p>I have compiled all the photos, raw images, and notes into a zip file for your report.</p>
                    </div>
                `;
                chat.appendChild(successMsg);
                scrollToBottom();
            }, 1500);
        } else {
            throw new Error("Server rejected compile request");
        }
    } catch (err) {
        console.error("Error compiling zip:", err);
        msg.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-content">
                <p>❌ Failed to compile report. Please try again.</p>
            </div>
        `;
        if (btnOverride) {
            btnOverride.innerHTML = "❌ Failed to compile";
            setTimeout(() => {
                btnOverride.innerHTML = originalText;
                btnOverride.disabled = false;
            }, 2000);
        }
    }
};

window.compileAndDownloadEmail = async function(btnOverride) {
    if (window.approvedPhotos.length === 0) return;
    
    let originalText = "";
    if (btnOverride) {
        btnOverride.disabled = true;
        originalText = btnOverride.innerHTML;
        btnOverride.innerHTML = "⏳ Compiling Email...";
    }
    
    const msg = document.createElement("div");
    msg.className = "message ai";
    msg.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-content">
            <div class="processing">
                <div class="processing-dots">
                    <span></span><span></span><span></span>
                </div>
                Generating email draft wrapper...
            </div>
        </div>
    `;
    chat.appendChild(msg);
    scrollToBottom();
    
    try {
        const res = await fetch(`${API_URL}/api/compile-email-draft`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rooms: window.approvedPhotos,
                building_name: "225 George St"
            })
        });
        
        if (res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Draft_Report.eml`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            
            if (btnOverride) {
                btnOverride.innerHTML = "✅ Email Draft Downloaded!";
            }
            
            setTimeout(() => {
                window.approvedPhotos = [];
                window.updateCartUI();
                reviewGrid.innerHTML = "";
                reviewModal.classList.remove("visible");
                
                msg.innerHTML = `
                    <div class="message-avatar">AI</div>
                    <div class="message-content">
                        <p>🎉 Done! I have compiled the ZIP and embedded it directly into an <code>.eml</code> draft. Click the downloaded file to securely review it in your native mail app before sending.</p>
                    </div>
                `;
            }, 800);
            
        } else {
            msg.innerHTML = `
                <div class="message-avatar">AI</div>
                <div class="message-content">
                    <p>❌ Failed to compile email draft. Please try again.</p>
                </div>
            `;
            if (btnOverride) {
                btnOverride.innerHTML = "❌ Failed";
                setTimeout(() => {
                    btnOverride.innerHTML = originalText;
                    btnOverride.disabled = false;
                }, 2000);
            }
        }
    } catch(e) {
        msg.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-content">
                <p>❌ Failed to compile email draft. Please try again.</p>
            </div>
        `;
        if (btnOverride) {
            btnOverride.innerHTML = "❌ Failed";
            setTimeout(() => {
                btnOverride.innerHTML = originalText;
                btnOverride.disabled = false;
            }, 2000);
        }
    }
};

window.shareReportZip = async function(btnOverride) {
    if (window.approvedPhotos.length === 0) return;
    
    // Quick device check for file share support
    let testFile;
    try { testFile = new File([''], 'test.txt', {type: 'text/plain'}); } catch(e){}
    if (!navigator.canShare || !navigator.canShare({ files: [testFile] })) {
        addErrorMessage("Your browser or device does not support native file sharing. Use Download Zip or Email Draft instead.");
        return;
    }

    let originalText = "";
    if (btnOverride) {
        btnOverride.disabled = true;
        originalText = btnOverride.innerHTML;
        btnOverride.innerHTML = "⏳ Preparing...";
    }
    
    try {
        const res = await fetch(`${API_URL}/api/compile-zip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rooms: window.approvedPhotos,
                building_name: "225 George St"
            })
        });
        
        if (res.ok) {
            const blob = await res.blob();
            const file = new File([blob], "Inspection_225_George_St.zip", { type: "application/zip" });
            
            if (btnOverride) {
                btnOverride.innerHTML = "✅ Ready";
            }
            
            try {
                await navigator.share({
                    files: [file],
                    title: 'Site Inspection Report',
                    text: 'Please find the attached site inspection report zip file for 225 George St.'
                });
                
                // Clear UI on successful share intent completion
                window.approvedPhotos = [];
                window.updateCartUI();
                reviewGrid.innerHTML = "";
                reviewModal.classList.remove("visible");
                
                const msg = document.createElement("div");
                msg.className = "message ai";
                msg.innerHTML = `
                    <div class="message-avatar">AI</div>
                    <div class="message-content">
                        <p>📤 Share sheet opened! The inspection is officially completed.</p>
                    </div>
                `;
                chat.appendChild(msg);
                scrollToBottom();
                
            } catch (shareErr) {
                console.log("Share cancelled or failed:", shareErr);
                if (btnOverride) {
                    btnOverride.innerHTML = originalText;
                    btnOverride.disabled = false;
                }
            }
        } else {
            throw new Error("Compilation failed");
        }
    } catch(e) {
        addErrorMessage("Failed to prepare zip for sharing.");
        if (btnOverride) {
            btnOverride.innerHTML = originalText;
            btnOverride.disabled = false;
        }
    }
};


const downloadZipBtn = document.getElementById("downloadZipBtn");

if (sendEmailBtn) {
    sendEmailBtn.addEventListener("click", () => {
        window.compileAndDownloadEmail(sendEmailBtn);
    });
}
if (downloadZipBtn) {
    downloadZipBtn.addEventListener("click", () => {
        window.compileAndDownloadReport(downloadZipBtn);
    });
}
