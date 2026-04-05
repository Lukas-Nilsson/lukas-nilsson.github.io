/**
 * Canonical interactive annotation renderer.
 *
 * The visible annotation layer is driven by AnnotationRenderer's shared layout
 * and styling plan. Editing affordances sit above it as a separate layer.
 */

let sceneIdCounter = 0;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function getUndoButton() {
    let undoBtn = document.getElementById("editorUndo");
    if (!undoBtn) {
        undoBtn = document.createElement("button");
        undoBtn.style.display = "none";
    }
    return undoBtn;
}

function keepEditableInView(el) {
    if (!el) return;
    requestAnimationFrame(() => {
        el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
        const editorContent = document.getElementById("editorContent");
        if (!editorContent) return;
        const editorRect = editorContent.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        if (elRect.top < editorRect.top + 24) {
            editorContent.scrollTop -= (editorRect.top + 24) - elRect.top;
        } else if (elRect.bottom > editorRect.bottom - 80) {
            editorContent.scrollTop += elRect.bottom - (editorRect.bottom - 80);
        }
    });
}

function destroyInteractiveSVG(container) {
    if (!container) return;

    if (typeof container._interactiveSceneCleanup === "function") {
        container._interactiveSceneCleanup();
        container._interactiveSceneCleanup = null;
    }

    const oldLayers = container.querySelectorAll("[data-interactive-layer='true']");
    oldLayers.forEach((el) => el.remove());
    container._annotationRenderResult = null;
    container._annotationBaseImageHref = null;
    container._annotationImageSize = null;
}

