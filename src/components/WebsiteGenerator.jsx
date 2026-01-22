// src/components/WebsiteGenerator.jsx

import React, { useState } from 'react';
import { Download, Code, Eye, RefreshCw, Rocket } from 'lucide-react';
import PromptInput from './PromptInput';
import Preview from './Preview';
import CodeEditor from './CodeEditor';
import DeployModal from './DeployModal';
import { generateWebsite } from '../services/api';

const WebsiteGenerator = () => {
    const [html, setHtml] = useState('');
    const [css, setCss] = useState('');
    const [js, setJs] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState('preview'); // 'preview' or 'code'
    const [error, setError] = useState(null);
    const [showDeployModal, setShowDeployModal] = useState(false);

    const handleGenerate = async (prompt) => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await generateWebsite(prompt);

            if (result.success) {
                setHtml(result.website.html);
                setCss(result.website.css);
                setJs(result.website.js || '');
            } else {
                setError(result.error || 'Failed to generate website. Please try again.');
            }
        } catch (err) {
            console.error('Generation error:', err);
            setError(err.message || 'An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = () => {
        const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Website</title>
  <style>
${css}
  </style>
</head>
<body>
${html}
  <script>
${js}
  </script>
</body>
</html>`;

        const blob = new Blob([fullHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'website.html';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleReset = () => {
        setHtml('');
        setCss('');
        setJs('');
        setError(null);
    };

    return (
        <div className="generator-container">
            {/* Header */}
            <header className="generator-header">
                <div className="header-left">
                    <h1 className="generator-title">
                        <Wand2Icon />
                        AI Website Generator
                    </h1>
                    <p className="generator-subtitle">
                        Describe your dream website and watch it come to life
                    </p>
                </div>
                <div className="header-actions">
                    {html && (
                        <>
                            <button className="action-button" onClick={handleReset}>
                                <RefreshCw size={18} />
                                Reset
                            </button>
                            <button className="action-button primary" onClick={handleExport}>
                                <Download size={18} />
                                Export HTML
                            </button>
                            <button className="action-button primary" onClick={() => setShowDeployModal(true)}>
                                <Rocket size={18} />
                                Deploy
                            </button>
                        </>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <div className="generator-main">
                {/* Left Panel - Prompt Input */}
                <aside className="generator-sidebar">
                    <PromptInput onGenerate={handleGenerate} isLoading={isLoading} />

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}
                </aside>

                {/* Right Panel - Preview/Editor */}
                <main className="generator-content">
                    {/* View Toggle */}
                    <div className="view-toggle">
                        <button
                            className={`toggle-button ${viewMode === 'preview' ? 'active' : ''}`}
                            onClick={() => setViewMode('preview')}
                        >
                            <Eye size={18} />
                            Preview
                        </button>
                        <button
                            className={`toggle-button ${viewMode === 'code' ? 'active' : ''}`}
                            onClick={() => setViewMode('code')}
                        >
                            <Code size={18} />
                            Code
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="content-area">
                        {viewMode === 'preview' ? (
                            <Preview html={html} css={css} js={js} />
                        ) : (
                            <CodeEditor
                                html={html}
                                css={css}
                                js={js}
                                onHtmlChange={setHtml}
                                onCssChange={setCss}
                                onJsChange={setJs}
                            />
                        )}
                    </div>
                </main>
            </div>

            {/* Deploy Modal */}
            <DeployModal
                isOpen={showDeployModal}
                onClose={() => setShowDeployModal(false)}
                html={html}
                css={css}
                js={js}
            />
        </div>
    );
};

// Simple icon component
const Wand2Icon = () => (
    <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z" />
        <path d="m14 7 3 3" />
        <path d="M5 6v4" />
        <path d="M19 14v4" />
        <path d="M10 2v2" />
        <path d="M7 8H3" />
        <path d="M21 16h-4" />
        <path d="M11 3H9" />
    </svg>
);

export default WebsiteGenerator;