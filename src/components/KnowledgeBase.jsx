// src/components/KnowledgeBase.jsx
// Knowledge Base Admin Modal - Works with existing App.css styles

import React, { useState, useEffect, useCallback } from 'react';
import {
    Database, X, FileText, Book, Search, Plus, Trash2,
    RefreshCw, CheckCircle, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const KnowledgeBase = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('documents');
    const [documents, setDocuments] = useState([]);
    const [intents, setIntents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [expandedItems, setExpandedItems] = useState(new Set());

    // Add document form
    const [showAddForm, setShowAddForm] = useState(false);
    const [newDoc, setNewDoc] = useState({ title: '', content: '', category: 'general' });

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const [docsRes, intentsRes] = await Promise.all([
                fetch(`${API_URL}/api/knowledge/documents`).catch(() => ({ ok: false })),
                fetch(`${API_URL}/api/knowledge/intents`).catch(() => ({ ok: false }))
            ]);

            if (docsRes.ok) {
                const docsData = await docsRes.json();
                setDocuments(docsData.documents || []);
            }

            if (intentsRes.ok) {
                const intentsData = await intentsRes.json();
                setIntents(intentsData.intents || []);
            }
        } catch (e) {
            console.error('Fetch error:', e);
            setError('Failed to connect to backend');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, fetchData]);

    // Clear messages after timeout
    useEffect(() => {
        if (error || success) {
            const timer = setTimeout(() => { setError(null); setSuccess(null); }, 4000);
            return () => clearTimeout(timer);
        }
    }, [error, success]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/knowledge/search?q=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            setSearchResults(data);
        } catch (e) {
            setSearchResults({ error: 'Search failed: ' + e.message });
        } finally {
            setLoading(false);
        }
    };

    const handleAddDocument = async () => {
        if (!newDoc.title.trim() || !newDoc.content.trim()) {
            setError('Title and content are required');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/knowledge/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newDoc)
            });
            if (res.ok) {
                setSuccess('Document added!');
                setShowAddForm(false);
                setNewDoc({ title: '', content: '', category: 'general' });
                fetchData();
            } else {
                setError('Failed to add document');
            }
        } catch (e) {
            setError('Failed to add: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this document?')) return;
        try {
            await fetch(`${API_URL}/api/knowledge/documents/${id}`, { method: 'DELETE' });
            setSuccess('Deleted');
            fetchData();
        } catch (e) {
            setError('Delete failed');
        }
    };

    const toggleExpand = (id) => {
        const newSet = new Set(expandedItems);
        newSet.has(id) ? newSet.delete(id) : newSet.add(id);
        setExpandedItems(newSet);
    };

    if (!isOpen) return null;

    return (
        <div className="kb-overlay" onClick={onClose}>
            <div className="kb-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="kb-header">
                    <div className="kb-header-title">
                        <Database size={24} />
                        <h2>Knowledge Base</h2>
                    </div>
                    <button className="kb-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Stats */}
                <div className="kb-stats">
                    <div className="kb-stat">
                        <span className="kb-stat-value">{documents.length}</span>
                        <span className="kb-stat-label">Documents</span>
                    </div>
                    <div className="kb-stat">
                        <span className="kb-stat-value">{intents.length}</span>
                        <span className="kb-stat-label">Intents</span>
                    </div>
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
                        <CheckCircle size={16} />
                        {success}
                    </div>
                )}

                {/* Tabs */}
                <div className="kb-tabs">
                    <button className={`kb-tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>
                        <FileText size={16} /> Documents ({documents.length})
                    </button>
                    <button className={`kb-tab ${activeTab === 'intents' ? 'active' : ''}`} onClick={() => setActiveTab('intents')}>
                        <Book size={16} /> Intents ({intents.length})
                    </button>
                    <button className={`kb-tab ${activeTab === 'test' ? 'active' : ''}`} onClick={() => setActiveTab('test')}>
                        <Search size={16} /> Test
                    </button>
                </div>

                {/* Content */}
                <div className="kb-content">
                    {/* Documents Tab */}
                    {activeTab === 'documents' && (
                        <div className="kb-documents">
                            {!showAddForm && (
                                <button className="kb-btn primary" onClick={() => setShowAddForm(true)} style={{ marginBottom: 16 }}>
                                    <Plus size={18} /> Add Document
                                </button>
                            )}

                            {showAddForm && (
                                <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 10, marginBottom: 16 }}>
                                    <div className="kb-form-group">
                                        <label>Title</label>
                                        <input type="text" value={newDoc.title} onChange={e => setNewDoc({ ...newDoc, title: e.target.value })} placeholder="Document title" />
                                    </div>
                                    <div className="kb-form-group">
                                        <label>Category</label>
                                        <select value={newDoc.category} onChange={e => setNewDoc({ ...newDoc, category: e.target.value })}>
                                            <option value="general">General</option>
                                            <option value="company">Company</option>
                                            <option value="visa">Visa</option>
                                            <option value="faq">FAQ</option>
                                        </select>
                                    </div>
                                    <div className="kb-form-group">
                                        <label>Content</label>
                                        <textarea value={newDoc.content} onChange={e => setNewDoc({ ...newDoc, content: e.target.value })} placeholder="Content..." rows={4} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="kb-btn primary" onClick={handleAddDocument} disabled={loading}>Save</button>
                                        <button className="kb-btn secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                                    </div>
                                </div>
                            )}

                            {documents.length === 0 ? (
                                <div className="kb-empty">
                                    <FileText size={48} />
                                    <p>No documents found</p>
                                    <span>Add documents to train your AI</span>
                                </div>
                            ) : (
                                documents.map((doc, idx) => (
                                    <div key={doc.id || idx} className="kb-document-item">
                                        <div className="kb-document-header" onClick={() => toggleExpand(doc.id || idx)}>
                                            <div className="kb-document-info">
                                                <FileText size={18} />
                                                <div>
                                                    <h4>{doc.title || 'Untitled'}</h4>
                                                    <span>{doc.category || 'general'}</span>
                                                </div>
                                            </div>
                                            <div className="kb-document-actions">
                                                <button className="kb-btn-icon danger" onClick={e => { e.stopPropagation(); handleDelete(doc.id); }}>
                                                    <Trash2 size={16} />
                                                </button>
                                                {expandedItems.has(doc.id || idx) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </div>
                                        </div>
                                        {expandedItems.has(doc.id || idx) && (
                                            <div className="kb-document-details">
                                                <p>{doc.content}</p>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Intents Tab */}
                    {activeTab === 'intents' && (
                        <div className="kb-intents">
                            {intents.length === 0 ? (
                                <div className="kb-empty">
                                    <Book size={48} />
                                    <p>No intents loaded</p>
                                    <span>Place meydan_intents.json in backend/data/</span>
                                </div>
                            ) : (
                                intents.map((intent, idx) => (
                                    <div key={idx} className="kb-intent-item">
                                        <div className="kb-intent-header" onClick={() => toggleExpand(`intent_${idx}`)}>
                                            <h4>{intent.name || intent.intent || `Intent ${idx + 1}`}</h4>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                    {(intent.keywords || intent.patterns || []).length} keywords
                                                </span>
                                                {expandedItems.has(`intent_${idx}`) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </div>
                                        </div>
                                        {expandedItems.has(`intent_${idx}`) && (
                                            <div className="kb-intent-details">
                                                <div>
                                                    <strong>Keywords:</strong>
                                                    <ul>
                                                        {(intent.keywords || intent.patterns || []).slice(0, 5).map((k, i) => <li key={i}>{k}</li>)}
                                                        {(intent.keywords || intent.patterns || []).length > 5 && <li>+{(intent.keywords || intent.patterns).length - 5} more</li>}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <strong>Response:</strong>
                                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{intent.response?.substring(0, 200)}...</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Test Tab */}
                    {activeTab === 'test' && (
                        <div className="kb-test">
                            <div className="kb-search-box">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleSearch()}
                                    placeholder="Test a search query..."
                                />
                                <button onClick={handleSearch} disabled={loading || !searchQuery.trim()}>
                                    <Search size={18} />
                                </button>
                            </div>

                            {searchResults && (
                                <div className="kb-search-results">
                                    <h4>Result:</h4>
                                    {searchResults.error ? (
                                        <div className="kb-no-results"><p>Error: {searchResults.error}</p></div>
                                    ) : searchResults.found ? (
                                        <div className="kb-search-result">
                                            <div className="kb-result-header">
                                                <span className="kb-result-source">{searchResults.type}</span>
                                                <span className="kb-result-score">Score: {(searchResults.score || 0).toFixed(3)}</span>
                                            </div>
                                            <p>{searchResults.response}</p>
                                        </div>
                                    ) : (
                                        <div className="kb-no-results">
                                            <p>No match found</p>
                                            <span>Score: {(searchResults.score || 0).toFixed(3)}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="kb-footer">
                    <button className="kb-btn secondary" onClick={fetchData} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} /> Refresh
                    </button>
                    <button className="kb-btn secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default KnowledgeBase;