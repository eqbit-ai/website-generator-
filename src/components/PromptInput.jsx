// src/components/PromptInput.jsx

import React, { useState } from 'react';
import { Wand2, Clock, Square, Search, FolderDown, FileCode, Eye } from 'lucide-react';

const PHASE_CONFIG = {
    analyzing: { icon: Search, label: 'Analyzing prompt...', color: '#818cf8' },
    fetching:  { icon: FolderDown, label: 'Fetching assets...', color: '#a855f7' },
    compiling: { icon: FileCode, label: 'Compiling files...', color: '#6366f1' },
    writing:   { icon: FileCode, label: 'Writing code...', color: '#22c55e' },
    done:      { icon: Eye, label: 'Launching preview...', color: '#22c55e' },
};

const PromptInput = ({ onGenerate, onStop, isLoading, genPhase = 'idle', promptHistory = [] }) => {
    const [prompt, setPrompt] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (prompt.trim() && !isLoading) {
            onGenerate(prompt);
            setPrompt('');
        }
    };

    const phaseInfo = PHASE_CONFIG[genPhase];

    const examplePrompts = [
        "A modern pet shop website with adorable animal photos",
        "A professional dental clinic website with clean design",
        "A luxury spa and wellness center with calming aesthetics",
        "A tech startup landing page with futuristic design",
        "A restaurant website with food photography gallery",
        "A fitness gym website with energy and motivation"
    ];

    return (
        <div className="prompt-input-container">
            <form onSubmit={handleSubmit} className="prompt-form">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your website or request changes to the current design..."
                    className="prompt-textarea"
                    rows={4}
                    disabled={isLoading}
                />
                {isLoading ? (
                    <div className="generation-controls">
                        <div className="generation-status">
                            {phaseInfo && (
                                <div className="phase-indicator" style={{ '--phase-color': phaseInfo.color }}>
                                    <phaseInfo.icon className="icon spinning" size={16} />
                                    <span>{phaseInfo.label}</span>
                                    <div className="phase-progress" />
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            className="stop-button"
                            onClick={onStop}
                            title="Stop generation"
                        >
                            <Square size={14} />
                            Stop
                        </button>
                    </div>
                ) : (
                    <button
                        type="submit"
                        className="generate-button"
                        disabled={!prompt.trim()}
                    >
                        <Wand2 className="icon" size={20} />
                        Generate Website
                    </button>
                )}
            </form>

            {/* Prompt History */}
            {promptHistory.length > 0 && (
                <div className="prompt-history">
                    <div className="history-header">
                        <Clock size={16} />
                        <span>Your Prompts</span>
                    </div>
                    <div className="history-list">
                        {promptHistory.map((item, index) => (
                            <div key={index} className="history-item">
                                <span className="history-number">{index + 1}.</span>
                                <span className="history-text">{item.text}</span>
                                <span className="history-time">{item.timestamp}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="example-prompts">
                <p className="example-label">Try an example:</p>
                <div className="example-buttons">
                    {examplePrompts.map((example, index) => (
                        <button
                            key={index}
                            className="example-button"
                            onClick={() => setPrompt(example)}
                        >
                            {example}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PromptInput;