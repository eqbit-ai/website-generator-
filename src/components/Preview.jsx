// src/components/Preview.jsx

import React, { useEffect, useRef, useCallback } from 'react';

// Extract Google Font URLs from CSS @import and HTML <link> tags
function extractGoogleFonts(cssContent, htmlContent) {
    const fontUrls = new Set();

    // Extract @import url('...fonts.googleapis.com...')
    const importRegex = /@import\s+url\(["']?(https:\/\/fonts\.googleapis\.com\/css2[^"')\s]+)["']?\)/gi;
    let match;
    while ((match = importRegex.exec(cssContent || '')) !== null) {
        fontUrls.add(match[1]);
    }

    // Extract <link href="...fonts.googleapis.com...">
    const linkRegex = /<link[^>]+href=["'](https:\/\/fonts\.googleapis\.com\/css2[^"']+)["'][^>]*\/?>/gi;
    while ((match = linkRegex.exec(htmlContent || '')) !== null) {
        fontUrls.add(match[1]);
    }

    return Array.from(fontUrls);
}

// Remove @import for Google Fonts from CSS (they'll be loaded via <link> in head)
function cleanFontImportsFromCss(cssContent) {
    return (cssContent || '').replace(/@import\s+url\(["']?https:\/\/fonts\.googleapis\.com[^)]+\)\s*;?/gi, '');
}

// Remove Google Font <link> tags from HTML body (they'll be in head)
function cleanFontLinksFromHtml(htmlContent) {
    return (htmlContent || '').replace(/<link[^>]*href=["']https:\/\/fonts\.googleapis\.com[^"']*["'][^>]*\/?>/gi, '');
}

const Preview = ({ html, css, js, editMode = false, onElementSelect, selectedElement }) => {
    const iframeRef = useRef(null);

    // Inject selection mode styles and handlers into iframe
    const getSelectionScript = useCallback(() => {
        if (!editMode) return '';

        return `
        <script>
        (function() {
            let selectedEl = null;
            let hoverEl = null;

            // Create highlight overlay
            const overlay = document.createElement('div');
            overlay.id = 'element-selector-overlay';
            overlay.style.cssText = 'position: fixed; pointer-events: none; border: 2px dashed #3b82f6; background: rgba(59, 130, 246, 0.1); z-index: 99999; display: none; transition: all 0.15s ease;';
            document.body.appendChild(overlay);

            // Create selected overlay
            const selectedOverlay = document.createElement('div');
            selectedOverlay.id = 'element-selected-overlay';
            selectedOverlay.style.cssText = 'position: fixed; pointer-events: none; border: 3px solid #10b981; background: rgba(16, 185, 129, 0.15); z-index: 99998; display: none;';
            document.body.appendChild(selectedOverlay);

            // Create label
            const label = document.createElement('div');
            label.id = 'element-selector-label';
            label.style.cssText = 'position: fixed; background: #3b82f6; color: white; padding: 2px 8px; font-size: 11px; font-family: monospace; z-index: 100000; display: none; border-radius: 3px; pointer-events: none;';
            document.body.appendChild(label);

            function getElementPath(el) {
                if (!el || el === document.body) return 'body';
                let path = el.tagName.toLowerCase();
                if (el.id) path += '#' + el.id;
                else if (el.className && typeof el.className === 'string') {
                    const classes = el.className.trim().split(/\\s+/).slice(0, 2).join('.');
                    if (classes) path += '.' + classes;
                }
                return path;
            }

            function positionOverlay(overlayEl, targetEl) {
                const rect = targetEl.getBoundingClientRect();
                overlayEl.style.left = rect.left + 'px';
                overlayEl.style.top = rect.top + 'px';
                overlayEl.style.width = rect.width + 'px';
                overlayEl.style.height = rect.height + 'px';
                overlayEl.style.display = 'block';
            }

            // Expanded valid element list — supports ALL common elements for editing
            function isValidElement(el) {
                if (!el || el === document.body || el === document.documentElement) return false;
                if (el.id && el.id.startsWith('element-selector')) return false;
                const tag = el.tagName.toLowerCase();
                return [
                    // Structural
                    'div', 'section', 'header', 'footer', 'nav', 'main', 'article', 'aside',
                    // Headings
                    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    // Text
                    'p', 'span', 'a', 'strong', 'em', 'b', 'i', 'u', 'mark', 'small', 'sub', 'sup',
                    'blockquote', 'cite', 'q', 'code', 'pre', 'time', 'address',
                    // Interactive
                    'button', 'input', 'textarea', 'label', 'select', 'option',
                    // Media
                    'img', 'video', 'audio', 'picture', 'source', 'figure', 'figcaption', 'svg',
                    // Lists
                    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
                    // Tables
                    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
                    // Form
                    'form', 'fieldset', 'legend',
                    // Other
                    'details', 'summary', 'hr'
                ].includes(tag);
            }

            document.addEventListener('mousemove', function(e) {
                const el = document.elementFromPoint(e.clientX, e.clientY);
                if (!el || !isValidElement(el)) {
                    overlay.style.display = 'none';
                    label.style.display = 'none';
                    hoverEl = null;
                    return;
                }

                if (el !== hoverEl) {
                    hoverEl = el;
                    positionOverlay(overlay, el);
                    label.textContent = getElementPath(el);
                    label.style.left = e.clientX + 10 + 'px';
                    label.style.top = e.clientY + 10 + 'px';
                    label.style.display = 'block';
                }
            });

            document.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const el = document.elementFromPoint(e.clientX, e.clientY);
                if (!el || !isValidElement(el)) return;

                selectedEl = el;
                positionOverlay(selectedOverlay, el);

                // Get element info to send to parent
                const elementInfo = {
                    tagName: el.tagName.toLowerCase(),
                    id: el.id || null,
                    className: el.className || null,
                    path: getElementPath(el),
                    outerHTML: el.outerHTML,
                    textContent: el.textContent?.substring(0, 100) || '',
                    src: el.src || el.getAttribute('src') || null,
                    alt: el.alt || el.getAttribute('alt') || null,
                    href: el.href || el.getAttribute('href') || null,
                    rect: el.getBoundingClientRect()
                };

                // Send to parent window
                window.parent.postMessage({
                    type: 'element-selected',
                    element: elementInfo
                }, '*');
            }, true);

            // Handle scroll to reposition overlays
            document.addEventListener('scroll', function() {
                if (selectedEl) {
                    positionOverlay(selectedOverlay, selectedEl);
                }
            });
        })();
        ${'<'}/script>
        `;
    }, [editMode]);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        // Write content to iframe
        const writeContent = () => {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) return;

            const selectionScript = getSelectionScript();
            const editModeStyles = editMode ? `
                * { cursor: crosshair !important; }
                *:hover { outline: 1px dashed rgba(59, 130, 246, 0.5) !important; }
            ` : '';

            // Extract Google Fonts from CSS and HTML, then load via <link> in <head>
            const fontUrls = extractGoogleFonts(css, html);
            const fontLinkTags = fontUrls.map(url =>
                `<link rel="stylesheet" href="${url}">`
            ).join('\n  ');

            // Clean font @imports from CSS and <link> tags from HTML body to avoid double loading
            const cleanedCss = cleanFontImportsFromCss(css);
            const cleanedHtml = cleanFontLinksFromHtml(html);

            // Minimal safety styles — no destructive overrides
            const safetyStyles = `
                /* Safety: prevent horizontal overflow */
                body { overflow-x: hidden !important; }
                /* Safety: prevent image overflow */
                img { max-width: 100%; height: auto; }
            `;

            // Wrap JS in error boundary to prevent console errors from breaking the preview
            const safeJs = js ? `(function() {
                'use strict';
                try {
                    ${js}
                } catch(e) {
                    console.warn('[Website Script]:', e.message);
                }
            })();` : '';

            const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${fontLinkTags}
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"><\/script>
  <script src="https://unpkg.com/lenis@1.1.18/dist/lenis.min.js"><\/script>
  <style>
    ${cleanedCss || ''}
    ${safetyStyles}
    ${editModeStyles}
  </style>
</head>
<body>
  ${cleanedHtml || `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a0a0f;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;overflow:hidden">
    <div style="text-align:center;position:relative">
      <div style="width:120px;height:120px;border-radius:50%;background:linear-gradient(135deg,rgba(99,102,241,0.25),rgba(168,85,247,0.18));margin:0 auto 2rem;position:relative;animation:float 6s ease-in-out infinite">
        <div style="position:absolute;inset:15px;border-radius:50%;border:1.5px dashed rgba(99,102,241,0.3);animation:spin 20s linear infinite"></div>
        <div style="position:absolute;inset:30px;border-radius:50%;background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(168,85,247,0.1));display:flex;align-items:center;justify-content:center">
          <svg width="32" height="32" fill="none" stroke="rgba(99,102,241,0.7)" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        </div>
      </div>
      <h2 style="color:#fff;font-size:1.5rem;font-weight:700;margin:0 0 0.5rem;letter-spacing:-0.02em">Create Something Amazing</h2>
      <p style="color:#606070;font-size:0.9375rem;margin:0 0 2rem;max-width:280px;line-height:1.6">Describe your vision and watch it come to life in seconds</p>
      <div style="display:inline-flex;align-items:center;gap:8px;color:rgba(99,102,241,0.6);font-size:0.8125rem;font-weight:500">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Type a prompt to begin
      </div>
    </div>
    <style>@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
  </div>`}
  <script>
    ${safeJs}
  ${'<'}/script>
  ${selectionScript}
</body>
</html>`;

            doc.open();
            doc.write(fullHTML);
            doc.close();
        };

        // If iframe is already loaded, write immediately
        if (iframe.contentDocument?.readyState === 'complete') {
            writeContent();
        } else {
            iframe.addEventListener('load', writeContent);
            const timeout = setTimeout(writeContent, 100);

            return () => {
                iframe.removeEventListener('load', writeContent);
                clearTimeout(timeout);
            };
        }
    }, [html, css, js, editMode, getSelectionScript]);

    // Listen for messages from iframe
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data?.type === 'element-selected' && onElementSelect) {
                onElementSelect(event.data.element);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onElementSelect]);

    return (
        <div className="preview-container">
            <iframe
                ref={iframeRef}
                title="Website Preview"
                sandbox="allow-scripts allow-same-origin"
                className="preview-iframe"
                srcDoc="<!DOCTYPE html><html><body></body></html>"
            />
        </div>
    );
};

export default Preview;
