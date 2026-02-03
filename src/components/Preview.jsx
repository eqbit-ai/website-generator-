// src/components/Preview.jsx

import React, { useEffect, useRef, useCallback } from 'react';

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

            function isValidElement(el) {
                if (!el || el === document.body || el === document.documentElement) return false;
                if (el.id && el.id.startsWith('element-selector')) return false;
                const tag = el.tagName.toLowerCase();
                // Allow selection of meaningful elements
                return ['div', 'section', 'header', 'footer', 'nav', 'main', 'article', 'aside',
                        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'img',
                        'ul', 'ol', 'li', 'form', 'input', 'textarea', 'label', 'figure', 'figcaption'].includes(tag);
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
        <\/script>
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

            const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>
    /* Prevent FOUC (Flash of Unstyled Content) */
    body { visibility: hidden; }
    body.loaded { visibility: visible; }
    ${css || ''}
    ${editModeStyles}
  </style>
</head>
<body>
  ${html || '<p style="padding: 20px; color: #666; font-family: sans-serif;">Enter a prompt to generate your website...</p>'}
  <script>
    // Show body only after CSS is parsed
    document.addEventListener('DOMContentLoaded', function() {
      document.body.classList.add('loaded');
    });
    ${js || ''}
  <\/script>
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
            // Otherwise wait for load event
            iframe.addEventListener('load', writeContent);
            // Also try writing after a small delay as fallback
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
