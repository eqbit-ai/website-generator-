// src/components/CodeEditor.jsx

import React, { useState } from 'react';
import Editor from '@monaco-editor/react';

const CodeEditor = ({ html, css, js, onHtmlChange, onCssChange, onJsChange }) => {
    const [activeTab, setActiveTab] = useState('html');

    const tabs = [
        { id: 'html', label: 'HTML', language: 'html', value: html, onChange: onHtmlChange },
        { id: 'css', label: 'CSS', language: 'css', value: css, onChange: onCssChange },
        { id: 'js', label: 'JavaScript', language: 'javascript', value: js, onChange: onJsChange },
    ];

    const activeTabData = tabs.find(tab => tab.id === activeTab);

    return (
        <div className="code-editor">
            <div className="editor-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`editor-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="editor-content">
                <Editor
                    height="100%"
                    language={activeTabData.language}
                    value={activeTabData.value}
                    onChange={activeTabData.onChange}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        wordWrap: 'on',
                    }}
                />
            </div>
        </div>
    );
};

export default CodeEditor;