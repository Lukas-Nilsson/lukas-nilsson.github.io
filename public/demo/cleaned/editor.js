/**
 * Interactive SVG Polygon Editor & HTML Panel
 * 
 * Takes normalized coordinates (0..1) from backend and overlays them as interactive SVG elements.
 * Supports: dragging polygon, dragging individual points (warp), and dynamic leader line updating.
 * Builds fully interactive HTML frosted glass panel.
 */

// Math utilities
function catmullRom2bezier(p0, p1, p2, p3) {
    return [
        { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
        { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
        p2
    ];
}

function generateSmoothPath(points, vbW, vbH) {
    if (!points || points.length < 3) return "";
    
    // Create points array with format {x,y}
    const pts = points.map(p => ({ x: p[0] * vbW, y: p[1] * vbH }));
    const n = pts.length;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    
    for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const p3 = pts[(i + 2) % n];
        
        const bezier = catmullRom2bezier(p0, p1, p2, p3);
        d += ` C ${bezier[0].x} ${bezier[0].y}, ${bezier[1].x} ${bezier[1].y}, ${bezier[2].x} ${bezier[2].y}`;
    }
    
    d += " Z";
    return d;
}

function calculateCentroid(points) {
    let sumX = 0, sumY = 0;
    points.forEach(p => {
        sumX += p[0];
        sumY += p[1];
    });
    return {
        cx: sumX / points.length,
        cy: sumY / points.length
    };
}

// Global update registry to call on resize
const activeUpdaters = [];
let ro = null;

function buildInteractiveSVG(container, data, isEditable = true) {
    activeUpdaters.length = 0;
    const svgNS = "http://www.w3.org/2000/svg";
    const img = container.querySelector("img");
    const vbW = 1000;
    const vbH = img && img.naturalHeight ? Math.round(1000 * img.naturalHeight / img.naturalWidth) : 1000;
    
    // Make container relative and a flex container for interactive elements if needed
    container.style.position = "relative";
    
    let activeDrag = null;
    let activeWarp = null;
    let isResizing = false;
    const elementsState = [];
    
    // Create Base SVG for Polygons (Behind UI)
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${vbW} ${vbH}`);
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.zIndex = "1"; // Behind HTML panel
    svg.style.overflow = "hidden";
    
    // Create Top SVG for Lines, Handles, Badges (Above UI)
    const svgTop = document.createElementNS(svgNS, "svg");
    svgTop.setAttribute("viewBox", `0 0 ${vbW} ${vbH}`);
    svgTop.style.position = "absolute";
    svgTop.style.top = "0";
    svgTop.style.left = "0";
    svgTop.style.width = "100%";
    svgTop.style.height = "100%";
    svgTop.style.zIndex = "20"; // Above HTML panel
    svgTop.style.pointerEvents = "none"; // Let clicks pass through to panel
    svgTop.style.overflow = "hidden";
    
    // Groups
    const gPraise = document.createElementNS(svgNS, "g");
    const gIssues = document.createElementNS(svgNS, "g");
    svg.appendChild(gPraise);
    svg.appendChild(gIssues);
    
    const gLines = document.createElementNS(svgNS, "g");
    const gBadges = document.createElementNS(svgNS, "g");
    const gHandles = document.createElementNS(svgNS, "g");
    gHandles.setAttribute("class", "warp-handles");
    svgTop.appendChild(gLines);
    svgTop.appendChild(gBadges);
    svgTop.appendChild(gHandles);
    
    // Add badge-shadow defs
    const defs = document.createElementNS(svgNS, "defs");
    const filter = document.createElementNS(svgNS, "filter");
    filter.setAttribute("id", "badge-shadow");
    filter.setAttribute("x", "-50%");
    filter.setAttribute("y", "-50%");
    filter.setAttribute("width", "200%");
    filter.setAttribute("height", "200%");
    const feDropShadow = document.createElementNS(svgNS, "feDropShadow");
    feDropShadow.setAttribute("dx", "0");
    feDropShadow.setAttribute("dy", "1");
    feDropShadow.setAttribute("stdDeviation", "2");
    feDropShadow.setAttribute("flood-color", "rgba(0,0,0,0.6)");
    filter.appendChild(feDropShadow);
    defs.appendChild(filter);
    svgTop.appendChild(defs);
    
    let lastTapTime = 0;
    // Deselect handles when clicking the empty background SVG
    svg.addEventListener("pointerdown", (e) => {
        if (e.target === svg) {
            gHandles.innerHTML = "";
            activeWarp = null;
            activeDrag = null;
            
            // Double-tap detection for lightbox
            const now = Date.now();
            if (now - lastTapTime < 300) {
                if (window.openLightbox) {
                    const img = container.querySelector("img");
                    if (img && img.src) window.openLightbox(img.src);
                }
            }
            lastTapTime = now;
        }
    });

    // CRITICAL: Block Safari scroll hijacks globally across the wrapper if engaging any node!
    container.addEventListener("touchmove", (e) => {
        if (activeDrag || activeWarp || isResizing) {
            e.preventDefault();
        }
    }, { passive: false });

    // Pass through double clicks to open the lightbox (desktop fallback)
    svg.addEventListener("dblclick", (e) => {
        if (e.target === svg && window.openLightbox) {
            const img = container.querySelector("img");
            if (img && img.src) window.openLightbox(img.src);
        }
    });

    // (Praise logic moved below panel generation)

    // ============================================
    // HTML Panel Generation
    // ============================================
    const panel = document.createElement("div");
    panel.className = "ai-panel";
    // Dynamic Layout Logic: Find the corner that is FURTHEST away, on average, from all polygon points
    const allPts = [];
    if (data.issues) data.issues.forEach(iss => (iss.frontend_polygons || []).forEach(poly => allPts.push(...poly)));
    if (data.praise) data.praise.forEach(pr => allPts.push(...(pr.frontend_points || [])));
    
    // Calculate the distance sum from each of the 4 ideal panel center-points to all polygon points
    // The panel operates at roughly 40% width, 40% height. So its center points fall at around x:0.2/0.8, y:0.2/0.8.
    const corners = [
        { name: 'q1', x: 'left', y: 'top', cx: 0.2, cy: 0.2, sumDist: 0 },
        { name: 'q2', x: 'right', y: 'top', cx: 0.8, cy: 0.2, sumDist: 0 },
        { name: 'q3', x: 'left', y: 'bottom', cx: 0.2, cy: 0.8, sumDist: 0 },
        { name: 'q4', x: 'right', y: 'bottom', cx: 0.8, cy: 0.8, sumDist: 0 }
    ];

    let picked = { x: 'right', y: 'top' }; // default fallback
    
    if (data.frontend_panel_pos) {
        if (data.frontend_panel_pos.top) panel.style.top = data.frontend_panel_pos.top;
        if (data.frontend_panel_pos.bottom) panel.style.bottom = data.frontend_panel_pos.bottom;
        if (data.frontend_panel_pos.left) panel.style.left = data.frontend_panel_pos.left;
        if (data.frontend_panel_pos.right) panel.style.right = data.frontend_panel_pos.right;
        panel.style.width = data.frontend_panel_pos.width || "40%";
        picked.x = data.frontend_panel_pos.x;
        picked.y = data.frontend_panel_pos.y;
    } else {
        if (allPts.length > 0) {
            corners.forEach(c => {
                let minDist = 9999;
                allPts.forEach(p => {
                    const d = Math.pow(p[0] - c.cx, 2) + Math.pow(p[1] - c.cy, 2);
                    if (d < minDist) minDist = d;
                });
                c.score = minDist;
            });
        } else {
            corners.forEach(c => c.score = 1);
        }

        // Pick the corner with the LARGEST minimum distance to any point (Maximin strategy)
        corners.sort((a, b) => b.score - a.score);
        
        picked = corners[0];
        if (picked.y === 'top') {
            panel.style.top = "4%";
        } else {
            panel.style.bottom = "4%";
        }
        
        if (picked.x === 'left') {
            panel.style.left = "4%";
        } else {
            panel.style.right = "4%";
        }
        
        panel.style.width = "40%";
        
        data.frontend_panel_pos = {
            top: panel.style.top,
            bottom: panel.style.bottom,
            left: panel.style.left,
            right: panel.style.right,
            width: panel.style.width,
            x: picked.x,
            y: picked.y
        };
    }

    // Custom adaptive diagonal resizer
    const resizer = document.createElement("div");
    resizer.style.position = "absolute";
    resizer.style.width = "20px";
    resizer.style.height = "20px";
    
    // Add visual handle (Industry standard diagonal lines)
    const handleVisual = document.createElementNS(svgNS, "svg");
    handleVisual.setAttribute("viewBox", "0 0 12 12");
    handleVisual.style.position = "absolute";
    handleVisual.style.width = "10px";
    handleVisual.style.height = "10px";
    handleVisual.style.opacity = "0.4";
    handleVisual.style.transition = "opacity 0.2s";
    
    const ln1 = document.createElementNS(svgNS, "path");
    ln1.setAttribute("d", "M 10 2 L 2 10");
    ln1.setAttribute("stroke", "white");
    ln1.setAttribute("stroke-width", "1.5");
    ln1.setAttribute("stroke-linecap", "round");
    
    const ln2 = document.createElementNS(svgNS, "path");
    ln2.setAttribute("d", "M 10 6 L 6 10");
    ln2.setAttribute("stroke", "white");
    ln2.setAttribute("stroke-width", "1.5");
    ln2.setAttribute("stroke-linecap", "round");

    handleVisual.appendChild(ln1);
    handleVisual.appendChild(ln2);

    resizer.appendChild(handleVisual);
    resizer.addEventListener("mouseenter", () => handleVisual.style.opacity = "1");
    resizer.addEventListener("mouseleave", () => handleVisual.style.opacity = "0.4");

    if (picked.y === 'top' && picked.x === 'right') { 
        resizer.style.bottom = "0"; resizer.style.left = "0"; resizer.style.cursor = "nesw-resize";
        handleVisual.style.bottom = "4px"; handleVisual.style.left = "4px";
        handleVisual.style.transform = "rotate(90deg)";
        panel.style.paddingBottom = "12px";
    } else if (picked.y === 'bottom' && picked.x === 'left') { 
        resizer.style.top = "0"; resizer.style.right = "0"; resizer.style.cursor = "nesw-resize";
        handleVisual.style.top = "4px"; handleVisual.style.right = "4px";
        handleVisual.style.transform = "rotate(270deg)";
        panel.style.paddingTop = "12px";
    } else if (picked.y === 'bottom' && picked.x === 'right') { 
        resizer.style.top = "0"; resizer.style.left = "0"; resizer.style.cursor = "nwse-resize";
        handleVisual.style.top = "4px"; handleVisual.style.left = "4px";
        handleVisual.style.transform = "rotate(180deg)";
        panel.style.paddingTop = "12px";
    } else { // Top Left (so handle is Bottom-Right)
        resizer.style.bottom = "0"; resizer.style.right = "0"; resizer.style.cursor = "nwse-resize";
        handleVisual.style.bottom = "4px"; handleVisual.style.right = "4px";
        handleVisual.style.transform = "rotate(0deg)";
        panel.style.paddingBottom = "12px";
    }

    if (isEditable) {
        panel.appendChild(resizer);

        isResizing = false;
        let startW, startH, startX, startY;
        
        resizer.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.target.setPointerCapture(e.pointerId);
            isResizing = true;
            document.body.style.cursor = resizer.style.cursor;
            const rect = panel.getBoundingClientRect();
            startW = rect.width;
            startH = rect.height;
            startX = e.clientX;
            startY = e.clientY;
            
            window.addEventListener("pointermove", onResize);
            window.addEventListener("pointerup", stopResize);
            window.addEventListener("pointercancel", stopResize);
        });

        function onResize(e) {
            if (!isResizing) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            const svgRect = svg.getBoundingClientRect();
            const maxW = svgRect.width * 0.92;
            const maxH = svgRect.height * 0.92;

            const headH = panel.querySelector('.ai-panel-header').offsetHeight 
                        + panel.querySelector('.ai-panel-divider').offsetHeight 
                        + 16;
                        
            const reqInnerH = panel.querySelector('.ai-panel-scroll').scrollHeight; 
            const minHeightRequired = reqInnerH + headH;

            if (picked.x === 'right') {
                panel.style.width = Math.min(maxW, Math.max(80, startW - dx)) + "px";
            } else {
                panel.style.width = Math.min(maxW, Math.max(80, startW + dx)) + "px";
            }
            
            if (picked.y === 'bottom') {
                panel.style.height = Math.min(maxH, Math.max(minHeightRequired, startH - dy)) + "px";
            } else {
                panel.style.height = Math.min(maxH, Math.max(minHeightRequired, startH + dy)) + "px";
            }
        }

        function stopResize() {
            isResizing = false;
            document.body.style.cursor = "";
            window.removeEventListener("pointermove", onResize);
            window.removeEventListener("pointerup", stopResize);
            window.removeEventListener("pointercancel", stopResize);
            
            if (data && data.frontend_panel_pos) {
                // Convert pixel drag width back into percentage width relative to image
                const percWidth = (parseFloat(panel.style.width) / container.offsetWidth * 100).toFixed(2) + "%";
                data.frontend_panel_pos.width = percWidth;
                panel.style.width = percWidth; // apply percentage
                // We keep height auto or whatever was calculated
                data.frontend_panel_pos.height = panel.style.height;
            }
        }
    }
    
    const header = document.createElement("div");
    header.className = "ai-panel-header";
    const locName = data.location_name ? data.location_name.toUpperCase() : "INSPECTION AREA";
    header.innerHTML = `
        <div class="ai-panel-accent"></div>
        <div class="ai-panel-title">
            <h3 class="editable-loc" ${isEditable ? 'contenteditable="true"' : ''}>225 GEORGE ST</h3>
            <p class="editable-sub" ${isEditable ? 'contenteditable="true"' : ''}>${locName}</p>
        </div>
    `;
    panel.appendChild(header);
    
    if (isEditable) {
        const titleEl = header.querySelector(".editable-sub");
        if (titleEl) {
            titleEl.addEventListener("input", () => {
                data.location_name = titleEl.innerText;
            });
            titleEl.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    titleEl.blur();
                }
            });
        }
    }

    const divider = document.createElement("div");
    divider.className = "ai-panel-divider";
    panel.appendChild(divider);

    const scrollContainer = document.createElement("div");
    scrollContainer.className = "ai-panel-scroll";
    panel.appendChild(scrollContainer);

    // Track state for interaction
    const FALLBACK_COLORS = [
        [255, 90, 40], [100, 160, 255], [255, 200, 60], [200, 100, 255], [255, 100, 130],
    ];
    function getIssueColor(issue, idx) {
        const rgb = issue.frontend_color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
        return {
            border: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.86)`,
            fill: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.22)`,
            line: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.63)`,
            solid: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`,
        };
    }


    // Build items and SVG lines
    if (data.issues) {
        data.issues.forEach((issue, idx) => {
            const colors = getIssueColor(issue, idx);
            
            // 1. Create HTML Row
            const itemDiv = document.createElement("div");
            itemDiv.className = "ai-panel-item";
            itemDiv.style.borderColor = colors.line;
            itemDiv.innerHTML = `
                <div class="ai-panel-badge" style="background: ${colors.solid}">${idx + 1}</div>
                <div class="ai-panel-text" ${isEditable ? 'contenteditable="true"' : ''}>${issue.description || "Issue indentified"}</div>
            `;
            scrollContainer.appendChild(itemDiv);
            const textDiv = itemDiv.querySelector(".ai-panel-text");
            textDiv.addEventListener("focus", () => {
                undoStack.push({ type: "state", isPraise: false, idx: idx, prevState: JSON.stringify(issue) });
                undoBtn.style.display = "block";
            });
            textDiv.addEventListener("input", () => {
                issue.description = textDiv.innerText;
            });
            textDiv.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    textDiv.blur();
                }
            });
            // 2. Create SVG Elements
            const group = document.createElementNS(svgNS, "g");
            const leaderPath = document.createElementNS(svgNS, "path");
            leaderPath.setAttribute("fill", "none");
            leaderPath.setAttribute("stroke", colors.line);
            leaderPath.setAttribute("stroke-width", "4.5");
            const nodeDot = document.createElementNS(svgNS, "circle");
            nodeDot.setAttribute("fill", colors.solid);
            nodeDot.setAttribute("stroke", "white");
            nodeDot.setAttribute("stroke-width", "1.5");
            nodeDot.setAttribute("r", "5");
            
            const badgeGroup = document.createElementNS(svgNS, "g");
            badgeGroup.setAttribute("filter", "url(#badge-shadow)");
            const circle = document.createElementNS(svgNS, "circle");
            circle.setAttribute("fill", colors.solid);
            circle.setAttribute("stroke", "rgba(0,0,0,0.2)");
            circle.setAttribute("stroke-width", "1.5");
            circle.setAttribute("r", "12");
            const text = document.createElementNS(svgNS, "text");
            text.setAttribute("fill", "white");
            text.setAttribute("font-family", "Inter, sans-serif");
            text.setAttribute("font-size", "14");
            text.setAttribute("font-weight", "800");
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("alignment-baseline", "central");
            text.textContent = String(idx + 1);
            badgeGroup.appendChild(circle);
            badgeGroup.appendChild(text);
            
            gLines.appendChild(leaderPath);
            gLines.appendChild(nodeDot);
            gBadges.appendChild(badgeGroup);
            
            // Create initial polygons
            issue.frontend_polygons.forEach((polyPoints, polyIdx) => {
                const path = document.createElementNS(svgNS, "path");
                path.setAttribute("fill", colors.fill);
                path.setAttribute("stroke", colors.border);
                path.setAttribute("stroke-width", "2.5");
                path.style.cursor = "move";
                path.style.pointerEvents = "all";
                if (isEditable) {
                    path.addEventListener("pointerdown", (e) => {
                        if (e.pointerType === 'touch' && !e.isPrimary) return;
                        e.preventDefault();
                        e.target.setPointerCapture(e.pointerId);
                        
                        // Snapshot state for undo
                        undoStack.push({ type: "state", isPraise: false, idx: idx, prevState: JSON.stringify(issue) });
                        undoBtn.style.display = "block";

                        activeDrag = { isPraise: false, idx: idx, polyIdx: polyIdx, startX: e.clientX, startY: e.clientY, originalPoints: JSON.parse(JSON.stringify(polyPoints)) };
                        ensureHandles(issue, idx, polyIdx, colors, false);
                        window.addEventListener("pointermove", handleMouseDrag, { passive: false });
                        window.addEventListener("pointerup", endDrag);
                        window.addEventListener("pointercancel", endDrag);
                    });
                }
                group.appendChild(path);
            });
            gIssues.appendChild(group);

            // Create Updater
            const update = () => {
                let allPts = [];
                const paths = group.querySelectorAll("path");
                issue.frontend_polygons.forEach((polyPoints, polyIdx) => {
                    paths[polyIdx].setAttribute("d", generateSmoothPath(polyPoints, vbW, vbH));
                    allPts.push(...polyPoints);
                    if ((activeWarp && !activeWarp.isPraise && activeWarp.idx === idx && activeWarp.polyIdx === polyIdx) ||
                        (activeDrag && !activeDrag.isPraise && activeDrag.idx === idx && activeDrag.polyIdx === polyIdx)) {
                        ensureHandles(issue, idx, polyIdx, colors, false, true); // Update handles safely true flag
                    }
                });
                
                const centroid = calculateCentroid(allPts);
                const cx = centroid.cx * vbW;
                const cy = centroid.cy * vbH;
                
                circle.setAttribute("cx", cx);
                circle.setAttribute("cy", cy);
                text.setAttribute("x", cx);
                text.setAttribute("y", cy);
                
                // Track HTML coordinates dynamically
                const elRect = itemDiv.getBoundingClientRect();
                const svgRect = svg.getBoundingClientRect();
                
                // Ignore if invisible
                if (elRect.width === 0 || svgRect.width === 0) return;
                
                const sx1 = (elRect.left - svgRect.left) / svgRect.width * vbW;
                const sy1 = (elRect.top - svgRect.top) / svgRect.height * vbH;
                const sx2 = (elRect.right - svgRect.left) / svgRect.width * vbW;
                const sy2 = (elRect.bottom - svgRect.top) / svgRect.height * vbH;
                
                const htmlCenterY = (sy1 + sy2) / 2;
                const htmlCenterX = (sx1 + sx2) / 2;
                
                const dir = cx > htmlCenterX ? 1 : -1;
                const exitX = dir === 1 ? sx2 : sx1;
                const exitY = htmlCenterY;
                
                const dx = cx - exitX;
                const dy = cy - exitY;
                const dist = Math.max(1, Math.sqrt(dx*dx + dy*dy));
                const horizontalReach = Math.min(dist * 0.4, 200);
                const ctrl1X = exitX + dir * horizontalReach;
                const ctrl1Y = exitY;
                const ctrl2X = cx - dir * Math.min(dist * 0.15, 80);
                const ctrl2Y = cy + (exitY - cy) * 0.2;
                
                leaderPath.setAttribute("d", `M ${exitX} ${exitY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${cx} ${cy}`);
                nodeDot.setAttribute("cx", exitX);
                nodeDot.setAttribute("cy", exitY);
            };
            
            update();
            activeUpdaters.push(update);
            elementsState.push({ isPraise: false, idx, itemDiv, group, leaderPath, nodeDot, badgeGroup, text, active: true, update });
        });
    }

    // Draw praise items (with list elements)
    if (data.praise) {
        data.praise.forEach((pr, idx) => {
            if (!pr.frontend_points) return;
            const colors = {
                border: "rgba(40, 220, 110, 0.8)",
                fill: "rgba(40, 200, 100, 0.08)",
                line: "rgba(40, 220, 110, 0.6)",
                solid: "rgba(40, 200, 100, 0.9)"
            };
            
            // 1. Create HTML Row
            const itemDiv = document.createElement("div");
            itemDiv.className = "ai-panel-item";
            itemDiv.style.borderColor = colors.line;
            itemDiv.innerHTML = `
                <div class="ai-panel-badge" style="background: ${colors.solid}">✓</div>
                <div class="ai-panel-text" ${isEditable ? 'contenteditable="true"' : ''}>${pr.description || "Positive point identified"}</div>
            `;
            scrollContainer.appendChild(itemDiv);
            const textDiv = itemDiv.querySelector(".ai-panel-text");
            textDiv.addEventListener("focus", () => {
                undoStack.push({ type: "state", isPraise: true, idx: idx, prevState: JSON.stringify(pr) });
                undoBtn.style.display = "block";
            });
            textDiv.addEventListener("input", () => {
                pr.description = textDiv.innerText;
            });
            textDiv.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    textDiv.blur();
                }
            });

            // 2. Create SVG Elements
            const group = document.createElementNS(svgNS, "g");
            const leaderPath = document.createElementNS(svgNS, "path");
            leaderPath.setAttribute("fill", "none");
            leaderPath.setAttribute("stroke", colors.line);
            leaderPath.setAttribute("stroke-width", "4.5");
            const nodeDot = document.createElementNS(svgNS, "circle");
            nodeDot.setAttribute("fill", colors.solid);
            nodeDot.setAttribute("stroke", "white");
            nodeDot.setAttribute("stroke-width", "1.5");
            nodeDot.setAttribute("r", "5");

            const path = document.createElementNS(svgNS, "path");
            path.setAttribute("fill", colors.fill);
            path.setAttribute("stroke", colors.border);
            path.setAttribute("stroke-width", "2.5");
            path.setAttribute("stroke-dasharray", "8, 6");
            path.style.cursor = "move";
            path.style.pointerEvents = "all";
            
            const badgeGroup = document.createElementNS(svgNS, "g");
            badgeGroup.setAttribute("filter", "url(#badge-shadow)");
            const circle = document.createElementNS(svgNS, "circle");
            circle.setAttribute("fill", colors.solid);
            circle.setAttribute("stroke", "rgba(0,0,0,0.2)");
            circle.setAttribute("stroke-width", "1.5");
            circle.setAttribute("r", "14");
            
            const text = document.createElementNS(svgNS, "text");
            text.setAttribute("fill", "white");
            text.setAttribute("font-family", "Inter, sans-serif");
            text.setAttribute("font-size", "16");
            text.setAttribute("font-weight", "700");
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("alignment-baseline", "central");
            text.textContent = "✓";
            
            badgeGroup.appendChild(circle);
            badgeGroup.appendChild(text);
            group.appendChild(path);
            gPraise.appendChild(group);
            
            gLines.appendChild(leaderPath);
            gLines.appendChild(nodeDot);
            gBadges.appendChild(badgeGroup);
            
            if (isEditable) {
                path.addEventListener("pointerdown", (e) => {
                    if (e.pointerType === 'touch' && !e.isPrimary) return;
                    e.preventDefault();
                    e.target.setPointerCapture(e.pointerId);
                    
                    // Snapshot state for undo
                    undoStack.push({ type: "state", isPraise: true, idx: idx, prevState: JSON.stringify(pr) });
                    undoBtn.style.display = "block";

                    activeDrag = { isPraise: true, idx: idx, startX: e.clientX, startY: e.clientY, originalPoints: JSON.parse(JSON.stringify(pr.frontend_points)) };
                    ensureHandles(pr, idx, null, colors, true);
                    window.addEventListener("pointermove", handleMouseDrag, { passive: false });
                    window.addEventListener("pointerup", endDrag);
                    window.addEventListener("pointercancel", endDrag);
                });
            }

            const update = () => {
                path.setAttribute("d", generateSmoothPath(pr.frontend_points, vbW, vbH));
                const centroid = calculateCentroid(pr.frontend_points);
                const cx = centroid.cx * vbW;
                const cy = centroid.cy * vbH;
                circle.setAttribute("cx", cx);
                circle.setAttribute("cy", cy);
                text.setAttribute("x", cx);
                text.setAttribute("y", cy);
                if ((activeWarp && activeWarp.isPraise && activeWarp.idx === idx) ||
                    (activeDrag && activeDrag.isPraise && activeDrag.idx === idx)) {
                    ensureHandles(pr, idx, null, colors, true, true);
                }

                // Leader line HTML tracking
                const elRect = itemDiv.getBoundingClientRect();
                const svgRect = svg.getBoundingClientRect();
                if (elRect.width === 0 || svgRect.width === 0) return;
                
                const sx1 = (elRect.left - svgRect.left) / svgRect.width * vbW;
                const sy1 = (elRect.top - svgRect.top) / svgRect.height * vbH;
                const sx2 = (elRect.right - svgRect.left) / svgRect.width * vbW;
                const sy2 = (elRect.bottom - svgRect.top) / svgRect.height * vbH;
                
                const htmlCenterY = (sy1 + sy2) / 2;
                const htmlCenterX = (sx1 + sx2) / 2;
                
                const dir = cx > htmlCenterX ? 1 : -1;
                const exitX = dir === 1 ? sx2 : sx1;
                const exitY = htmlCenterY;
                
                const dx = cx - exitX;
                const dy = cy - exitY;
                const dist = Math.max(1, Math.sqrt(dx*dx + dy*dy));
                const horizontalReach = Math.min(dist * 0.4, 200);
                const ctrl1X = exitX + dir * horizontalReach;
                const ctrl1Y = exitY;
                const ctrl2X = cx - dir * Math.min(dist * 0.15, 80);
                const ctrl2Y = cy + (exitY - cy) * 0.2;
                
                leaderPath.setAttribute("d", `M ${exitX} ${exitY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${cx} ${cy}`);
                nodeDot.setAttribute("cx", exitX);
                nodeDot.setAttribute("cy", exitY);
            };
            
            update();
            activeUpdaters.push(update);
            elementsState.push({ isPraise: true, idx, itemDiv, group, leaderPath, nodeDot, badgeGroup, active: true, update });
        });
    }

    container.appendChild(svg);
    container.appendChild(panel);
    container.appendChild(svgTop);

    // Watch resize of panel
    ro = new ResizeObserver(() => {
        activeUpdaters.forEach(fn => fn());
    });
    ro.observe(panel);

    // Watch resize of window/container to recompute mapping
    ro.observe(container);

    // --- Interaction logic ---
    function ensureHandles(item, idx, polyIdx, colors, isPraise = false, isUpdate = false) {
        let existingTouch = null;
        let existingVis = null;
        let existingRmBg = null;
        let existingRmText = null;

        if (isUpdate) {
            existingTouch = gHandles.querySelectorAll(".h-touch");
            existingVis = gHandles.querySelectorAll(".h-vis");
            existingRmBg = gHandles.querySelector(".rm-bg");
            existingRmText = gHandles.querySelector(".rm-txt");
        } else {
            gHandles.innerHTML = "";
        }

        const points = isPraise ? item.frontend_points : item.frontend_polygons[polyIdx];
        if (!points) return;
        const handleColor = colors ? colors.border : "rgba(40, 220, 110, 0.8)";
        
        points.forEach((p, ptIdx) => {
            const hx = p[0] * vbW;
            const hy = p[1] * vbH;
            
            if (isUpdate && existingTouch && existingTouch[ptIdx]) {
                existingTouch[ptIdx].setAttribute("cx", hx);
                existingTouch[ptIdx].setAttribute("cy", hy);
                existingVis[ptIdx].setAttribute("cx", hx);
                existingVis[ptIdx].setAttribute("cy", hy);
                return;
            }
            
            // Invisible touch target (Fat finger)
            const touchTarget = document.createElementNS(svgNS, "circle");
            touchTarget.setAttribute("cx", hx);
            touchTarget.setAttribute("cy", hy);
            touchTarget.setAttribute("r", "25");
            touchTarget.setAttribute("fill", "transparent");
            touchTarget.setAttribute("cursor", "pointer");
            touchTarget.setAttribute("class", "h-touch");
            touchTarget.style.pointerEvents = "all";

            const handle = document.createElementNS(svgNS, "circle");
            handle.setAttribute("cx", hx);
            handle.setAttribute("cy", hy);
            handle.setAttribute("r", "8");
            handle.setAttribute("fill", "white");
            handle.setAttribute("stroke", handleColor);
            handle.setAttribute("stroke-width", "2");
            handle.setAttribute("class", "h-vis");
            handle.style.pointerEvents = "none";
            
            touchTarget.addEventListener("pointerdown", (e) => {
                e.stopPropagation();
                e.preventDefault();
                e.target.setPointerCapture(e.pointerId);
                
                // Snapshot state for undo
                undoStack.push({ type: "state", isPraise, idx, prevState: JSON.stringify(isPraise ? item : data.issues[idx]) });
                undoBtn.style.display = "block";

                activeWarp = { isPraise, idx, polyIdx, ptIdx };
                window.addEventListener("pointermove", handleMouseWarp, { passive: false });
                window.addEventListener("pointerup", endWarp);
                window.addEventListener("pointercancel", endWarp);
            });
            gHandles.appendChild(handle);
            gHandles.appendChild(touchTarget);
        });

        const centroid = calculateCentroid(points);
        const rmX = centroid.cx * vbW + 28;
        const rmY = centroid.cy * vbH - 28;
        
        if (isUpdate && existingRmBg && existingRmText) {
            existingRmBg.setAttribute("cx", rmX);
            existingRmBg.setAttribute("cy", rmY);
            existingRmText.setAttribute("x", rmX);
            existingRmText.setAttribute("y", rmY);
            return;
        }

        const rmGroup = document.createElementNS(svgNS, "g");
        rmGroup.style.cursor = "pointer";
        rmGroup.style.pointerEvents = "all";
        const rmBg = document.createElementNS(svgNS, "circle");
        rmBg.setAttribute("cx", rmX);
        rmBg.setAttribute("cy", rmY);
        rmBg.setAttribute("r", "14");
        rmBg.setAttribute("fill", "rgba(220, 50, 50, 0.9)");
        rmBg.setAttribute("stroke", "white");
        rmBg.setAttribute("stroke-width", "2");
        rmBg.setAttribute("class", "rm-bg");
        const rmText = document.createElementNS(svgNS, "text");
        rmText.setAttribute("x", rmX);
        rmText.setAttribute("y", rmY);
        rmText.setAttribute("fill", "white");
        rmText.setAttribute("font-family", "Inter, sans-serif");
        rmText.setAttribute("font-size", "16");
        rmText.setAttribute("font-weight", "700");
        rmText.setAttribute("text-anchor", "middle");
        rmText.setAttribute("alignment-baseline", "central");
        rmText.setAttribute("class", "rm-txt");
        rmText.textContent = "✕";
        rmGroup.appendChild(rmBg);
        rmGroup.appendChild(rmText);
        rmGroup.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            removeItem(isPraise, idx);
            gHandles.innerHTML = "";
            activeWarp = null;
            activeDrag = null;
        });
        gHandles.appendChild(rmGroup);
    }



    function handleMouseDrag(e) {
        if (e.cancelable) e.preventDefault();
        if (!activeDrag) return;
        const state = elementsState.find(s => s.idx === activeDrag.idx && !!s.isPraise === activeDrag.isPraise);
        if(!state || !state.active) return;

        const rect = svg.getBoundingClientRect();
        const deltaX = (e.clientX - activeDrag.startX) / rect.width;
        const deltaY = (e.clientY - activeDrag.startY) / rect.height;
        
        const initialPts = activeDrag.originalPoints;
        let pts;
        if (activeDrag.isPraise) {
            pts = data.praise[activeDrag.idx].frontend_points;
        } else {
            pts = data.issues[activeDrag.idx].frontend_polygons[activeDrag.polyIdx];
        }
        
        for (let i = 0; i < pts.length; i++) {
            pts[i][0] = initialPts[i][0] + deltaX;
            pts[i][1] = initialPts[i][1] + deltaY;
        }
        state.update();
    }

    function handleMouseWarp(e) {
        if (e.cancelable) e.preventDefault();
        if (!activeWarp) return;
        const state = elementsState.find(s => s.idx === activeWarp.idx && !!s.isPraise === activeWarp.isPraise);
        if(!state || !state.active) return;
        
        const rect = svg.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = (e.clientY - rect.top) / rect.height;
        
        if (activeWarp.isPraise) {
            data.praise[activeWarp.idx].frontend_points[activeWarp.ptIdx] = [nx, ny];
        } else {
            data.issues[activeWarp.idx].frontend_polygons[activeWarp.polyIdx][activeWarp.ptIdx] = [nx, ny];
        }
        state.update();
    }

    function endDrag() {
        activeDrag = null;
        window.removeEventListener("pointermove", handleMouseDrag);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
    }
    
    function endWarp() {
        activeWarp = null;
        window.removeEventListener("pointermove", handleMouseWarp);
        window.removeEventListener("pointerup", endWarp);
        window.removeEventListener("pointercancel", endWarp);
    }

    // Undo Stack
    const undoStack = [];
    
    // Wire up global editor modal undo button or hide it
    let undoBtn = document.getElementById("editorUndo");
    if (!undoBtn) {
        undoBtn = document.createElement("button");
        undoBtn.style.display = "none";
    }
    undoBtn.style.display = "none";
    
    undoBtn.onclick = () => {
        if (undoStack.length > 0) {
            const last = undoStack.pop();
            const state = elementsState.find(s => s.idx === last.idx && !!s.isPraise === last.isPraise);
            if (state) {
                if (last.type === "delete") {
                    state.active = true;
                    if (state.itemDiv) state.itemDiv.style.display = "";
                    if (state.group) state.group.style.display = "";
                    if (state.leaderPath) state.leaderPath.style.display = "";
                    if (state.nodeDot) state.nodeDot.style.display = "";
                    if (state.badgeGroup) state.badgeGroup.style.display = "";
                    if (state.update) state.update(); // refresh lines
                } else if (last.type === "state") {
                    const restored = JSON.parse(last.prevState);
                    const targetObj = last.isPraise ? data.praise[last.idx] : data.issues[last.idx];
                    Object.assign(targetObj, restored);
                    
                    if (state.itemDiv) {
                        const textDiv = state.itemDiv.querySelector(".ai-panel-text");
                        if (textDiv) textDiv.innerText = targetObj.description || "";
                    }
                    if (state.update) state.update(); // re-map SVG to restored coords
                    gHandles.innerHTML = ""; // clear handles as they are stale
                }
            }
            renumberItems();
            if (undoStack.length === 0) undoBtn.style.display = "none";
        }
    };

    function renumberItems() {
        let issueCounter = 1;
        elementsState.forEach(st => {
            if (st.active && !st.isPraise) {
                if (st.text) st.text.textContent = String(issueCounter);
                if (st.itemDiv) {
                    const htmlBadge = st.itemDiv.querySelector('.ai-panel-badge');
                    if (htmlBadge) htmlBadge.textContent = String(issueCounter);
                }
                issueCounter++;
            }
        });
    }

    function removeItem(isPraise, idx) {
        const state = elementsState.find(s => s.idx === idx && !!s.isPraise === isPraise);
        if (state && state.active) {
            state.active = false;
            if (state.itemDiv) state.itemDiv.style.display = "none";
            if (state.group) state.group.style.display = "none";
            if (state.leaderPath) state.leaderPath.style.display = "none";
            if (state.nodeDot) state.nodeDot.style.display = "none";
            if (state.badgeGroup) state.badgeGroup.style.display = "none";
            undoStack.push({ type: "delete", isPraise, idx });
            undoBtn.style.display = "block";
            renumberItems();
            // trigger reflow of remaining items mathematically
            requestAnimationFrame(() => {
                elementsState.forEach(st => {
                    if (st.active && st.update) st.update();
                });
            });
        }
    }
}
