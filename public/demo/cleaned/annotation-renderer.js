(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.AnnotationRenderer = factory();
    }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
    const THEME_V1 = {
        version: 1,
        fontFamily: "Arial, Helvetica, sans-serif",
        shape: {
            strokeWidth: 2.5,
            dashArray: [8, 6]
        },
        panel: {
            insetRatio: 0.04,
            defaultWidthRatio: 0.4,
            maxWidthRatio: 0.8,
            maxHeightRatio: 0.92,
            minWidthPx: 60,
            radiusPx: 12,
            borderWidth: 1,
            backdropBlurPx: 28,
            shadow: {
                dx: 0,
                dy: 8,
                blur: 32,
                color: [0, 0, 0, 0.3]
            },
            background: [10, 10, 16, 0.4],
            border: [255, 255, 255, 0.15],
            padding: { cqi: 3.2, min: 4, max: 12 },
            gap: { cqi: 1.5, min: 1, max: 4 }
        },
        header: {
            gapCqi: 2,
            accentWidthCqi: 1,
            accentHeightCqi: 5,
            accentColor: [255, 90, 40, 1],
            titleFontSizeCqi: 3.5,
            titleWeight: 700,
            titleLineHeight: 1.2,
            titleLetterSpacing: 0.5,
            titleColor: [255, 255, 255, 0.95],
            subtitleFontSizeCqi: 2.5,
            subtitleWeight: 500,
            subtitleLineHeight: 1.2,
            subtitleLetterSpacing: 0.5,
            subtitleColor: [255, 255, 255, 0.6],
            titleGapPx: 2,
            dividerMarginPx: 4,
            dividerColor: [255, 255, 255, 0.1]
        },
        row: {
            gapCqi: 2,
            paddingYCqi: 1.35,
            paddingXCqi: 2,
            innerGapCqi: 2,
            radiusPx: 6,
            background: [0, 0, 0, 0.2],
            borderAlpha: 0.63,
            borderWidth: 1,
            fontSizeCqi: 3.5,
            fontWeight: 400,
            lineHeight: 1.25,
            textColor: [255, 255, 255, 0.95]
        },
        badge: {
            sizeCqi: 6.6,
            fontSizeCqi: 3.2,
            fontWeight: 700,
            textColor: [255, 255, 255, 1],
            shadow: {
                dx: 0,
                dy: 1,
                blur: 3,
                color: [0, 0, 0, 0.4]
            }
        },
        leader: {
            strokeWidth: 4.5,
            nodeRadius: 5,
            nodeStrokeColor: [255, 255, 255, 1],
            nodeStrokeWidth: 1.5,
            issueBadgeRadius: 7,
            praiseBadgeRadius: 8,
            badgeStrokeColor: [0, 0, 0, 0.2],
            badgeStrokeWidth: 1.5
        },
        overlayBadge: {
            fontSizeScale: 0.5
        },
        issuePalette: [
            [255, 90, 40],
            [100, 160, 255],
            [255, 200, 60],
            [200, 100, 255],
            [255, 100, 130]
        ],
        issueAlpha: {
            border: 0.86,
            fill: 0.22,
            line: 0.63,
            solid: 1
        },
        praise: {
            border: [40, 220, 110, 0.8],
            fill: [40, 200, 100, 0.08],
            line: [40, 220, 110, 0.6],
            solid: [40, 200, 100, 0.9]
        }
    };

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function rgbaToCss(color) {
        const [r, g, b, a = 1] = color;
        return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
    }

    function rgbaToPlan(color) {
        const [r, g, b, a = 1] = color;
        return {
            rgba: [Math.round(r), Math.round(g), Math.round(b), clamp(Math.round(a * 255), 0, 255)],
            css: rgbaToCss(color)
        };
    }

    function rgbWithAlpha(rgb, alpha) {
        return [rgb[0], rgb[1], rgb[2], alpha];
    }

    function parseLength(value, reference, fallback) {
        if (value === undefined || value === null || value === "") return fallback;
        if (typeof value === "number") return value;
        const text = String(value).trim();
        if (!text) return fallback;
        if (text.endsWith("%")) {
            const pct = Number.parseFloat(text.slice(0, -1));
            return Number.isFinite(pct) ? (reference * pct / 100) : fallback;
        }
        if (text.endsWith("px")) {
            const px = Number.parseFloat(text.slice(0, -2));
            return Number.isFinite(px) ? px : fallback;
        }
        const num = Number.parseFloat(text);
        return Number.isFinite(num) ? num : fallback;
    }

    function rectToPercentStyle(rect, imageWidth, imageHeight) {
        return {
            left: `${(rect.x / imageWidth) * 100}%`,
            top: `${(rect.y / imageHeight) * 100}%`,
            width: `${(rect.width / imageWidth) * 100}%`,
            height: `${(rect.height / imageHeight) * 100}%`
        };
    }

    function pathEscape(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function catmullRom2bezier(p0, p1, p2, p3) {
        return [
            { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
            { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
            p2
        ];
    }

    function absolutePoints(points, width, height) {
        return (points || []).map((point) => ({
            x: Number(point[0]) * width,
            y: Number(point[1]) * height
        }));
    }

    function sampleSmoothPoints(points, width, height) {
        const absPoints = absolutePoints(points, width, height);
        if (absPoints.length < 3) return absPoints;
        const smooth = [];
        const count = absPoints.length;
        for (let i = 0; i < count; i++) {
            const p0 = absPoints[(i - 1 + count) % count];
            const p1 = absPoints[i];
            const p2 = absPoints[(i + 1) % count];
            const p3 = absPoints[(i + 2) % count];
            const bezier = catmullRom2bezier(p0, p1, p2, p3);
            if (i === 0) smooth.push({ x: p1.x, y: p1.y });
            for (let step = 1; step <= 8; step++) {
                const t = step / 8;
                const mt = 1 - t;
                const x = (mt ** 3) * p1.x + 3 * (mt ** 2) * t * bezier[0].x + 3 * mt * (t ** 2) * bezier[1].x + (t ** 3) * bezier[2].x;
                const y = (mt ** 3) * p1.y + 3 * (mt ** 2) * t * bezier[0].y + 3 * mt * (t ** 2) * bezier[1].y + (t ** 3) * bezier[2].y;
                smooth.push({ x, y });
            }
        }
        return smooth;
    }

    function pathFromPoints(points) {
        if (!points || points.length < 3) return "";
        let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
        }
        d += " Z";
        return d;
    }

    function smoothPathFromNormalized(points, width, height) {
        return pathFromPoints(sampleSmoothPoints(points, width, height));
    }

    function centroidFromNormalized(polygons) {
        const pts = [];
        polygons.forEach((polygon) => {
            polygon.forEach((point) => pts.push(point));
        });
        if (!pts.length) return { x: 0, y: 0 };
        let sumX = 0;
        let sumY = 0;
        pts.forEach((point) => {
            sumX += Number(point[0]);
            sumY += Number(point[1]);
        });
        return {
            x: sumX / pts.length,
            y: sumY / pts.length
        };
    }

    function charWidthFactor(char) {
        if (char === " ") return 0.33;
        if (".,:;!'|`".includes(char)) return 0.28;
        if ("()[]{}".includes(char)) return 0.32;
        if ("ilItfrj".includes(char)) return 0.35;
        if ("mwMW@#%&".includes(char)) return 0.9;
        if (/[0-9]/.test(char)) return 0.58;
        if (/[A-Z]/.test(char)) return 0.66;
        return 0.56;
    }

    function measureText(text, fontSize, letterSpacing) {
        let width = 0;
        for (let i = 0; i < text.length; i++) {
            width += fontSize * charWidthFactor(text[i]);
            if (i < text.length - 1) width += letterSpacing;
        }
        return width;
    }

    function breakLongToken(token, maxWidth, fontSize, letterSpacing) {
        const chars = token.split("");
        const lines = [];
        let current = "";
        chars.forEach((char) => {
            const test = current + char;
            if (current && measureText(test, fontSize, letterSpacing) > maxWidth) {
                lines.push(current);
                current = char;
            } else {
                current = test;
            }
        });
        if (current) lines.push(current);
        return lines;
    }

    function wrapText(text, maxWidth, fontSize, letterSpacing) {
        const raw = String(text || "").trim();
        if (!raw) return [""];

        const paragraphs = raw.split(/\r?\n/);
        const lines = [];
        paragraphs.forEach((paragraph) => {
            const words = paragraph.split(/\s+/).filter(Boolean);
            if (!words.length) {
                lines.push("");
                return;
            }
            let current = "";
            words.forEach((word) => {
                const candidate = current ? `${current} ${word}` : word;
                if (measureText(candidate, fontSize, letterSpacing) <= maxWidth) {
                    current = candidate;
                    return;
                }
                if (current) {
                    lines.push(current);
                    current = "";
                }
                if (measureText(word, fontSize, letterSpacing) <= maxWidth) {
                    current = word;
                    return;
                }
                const broken = breakLongToken(word, maxWidth, fontSize, letterSpacing);
                broken.forEach((part, index) => {
                    if (index < broken.length - 1) {
                        lines.push(part);
                    } else {
                        current = part;
                    }
                });
            });
            if (current) lines.push(current);
        });
        return lines.length ? lines : [raw];
    }

    function truncateText(text, maxWidth, fontSize, letterSpacing) {
        const value = String(text || "");
        if (!value) return "";
        if (measureText(value, fontSize, letterSpacing) <= maxWidth) return value;
        const ellipsis = "...";
        let clipped = value;
        while (clipped.length > 1) {
            clipped = clipped.slice(0, -1).trimEnd();
            const candidate = `${clipped}${ellipsis}`;
            if (measureText(candidate, fontSize, letterSpacing) <= maxWidth) {
                return candidate;
            }
        }
        return ellipsis;
    }

    function issueColors(issue, idx) {
        const rgb = issue && Array.isArray(issue.frontend_color)
            ? issue.frontend_color
            : THEME_V1.issuePalette[idx % THEME_V1.issuePalette.length];
        return {
            border: rgbaToPlan(rgbWithAlpha(rgb, THEME_V1.issueAlpha.border)),
            fill: rgbaToPlan(rgbWithAlpha(rgb, THEME_V1.issueAlpha.fill)),
            line: rgbaToPlan(rgbWithAlpha(rgb, THEME_V1.issueAlpha.line)),
            solid: rgbaToPlan(rgbWithAlpha(rgb, THEME_V1.issueAlpha.solid))
        };
    }

    function praiseColors() {
        return {
            border: rgbaToPlan(THEME_V1.praise.border),
            fill: rgbaToPlan(THEME_V1.praise.fill),
            line: rgbaToPlan(THEME_V1.praise.line),
            solid: rgbaToPlan(THEME_V1.praise.solid)
        };
    }

    function normalizeScene(scene) {
        const normalized = clone(scene || {});
        normalized.theme_version = THEME_V1.version;
        normalized.header_title = (normalized.header_title || "225 GEORGE ST").trim() || "225 GEORGE ST";
        normalized.location_name = (normalized.location_name || "INSPECTION AREA").trim() || "INSPECTION AREA";
        normalized.issues = Array.isArray(normalized.issues) ? normalized.issues : [];
        normalized.praise = Array.isArray(normalized.praise) ? normalized.praise : [];
        normalized.exclusions = Array.isArray(normalized.exclusions) ? normalized.exclusions : [];
        return normalized;
    }

    function pickDefaultPanelPosition(scene) {
        const allPoints = [];
        (scene.issues || []).forEach((issue) => {
            (issue.frontend_polygons || []).forEach((polygon) => allPoints.push(...polygon));
        });
        (scene.praise || []).forEach((item) => {
            allPoints.push(...(item.frontend_points || []));
        });

        const corners = [
            { x: "left", y: "top", cx: 0.2, cy: 0.2, score: 0 },
            { x: "right", y: "top", cx: 0.8, cy: 0.2, score: 0 },
            { x: "left", y: "bottom", cx: 0.2, cy: 0.8, score: 0 },
            { x: "right", y: "bottom", cx: 0.8, cy: 0.8, score: 0 }
        ];

        corners.forEach((corner) => {
            let minDistance = Number.POSITIVE_INFINITY;
            allPoints.forEach((point) => {
                const dx = Number(point[0]) - corner.cx;
                const dy = Number(point[1]) - corner.cy;
                minDistance = Math.min(minDistance, (dx * dx) + (dy * dy));
            });
            corner.score = Number.isFinite(minDistance) ? minDistance : 1;
        });

        corners.sort((a, b) => b.score - a.score);
        const picked = corners[0];
        return {
            left: picked.x === "left" ? "4%" : "",
            right: picked.x === "right" ? "4%" : "",
            top: picked.y === "top" ? "4%" : "",
            bottom: picked.y === "bottom" ? "4%" : "",
            width: "40%",
            x: picked.x,
            y: picked.y
        };
    }

    function resolvePanelRect(scene, imageWidth, imageHeight) {
        const position = scene.frontend_panel_pos ? clone(scene.frontend_panel_pos) : pickDefaultPanelPosition(scene);
        const width = clamp(
            parseLength(position.width, imageWidth, imageWidth * THEME_V1.panel.defaultWidthRatio),
            THEME_V1.panel.minWidthPx,
            imageWidth * THEME_V1.panel.maxWidthRatio
        );

        const explicitHeight = parseLength(position.height, imageHeight, null);
        let x = parseLength(position.left, imageWidth, null);
        let y = parseLength(position.top, imageHeight, null);
        const right = parseLength(position.right, imageWidth, null);
        const bottom = parseLength(position.bottom, imageHeight, null);

        const anchorX = position.x || (x !== null ? "left" : "right");
        const anchorY = position.y || (y !== null ? "top" : "bottom");

        if (x === null) {
            x = imageWidth - width - (right !== null ? right : imageWidth * THEME_V1.panel.insetRatio);
        }
        x = clamp(x, 0, imageWidth - width);

        const yHint = y !== null ? y : null;

        return {
            rawPosition: position,
            x,
            y: yHint,
            width,
            height: explicitHeight,
            right,
            bottom,
            anchorX,
            anchorY
        };
    }

    function computeTextLines(text, boxX, boxY, boxWidth, fontSize, lineHeight, color, fontWeight, letterSpacing) {
        const lines = wrapText(text, boxWidth, fontSize, letterSpacing);
        return lines.map((line, lineIndex) => ({
            text: line,
            x: boxX,
            y: boxY + (lineIndex * lineHeight),
            fontSize,
            lineHeight,
            color,
            fontWeight,
            letterSpacing
        }));
    }

    function computeLayout(sceneInput, imageWidth, imageHeight) {
        const scene = normalizeScene(sceneInput);
        const panelConfig = resolvePanelRect(scene, imageWidth, imageHeight);
        const cqi = panelConfig.width / 100;

        const panelPad = clamp(THEME_V1.panel.padding.cqi * cqi, THEME_V1.panel.padding.min, THEME_V1.panel.padding.max);
        const panelGap = clamp(THEME_V1.panel.gap.cqi * cqi, THEME_V1.panel.gap.min, THEME_V1.panel.gap.max);
        const headerGap = Math.max(2, THEME_V1.header.gapCqi * cqi);
        const accentWidth = Math.max(2, THEME_V1.header.accentWidthCqi * cqi);
        const accentHeight = Math.max(6, THEME_V1.header.accentHeightCqi * cqi);
        const titleFontSize = Math.max(10, THEME_V1.header.titleFontSizeCqi * cqi);
        const subtitleFontSize = Math.max(9, THEME_V1.header.subtitleFontSizeCqi * cqi);
        const rowFontSize = Math.max(10, THEME_V1.row.fontSizeCqi * cqi);
        const badgeSize = Math.max(12, THEME_V1.badge.sizeCqi * cqi);
        const badgeFontSize = Math.max(10, THEME_V1.badge.fontSizeCqi * cqi);
        const rowPadY = Math.max(3, THEME_V1.row.paddingYCqi * cqi);
        const rowPadX = Math.max(4, THEME_V1.row.paddingXCqi * cqi);
        const rowInnerGap = Math.max(4, THEME_V1.row.innerGapCqi * cqi);
        const dividerMargin = THEME_V1.header.dividerMarginPx;
        const headerTextOffsetY = Math.max(1, 0.45 * cqi);
        const rowTextOffsetY = Math.max(1, 0.35 * cqi);

        const titleLetterSpacing = THEME_V1.header.titleLetterSpacing;
        const subtitleLetterSpacing = THEME_V1.header.subtitleLetterSpacing;
        const titleLineHeight = titleFontSize * THEME_V1.header.titleLineHeight;
        const subtitleLineHeight = subtitleFontSize * THEME_V1.header.subtitleLineHeight;
        const rowLineHeight = rowFontSize * THEME_V1.row.lineHeight;

        const titleMaxWidth = Math.max(20, panelConfig.width - (panelPad * 2) - accentWidth - headerGap);
        const titleText = truncateText(scene.header_title.toUpperCase(), titleMaxWidth, titleFontSize, titleLetterSpacing);
        const subtitleText = truncateText(scene.location_name.toUpperCase(), titleMaxWidth, subtitleFontSize, subtitleLetterSpacing);
        const headerHeight = Math.max(accentHeight, titleLineHeight + THEME_V1.header.titleGapPx + subtitleLineHeight);

        const rows = [];
        const issueEntries = scene.issues.map((issue, sourceIndex) => ({
            kind: "issue",
            sourceIndex,
            description: issue.description || "Issue identified",
            colors: issueColors(issue, sourceIndex),
            polygons: (issue.frontend_polygons || []).map((polygon) => ({
                points: absolutePoints(polygon, imageWidth, imageHeight),
                smoothPoints: sampleSmoothPoints(polygon, imageWidth, imageHeight),
                pathD: smoothPathFromNormalized(polygon, imageWidth, imageHeight),
                dashed: false
            })),
            centroid: centroidFromNormalized(issue.frontend_polygons || [])
        }));
        const praiseEntries = scene.praise.map((praise, sourceIndex) => ({
            kind: "praise",
            sourceIndex,
            description: praise.description || "Positive point identified",
            colors: praiseColors(),
            polygons: [{
                points: absolutePoints(praise.frontend_points || [], imageWidth, imageHeight),
                smoothPoints: sampleSmoothPoints(praise.frontend_points || [], imageWidth, imageHeight),
                pathD: smoothPathFromNormalized(praise.frontend_points || [], imageWidth, imageHeight),
                dashed: true
            }],
            centroid: centroidFromNormalized([praise.frontend_points || []])
        }));

        const items = issueEntries.concat(praiseEntries);
        const rowWidth = panelConfig.width - (panelPad * 2);
        const rowTextWidth = Math.max(24, rowWidth - (rowPadX * 2) - badgeSize - rowInnerGap);

        let contentHeight = 0;
        items.forEach((item, itemIndex) => {
            const lines = wrapText(item.description, rowTextWidth, rowFontSize, 0);
            const textHeight = Math.max(rowLineHeight, lines.length * rowLineHeight);
            const rowHeight = Math.max(badgeSize, textHeight) + (rowPadY * 2);
            rows.push({
                key: `${item.kind}:${item.sourceIndex}`,
                kind: item.kind,
                sourceIndex: item.sourceIndex,
                displayIndex: item.kind === "issue" ? item.sourceIndex + 1 : null,
                label: item.kind === "issue" ? String(item.sourceIndex + 1) : "✓",
                description: item.description,
                colors: item.colors,
                polygons: item.polygons,
                centroid: {
                    x: item.centroid.x * imageWidth,
                    y: item.centroid.y * imageHeight
                },
                rowHeight,
                textLinesRaw: lines
            });
            contentHeight += rowHeight;
            if (itemIndex < items.length - 1) contentHeight += panelGap;
        });

        const autoPanelHeight = panelPad + headerHeight + dividerMargin + 1 + dividerMargin + contentHeight + panelPad;
        let panelHeight = panelConfig.height != null ? panelConfig.height : autoPanelHeight;
        panelHeight = clamp(panelHeight, (panelPad * 2) + headerHeight + 9, imageHeight * THEME_V1.panel.maxHeightRatio);

        let panelY;
        if (panelConfig.y != null) {
            panelY = clamp(panelConfig.y, 0, imageHeight - panelHeight);
        } else {
            const bottom = panelConfig.bottom != null ? panelConfig.bottom : imageHeight * THEME_V1.panel.insetRatio;
            panelY = clamp(imageHeight - panelHeight - bottom, 0, imageHeight - panelHeight);
        }

        const panelX = panelConfig.x;
        const panelRect = { x: panelX, y: panelY, width: panelConfig.width, height: panelHeight };
        const headerRect = { x: panelX + panelPad, y: panelY + panelPad, width: panelConfig.width - (panelPad * 2), height: headerHeight };
        const accentRect = {
            x: headerRect.x,
            y: headerRect.y + Math.max(0, (headerHeight - accentHeight) / 2),
            width: accentWidth,
            height: accentHeight
        };
        const titleX = accentRect.x + accentRect.width + headerGap;
        const titleTop = panelY + panelPad + Math.max(0, (headerHeight - (titleLineHeight + THEME_V1.header.titleGapPx + subtitleLineHeight)) / 2) + headerTextOffsetY;
        const subtitleTop = titleTop + titleLineHeight + THEME_V1.header.titleGapPx;
        const dividerRect = {
            x: panelX + panelPad,
            y: panelY + panelPad + headerHeight + dividerMargin,
            width: panelConfig.width - (panelPad * 2),
            height: 1
        };
        const scrollTop = dividerRect.y + dividerRect.height + dividerMargin;
        const scrollBottom = panelY + panelHeight - panelPad;

        let currentY = scrollTop;
        rows.forEach((row, rowIndex) => {
            row.rect = {
                x: panelX + panelPad,
                y: currentY,
                width: rowWidth,
                height: row.rowHeight
            };
            row.badgeRect = {
                x: row.rect.x + rowPadX,
                y: row.rect.y + ((row.rowHeight - badgeSize) / 2),
                width: badgeSize,
                height: badgeSize
            };
            row.textBox = {
                x: row.badgeRect.x + row.badgeRect.width + rowInnerGap,
                y: row.rect.y + rowPadY + rowTextOffsetY,
                width: rowTextWidth,
                height: Math.max(rowLineHeight, row.rowHeight - (rowPadY * 2) - rowTextOffsetY)
            };
            row.textLines = computeTextLines(
                row.description,
                row.textBox.x,
                row.textBox.y,
                row.textBox.width,
                rowFontSize,
                rowLineHeight,
                rgbaToCss(THEME_V1.row.textColor),
                THEME_V1.row.fontWeight,
                0
            );
            row.visible = row.rect.y < scrollBottom && (row.rect.y + row.rect.height) > scrollTop;

            const rowCenterX = row.rect.x + (row.rect.width / 2);
            const rowCenterY = row.rect.y + (row.rect.height / 2);
            const direction = row.centroid.x > rowCenterX ? 1 : -1;
            const exitX = direction === 1 ? (row.rect.x + row.rect.width) : row.rect.x;
            const exitY = rowCenterY;
            const dx = row.centroid.x - exitX;
            const dy = row.centroid.y - exitY;
            const distance = Math.max(1, Math.sqrt((dx * dx) + (dy * dy)));
            row.leader = {
                start: { x: exitX, y: exitY },
                ctrl1: { x: exitX + (direction * Math.min(distance * 0.4, 200)), y: exitY },
                ctrl2: { x: row.centroid.x - (direction * Math.min(distance * 0.15, 80)), y: row.centroid.y + ((exitY - row.centroid.y) * 0.2) },
                end: { x: row.centroid.x, y: row.centroid.y }
            };
            row.nodeDot = {
                x: exitX,
                y: exitY,
                radius: THEME_V1.leader.nodeRadius
            };
            row.overlayBadge = {
                x: row.centroid.x,
                y: row.centroid.y,
                radius: Math.max(
                    row.badgeRect.width / 2,
                    row.kind === "praise" ? THEME_V1.leader.praiseBadgeRadius : THEME_V1.leader.issueBadgeRadius
                )
            };

            currentY += row.rowHeight;
            if (rowIndex < rows.length - 1) currentY += panelGap;
        });

        const titleField = {
            key: "title",
            kind: "title",
            text: scene.header_title,
            rect: {
                x: titleX,
                y: titleTop,
                width: titleMaxWidth,
                height: titleLineHeight
            },
            fontSize: titleFontSize,
            lineHeight: titleLineHeight,
            fontWeight: THEME_V1.header.titleWeight,
            letterSpacing: titleLetterSpacing,
            color: rgbaToCss(THEME_V1.header.titleColor)
        };
        const subtitleField = {
            key: "subtitle",
            kind: "subtitle",
            text: scene.location_name.toUpperCase(),
            rect: {
                x: titleX,
                y: subtitleTop,
                width: titleMaxWidth,
                height: subtitleLineHeight
            },
            fontSize: subtitleFontSize,
            lineHeight: subtitleLineHeight,
            fontWeight: THEME_V1.header.subtitleWeight,
            letterSpacing: subtitleLetterSpacing,
            color: rgbaToCss(THEME_V1.header.subtitleColor)
        };

        return {
            version: THEME_V1.version,
            theme: clone(THEME_V1),
            imageWidth,
            imageHeight,
            scene,
            metrics: {
                cqi,
                panelPad,
                panelGap,
                headerGap,
                accentWidth,
                accentHeight,
                titleFontSize,
                subtitleFontSize,
                rowFontSize,
                rowLineHeight,
                badgeSize,
                badgeFontSize,
                rowPadY,
                rowPadX,
                rowInnerGap
            },
            panel: {
                rect: panelRect,
                anchorX: panelConfig.anchorX,
                anchorY: panelConfig.anchorY,
                background: rgbaToPlan(THEME_V1.panel.background),
                border: rgbaToPlan(THEME_V1.panel.border),
                radius: THEME_V1.panel.radiusPx,
                shadow: {
                    dx: THEME_V1.panel.shadow.dx,
                    dy: THEME_V1.panel.shadow.dy,
                    blur: THEME_V1.panel.shadow.blur,
                    color: rgbaToPlan(THEME_V1.panel.shadow.color)
                },
                header: {
                    rect: headerRect,
                    accentRect,
                    title: {
                        text: titleText,
                        x: titleX,
                        y: titleTop,
                        maxWidth: titleMaxWidth,
                        fontSize: titleFontSize,
                        lineHeight: titleLineHeight,
                        fontWeight: THEME_V1.header.titleWeight,
                        letterSpacing: titleLetterSpacing,
                        color: rgbaToPlan(THEME_V1.header.titleColor)
                    },
                    subtitle: {
                        text: subtitleText,
                        x: titleX,
                        y: subtitleTop,
                        maxWidth: titleMaxWidth,
                        fontSize: subtitleFontSize,
                        lineHeight: subtitleLineHeight,
                        fontWeight: THEME_V1.header.subtitleWeight,
                        letterSpacing: subtitleLetterSpacing,
                        color: rgbaToPlan(THEME_V1.header.subtitleColor)
                    }
                },
                divider: {
                    rect: dividerRect,
                    color: rgbaToPlan(THEME_V1.header.dividerColor)
                },
                rows
            },
            fields: [
                titleField,
                subtitleField,
                ...rows.map((row) => ({
                    key: row.key,
                    kind: row.kind,
                    sourceIndex: row.sourceIndex,
                    text: row.description,
                    rect: row.textBox,
                    rowRect: row.rect,
                    fontSize: rowFontSize,
                    lineHeight: rowLineHeight,
                    fontWeight: THEME_V1.row.fontWeight,
                    letterSpacing: 0,
                    color: rgbaToCss(THEME_V1.row.textColor)
                }))
            ]
        };
    }

    function cubicPath(leader) {
        return [
            `M ${leader.start.x.toFixed(2)} ${leader.start.y.toFixed(2)}`,
            `C ${leader.ctrl1.x.toFixed(2)} ${leader.ctrl1.y.toFixed(2)},`,
            `${leader.ctrl2.x.toFixed(2)} ${leader.ctrl2.y.toFixed(2)},`,
            `${leader.end.x.toFixed(2)} ${leader.end.y.toFixed(2)}`
        ].join(" ");
    }

    function renderPlanToSvg(plan, assets = {}) {
        const badgeShadowId = "annotation-badge-shadow";
        const panelShadowId = "annotation-panel-shadow";
        const panelClipId = "annotation-panel-clip";
        const panelBlurId = "annotation-panel-blur";
        const baseImageHref = assets.baseImageHref || assets.baseImageSource || assets.imageHref || "";

        const polygonMarkup = plan.panel.rows.map((row) => {
            return row.polygons.map((polygon) => `
                <path
                    d="${polygon.pathD}"
                    fill="${row.colors.fill.css}"
                    stroke="${row.colors.border.css}"
                    stroke-width="${plan.theme.shape.strokeWidth}"
                    ${polygon.dashed ? `stroke-dasharray="${plan.theme.shape.dashArray.join(" ")}"` : ""}
                />`).join("");
        }).join("");

        const rowMarkup = plan.panel.rows.map((row) => {
            const textMarkup = row.textLines.map((line) => `
                <text
                    x="${line.x.toFixed(2)}"
                    y="${line.y.toFixed(2)}"
                    font-family="${pathEscape(THEME_V1.fontFamily)}"
                    font-size="${line.fontSize.toFixed(2)}"
                    font-weight="${line.fontWeight}"
                    fill="${line.color}"
                    dominant-baseline="hanging"
                    letter-spacing="${line.letterSpacing.toFixed(2)}"
                >${pathEscape(line.text)}</text>
            `).join("");

            return `
                <g data-row-key="${pathEscape(row.key)}">
                    <rect
                        x="${row.rect.x.toFixed(2)}"
                        y="${row.rect.y.toFixed(2)}"
                        width="${row.rect.width.toFixed(2)}"
                        height="${row.rect.height.toFixed(2)}"
                        rx="${THEME_V1.row.radiusPx}"
                        fill="${rgbaToCss(THEME_V1.row.background)}"
                        stroke="${row.colors.line.css}"
                        stroke-width="${plan.theme.row.borderWidth}"
                    />
                    <circle
                        cx="${(row.badgeRect.x + (row.badgeRect.width / 2)).toFixed(2)}"
                        cy="${(row.badgeRect.y + (row.badgeRect.height / 2)).toFixed(2)}"
                        r="${(row.badgeRect.width / 2).toFixed(2)}"
                        fill="${row.colors.solid.css}"
                    />
                    <text
                        x="${(row.badgeRect.x + (row.badgeRect.width / 2)).toFixed(2)}"
                        y="${(row.badgeRect.y + (row.badgeRect.height / 2)).toFixed(2)}"
                        font-family="${pathEscape(THEME_V1.fontFamily)}"
                        font-size="${plan.metrics.badgeFontSize.toFixed(2)}"
                        font-weight="${THEME_V1.badge.fontWeight}"
                        fill="${rgbaToCss(THEME_V1.badge.textColor)}"
                        text-anchor="middle"
                        dominant-baseline="central"
                    >${pathEscape(row.label)}</text>
                    ${textMarkup}
                </g>
            `;
        }).join("");

        const leaderMarkup = plan.panel.rows.map((row) => `
            <g data-leader-key="${pathEscape(row.key)}" filter="url(#${badgeShadowId})">
                <path
                    d="${cubicPath(row.leader)}"
                    fill="none"
                    stroke="${row.colors.line.css}"
                    stroke-width="${THEME_V1.leader.strokeWidth}"
                />
                <circle
                    cx="${row.nodeDot.x.toFixed(2)}"
                    cy="${row.nodeDot.y.toFixed(2)}"
                    r="${row.nodeDot.radius.toFixed(2)}"
                    fill="${row.colors.solid.css}"
                    stroke="${rgbaToCss(THEME_V1.leader.nodeStrokeColor)}"
                    stroke-width="${THEME_V1.leader.nodeStrokeWidth}"
                />
                <circle
                    cx="${row.overlayBadge.x.toFixed(2)}"
                    cy="${row.overlayBadge.y.toFixed(2)}"
                    r="${row.overlayBadge.radius.toFixed(2)}"
                    fill="${row.colors.solid.css}"
                    stroke="${rgbaToCss(THEME_V1.leader.badgeStrokeColor)}"
                    stroke-width="${THEME_V1.leader.badgeStrokeWidth}"
                />
                <text
                    x="${row.overlayBadge.x.toFixed(2)}"
                    y="${row.overlayBadge.y.toFixed(2)}"
                    font-family="${pathEscape(THEME_V1.fontFamily)}"
                    font-size="${(plan.metrics.badgeFontSize * THEME_V1.overlayBadge.fontSizeScale).toFixed(2)}"
                    font-weight="${THEME_V1.badge.fontWeight}"
                    fill="${rgbaToCss(THEME_V1.badge.textColor)}"
                    text-anchor="middle"
                    dominant-baseline="central"
                >${pathEscape(row.label)}</text>
            </g>
        `).join("");

        const panelBackdropMarkup = baseImageHref ? `
    <g data-layer="panel-backdrop">
        <image
            href="${pathEscape(baseImageHref)}"
            x="0"
            y="0"
            width="${plan.imageWidth}"
            height="${plan.imageHeight}"
            preserveAspectRatio="none"
            clip-path="url(#${panelClipId})"
            filter="url(#${panelBlurId})"
        />
    </g>` : "";

        return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${plan.imageWidth} ${plan.imageHeight}" width="${plan.imageWidth}" height="${plan.imageHeight}" preserveAspectRatio="xMidYMid meet">
    <defs>
        <filter id="${badgeShadowId}" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.6)" />
        </filter>
        <filter id="${panelShadowId}" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
                dx="${plan.panel.shadow.dx}"
                dy="${plan.panel.shadow.dy}"
                stdDeviation="${(plan.panel.shadow.blur / 8).toFixed(2)}"
                flood-color="${plan.panel.shadow.color.css}"
            />
        </filter>
        <clipPath id="${panelClipId}">
            <rect
                x="${plan.panel.rect.x.toFixed(2)}"
                y="${plan.panel.rect.y.toFixed(2)}"
                width="${plan.panel.rect.width.toFixed(2)}"
                height="${plan.panel.rect.height.toFixed(2)}"
                rx="${plan.panel.radius}"
            />
        </clipPath>
        <filter id="${panelBlurId}" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="${(plan.theme.panel.backdropBlurPx / 2).toFixed(2)}" />
        </filter>
    </defs>

    ${panelBackdropMarkup}
    <g data-layer="polygons">${polygonMarkup}</g>

    <g data-layer="panel" filter="url(#${panelShadowId})">
        <rect
            x="${plan.panel.rect.x.toFixed(2)}"
            y="${plan.panel.rect.y.toFixed(2)}"
            width="${plan.panel.rect.width.toFixed(2)}"
            height="${plan.panel.rect.height.toFixed(2)}"
            rx="${plan.panel.radius}"
            fill="${plan.panel.background.css}"
            stroke="${plan.panel.border.css}"
            stroke-width="${plan.theme.panel.borderWidth}"
        />
        <rect
            x="${plan.panel.header.accentRect.x.toFixed(2)}"
            y="${plan.panel.header.accentRect.y.toFixed(2)}"
            width="${plan.panel.header.accentRect.width.toFixed(2)}"
            height="${plan.panel.header.accentRect.height.toFixed(2)}"
            rx="${Math.max(1, plan.panel.header.accentRect.width / 2).toFixed(2)}"
            fill="${rgbaToCss(THEME_V1.header.accentColor)}"
        />
        <text
            x="${plan.panel.header.title.x.toFixed(2)}"
            y="${plan.panel.header.title.y.toFixed(2)}"
            font-family="${pathEscape(THEME_V1.fontFamily)}"
            font-size="${plan.panel.header.title.fontSize.toFixed(2)}"
            font-weight="${plan.panel.header.title.fontWeight}"
            fill="${plan.panel.header.title.color.css}"
            dominant-baseline="hanging"
            letter-spacing="${plan.panel.header.title.letterSpacing.toFixed(2)}"
        >${pathEscape(plan.panel.header.title.text)}</text>
        <text
            x="${plan.panel.header.subtitle.x.toFixed(2)}"
            y="${plan.panel.header.subtitle.y.toFixed(2)}"
            font-family="${pathEscape(THEME_V1.fontFamily)}"
            font-size="${plan.panel.header.subtitle.fontSize.toFixed(2)}"
            font-weight="${plan.panel.header.subtitle.fontWeight}"
            fill="${plan.panel.header.subtitle.color.css}"
            dominant-baseline="hanging"
            letter-spacing="${plan.panel.header.subtitle.letterSpacing.toFixed(2)}"
        >${pathEscape(plan.panel.header.subtitle.text)}</text>
        <rect
            x="${plan.panel.divider.rect.x.toFixed(2)}"
            y="${plan.panel.divider.rect.y.toFixed(2)}"
            width="${plan.panel.divider.rect.width.toFixed(2)}"
            height="${plan.panel.divider.rect.height.toFixed(2)}"
            fill="${plan.panel.divider.color.css}"
        />
        ${rowMarkup}
    </g>

    <g data-layer="leaders">${leaderMarkup}</g>
</svg>
        `.trim();
    }

    function renderAnnotatedScene(sceneInput, assets) {
        const imageWidth = Number(assets && assets.imageWidth);
        const imageHeight = Number(assets && assets.imageHeight);
        if (!imageWidth || !imageHeight) {
            throw new Error("renderAnnotatedScene requires imageWidth and imageHeight");
        }
        const layoutMap = computeLayout(sceneInput, imageWidth, imageHeight);
        return {
            scene: layoutMap.scene,
            theme: layoutMap.theme,
            layoutMap,
            svg: renderPlanToSvg(layoutMap, assets || {})
        };
    }

    function loadImageAsset(source) {
        return new Promise((resolve, reject) => {
            if (!source) {
                reject(new Error("No image source provided for rasterization"));
                return;
            }
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Failed to load image asset for rasterization"));
            img.src = source;
        });
    }

    async function rasterizeAnnotatedScene(sceneInput, assets, options = {}) {
        if (typeof document === "undefined") {
            throw new Error("rasterizeAnnotatedScene is only available in a browser environment");
        }

        const result = renderAnnotatedScene(sceneInput, assets);
        return rasterizeRenderedScene(result, assets, options);
    }

    async function rasterizeRenderedScene(renderResult, assets, options = {}) {
        if (typeof document === "undefined") {
            throw new Error("rasterizeRenderedScene is only available in a browser environment");
        }

        const imageWidth = Number(assets && assets.imageWidth);
        const imageHeight = Number(assets && assets.imageHeight);
        const outputWidth = Math.max(1, Math.round(options.outputWidth || imageWidth));
        const outputHeight = Math.max(1, Math.round(options.outputHeight || imageHeight));
        const canvas = document.createElement("canvas");
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            throw new Error("Failed to create rasterization canvas context");
        }

        const baseImageSource = assets && (
            assets.baseImageSource ||
            assets.imageSource ||
            assets.rawImage ||
            assets.src
        );

        if (baseImageSource) {
            const baseImage = await loadImageAsset(baseImageSource);
            ctx.drawImage(baseImage, 0, 0, outputWidth, outputHeight);
        }

        const overlaySource = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderResult.svg)}`;
        const overlayImage = await loadImageAsset(overlaySource);
        ctx.drawImage(overlayImage, 0, 0, outputWidth, outputHeight);

        if (options.returnCanvas) {
            return {
                ...renderResult,
                canvas
            };
        }

        if (options.returnBlob) {
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob((value) => {
                    if (!value) {
                        reject(new Error("Failed to encode rasterized annotation image"));
                        return;
                    }
                    resolve(value);
                }, options.mimeType || "image/png", options.quality);
            });
            return {
                ...renderResult,
                blob,
                canvas
            };
        }

        return {
            ...renderResult,
            dataUrl: canvas.toDataURL(options.mimeType || "image/png", options.quality),
            canvas
        };
    }

    return {
        THEME_V1,
        normalizeScene,
        renderAnnotatedScene,
        rasterizeAnnotatedScene,
        rasterizeRenderedScene,
        computeLayout,
        smoothPathFromNormalized,
        absolutePoints,
        rectToPercentStyle,
        rgbaToCss
    };
});
