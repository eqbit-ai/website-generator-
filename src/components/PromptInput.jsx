// src/components/PromptInput.jsx

import React, { useState } from 'react';
import { Wand2, Loader2 } from 'lucide-react';

const PromptInput = ({ onGenerate, isLoading, loadingMessage }) => {
    const [prompt, setPrompt] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (prompt.trim() && !isLoading) {
            onGenerate(prompt);
            setPrompt(''); // Clear prompt after submission
        }
    };

    const examplePrompts = [
        "A premium landing page for a tech startup",
        "A luxury hotel website with booking section",
        "A creative portfolio for a graphic designer",
        "An elegant e-commerce site for jewelry",
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
                <button
                    type="submit"
                    className="generate-button"
                    disabled={!prompt.trim() || isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="icon spinning" size={20} />
                            {loadingMessage || 'Generating...'}
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