function buildInteractiveSVG(container, data, isEditable = true) {
    destroyInteractiveSVG(container);

    const renderer = window.AnnotationRenderer;
    if (!renderer) {
        console.error("AnnotationRenderer is not available");
        return;
    }

    // Deep-clone so edits don't auto-save to globalPreviousAnalysisData
    // Only commit back when Save is pressed (handled in app.js syncEditorToPreview)
    data = deepClone(data);
    container._editorLocalData = data;

    const img = container.querySelector("img");
    if (!img) return;

    const imageWidth = img.naturalWidth || 1000;
    const imageHeight = img.naturalHeight || 1000;
    const svgNS = "http://www.w3.org/2000/svg";
    const sceneId = ++sceneIdCounter;

    container.style.position = "relative";
    container.style.lineHeight = "0";

    const displayLayer = document.createElement("div");
    displayLayer.dataset.interactiveLayer = "true";
    displayLayer.style.position = "absolute";
    displayLayer.style.inset = "0";
    displayLayer.style.zIndex = "8";
    displayLayer.style.pointerEvents = "none";

    const interactionSvg = document.createElementNS(svgNS, "svg");
    interactionSvg.dataset.interactiveLayer = "true";
    interactionSvg.setAttribute("viewBox", `0 0 ${imageWidth} ${imageHeight}`);
    interactionSvg.style.position = "absolute";
    interactionSvg.style.inset = "0";
    interactionSvg.style.width = "100%";
    interactionSvg.style.height = "100%";
    interactionSvg.style.zIndex = "20";
    interactionSvg.style.overflow = "hidden";
    interactionSvg.style.pointerEvents = isEditable ? "auto" : "none";
    // Prevent browser native pan/zoom interfering with single-finger node drags
    interactionSvg.style.touchAction = "none";

    const panelOverlay = document.createElement("div");
    panelOverlay.dataset.interactiveLayer = "true";
    panelOverlay.style.position = "absolute";
    panelOverlay.style.inset = "0";
    panelOverlay.style.zIndex = "30";
    panelOverlay.style.pointerEvents = "none";

    container.appendChild(displayLayer);
    container.appendChild(interactionSvg);
    container.appendChild(panelOverlay);

    let renderResult = null;
    let selectedTarget = null;
    let activeDrag = null;
    let activeWarp = null;
    let activePanelDrag = null;
    let activeResize = null;
    let activeEditor = null;
    const undoStack = [];
    const undoBtn = getUndoButton();

    function syncUndoButton() {
        undoBtn.style.display = undoStack.length > 0 ? "block" : "none";
    }

    function pushUndoSnapshot() {
        undoStack.push(deepClone(data));
        syncUndoButton();
    }

    function restoreSnapshot(snapshot) {
        const replacement = deepClone(snapshot);
        Object.keys(data).forEach((key) => delete data[key]);
        Object.assign(data, replacement);
    }

    undoBtn.onclick = () => {
        if (!undoStack.length) return;
        const snapshot = undoStack.pop();
        restoreSnapshot(snapshot);
        selectedTarget = null;
        closeActiveEditor(false);
        rerender();
        syncUndoButton();
    };
    syncUndoButton();

    function getPercentStyle(rect) {
        return renderer.rectToPercentStyle(rect, imageWidth, imageHeight);
    }

    function setScenePanelFromRect(rect) {
        const anchorX = renderResult?.layoutMap?.panel?.anchorX || "left";
        const anchorY = renderResult?.layoutMap?.panel?.anchorY || "top";
        const widthPct = clamp((rect.width / imageWidth) * 100, 15, 92);
        const leftPct = clamp((rect.x / imageWidth) * 100, 0, 100 - widthPct);
        const topPct = clamp((rect.y / imageHeight) * 100, 0, 100);
        const rightPct = clamp(((imageWidth - (rect.x + rect.width)) / imageWidth) * 100, 0, 100 - widthPct);
        const bottomPct = clamp(((imageHeight - (rect.y + rect.height)) / imageHeight) * 100, 0, 100);
        data.frontend_panel_pos = {
            left: anchorX === "left" ? `${leftPct.toFixed(2)}%` : "",
            top: anchorY === "top" ? `${topPct.toFixed(2)}%` : "",
            right: anchorX === "right" ? `${rightPct.toFixed(2)}%` : "",
            bottom: anchorY === "bottom" ? `${bottomPct.toFixed(2)}%` : "",
            width: `${widthPct.toFixed(2)}%`,
            height: "",
            x: anchorX,
            y: anchorY
        };
    }

    function getPolygonRef(kind, sourceIndex, polygonIndex) {
        if (kind === "praise") {
            return data.praise[sourceIndex]?.frontend_points || null;
        }
        return data.issues[sourceIndex]?.frontend_polygons?.[polygonIndex] || null;
    }

    function getFieldValue(field) {
        if (field.kind === "title") return data.header_title || "";
        if (field.kind === "subtitle") return (data.location_name || "").toUpperCase();
        if (field.kind === "issue") return data.issues[field.sourceIndex]?.description || "";
        return data.praise[field.sourceIndex]?.description || "";
    }

    function setFieldValue(field, value) {
        const normalized = String(value || "").trim();
        if (field.kind === "title") {
            data.header_title = normalized || "225 GEORGE ST";
            return;
        }
        if (field.kind === "subtitle") {
            data.location_name = normalized || "INSPECTION AREA";
            return;
        }
        if (field.kind === "issue" && data.issues[field.sourceIndex]) {
            data.issues[field.sourceIndex].description = normalized || "Issue identified";
            return;
        }
        if (field.kind === "praise" && data.praise[field.sourceIndex]) {
            data.praise[field.sourceIndex].description = normalized || "Positive point identified";
        }
    }

    function closeActiveEditor(commit = true) {
        if (!activeEditor) return;
        const { field, element } = activeEditor;
        if (commit) {
            setFieldValue(field, element.innerText);
        }
        element.remove();
        activeEditor = null;
    }

    function openTextEditor(field) {
        if (!isEditable) return;
        if (activeEditor && activeEditor.field.key === field.key) return;
        closeActiveEditor(true);

        // On mobile: use bottom sheet instead of tiny inline editor
        const isMobile = 'ontouchstart' in window;
        if (isMobile) {
            const sheet = document.getElementById('bottomSheet');
            const input = document.getElementById('bottomSheetInput');
            const label = document.getElementById('bottomSheetLabel');
            const saveBtn = document.getElementById('bottomSheetSave');
            const cancelBtn = document.getElementById('bottomSheetCancel');
            if (sheet && input) {
                const currentVal = getFieldValue(field);
                if (label) label.textContent = field.kind === 'issue' ? 'Edit issue label' : field.kind === 'praise' ? 'Edit praise label' : 'Edit label';
                input.value = currentVal;
                sheet.classList.add('visible');
                requestAnimationFrame(() => input.focus());
                const doSave = () => {
                    pushUndoSnapshot();
                    setFieldValue(field, input.value.trim() || currentVal);
                    sheet.classList.remove('visible');
                    rerender();
                    saveBtn.removeEventListener('click', doSave);
                    cancelBtn.removeEventListener('click', doCancel);
                };
                const doCancel = () => {
                    sheet.classList.remove('visible');
                    saveBtn.removeEventListener('click', doSave);
                    cancelBtn.removeEventListener('click', doCancel);
                };
                saveBtn.addEventListener('click', doSave);
                cancelBtn.addEventListener('click', doCancel);
                return;
            }
        }

        pushUndoSnapshot();

        const panelRect = renderResult.layoutMap.panel.rect;
        const localRect = {
            x: field.rect.x - panelRect.x,
            y: field.rect.y - panelRect.y,
            width: field.rect.width,
            height: Math.max(field.rect.height, field.lineHeight)
        };

        const editor = document.createElement("div");
        editor.contentEditable = "true";
        editor.dataset.fieldKey = field.key;
        editor.style.position = "absolute";
        editor.style.left = `${(localRect.x / panelRect.width) * 100}%`;
        editor.style.top = `${(localRect.y / panelRect.height) * 100}%`;
        editor.style.width = `${(localRect.width / panelRect.width) * 100}%`;
        editor.style.minHeight = `${Math.max(localRect.height, 20)}px`;
        editor.style.padding = field.kind === "title" || field.kind === "subtitle" ? "2px 0" : "2px 0";
        editor.style.margin = "0";
        editor.style.background = "rgba(10, 10, 16, 0.82)";
        editor.style.border = "1px solid rgba(255,255,255,0.18)";
        editor.style.borderRadius = field.kind === "title" || field.kind === "subtitle" ? "4px" : "4px";
        editor.style.outline = "none";
        editor.style.color = field.color;
        editor.style.fontFamily = renderer.THEME_V1.fontFamily;
        editor.style.fontSize = `${field.fontSize}px`;
        editor.style.fontWeight = `${field.fontWeight}`;
        editor.style.letterSpacing = `${field.letterSpacing}px`;
        editor.style.lineHeight = `${field.lineHeight}px`;
        editor.style.whiteSpace = "pre-wrap";
        editor.style.overflowWrap = "anywhere";
        editor.style.pointerEvents = "auto";
        editor.style.boxSizing = "border-box";
        editor.style.zIndex = "6";
        editor.textContent = getFieldValue(field);

        panelOverlay._panelBox.appendChild(editor);
        activeEditor = { field, element: editor };

        editor.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                editor.blur();
            }
            if (event.key === "Escape") {
                event.preventDefault();
                closeActiveEditor(false);
                rerender();
            }
        });

        editor.addEventListener("blur", () => {
            closeActiveEditor(true);
            rerender();
        }, { once: true });

        requestAnimationFrame(() => {
            editor.focus();
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
            keepEditableInView(editor);
        });
    }

    function renderDisplay() {
        const baseImageHref =
            img.getAttribute("data-clean-url") ||
            img.getAttribute("data-raw") ||
            img.currentSrc ||
            img.src;
        renderResult = renderer.renderAnnotatedScene(data, { imageWidth, imageHeight, baseImageHref });
        container._annotationRenderResult = renderResult;
        container._annotationBaseImageHref = baseImageHref;
        container._annotationImageSize = { width: imageWidth, height: imageHeight };
        displayLayer.innerHTML = renderResult.svg;
        const svgEl = displayLayer.querySelector("svg");
        if (svgEl) {
            svgEl.style.display = "block";
            svgEl.style.width = "100%";
            svgEl.style.height = "100%";
            svgEl.style.pointerEvents = "none";
        }
    }

    function renderInteractionSvg() {
        while (interactionSvg.firstChild) interactionSvg.removeChild(interactionSvg.firstChild);
        interactionSvg.setAttribute("viewBox", `0 0 ${imageWidth} ${imageHeight}`);

        if (!isEditable) return;

        renderResult.layoutMap.panel.rows.forEach((row) => {
            row.polygons.forEach((polygon, polygonIndex) => {
                const hitPath = document.createElementNS(svgNS, "path");
                hitPath.setAttribute("d", polygon.pathD);
                hitPath.setAttribute("fill", "rgba(255,255,255,0.001)");
                hitPath.setAttribute("stroke", "transparent");
                hitPath.setAttribute("stroke-width", "24");
                hitPath.style.pointerEvents = "all";
                hitPath.style.cursor = "move";
                hitPath.addEventListener("pointerdown", (event) => {
                    if (event.pointerType === "touch" && !event.isPrimary) return;
                    event.preventDefault();
                    event.stopPropagation();
                    selectedTarget = {
                        kind: row.kind,
                        sourceIndex: row.sourceIndex,
                        polygonIndex
                    };
                    const originalPoints = deepClone(getPolygonRef(row.kind, row.sourceIndex, polygonIndex));
                    activeDrag = {
                        kind: row.kind,
                        sourceIndex: row.sourceIndex,
                        polygonIndex,
                        startX: event.clientX,
                        startY: event.clientY,
                        originalPoints,
                        undoCaptured: false
                    };
                    hitPath.setPointerCapture?.(event.pointerId);
                    window.addEventListener("pointermove", handleDrag, { passive: false });
                    window.addEventListener("pointerup", endDrag);
                    window.addEventListener("pointercancel", endDrag);
                    renderHandles();
                });
                interactionSvg.appendChild(hitPath);
            });
        });

        renderHandles();
    }

    function renderHandles() {
        const existing = interactionSvg.querySelector("[data-overlay='handles']");
        if (existing) existing.remove();
        if (!isEditable || !selectedTarget) return;

        const points = getPolygonRef(selectedTarget.kind, selectedTarget.sourceIndex, selectedTarget.polygonIndex);
        if (!points || !points.length) return;

        const handleGroup = document.createElementNS(svgNS, "g");
        handleGroup.setAttribute("data-overlay", "handles");

        points.forEach((point, pointIndex) => {
            const x = Number(point[0]) * imageWidth;
            const y = Number(point[1]) * imageHeight;

            const visibleHandle = document.createElementNS(svgNS, "circle");
            visibleHandle.setAttribute("cx", x);
            visibleHandle.setAttribute("cy", y);
            visibleHandle.setAttribute("r", 8);
            visibleHandle.setAttribute("fill", "white");
            visibleHandle.setAttribute("stroke", "rgba(255,90,40,0.9)");
            visibleHandle.setAttribute("stroke-width", 2);

            const touchHandle = document.createElementNS(svgNS, "circle");
            touchHandle.setAttribute("cx", x);
            touchHandle.setAttribute("cy", y);
            touchHandle.setAttribute("r", 24);
            touchHandle.setAttribute("fill", "transparent");
            touchHandle.style.pointerEvents = "all";
            touchHandle.style.cursor = "pointer";
            touchHandle.addEventListener("pointerdown", (event) => {
                event.preventDefault();
                event.stopPropagation();
                activeWarp = {
                    kind: selectedTarget.kind,
                    sourceIndex: selectedTarget.sourceIndex,
                    polygonIndex: selectedTarget.polygonIndex,
                    pointIndex,
                    undoCaptured: false
                };
                touchHandle.setPointerCapture?.(event.pointerId);
                window.addEventListener("pointermove", handleWarp, { passive: false });
                window.addEventListener("pointerup", endWarp);
                window.addEventListener("pointercancel", endWarp);
            });

            handleGroup.appendChild(visibleHandle);
            handleGroup.appendChild(touchHandle);
        });

        const selectedRow = renderResult.layoutMap.panel.rows.find((row) =>
            row.kind === selectedTarget.kind && row.sourceIndex === selectedTarget.sourceIndex
        );
        if (selectedRow) {
            const removeX = selectedRow.overlayBadge.x + 28;
            const removeY = selectedRow.overlayBadge.y - 28;
            const removeBg = document.createElementNS(svgNS, "circle");
            removeBg.setAttribute("cx", removeX);
            removeBg.setAttribute("cy", removeY);
            removeBg.setAttribute("r", 14);
            removeBg.setAttribute("fill", "rgba(220,50,50,0.92)");
            removeBg.setAttribute("stroke", "white");
            removeBg.setAttribute("stroke-width", 2);
            removeBg.style.pointerEvents = "all";
            removeBg.style.cursor = "pointer";
            removeBg.addEventListener("pointerdown", (event) => {
                event.preventDefault();
                event.stopPropagation();
                pushUndoSnapshot();
                if (selectedTarget.kind === "issue") {
                    data.issues.splice(selectedTarget.sourceIndex, 1);
                } else {
                    data.praise.splice(selectedTarget.sourceIndex, 1);
                }
                selectedTarget = null;
                rerender();
            });

            const removeText = document.createElementNS(svgNS, "text");
            removeText.setAttribute("x", removeX);
            removeText.setAttribute("y", removeY);
            removeText.setAttribute("fill", "white");
            removeText.setAttribute("font-family", renderer.THEME_V1.fontFamily);
            removeText.setAttribute("font-size", "16");
            removeText.setAttribute("font-weight", "700");
            removeText.setAttribute("text-anchor", "middle");
            removeText.setAttribute("dominant-baseline", "central");
            removeText.textContent = "✕";

            handleGroup.appendChild(removeBg);
            handleGroup.appendChild(removeText);
        }

        interactionSvg.appendChild(handleGroup);
    }

    function renderPanelOverlay() {
        panelOverlay.innerHTML = "";
        panelOverlay._panelBox = null;
        if (!isEditable) return;

        const panelRect = renderResult.layoutMap.panel.rect;
        const panelAnchorX = renderResult.layoutMap.panel.anchorX || "left";
        const panelAnchorY = renderResult.layoutMap.panel.anchorY || "top";
        const panelBox = document.createElement("div");
        panelBox.style.position = "absolute";
        panelBox.style.pointerEvents = "none";
        panelBox.style.boxSizing = "border-box";
        panelBox.style.touchAction = "none";
        Object.assign(panelBox.style, getPercentStyle(panelRect));
        panelOverlay.appendChild(panelBox);
        panelOverlay._panelBox = panelBox;

        const headerDrag = document.createElement("div");
        headerDrag.style.position = "absolute";
        headerDrag.style.left = "0";
        headerDrag.style.top = "0";
        headerDrag.style.width = "100%";
        headerDrag.style.height = `${((renderResult.layoutMap.panel.header.rect.height + 12) / panelRect.height) * 100}%`;
        headerDrag.style.cursor = "move";
        headerDrag.style.pointerEvents = "auto";
        headerDrag.style.background = "transparent";
        panelBox.appendChild(headerDrag);

        headerDrag.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            activePanelDrag = {
                startX: event.clientX,
                startY: event.clientY,
                originalRect: deepClone(panelRect),
                undoCaptured: false
            };
            headerDrag.setPointerCapture?.(event.pointerId);
            window.addEventListener("pointermove", handlePanelDrag, { passive: false });
            window.addEventListener("pointerup", endPanelDrag);
            window.addEventListener("pointercancel", endPanelDrag);
        });

        const fields = renderResult.layoutMap.fields;
        fields.forEach((field) => {
            const localRect = {
                x: field.rect.x - panelRect.x,
                y: field.rect.y - panelRect.y,
                width: field.rect.width,
                height: field.rect.height
            };
            const hitbox = document.createElement("div");
            hitbox.dataset.fieldKey = field.key;
            hitbox.style.position = "absolute";
            hitbox.style.left = `${(localRect.x / panelRect.width) * 100}%`;
            hitbox.style.top = `${(localRect.y / panelRect.height) * 100}%`;
            hitbox.style.width = `${(localRect.width / panelRect.width) * 100}%`;
            hitbox.style.height = `${(localRect.height / panelRect.height) * 100}%`;
            hitbox.style.pointerEvents = "auto";
            hitbox.style.cursor = "text";
            hitbox.style.background = "transparent";
            hitbox.addEventListener("pointerdown", (event) => {
                event.preventDefault();
                event.stopPropagation();
                openTextEditor(field);
            });
            panelBox.appendChild(hitbox);
        });

        const resizeHandle = document.createElement("div");
        resizeHandle.style.position = "absolute";
        resizeHandle.style[panelAnchorX === "right" ? "left" : "right"] = "0";
        resizeHandle.style[panelAnchorY === "bottom" ? "top" : "bottom"] = "0";
        resizeHandle.style.width = "20px";
        resizeHandle.style.height = "20px";
        const isDiagonalForward = panelAnchorX === panelAnchorY;
        resizeHandle.style.cursor = isDiagonalForward ? "nwse-resize" : "nesw-resize";
        resizeHandle.style.pointerEvents = "auto";
        resizeHandle.style.display = "flex";
        resizeHandle.style.alignItems = panelAnchorY === "bottom" ? "flex-start" : "flex-end";
        resizeHandle.style.justifyContent = panelAnchorX === "right" ? "flex-start" : "flex-end";
        resizeHandle.style.transform = `rotate(${panelAnchorX === "right" && panelAnchorY === "bottom" ? "180deg" : panelAnchorX === "right" ? "90deg" : panelAnchorY === "bottom" ? "-90deg" : "0deg"})`;
        resizeHandle.innerHTML = `
            <svg viewBox="0 0 12 12" width="10" height="10" style="opacity:0.55; margin:4px;">
                <path d="M 10 2 L 2 10" stroke="white" stroke-width="1.5" stroke-linecap="round" />
                <path d="M 10 6 L 6 10" stroke="white" stroke-width="1.5" stroke-linecap="round" />
            </svg>
        `;
        resizeHandle.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            activeResize = {
                startX: event.clientX,
                startY: event.clientY,
                originalRect: deepClone(panelRect),
                undoCaptured: false
            };
            resizeHandle.setPointerCapture?.(event.pointerId);
            window.addEventListener("pointermove", handleResize, { passive: false });
            window.addEventListener("pointerup", endResize);
            window.addEventListener("pointercancel", endResize);
        });
        panelBox.appendChild(resizeHandle);
    }

    // rAF-throttled rerender
    let _rafPending = false;

    function rerender() {
        if (_rafPending) return;
        _rafPending = true;
        requestAnimationFrame(() => {
            _rafPending = false;
            renderDisplay();
            renderInteractionSvg();
            renderPanelOverlay();
        });
    }

    // Lightweight drag rerender: skip expensive renderDisplay().
    // Show live polygon shapes via cheap SVG paths drawn directly in interactionSvg.
    let _dragRafPending = false;
    function rerenderDragOnly() {
        if (_dragRafPending) return;
        _dragRafPending = true;
        requestAnimationFrame(() => {
            _dragRafPending = false;
            // Draw live polygon shapes directly in interaction SVG (cheap)
            renderLivePolygons();
            renderInteractionSvg();
        });
    }

    const svgNS_local = "http://www.w3.org/2000/svg";

    function renderLivePolygons() {
        // Remove existing live-polygon group
        const existing = interactionSvg.querySelector('[data-live-polygons]');
        if (existing) existing.remove();

        const group = document.createElementNS(svgNS_local, 'g');
        group.setAttribute('data-live-polygons', '1');

        const allRows = [
            ...(data.issues || []).map((item, i) => ({ item, kind: 'issue', index: i })),
            ...(data.praise || []).map((item, i) => ({ item, kind: 'praise', index: i }))
        ];

        // Color palette matching ISSUE_COLORS in pipeline.py
        const colors = [
            'rgba(255,90,40,0.5)',
            'rgba(100,160,255,0.5)',
            'rgba(255,200,60,0.5)',
            'rgba(200,100,255,0.5)',
            'rgba(255,100,130,0.5)',
        ];
        const borders = [
            'rgba(255,90,40,0.9)',
            'rgba(100,160,255,0.9)',
            'rgba(255,200,60,0.9)',
            'rgba(200,100,255,0.9)',
            'rgba(255,100,130,0.9)',
        ];
        const praiseColor = 'rgba(80,220,120,0.5)';
        const praiseBorder = 'rgba(80,220,120,0.9)';

        allRows.forEach(({ item, kind, index }) => {
            const polygons = kind === 'issue'
                ? (item.frontend_polygons || (item.frontend_points ? [item.frontend_points] : []))
                : (item.frontend_points ? [item.frontend_points] : []);

            const fill = kind === 'praise' ? praiseColor : (colors[index % colors.length]);
            const border = kind === 'praise' ? praiseBorder : (borders[index % borders.length]);

            polygons.forEach((polygon) => {
                if (!polygon || polygon.length < 3) return;
                // Build smooth path from normalized coords
                const pts = polygon.map(p => [p[0] * imageWidth, p[1] * imageHeight]);
                let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
                for (let i = 1; i < pts.length; i++) {
                    d += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
                }
                d += ' Z';
                const path = document.createElementNS(svgNS_local, 'path');
                path.setAttribute('d', d);
                path.setAttribute('fill', fill);
                path.setAttribute('stroke', border);
                path.setAttribute('stroke-width', '2.5');
                path.setAttribute('stroke-dasharray', '8 6');
                path.style.pointerEvents = 'none';
                group.appendChild(path);
            });
        });

        // Insert at bottom of interactionSvg so handles render on top
        interactionSvg.insertBefore(group, interactionSvg.firstChild);
    }

    function handleDrag(event) {
        if (event.cancelable) event.preventDefault();
        if (!activeDrag) return;
        if (!activeDrag.undoCaptured) {
            pushUndoSnapshot();
            activeDrag.undoCaptured = true;
        }
        const rect = interactionSvg.getBoundingClientRect();
        const deltaX = (event.clientX - activeDrag.startX) / rect.width;
        const deltaY = (event.clientY - activeDrag.startY) / rect.height;
        const points = getPolygonRef(activeDrag.kind, activeDrag.sourceIndex, activeDrag.polygonIndex);
        if (!points) return;
        points.forEach((point, index) => {
            point[0] = activeDrag.originalPoints[index][0] + deltaX;
            point[1] = activeDrag.originalPoints[index][1] + deltaY;
        });
        rerenderDragOnly();
    }

    function endDrag() {
        activeDrag = null;
        window.removeEventListener("pointermove", handleDrag);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
    }

    function handleWarp(event) {
        if (event.cancelable) event.preventDefault();
        if (!activeWarp) return;
        if (!activeWarp.undoCaptured) {
            pushUndoSnapshot();
            activeWarp.undoCaptured = true;
        }
        const rect = interactionSvg.getBoundingClientRect();
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = (event.clientY - rect.top) / rect.height;
        const points = getPolygonRef(activeWarp.kind, activeWarp.sourceIndex, activeWarp.polygonIndex);
        if (!points || !points[activeWarp.pointIndex]) return;
        points[activeWarp.pointIndex] = [nx, ny];
        rerenderDragOnly();
    }

    function endWarp() {
        activeWarp = null;
        window.removeEventListener("pointermove", handleWarp);
        window.removeEventListener("pointerup", endWarp);
        window.removeEventListener("pointercancel", endWarp);
    }

    function handlePanelDrag(event) {
        if (event.cancelable) event.preventDefault();
        if (!activePanelDrag) return;
        if (!activePanelDrag.undoCaptured) {
            pushUndoSnapshot();
            activePanelDrag.undoCaptured = true;
        }
        const containerRect = container.getBoundingClientRect();
        const scaleX = imageWidth / containerRect.width;
        const scaleY = imageHeight / containerRect.height;
        const dx = (event.clientX - activePanelDrag.startX) * scaleX;
        const dy = (event.clientY - activePanelDrag.startY) * scaleY;
        setScenePanelFromRect({
            x: clamp(activePanelDrag.originalRect.x + dx, 0, imageWidth - activePanelDrag.originalRect.width),
            y: clamp(activePanelDrag.originalRect.y + dy, 0, imageHeight - activePanelDrag.originalRect.height),
            width: activePanelDrag.originalRect.width,
            height: activePanelDrag.originalRect.height
        });
        rerender();
    }

    function endPanelDrag() {
        activePanelDrag = null;
        window.removeEventListener("pointermove", handlePanelDrag);
        window.removeEventListener("pointerup", endPanelDrag);
        window.removeEventListener("pointercancel", endPanelDrag);
    }

    function handleResize(event) {
        if (event.cancelable) event.preventDefault();
        if (!activeResize) return;
        if (!activeResize.undoCaptured) {
            pushUndoSnapshot();
            activeResize.undoCaptured = true;
        }
        // Use rAF for resize too
        if (_dragRafPending) return;
        _dragRafPending = true;
        requestAnimationFrame(() => { _dragRafPending = false; });
        const containerRect = container.getBoundingClientRect();
        const scaleX = imageWidth / containerRect.width;
        const scaleY = imageHeight / containerRect.height;
        const dx = (event.clientX - activeResize.startX) * scaleX;
        const dy = (event.clientY - activeResize.startY) * scaleY;
        const original = activeResize.originalRect;
        const anchorX = renderResult?.layoutMap?.panel?.anchorX || "left";
        const anchorY = renderResult?.layoutMap?.panel?.anchorY || "top";
        const nextRect = {
            x: original.x,
            y: original.y,
            width: original.width,
            height: original.height
        };

        if (anchorX === "left") {
            nextRect.width = clamp(original.width + dx, 120, imageWidth * 0.9);
        } else {
            const fixedRight = original.x + original.width;
            nextRect.x = clamp(original.x + dx, 0, fixedRight - 120);
            nextRect.width = clamp(fixedRight - nextRect.x, 120, imageWidth * 0.9);
        }

        if (anchorY === "top") {
            nextRect.height = clamp(original.height + dy, 90, imageHeight * 0.92);
        } else {
            const fixedBottom = original.y + original.height;
            nextRect.y = clamp(original.y + dy, 0, fixedBottom - 90);
            nextRect.height = clamp(fixedBottom - nextRect.y, 90, imageHeight * 0.92);
        }

        nextRect.width = Math.min(nextRect.width, imageWidth - nextRect.x);
        nextRect.height = Math.min(nextRect.height, imageHeight - nextRect.y);
        setScenePanelFromRect(nextRect);
        rerenderDragOnly();
    }

    function endResize() {
        activeResize = null;
        window.removeEventListener("pointermove", handleResize);
        window.removeEventListener("pointerup", endResize);
        window.removeEventListener("pointercancel", endResize);
    }

    if (!isEditable) {
        displayLayer.addEventListener("dblclick", () => {
            if (window.openLightbox && img.src) window.openLightbox(img.src);
        });
    }

    container._interactiveSceneCleanup = () => {
        closeActiveEditor(false);
        window.removeEventListener("pointermove", handleDrag);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
        window.removeEventListener("pointermove", handleWarp);
        window.removeEventListener("pointerup", endWarp);
        window.removeEventListener("pointercancel", endWarp);
        window.removeEventListener("pointermove", handlePanelDrag);
        window.removeEventListener("pointerup", endPanelDrag);
        window.removeEventListener("pointercancel", endPanelDrag);
        window.removeEventListener("pointermove", handleResize);
        window.removeEventListener("pointerup", endResize);
        window.removeEventListener("pointercancel", endResize);
    };

    rerender();

    // ── Pinch-to-zoom ──────────────────────────────────────────────────
    // Attach to the editor-content scroll container so pinch zooms the
    // image-wrapper (container). Single-finger touches fall through to
    // the normal pointer handlers above.
    const editorContentEl = document.getElementById('editorContent');
    if (editorContentEl && isEditable) {
        let pinch = null;
        let currentScale = 1.0;

        function getPinchDist(touches) {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }

        function applyScale(scale) {
            currentScale = Math.max(1.0, Math.min(4.0, scale));
            container.style.transformOrigin = 'center top';
            container.style.transform = currentScale === 1.0 ? '' : `scale(${currentScale})`;
        }

        const onPinchStart = (e) => {
            if (e.touches.length !== 2) return;
            e.preventDefault();
            pinch = { startDist: getPinchDist(e.touches), startScale: currentScale };
        };
        const onPinchMove = (e) => {
            if (!pinch || e.touches.length !== 2) return;
            e.preventDefault();
            const dist = getPinchDist(e.touches);
            applyScale(pinch.startScale * (dist / pinch.startDist));
        };
        const onPinchEnd = (e) => {
            if (e.touches.length < 2) pinch = null;
            // Snap back if nearly 1x
            if (currentScale < 1.1) applyScale(1.0);
        };

        editorContentEl.addEventListener('touchstart', onPinchStart, { passive: false });
        editorContentEl.addEventListener('touchmove', onPinchMove, { passive: false });
        editorContentEl.addEventListener('touchend', onPinchEnd, { passive: true });

        // Also handle on the SVG layer directly
        interactionSvg.addEventListener('touchstart', onPinchStart, { passive: false });
        interactionSvg.addEventListener('touchmove', onPinchMove, { passive: false });
        interactionSvg.addEventListener('touchend', onPinchEnd, { passive: true });

        // Clean up when modal closes
        const origCleanup = container._interactiveSceneCleanup || (() => {});
        container._interactiveSceneCleanup = () => {
            origCleanup();
            editorContentEl.removeEventListener('touchstart', onPinchStart);
            editorContentEl.removeEventListener('touchmove', onPinchMove);
            editorContentEl.removeEventListener('touchend', onPinchEnd);
            interactionSvg.removeEventListener('touchstart', onPinchStart);
            interactionSvg.removeEventListener('touchmove', onPinchMove);
            interactionSvg.removeEventListener('touchend', onPinchEnd);
            applyScale(1.0);
        };
    }
}

window.destroyInteractiveSVG = destroyInteractiveSVG;
window.buildInteractiveSVG = buildInteractiveSVG;
