// src/components/WebsiteGenerator.jsx

import React, { useState } from 'react';
import { Download, Code, Eye, RefreshCw, Rocket, Sparkles, MousePointer2, X, Send } from 'lucide-react';
import PromptInput from './PromptInput';
import Preview from './Preview';
import CodeEditor from './CodeEditor';
import DeployModal from './DeployModal';
import { generateWebsite, clearSession, editElement } from '../services/api';

const WebsiteGenerator = () => {
    const [html, setHtml] = useState('');
    const [css, setCss] = useState('');
    const [js, setJs] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState('preview'); // 'preview' or 'code'
    const [error, setError] = useState(null);
    const [showDeployModal, setShowDeployModal] = useState(false);

    // NEW: Session tracking for iterations
    const [sessionId, setSessionId] = useState(null);
    const [isNewDesign, setIsNewDesign] = useState(true);
    const [designStyle, setDesignStyle] = useState(null);
    const [loadingMessage, setLoadingMessage] = useState('');

    // Prompt history (session-only, clears on refresh)
    const [promptHistory, setPromptHistory] = useState([]);

    // NEW: Element editing mode
    const [editMode, setEditMode] = useState(false);
    const [selectedElement, setSelectedElement] = useState(null);
    const [elementPrompt, setElementPrompt] = useState('');
    const [isEditingElement, setIsEditingElement] = useState(false);

    const handleGenerate = async (prompt) => {
        setIsLoading(true);
        setError(null);
        setLoadingMessage('Creating your unique design with AI...');

        // Add prompt to history
        setPromptHistory(prev => [...prev, {
            text: prompt,
            timestamp: new Date().toLocaleTimeString()
        }]);

        try {
            const result = await generateWebsite(prompt, sessionId);

            if (result.success) {
                setHtml(result.website.html);
                setCss(result.website.css);
                setJs(result.website.js || '');

                // Update session info
                setSessionId(result.sessionId);
                setIsNewDesign(result.isNewDesign);
                setDesignStyle(result.style);

                if (result.isNewDesign) {
                    console.log(`✨ New ${result.style} design created with ${result.palette} palette`);
                } else {
                    console.log(`🔄 Design updated (maintaining ${result.style} style)`);
                }
            } else {
                setError(result.error || 'Failed to generate website. Please try again.');
            }
        } catch (err) {
            console.error('Generation error:', err);
            setError(err.message || 'An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    // NEW: Handle element selection
    const handleElementSelect = (element) => {
        setSelectedElement(element);
        setElementPrompt('');
        console.log('Selected element:', element.path, element.outerHTML.substring(0, 100));
    };

    // NEW: Handle element edit submission
    const handleElementEdit = async () => {
        if (!selectedElement || !elementPrompt.trim()) return;

        setIsEditingElement(true);
        setError(null);

        try {
            const result = await editElement(
                sessionId,
                selectedElement.outerHTML,
                selectedElement.path,
                elementPrompt,
                { html, css }
            );

            if (result.success) {
                // Check if it's a manual replace scenario
                if (result.manualReplace) {
                    // Show the edited element to user and offer to copy
                    const userChoice = window.confirm(
                        `Element edited but couldn't auto-replace.\n\n` +
                        `The edited element has been copied to clipboard.\n` +
                        `You can switch to Code view and paste it manually.\n\n` +
                        `Click OK to copy, Cancel to dismiss.`
                    );
                    if (userChoice && result.editedElement) {
                        navigator.clipboard.writeText(result.editedElement);
                    }
                } else {
                    setHtml(result.website.html);
                    setCss(result.website.css);
                    if (result.website.js) setJs(result.website.js);
                }

                // Add to history
                setPromptHistory(prev => [...prev, {
                    text: `[Element: ${selectedElement.path}] ${elementPrompt}`,
                    timestamp: new Date().toLocaleTimeString()
                }]);

                // Clear selection
                setSelectedElement(null);
                setElementPrompt('');
                setEditMode(false);

                console.log(`✅ Element edited: ${selectedElement.path}`);
            } else {
                setError(result.error || 'Failed to edit element');
            }
        } catch (err) {
            console.error('Element edit error:', err);
            setError(err.message || 'Failed to edit element');
        } finally {
            setIsEditingElement(false);
        }
    };

    // NEW: Cancel element selection
    const handleCancelEdit = () => {
        setSelectedElement(null);
        setElementPrompt('');
        setEditMode(false);
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

    const handleReset = async () => {
        // Clear session on backend
        if (sessionId) {
            try {
                await clearSession(sessionId);
            } catch (err) {
                console.error('Failed to clear session:', err);
            }
        }

        // Reset all state
        setHtml('');
        setCss('');
        setJs('');
        setError(null);
        setSessionId(null);
        setIsNewDesign(true);
        setDesignStyle(null);
        setPromptHistory([]); // Clear prompt history
        setEditMode(false);
        setSelectedElement(null);
        setElementPrompt('');
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
                    {designStyle && (
                        <div className="design-status">
                            <Sparkles size={14} />
                            <span className="style-badge">{designStyle}</span>
                            {!isNewDesign && <span className="iteration-badge">Iteration Mode</span>}
                        </div>
                    )}
                </div>
                <div className="header-actions">
                    {html && (
                        <>
                            <button
                                className={`action-button ${editMode ? 'active edit-mode-active' : ''}`}
                                onClick={() => {
                                    setEditMode(!editMode);
                                    if (editMode) {
                                        setSelectedElement(null);
                                        setElementPrompt('');
                                    }
                                }}
                                title="Click to select and edit individual elements"
                            >
                                <MousePointer2 size={18} />
                                {editMode ? 'Exit Edit Mode' : 'Edit Element'}
                            </button>
                            <button className="action-button" onClick={handleReset}>
                                <RefreshCw size={18} />
                                New Design
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
                    <PromptInput
                        onGenerate={handleGenerate}
                        isLoading={isLoading}
                        loadingMessage={loadingMessage}
                        promptHistory={promptHistory}
                    />

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    {html && !isNewDesign && !editMode && (
                        <div className="iteration-tip">
                            💡 <strong>Tip:</strong> Your next prompt will improve the current design.
                            Say "make new design" to start fresh.
                        </div>
                    )}

                    {editMode && !selectedElement && (
                        <div className="edit-mode-tip">
                            <MousePointer2 size={16} />
                            <span><strong>Edit Mode Active</strong> — Click any element in the preview to select it for editing</span>
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
                        {editMode && (
                            <span className="edit-mode-indicator">
                                <MousePointer2 size={14} />
                                Element Selection Active
                            </span>
                        )}
                    </div>

                    {/* Content Area */}
                    <div className="content-area">
                        {viewMode === 'preview' ? (
                            <Preview
                                html={html}
                                css={css}
                                js={js}
                                editMode={editMode}
                                onElementSelect={handleElementSelect}
                                selectedElement={selectedElement}
                            />
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

                    {/* Element Edit Panel - Modal Style */}
                    {selectedElement && (
                        <>
                        <div className="element-edit-backdrop" onClick={handleCancelEdit} />
                        <div className="element-edit-panel">
                            <div className="element-edit-header">
                                <div className="selected-element-info">
                                    <span className="element-tag">&lt;{selectedElement.tagName}&gt;</span>
                                    <span className="element-path">{selectedElement.path}</span>
                                    {selectedElement.textContent && (
                                        <span className="element-preview">
                                            "{selectedElement.textContent.substring(0, 50)}{selectedElement.textContent.length > 50 ? '...' : ''}"
                                        </span>
                                    )}
                                </div>
                                <button className="close-button" onClick={handleCancelEdit}>
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="element-edit-body">
                                <input
                                    type="text"
                                    className="element-prompt-input"
                                    placeholder="Describe what you want to change (e.g., 'make text blue', 'change to larger font', 'add shadow')"
                                    value={elementPrompt}
                                    onChange={(e) => setElementPrompt(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleElementEdit()}
                                    disabled={isEditingElement}
                                    autoFocus
                                />
                                <button
                                    className="element-submit-button"
                                    onClick={handleElementEdit}
                                    disabled={isEditingElement || !elementPrompt.trim()}
                                >
                                    {isEditingElement ? (
                                        <span className="loading-spinner" />
                                    ) : (
                                        <Send size={18} />
                                    )}
                                </button>
                            </div>
                            <div className="element-edit-hint">
                                Press Enter to apply changes • Uses ~90% fewer tokens than full-page edits
                            </div>
                        </div>
                        </>
                    )}
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

            {/* Element Edit Styles */}
            <style>{`
                .edit-mode-active {
                    background: #3b82f6 !important;
                    color: white !important;
                    border-color: #3b82f6 !important;
                }

                .edit-mode-tip {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px;
                    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                    color: white;
                    border-radius: 8px;
                    margin-top: 12px;
                    font-size: 13px;
                }

                .edit-mode-indicator {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-left: auto;
                    padding: 4px 12px;
                    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                    color: white;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                }

                .element-edit-panel {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 90%;
                    max-width: 600px;
                    background: #1e1e2e;
                    border: 1px solid #444;
                    border-radius: 16px;
                    padding: 20px;
                    z-index: 10000;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    animation: popIn 0.2s ease;
                }

                .element-edit-backdrop {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: 9999;
                    animation: fadeIn 0.2s ease;
                }

                @keyframes popIn {
                    from { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
                    to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .element-edit-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 16px;
                }

                .selected-element-info {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .element-tag {
                    background: #3b82f6;
                    color: white;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-family: monospace;
                    font-size: 13px;
                    font-weight: 600;
                    display: inline-block;
                    width: fit-content;
                }

                .element-path {
                    color: #888;
                    font-family: monospace;
                    font-size: 12px;
                }

                .element-preview {
                    color: #10b981;
                    font-size: 12px;
                    max-width: 400px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    background: rgba(16, 185, 129, 0.1);
                    padding: 4px 8px;
                    border-radius: 4px;
                }

                .close-button {
                    background: #333;
                    border: none;
                    color: #888;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 8px;
                    transition: all 0.15s;
                }

                .close-button:hover {
                    background: #444;
                    color: white;
                }

                .element-edit-body {
                    display: flex;
                    gap: 10px;
                }

                .element-prompt-input {
                    flex: 1;
                    padding: 14px 16px;
                    background: #2a2a3e;
                    border: 2px solid #444;
                    border-radius: 10px;
                    color: white;
                    font-size: 15px;
                    outline: none;
                    transition: border-color 0.15s;
                }

                .element-prompt-input:focus {
                    border-color: #3b82f6;
                }

                .element-prompt-input::placeholder {
                    color: #666;
                }

                .element-submit-button {
                    padding: 14px 24px;
                    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                    border: none;
                    border-radius: 10px;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: opacity 0.15s, transform 0.15s;
                    font-weight: 600;
                }

                .element-submit-button:hover:not(:disabled) {
                    opacity: 0.9;
                    transform: scale(1.02);
                }

                .element-submit-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .element-edit-hint {
                    margin-top: 12px;
                    font-size: 12px;
                    color: #666;
                    text-align: center;
                }

                .loading-spinner {
                    width: 18px;
                    height: 18px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .content-area {
                    position: relative;
                }
            `}</style>
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
