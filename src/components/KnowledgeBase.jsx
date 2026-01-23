// src/components/KnowledgeBase.jsx
import config from '../config';

import React, { useState, useEffect, useRef } from 'react';
import {
    Upload,
    FileText,
    Trash2,
    Search,
    Plus,
    X,
    Check,
    Loader2,
    Database,
    File,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    BookOpen,
    MessageSquare,
    RefreshCw
} from 'lucide-react';

const KnowledgeBase = ({ isOpen, onClose }) => {
    // State
    const [activeTab, setActiveTab] = useState('documents'); // documents, add, intents, test
    const [documents, setDocuments] = useState([]);
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Upload state
    const [uploadFile, setUploadFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Manual text state
    const [manualTitle, setManualTitle] = useState('');
    const [manualContent, setManualContent] = useState('');

    // Test search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Intent state
    const [intents, setIntents] = useState([]);
    const [newIntent, setNewIntent] = useState({ name: '', patterns: '', responses: '' });
    const [expandedDoc, setExpandedDoc] = useState(null);

    // Fetch data on mount
    useEffect(() => {
        if (isOpen) {
            fetchDocuments();
            fetchStats();
            fetchIntents();
        }
    }, [isOpen]);

    // Clear messages after 3 seconds
    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => {
                setSuccess(null);
                setError(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [success, error]);

    const fetchDocuments = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/api/knowledge/documents`);
            const data = await response.json();
            if (data.success) {
                setDocuments(data.documents);
            }
        } catch (err) {
            console.error('Error fetching documents:', err);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/api/knowledge/stats`)
                ;
            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    const fetchIntents = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/api/knowledge/intents`)
                ;
            const data = await response.json();
            if (data.success) {
                setIntents(data.intents);
            }
        } catch (err) {
            console.error('Error fetching intents:', err);
        }
    };

    // Handle file upload
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadFile(file);
        }
    };

    const handleFileUpload = async () => {
        if (!uploadFile) return;

        setIsUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', uploadFile);

            const response = await fetch(`${config.apiUrl}/api/knowledge/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                setSuccess(`Document uploaded! Created ${data.chunksCreated} chunks.`);
                setUploadFile(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                fetchDocuments();
                fetchStats();
            } else {
                setError(data.error || 'Upload failed');
            }
        } catch (err) {
            setError('Failed to upload file');
        } finally {
            setIsUploading(false);
        }
    };

    // Handle manual text add
    const handleAddText = async () => {
        if (!manualContent.trim()) {
            setError('Content is required');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${config.apiUrl}/api/knowledge/add-text`, {

                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: manualTitle || 'Manual Entry',
                    content: manualContent
                })
            });

            const data = await response.json();

            if (data.success) {
                setSuccess(`Content added! Created ${data.chunksCreated} chunks.`);
                setManualTitle('');
                setManualContent('');
                fetchDocuments();
                fetchStats();
            } else {
                setError(data.error || 'Failed to add content');
            }
        } catch (err) {
            setError('Failed to add content');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle delete document
    const handleDelete = async (documentId) => {
        if (!window.confirm('Are you sure you want to delete this document?')) return;

        try {
            const response = await fetch(`${config.apiUrl}/api/knowledge/documents/${documentId}`, { method: 'DELETE' })


            const data = await response.json();

            if (data.success) {
                setSuccess('Document deleted');
                fetchDocuments();
                fetchStats();
            } else {
                setError(data.error || 'Failed to delete');
            }
        } catch (err) {
            setError('Failed to delete document');
        }
    };

    // Handle search
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setSearchResults([]);

        try {
            const response = await fetch(
                `${config.apiUrl}/api/knowledge/search?query=${encodeURIComponent(searchQuery)}&limit=5`
            );

            const data = await response.json();

            if (data.success) {
                setSearchResults(data.results);
            }
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setIsSearching(false);
        }
    };

    // Handle add intent
    const handleAddIntent = async () => {
        if (!newIntent.name || !newIntent.patterns || !newIntent.responses) {
            setError('All fields are required for intent');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`${config.apiUrl}/api/knowledge/intents`, {

                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newIntent.name,
                    patterns: newIntent.patterns.split('\n').filter(p => p.trim()),
                    responses: newIntent.responses.split('\n').filter(r => r.trim())
                })
            });

            const data = await response.json();

            if (data.success) {
                setSuccess('Intent added successfully');
                setNewIntent({ name: '', patterns: '', responses: '' });
                fetchIntents();
            } else {
                setError(data.error || 'Failed to add intent');
            }
        } catch (err) {
            setError('Failed to add intent');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle delete intent
    const handleDeleteIntent = async (intentId) => {
        if (!window.confirm('Delete this intent?')) return;

        try {
            const response = await fetch(`${config.apiUrl}/api/knowledge/intents/${intentId}`, {
                method: 'DELETE'
            });


            const data = await response.json();

            if (data.success) {
                setSuccess('Intent deleted');
                fetchIntents();
            }
        } catch (err) {
            setError('Failed to delete intent');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="kb-overlay" onClick={onClose}>
            <div className="kb-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="kb-header">
                    <div className="kb-header-title">
                        <Database size={24} />
                        <h2>Knowledge Base Manager</h2>
                    </div>
                    <button className="kb-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Stats Bar */}
                {stats && (
                    <div className="kb-stats">
                        <div className="kb-stat">
                            <span className="kb-stat-value">{stats.documents}</span>
                            <span className="kb-stat-label">Documents</span>
                        </div>
                        <div className="kb-stat">
                            <span className="kb-stat-value">{stats.chunks}</span>
                            <span className="kb-stat-label">Chunks</span>
                        </div>
                        <div className="kb-stat">
                            <span className="kb-stat-value">{stats.totalTokens?.toLocaleString() || 0}</span>
                            <span className="kb-stat-label">Tokens</span>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="kb-tabs">
                    <button
                        className={`kb-tab ${activeTab === 'documents' ? 'active' : ''}`}
                        onClick={() => setActiveTab('documents')}
                    >
                        <FileText size={16} />
                        Documents
                    </button>
                    <button
                        className={`kb-tab ${activeTab === 'add' ? 'active' : ''}`}
                        onClick={() => setActiveTab('add')}
                    >
                        <Plus size={16} />
                        Add Content
                    </button>
                    <button
                        className={`kb-tab ${activeTab === 'intents' ? 'active' : ''}`}
                        onClick={() => setActiveTab('intents')}
                    >
                        <MessageSquare size={16} />
                        Intents
                    </button>
                    <button
                        className={`kb-tab ${activeTab === 'test' ? 'active' : ''}`}
                        onClick={() => setActiveTab('test')}
                    >
                        <Search size={16} />
                        Test Search
                    </button>
                </div>

                {/* Messages */}
                {error && (
                    <div className="kb-message error">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}
                {success && (
                    <div className="kb-message success">
                        <Check size={16} />
                        {success}
                    </div>
                )}

                {/* Content */}
                <div className="kb-content">
                    {/* Documents Tab */}
                    {activeTab === 'documents' && (
                        <div className="kb-documents">
                            {documents.length === 0 ? (
                                <div className="kb-empty">
                                    <BookOpen size={48} />
                                    <p>No documents yet</p>
                                    <span>Upload documents or add text to build your knowledge base</span>
                                </div>
                            ) : (
                                <div className="kb-document-list">
                                    {documents.map(doc => (
                                        <div key={doc.id} className="kb-document-item">
                                            <div
                                                className="kb-document-header"
                                                onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                                            >
                                                <div className="kb-document-info">
                                                    <File size={18} />
                                                    <div>
                                                        <h4>{doc.original_name}</h4>
                                                        <span>{doc.chunk_count} chunks • {doc.file_type} • {new Date(doc.uploaded_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                <div className="kb-document-actions">
                                                    <button
                                                        className="kb-btn-icon danger"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(doc.id);
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                    {expandedDoc === doc.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </div>
                                            </div>
                                            {expandedDoc === doc.id && (
                                                <div className="kb-document-details">
                                                    <p><strong>File:</strong> {doc.filename}</p>
                                                    <p><strong>Size:</strong> {(doc.file_size / 1024).toFixed(2)} KB</p>
                                                    <p><strong>Uploaded:</strong> {new Date(doc.uploaded_at).toLocaleString()}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Add Content Tab */}
                    {activeTab === 'add' && (
                        <div className="kb-add-content">
                            {/* File Upload */}
                            <div className="kb-section">
                                <h3>Upload Document</h3>
                                <p className="kb-section-desc">Upload PDF, TXT, DOCX, or MD files</p>

                                <div className="kb-upload-area">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.txt,.docx,.doc,.md"
                                        onChange={handleFileSelect}
                                        className="kb-file-input"
                                    />
                                    <div className="kb-upload-content">
                                        <Upload size={32} />
                                        <p>Drop file here or click to browse</p>
                                        <span>PDF, TXT, DOCX, MD (max 10MB)</span>
                                    </div>
                                </div>

                                {uploadFile && (
                                    <div className="kb-selected-file">
                                        <File size={18} />
                                        <span>{uploadFile.name}</span>
                                        <button onClick={() => setUploadFile(null)}>
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}

                                <button
                                    className="kb-btn primary"
                                    onClick={handleFileUpload}
                                    disabled={!uploadFile || isUploading}
                                >
                                    {isUploading ? (
                                        <>
                                            <Loader2 className="spinning" size={18} />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={18} />
                                            Upload Document
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Manual Text */}
                            <div className="kb-section">
                                <h3>Add Text Manually</h3>
                                <p className="kb-section-desc">Paste FAQ, documentation, or any text content</p>

                                <div className="kb-form-group">
                                    <label>Title (optional)</label>
                                    <input
                                        type="text"
                                        value={manualTitle}
                                        onChange={(e) => setManualTitle(e.target.value)}
                                        placeholder="e.g., Company FAQ, Product Guide"
                                    />
                                </div>

                                <div className="kb-form-group">
                                    <label>Content *</label>
                                    <textarea
                                        value={manualContent}
                                        onChange={(e) => setManualContent(e.target.value)}
                                        placeholder="Paste your content here. This will be automatically chunked and indexed for the chatbot to use..."
                                        rows={8}
                                    />
                                </div>

                                <button
                                    className="kb-btn primary"
                                    onClick={handleAddText}
                                    disabled={!manualContent.trim() || isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="spinning" size={18} />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={18} />
                                            Add Content
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Intents Tab */}
                    {activeTab === 'intents' && (
                        <div className="kb-intents">
                            {/* Add New Intent */}
                            <div className="kb-section">
                                <h3>Add New Intent</h3>
                                <p className="kb-section-desc">Define patterns and responses for common queries</p>

                                <div className="kb-form-group">
                                    <label>Intent Name *</label>
                                    <input
                                        type="text"
                                        value={newIntent.name}
                                        onChange={(e) => setNewIntent({ ...newIntent, name: e.target.value })}
                                        placeholder="e.g., greeting, pricing, hours"
                                    />
                                </div>

                                <div className="kb-form-group">
                                    <label>Patterns * (one per line)</label>
                                    <textarea
                                        value={newIntent.patterns}
                                        onChange={(e) => setNewIntent({ ...newIntent, patterns: e.target.value })}
                                        placeholder="hello&#10;hi there&#10;hey&#10;good morning"
                                        rows={4}
                                    />
                                </div>

                                <div className="kb-form-group">
                                    <label>Responses * (one per line, bot will pick randomly)</label>
                                    <textarea
                                        value={newIntent.responses}
                                        onChange={(e) => setNewIntent({ ...newIntent, responses: e.target.value })}
                                        placeholder="Hello! How can I help you today?&#10;Hi there! What can I assist you with?&#10;Hey! Nice to see you. How can I help?"
                                        rows={4}
                                    />
                                </div>

                                <button
                                    className="kb-btn primary"
                                    onClick={handleAddIntent}
                                    disabled={isLoading}
                                >
                                    <Plus size={18} />
                                    Add Intent
                                </button>
                            </div>

                            {/* Existing Intents */}
                            <div className="kb-section">
                                <h3>Existing Intents</h3>
                                {intents.length === 0 ? (
                                    <p className="kb-empty-text">No custom intents yet. Add some above!</p>
                                ) : (
                                    <div className="kb-intent-list">
                                        {intents.map(intent => (
                                            <div key={intent.id} className="kb-intent-item">
                                                <div className="kb-intent-header">
                                                    <h4>{intent.name}</h4>
                                                    <button
                                                        className="kb-btn-icon danger"
                                                        onClick={() => handleDeleteIntent(intent.id)}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                                <div className="kb-intent-details">
                                                    <div>
                                                        <strong>Patterns:</strong>
                                                        <ul>
                                                            {intent.patterns.slice(0, 3).map((p, i) => (
                                                                <li key={i}>{p}</li>
                                                            ))}
                                                            {intent.patterns.length > 3 && (
                                                                <li>+{intent.patterns.length - 3} more</li>
                                                            )}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <strong>Responses:</strong>
                                                        <ul>
                                                            {intent.responses.slice(0, 2).map((r, i) => (
                                                                <li key={i}>{r.substring(0, 50)}...</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Test Search Tab */}
                    {activeTab === 'test' && (
                        <div className="kb-test">
                            <div className="kb-section">
                                <h3>Test Knowledge Base Search</h3>
                                <p className="kb-section-desc">Search your knowledge base to see what the chatbot will find</p>

                                <div className="kb-search-box">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Enter a test query..."
                                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                    />
                                    <button onClick={handleSearch} disabled={isSearching}>
                                        {isSearching ? <Loader2 className="spinning" size={18} /> : <Search size={18} />}
                                    </button>
                                </div>

                                {searchResults.length > 0 && (
                                    <div className="kb-search-results">
                                        <h4>Found {searchResults.length} relevant chunks:</h4>
                                        {searchResults.map((result, index) => (
                                            <div key={index} className="kb-search-result">
                                                <div className="kb-result-header">
                                                    <span className="kb-result-source">{result.source || 'Unknown'}</span>
                                                    <span className="kb-result-score">Score: {result.score.toFixed(2)}</span>
                                                </div>
                                                <p>{result.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {searchQuery && searchResults.length === 0 && !isSearching && (
                                    <div className="kb-no-results">
                                        <p>No results found for "{searchQuery}"</p>
                                        <span>Try adding more content to your knowledge base</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="kb-footer">
                    <button className="kb-btn secondary" onClick={onClose}>
                        Close
                    </button>
                    <button className="kb-btn secondary" onClick={() => { fetchDocuments(); fetchStats(); fetchIntents(); }}>
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KnowledgeBase;