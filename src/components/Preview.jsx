// src/components/Preview.jsx

import React, { useEffect, useRef } from 'react';

const Preview = ({ html, css, js }) => {
    const iframeRef = useRef(null);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        // Wait for iframe to be ready
        const writeContent = () => {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) return;

            const fullHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>${css || ''}</style>
</head>
<body>
  ${html || '<p style="padding: 20px; color: #666; font-family: sans-serif;">Enter a prompt to generate your website...</p>'}
  <script>${js || ''}<\/script>
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
    }, [html, css, js]);

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