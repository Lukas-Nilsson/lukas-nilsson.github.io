/**
 * CLEANED Demo — Chat UI Logic
 */

const REMOTE_API_URL = "https://cleaned-demo-backend-hpogfshfba-uc.a.run.app";
const SITE_DEMO_PATH = "/demo/cleaned";
const LOCAL_DEV_HOST_PATTERN = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/;
const IS_LOCAL_DEV_HOST = LOCAL_DEV_HOST_PATTERN.test(window.location.hostname);
const IS_SITE_EMBEDDED_DEMO =
    window.location.pathname === SITE_DEMO_PATH ||
    window.location.pathname === `${SITE_DEMO_PATH}/` ||
    window.location.pathname.startsWith(`${SITE_DEMO_PATH}/`);
const API_URL = IS_LOCAL_DEV_HOST ? "" : REMOTE_API_URL;
let maxObservedViewportHeight = 0;

function appendDebugLog() {}

function snapshotLayout() {}

function resolveGreetingText() {
    const params = new URLSearchParams(window.location.search);
    const viewer = (params.get("viewer") || "").toLowerCase();
    if (viewer === "horng") return "Hey Horng 👋";
    if (viewer === "lukas") return "Hey Lukas 👋";
    return "Hi 👋";
}

function applyGreeting() {
    const greetingEl = document.getElementById("welcomeGreeting");
    if (greetingEl) {
        greetingEl.textContent = resolveGreetingText();
    }
}

applyGreeting();


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

function applyMobileViewportLayout() {
    const vv = window.visualViewport;
    const viewportHeight = vv ? vv.height : window.innerHeight;
    const viewportOffsetTop = vv ? vv.offsetTop : 0;
    const viewportBottom = viewportHeight + viewportOffsetTop;

    if (viewportBottom > maxObservedViewportHeight) {
        maxObservedViewportHeight = viewportBottom;
    }
    if (window.innerHeight > maxObservedViewportHeight) {
        maxObservedViewportHeight = window.innerHeight;
    }

    document.documentElement.style.setProperty("--app-height", `${viewportHeight}px`);
    document.body.style.height = `${viewportHeight}px`;

    if (appEl) {
        appEl.style.height = `${viewportHeight}px`;
        appEl.style.transform = "none";
    }

    let inputHeight = 0;
    if (inputArea) {
        inputArea.style.bottom = "0px";
        inputArea.style.top = "auto";
        inputHeight = Math.round(inputArea.getBoundingClientRect().height);
    }

    const previewVisible = !!(previewBar && previewBar.classList.contains("visible"));
    const previewGap = previewVisible ? 8 : 0;
    const previewHeight = previewVisible ? Math.round(previewBar.getBoundingClientRect().height) : 0;

    if (previewBar) {
        previewBar.style.bottom = `${inputHeight + previewGap}px`;
        previewBar.style.top = "auto";
    }

    if (chat) {
        const chatBottomPadding = inputHeight + previewHeight + previewGap + 24;
        chat.style.paddingBottom = `${chatBottomPadding}px`;
    }

}

function resetWindowScrollToTop(reason) {
    if (window.scrollY === 0) return;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    requestAnimationFrame(() => {
        applyMobileViewportLayout();
    });
}

applyMobileViewportLayout();

if (!window.visualViewport) {
    window.addEventListener("resize", applyMobileViewportLayout);
}

if (textInput) {
    textInput.addEventListener("focus", () => {
        resetWindowScrollToTop("focus");
    });
    textInput.addEventListener("blur", () => {
        resetWindowScrollToTop("blur");
    });
}

let selectedFile = null;
let globalActiveImageFile = null;
let globalActiveUploadFile = null;
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

function bindSceneStateToWrapper(wrapper, sceneData, sourceFile = null, uploadFile = null) {
    if (!wrapper) return;
    wrapper._sceneData = sceneData || null;
    if (sourceFile) wrapper._sourceFile = sourceFile;
    if (uploadFile) wrapper._uploadFile = uploadFile;
    window._lastImageWrapper = wrapper;
}

