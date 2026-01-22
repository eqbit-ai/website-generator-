// src/components/PromptInput.jsx

import React, { useState } from 'react';
import { Wand2, Loader2 } from 'lucide-react';

const PromptInput = ({ onGenerate, isLoading }) => {
    const [prompt, setPrompt] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (prompt.trim() && !isLoading) {
            onGenerate(prompt);
        }
    };

    const examplePrompts = [
        "A modern portfolio website for a photographer",
        "A landing page for a SaaS startup",
        "A restaurant website with menu section",
        "A personal blog with dark theme",
    ];

    return (
        <div className="prompt-input-container">
            <form onSubmit={handleSubmit} className="prompt-form">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the website you want to create..."
                    className="prompt-textarea"
                    rows={4}
                />
                <button
                    type="submit"
                    className="generate-button"
                    disabled={!prompt.trim() || isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="icon spinning" size={20} />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Wand2 className="icon" size={20} />
                            Generate Website
                        </>
                    )}
                </button>
            </form>

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