function cloneSceneForRender(wrapper) {
    const sceneData = wrapper && wrapper._sceneData ? wrapper._sceneData : globalPreviousAnalysisData;
    if (!sceneData) return null;

    if (window.AnnotationRenderer && typeof window.AnnotationRenderer.normalizeScene === "function") {
        return window.AnnotationRenderer.normalizeScene(sceneData);
    }
    return JSON.parse(JSON.stringify(sceneData));
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to convert rendered image to data URL"));
        reader.readAsDataURL(blob);
    });
}

async function readBlobAsText(blob) {
    if (!blob) return "";
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => resolve("");
        reader.readAsText(blob);
    });
}

function requestServerRenderedComposite(wrapper) {
    return new Promise((resolve, reject) => {
        const scene = cloneSceneForRender(wrapper);
        if (!scene) {
            reject(new Error("No scene data available for server render"));
            return;
        }

        const rawImg = wrapper ? (wrapper.querySelector('img[data-raw]') || wrapper.querySelector("img")) : null;
        const uploadFile = wrapper && wrapper._uploadFile ? wrapper._uploadFile : (wrapper ? wrapper._sourceFile : null);
        const rawImage = rawImg ? (rawImg.getAttribute("data-raw") || rawImg.src || "") : "";

        const formData = new FormData();
        formData.append("scene", JSON.stringify(scene));
        if (uploadFile instanceof File) {
            formData.append("image", uploadFile);
        } else if (rawImage) {
            formData.append("raw_image", rawImage);
        } else {
            reject(new Error("No source image available for server render"));
            return;
        }

        appendDebugLog("render-request", [{
            url: `${API_URL}/api/render-annotated`,
            hasUploadFile: uploadFile instanceof File,
            uploadFileName: uploadFile instanceof File ? uploadFile.name : null,
            rawImageLength: rawImage ? rawImage.length : 0
        }]);

        const startedAt = Date.now();
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_URL}/api/render-annotated`, true);
        xhr.responseType = "blob";
        xhr.timeout = 120000;

        xhr.onload = async () => {
            const durationMs = Date.now() - startedAt;
            const ok = xhr.status >= 200 && xhr.status < 300;
            const blob = xhr.response;
            appendDebugLog("render-response", [{
                ok,
                status: xhr.status,
                statusText: xhr.statusText || null,
                durationMs,
                contentType: xhr.getResponseHeader("content-type")
            }]);

            if (!ok) {
                const responseText = await readBlobAsText(blob);
                reject(new Error(parseResponseDetail(responseText) || `Render error (${xhr.status})`));
                return;
            }
            resolve(blob);
        };

        xhr.onerror = () => {
            appendDebugLog("render-network-error", [{
                status: xhr.status,
                durationMs: Date.now() - startedAt,
                network: getNetworkContext()
            }]);
            reject(new Error("Server render failed due to a network error"));
        };

        xhr.ontimeout = () => {
            appendDebugLog("render-timeout", [{
                timeoutMs: xhr.timeout,
                durationMs: Date.now() - startedAt
            }]);
            reject(new Error("Server render timed out"));
        };

        xhr.send(formData);
    });
}

async function requestClientRenderedComposite(wrapper, isExport) {
    const renderer = window.AnnotationRenderer;
    if (!renderer || typeof renderer.rasterizeRenderedScene !== "function") {
        throw new Error("Shared annotation renderer is not available for client fallback");
    }

    const rawImg = wrapper ? (wrapper.querySelector('img[data-raw]') || wrapper.querySelector("img")) : null;
    if (!rawImg) {
        throw new Error("No source image available for client render");
    }

    const imageSize = wrapper && wrapper._annotationImageSize ? wrapper._annotationImageSize : null;
    const imageWidth = (imageSize && imageSize.width) || rawImg.naturalWidth || Number(rawImg.getAttribute("width")) || 0;
    const imageHeight = (imageSize && imageSize.height) || rawImg.naturalHeight || Number(rawImg.getAttribute("height")) || 0;
    if (!imageWidth || !imageHeight) {
        throw new Error("Source image dimensions were not available for client render");
    }

    const baseImageSource =
        (wrapper && wrapper._annotationBaseImageHref) ||
        rawImg.getAttribute("data-clean-url") ||
        rawImg.getAttribute("data-raw") ||
        rawImg.currentSrc ||
        rawImg.src;
    const renderResult = wrapper && wrapper._annotationRenderResult
        ? wrapper._annotationRenderResult
        : (() => {
            const scene = cloneSceneForRender(wrapper);
            if (!scene) {
                throw new Error("No scene data available for client render");
            }
            return renderer.renderAnnotatedScene(scene, { imageWidth, imageHeight, baseImageHref: baseImageSource });
        })();

    appendDebugLog("render-client-request", [{
        mode: isExport ? "export" : "approval",
        imageWidth,
        imageHeight,
        hasBaseImageSource: !!baseImageSource
    }]);

    if (isExport) {
        const result = await renderer.rasterizeRenderedScene(renderResult, {
            imageWidth,
            imageHeight,
            baseImageSource
        }, {
            returnBlob: true,
            mimeType: "image/png"
        });
        return { kind: "blob", value: result.blob };
    }

    const result = await renderer.rasterizeRenderedScene(renderResult, {
        imageWidth,
        imageHeight,
        baseImageSource
    }, {
        mimeType: "image/jpeg",
        quality: 0.92
    });
    return { kind: "data-url", value: result.dataUrl };
}

async function requestCanonicalRenderedOutput(wrapper, mode, isExport) {
    try {
        const renderedBlob = await requestServerRenderedComposite(wrapper);
        appendDebugLog("render-path", [{
            mode,
            path: "server-canonical"
        }]);
        return { kind: "blob", value: renderedBlob };
    } catch (serverError) {
        appendDebugLog("render-path", [{
            mode,
            path: "server-failed",
            message: serverError.message
        }]);

        try {
            const renderedOutput = await requestClientRenderedComposite(wrapper, isExport);
            appendDebugLog("render-path", [{ mode, path: "client-fallback" }]);
            return renderedOutput;
        } catch (clientError) {
            appendDebugLog("render-path", [{
                mode,
                path: "client-failed",
                message: clientError.message
            }]);
            throw new Error(`Render failed in both canonical server and client fallback. Server: ${serverError.message}. Client: ${clientError.message}`);
        }
    }
}

window.buildTextSummary = function(data) {
    if (!data) return "";
    let html = '';
    const locName = data.location_name ? data.location_name.toUpperCase() : "INSPECTION AREA";
    const headerTitle = data.header_title || "225 GEORGE ST";
    html += `<div style="margin-bottom: 12px; line-height: 1.3;"><strong style="color: var(--text-primary); letter-spacing: 0.5px;">${escapeHtml(headerTitle)}</strong><br>`;
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
        appendDebugLog("file-selected", [{
            name: file.name,
            type: file.type || null,
            size: file.size
        }]);
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
            appendDebugLog("preview-ready", [{
                name: file.name,
                type: file.type || null,
                size: file.size,
                mode: "data-url"
            }]);
            previewImage.src = e.target.result;
            previewBar.classList.add("visible");
            attachBtn.classList.add("has-file");
        };
        reader.onerror = () => {
            appendDebugLog("preview-error", [{
                name: file.name,
                type: file.type || null,
                size: file.size,
                mode: "file-reader"
            }]);
        };
        reader.readAsDataURL(file);
    } else {
        appendDebugLog("preview-ready", [{
            name: file.name,
            type: file.type || null,
            size: file.size,
            mode: "file-badge"
        }]);
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

function getNetworkContext() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
        online: navigator.onLine,
        effectiveType: connection ? connection.effectiveType || null : null,
        type: connection ? connection.type || null : null,
        downlink: connection && typeof connection.downlink === "number" ? connection.downlink : null,
        rtt: connection && typeof connection.rtt === "number" ? connection.rtt : null
    };
}

function parseResponseDetail(responseText) {
    if (!responseText) return null;
    try {
        const parsed = JSON.parse(responseText);
        return parsed && typeof parsed.detail === "string" ? parsed.detail : responseText.slice(0, 500);
    } catch (_) {
        return responseText.slice(0, 500);
    }
}

function isUploadOptimizationCandidate(file) {
    if (!file || !file.type) return false;
    return /^image\/(jpeg|jpg|webp)$/i.test(file.type);
}

function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Failed to decode image for upload optimization"));
        };
        img.src = objectUrl;
    });
}

function canvasToBlobAsync(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error("Failed to encode optimized upload image"));
            }
        }, type, quality);
    });
}

async function optimizeUploadImage(file) {
    const shouldOptimize =
        isUploadOptimizationCandidate(file) &&
        (file.size > 1_500_000 || /iP(hone|ad|od)/.test(navigator.userAgent));

    if (!shouldOptimize) {
        appendDebugLog("upload-prepare-skip", [{
            name: file.name,
            type: file.type || null,
            size: file.size
        }]);
        return file;
    }

    appendDebugLog("upload-prepare-start", [{
        name: file.name,
        type: file.type || null,
        size: file.size
    }]);

    const sourceImage = await loadImageFromFile(file);
    const maxDimension = 2048;
    const maxBytes = 1_250_000;
    const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
    const sourceHeight = sourceImage.naturalHeight || sourceImage.height;
    const initialScale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));

    let width = Math.max(1, Math.round(sourceWidth * initialScale));
    let height = Math.max(1, Math.round(sourceHeight * initialScale));
    let quality = 0.82;
    let blob = null;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
        appendDebugLog("upload-prepare-fallback", [{
            reason: "no-2d-context",
            name: file.name
        }]);
        return file;
    }

    while (true) {
        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(sourceImage, 0, 0, width, height);
        blob = await canvasToBlobAsync(canvas, "image/jpeg", quality);

        if (blob.size <= maxBytes) break;

        if (quality > 0.6) {
            quality = Math.max(0.6, quality - 0.08);
            continue;
        }

        if (Math.max(width, height) > 1280) {
            width = Math.max(1, Math.round(width * 0.85));
            height = Math.max(1, Math.round(height * 0.85));
            quality = 0.82;
            continue;
        }

        break;
    }

    if (!blob) {
        appendDebugLog("upload-prepare-fallback", [{
            reason: "empty-blob",
            name: file.name
        }]);
        return file;
    }

    if (blob.size >= file.size * 0.98) {
        appendDebugLog("upload-prepare-fallback", [{
            reason: "not-smaller",
            name: file.name,
            originalSize: file.size,
            optimizedSize: blob.size
        }]);
        return file;
    }

    const optimizedName = file.name.replace(/\.(jpe?g|webp)$/i, ".jpg");
    const optimizedFile = new File([blob], optimizedName, {
        type: "image/jpeg",
        lastModified: Date.now()
    });

    appendDebugLog("upload-prepare-success", [{
        name: file.name,
        optimizedName,
        originalSize: file.size,
        optimizedSize: optimizedFile.size,
        sourceWidth,
        sourceHeight,
        uploadWidth: width,
        uploadHeight: height,
        quality
    }]);

    return optimizedFile;
}

function uploadInspectionRequestOnce({ file, text, previousAnalysis, attempt, maxAttempts }) {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const xhr = new XMLHttpRequest();
        const url = `${API_URL}/api/process`;

        appendDebugLog("send-request", [{
            url,
            attempt,
            maxAttempts,
            hasPreviousAnalysis: !!previousAnalysis,
            fileName: file ? file.name || null : null,
            network: getNetworkContext()
        }]);

        xhr.open("POST", url, true);
        xhr.responseType = "text";
        xhr.timeout = 90000;

        xhr.onload = () => {
            const durationMs = Date.now() - startedAt;
            const ok = xhr.status >= 200 && xhr.status < 300;
            const responseText = typeof xhr.response === "string" ? xhr.response : (xhr.responseText || "");
            const contentType = xhr.getResponseHeader("content-type");

            appendDebugLog("send-response", [{
                attempt,
                ok,
                status: xhr.status,
                statusText: xhr.statusText || null,
                contentType,
                durationMs
            }]);

            if (!ok) {
                const detail = parseResponseDetail(responseText);
                appendDebugLog("send-response-error", [{
                    attempt,
                    status: xhr.status,
                    statusText: xhr.statusText || null,
                    detail
                }]);
                const error = new Error(detail || `Server error (${xhr.status})`);
                error.retryable = xhr.status === 408 || xhr.status === 429 || xhr.status >= 500;
                reject(error);
                return;
            }

            try {
                resolve(JSON.parse(responseText));
            } catch (error) {
                appendDebugLog("send-parse-error", [{
                    attempt,
                    message: error.message,
                    responseSnippet: responseText.slice(0, 500)
                }]);
                reject(new Error("Server returned invalid JSON"));
            }
        };

        xhr.onerror = () => {
            const error = new Error(navigator.onLine ? "Network error while uploading image" : "You appear to be offline");
            error.retryable = true;
            appendDebugLog("send-network-error", [{
                attempt,
                readyState: xhr.readyState,
                status: xhr.status,
                durationMs: Date.now() - startedAt,
                network: getNetworkContext()
            }]);
            reject(error);
        };

        xhr.ontimeout = () => {
            const error = new Error("Upload timed out");
            error.retryable = true;
            appendDebugLog("send-timeout", [{
                attempt,
                timeoutMs: xhr.timeout,
                durationMs: Date.now() - startedAt,
                network: getNetworkContext()
            }]);
            reject(error);
        };

        xhr.onabort = () => {
            const error = new Error("Upload was aborted");
            error.retryable = true;
            appendDebugLog("send-abort", [{
                attempt,
                durationMs: Date.now() - startedAt
            }]);
            reject(error);
        };

        const formData = new FormData();
        formData.append("image", file);
        formData.append("description", text);
        if (previousAnalysis) {
            formData.append("previous_analysis", JSON.stringify(previousAnalysis));
        }

        xhr.send(formData);
    });
}

async function uploadInspectionRequest({ file, text, previousAnalysis }) {
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await uploadInspectionRequestOnce({
                file,
                text,
                previousAnalysis,
                attempt,
                maxAttempts
            });
        } catch (error) {
            if (!error.retryable || attempt === maxAttempts) {
                throw error;
            }
            appendDebugLog("send-retry", [{
                attempt,
                nextAttempt: attempt + 1,
                reason: error.message
            }]);
        }
    }

    throw new Error("Upload failed");
}

async function send() {
    const text = textInput.value.trim();
    const isNewFile = selectedFile !== null;
    const requestFile = selectedFile || globalActiveImageFile;
    const requestPreviousAnalysis = isNewFile ? null : globalPreviousAnalysisData;

    if (!text || !requestFile) return;

    appendDebugLog("send-start", [{
        textLength: text.length,
        isNewFile,
        hasContextImage: !!globalActiveImageFile,
        hasPreviousAnalysis: !!requestPreviousAnalysis,
        file: requestFile ? {
            name: requestFile.name || null,
            type: requestFile.type || null,
            size: requestFile.size || null
        } : null
    }]);
    snapshotLayout("send-start", {
        textLength: text.length,
        isNewFile,
        hasContextImage: !!globalActiveImageFile
    });

    // Add user message (defer showing raw file if it's HEIC, the server will process it)
    addUserMessage(text, isNewFile ? requestFile : null);
    
    // Clear input
    textInput.value = "";
    clearFile();
    updateSendState();
    
    // Show processing state
    const processingEl = addProcessingMessage();
    
    try {
        let uploadFile = null;
        if (!isNewFile && globalActiveUploadFile && globalActiveImageFile === requestFile) {
            uploadFile = globalActiveUploadFile;
            appendDebugLog("upload-prepare-cache-hit", [{
                name: uploadFile.name,
                size: uploadFile.size
            }]);
        } else {
            uploadFile = await optimizeUploadImage(requestFile);
        }

        if (isNewFile) {
            globalActiveImageFile = requestFile;
            globalActiveUploadFile = uploadFile;
            globalPreviousAnalysisData = null;
        } else if (!globalActiveUploadFile || globalActiveImageFile === requestFile) {
            globalActiveUploadFile = uploadFile;
        }

        const data = await uploadInspectionRequest({
            file: uploadFile,
            text,
            previousAnalysis: requestPreviousAnalysis
        });
        appendDebugLog("send-success", [{
            issues: Array.isArray(data.issues) ? data.issues.length : null,
            praise: Array.isArray(data.praise) ? data.praise.length : null,
            exclusions: Array.isArray(data.exclusions) ? data.exclusions.length : null,
            isInspectionComplete: !!data.is_inspection_complete
        }]);
        
        // Remove processing indicator
        processingEl.remove();

        if (data.is_inspection_complete) {
            compileAndDownloadReport();
            return;
        }
        
        // Add AI response
        addAIResponse(data);
        
    } catch (err) {
        appendDebugLog("send-error", [{
            name: err && err.name ? err.name : "Error",
            message: err && err.message ? err.message : String(err)
        }]);
        console.error("Send failed:", err);
        snapshotLayout("send-error", {
            message: err && err.message ? err.message : String(err)
        });
        processingEl.remove();
        if (isNewFile && !selectedFile) {
            selectedFile = requestFile;
            showPreview(requestFile);
        }
        if (!textInput.value) {
            textInput.value = text;
        }
        updateSendState();
        appendDebugLog("send-restore-draft", [{
            restoredTextLength: text.length,
            restoredFileName: isNewFile && requestFile ? requestFile.name || null : null
        }]);
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
        header_title: data.header_title || "225 GEORGE ST",
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
        bindSceneStateToWrapper(wrapper, globalPreviousAnalysisData, window.globalActiveImageFile, window.globalActiveUploadFile);
        
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
        bindSceneStateToWrapper(wrapper, globalPreviousAnalysisData);
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
        bindSceneStateToWrapper(wrapper, globalPreviousAnalysisData);
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
        bindSceneStateToWrapper(wrapper, globalPreviousAnalysisData);
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

    const ogBtnText = btn.innerHTML;
    try {
        btn.innerHTML = "⏳ Exporting...";
        btn.disabled = true;
        let downloadUrl;
        let objectUrl = null;
        const renderedOutput = await requestCanonicalRenderedOutput(wrapper, "export", true);
        if (renderedOutput.kind === "blob") {
            objectUrl = URL.createObjectURL(renderedOutput.value);
            downloadUrl = objectUrl;
        } else {
            downloadUrl = renderedOutput.value;
        }

        const link = document.createElement("a");
        link.download = `cleaned_report_${Date.now()}.png`;
        link.href = downloadUrl;
        link.click();
        if (objectUrl) {
            setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
        }

        btn.innerHTML = ogBtnText;
        btn.disabled = false;
    } catch (e) {
        console.error("Export failed:", e);
        addErrorMessage(e && e.message ? e.message : "Failed to export image.");
        btn.innerHTML = ogBtnText;
        btn.disabled = false;
    }
};

window.approveAndProceed = async function(btn) {
    const aiMessageDiv = btn.closest(".message.ai");
    const wrapper = aiMessageDiv.querySelector(".image-wrapper");

    const ogBtnText = btn.innerHTML;
    try {
        btn.innerHTML = "⏳ Saving...";
        btn.disabled = true;
        let dataUrl;
        const renderedOutput = await requestCanonicalRenderedOutput(wrapper, "approval", false);
        if (renderedOutput.kind === "blob") {
            dataUrl = await blobToDataUrl(renderedOutput.value);
        } else {
            dataUrl = renderedOutput.value;
        }

        // Extract raw image string
        const rawImg = wrapper.querySelector('img[data-raw]') || wrapper.querySelector('img');
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
        addErrorMessage(e && e.message ? e.message : "Failed to approve image.");
        btn.innerHTML = ogBtnText;
        btn.disabled = false;
    }
};

function addErrorMessage(errorText) {
    appendDebugLog("ui-error", [{ message: errorText }]);
    snapshotLayout("ui-error", { message: errorText });
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
const editorSave = document.getElementById("editorSave");
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
    img.style.maxHeight = "calc(100dvh - 90px)";
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
        // Sync any unsaved changes before closing
        syncEditorToPreview();
        editorModal.classList.remove("visible");
    });
}

// Save button — commits edits from editor modal back to chat preview
function syncEditorToPreview() {
    const lastWrapper = document.querySelector('.message.ai:last-child .image-wrapper');
    const img = lastWrapper ? lastWrapper.querySelector('img') : null;
    if (lastWrapper && img && globalPreviousAnalysisData && window.buildInteractiveSVG) {
        const dataRaw = img.getAttribute('data-raw') || img.src;
        const cachedSize = lastWrapper._annotationImageSize;
        const sourceFile = lastWrapper._sourceFile || window.globalActiveImageFile;
        const uploadFile = lastWrapper._uploadFile || window.globalActiveUploadFile;
        lastWrapper.innerHTML = `<img src="${img.src}" data-raw="${dataRaw}" style="width: 100%; height: auto; display: block;" crossorigin="anonymous">`;
        const newImg = lastWrapper.querySelector('img');
        if (cachedSize && newImg) {
            Object.defineProperty(newImg, 'naturalWidth', { get: () => cachedSize.width, configurable: true });
            Object.defineProperty(newImg, 'naturalHeight', { get: () => cachedSize.height, configurable: true });
        }
        const doRebuild = () => {
            window.buildInteractiveSVG(lastWrapper, globalPreviousAnalysisData, false);
            bindSceneStateToWrapper(lastWrapper, globalPreviousAnalysisData, sourceFile, uploadFile);
        };
        if (newImg && newImg.complete && newImg.naturalWidth > 0) {
            doRebuild();
        } else if (newImg) {
            newImg.addEventListener('load', doRebuild, { once: true });
        }
    }
    const textContainer = document.querySelector('.message.ai:last-child .dynamic-message-text');
    if (textContainer && globalPreviousAnalysisData) {
        textContainer.innerHTML = window.buildTextSummary(globalPreviousAnalysisData);
    }
}

if (editorSave) {
    editorSave.addEventListener('click', () => {
        syncEditorToPreview();
        // Flash the button to confirm save
        if (editorSave) {
            editorSave.textContent = '✓ Saved!';
            setTimeout(() => { editorSave.textContent = '✓ Save'; }, 1200);
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
        applyMobileViewportLayout();
        if (document.activeElement === textInput) {
            requestAnimationFrame(() => resetWindowScrollToTop("viewport-change"));
        }
    };
    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);
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

window.addEventListener("scroll", () => {
    if (document.activeElement === textInput) {
        resetWindowScrollToTop("window-scroll");
    }
}, { passive: true });

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
