// src/components/admin/KnowledgeBase.jsx
// Fixed Knowledge Base admin panel with proper data display

import React, { useState, useEffect, useCallback } from 'react';
import {
    Database, Plus, Search, Trash2, Edit2, Save, X,
    FileText, RefreshCw, Upload, Download, AlertCircle,
    CheckCircle, ChevronDown, ChevronUp, Book
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const KnowledgeBase = () => {
    const [documents, setDocuments] = useState([]);
    const [intents, setIntents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('documents');
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [expandedItems, setExpandedItems] = useState(new Set());

    // New document form
    const [newDoc, setNewDoc] = useState({
        title: '',
        content: '',
        category: 'general',
        keywords: ''
    });

    // Fetch knowledge base data
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch documents
            const docsRes = await fetch(`${API_URL}/api/knowledge/documents`);
            const docsData = await docsRes.json();

            if (docsData.success && Array.isArray(docsData.documents)) {
                setDocuments(docsData.documents);
            } else if (Array.isArray(docsData)) {
                setDocuments(docsData);
            } else {
                setDocuments([]);
            }

            // Fetch intents
            const intentsRes = await fetch(`${API_URL}/api/knowledge/intents`);
            const intentsData = await intentsRes.json();

            if (intentsData.success && Array.isArray(intentsData.intents)) {
                setIntents(intentsData.intents);
            } else if (Array.isArray(intentsData)) {
                setIntents(intentsData);
            } else {
                setIntents([]);
            }

        } catch (e) {
            console.error('Failed to fetch KB data:', e);
            setError('Failed to load knowledge base data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Add new document
    const handleAddDocument = async () => {
        if (!newDoc.title.trim() || !newDoc.content.trim()) {
            setError('Title and content are required');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/knowledge/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newDoc.title,
                    content: newDoc.content,
                    category: newDoc.category,
                    keywords: newDoc.keywords.split(',').map(k => k.trim()).filter(Boolean)
                })
            });

            const data = await response.json();

            if (data.success) {
                setSuccess('Document added successfully');
                setShowAddDialog(false);
                setNewDoc({ title: '', content: '', category: 'general', keywords: '' });
                fetchData();
            } else {
                setError(data.error || 'Failed to add document');
            }
        } catch (e) {
            setError('Failed to add document');
        } finally {
            setLoading(false);
        }
    };

    // Delete document
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/knowledge/documents/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setSuccess('Document deleted');
                fetchData();
            } else {
                setError('Failed to delete document');
            }
        } catch (e) {
            setError('Failed to delete document');
        } finally {
            setLoading(false);
        }
    };

    // Test search
    const [testQuery, setTestQuery] = useState('');
    const [testResult, setTestResult] = useState(null);

    const handleTestSearch = async () => {
        if (!testQuery.trim()) return;

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/knowledge/search?q=${encodeURIComponent(testQuery)}`);
            const data = await response.json();
            setTestResult(data);
        } catch (e) {
            setTestResult({ error: 'Search failed' });
        } finally {
            setLoading(false);
        }
    };

    // Toggle expand
    const toggleExpand = (id) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedItems(newExpanded);
    };

    // Filter documents
    const filteredDocuments = documents.filter(doc => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            doc.title?.toLowerCase().includes(search) ||
            doc.content?.toLowerCase().includes(search) ||
            doc.category?.toLowerCase().includes(search)
        );
    });

    // Filter intents
    const filteredIntents = intents.filter(intent => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            intent.intent?.toLowerCase().includes(search) ||
            intent.response?.toLowerCase().includes(search) ||
            intent.patterns?.some(p => p.toLowerCase().includes(search))
        );
    });

    // Clear messages after timeout
    useEffect(() => {
        if (error || success) {
            const timer = setTimeout(() => {
                setError(null);
                setSuccess(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error, success]);

    // Format date safely
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '-';
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return '-';
        }
    };

    return (
        <div className="kb-container">
            <div className="kb-header">
                <h2><Database size={24} /> Knowledge Base</h2>

                <div className="kb-actions">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search knowledge base..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={() => setShowAddDialog(true)}
                    >
                        <Plus size={18} />
                        Add Document
                    </button>

                    <button
                        className="btn btn-secondary"
                        onClick={fetchData}
                        disabled={loading}
                    >
                        <RefreshCw size={18} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="alert alert-error">
                    <AlertCircle size={18} />
                    {error}
                    <button onClick={() => setError(null)}><X size={16} /></button>
                </div>
            )}

            {success && (
                <div className="alert alert-success">
                    <CheckCircle size={18} />
                    {success}
                    <button onClick={() => setSuccess(null)}><X size={16} /></button>
                </div>
            )}

            {/* Tabs */}
            <div className="kb-tabs">
                <button
                    className={`tab ${activeTab === 'documents' ? 'active' : ''}`}
                    onClick={() => setActiveTab('documents')}
                >
                    <FileText size={18} />
                    Documents ({filteredDocuments.length})
                </button>
                <button
                    className={`tab ${activeTab === 'intents' ? 'active' : ''}`}
                    onClick={() => setActiveTab('intents')}
                >
                    <Book size={18} />
                    Intents ({filteredIntents.length})
                </button>
                <button
                    className={`tab ${activeTab === 'test' ? 'active' : ''}`}
                    onClick={() => setActiveTab('test')}
                >
                    <Search size={18} />
                    Test Search
                </button>
            </div>

            {/* Content */}
            <div className="kb-content">
                {/* Documents Tab */}
                {activeTab === 'documents' && (
                    <div className="documents-list">
                        {filteredDocuments.length === 0 ? (
                            <div className="empty-state">
                                <FileText size={48} />
                                <p>No documents found</p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowAddDialog(true)}
                                >
                                    Add your first document
                                </button>
                            </div>
                        ) : (
                            filteredDocuments.map((doc, idx) => (
                                <div key={doc.id || idx} className="doc-card">
                                    <div
                                        className="doc-header"
                                        onClick={() => toggleExpand(doc.id || idx)}
                                    >
                                        <div className="doc-info">
                                            <span className="doc-title">{doc.title || 'Untitled'}</span>
                                            <span className="doc-category">{doc.category || 'general'}</span>
                                            <span className="doc-date">{formatDate(doc.createdAt || doc.created_at)}</span>
                                        </div>
                                        <div className="doc-actions">
                                            <button
                                                className="icon-btn"
                                                onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            {expandedItems.has(doc.id || idx) ?
                                                <ChevronUp size={18} /> : <ChevronDown size={18} />
                                            }
                                        </div>
                                    </div>

                                    {expandedItems.has(doc.id || idx) && (
                                        <div className="doc-content">
                                            <p>{doc.content || 'No content'}</p>
                                            {doc.keywords && doc.keywords.length > 0 && (
                                                <div className="doc-keywords">
                                                    {(Array.isArray(doc.keywords) ? doc.keywords : [doc.keywords]).map((kw, i) => (
                                                        <span key={i} className="keyword-tag">{kw}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Intents Tab */}
                {activeTab === 'intents' && (
                    <div className="intents-list">
                        {filteredIntents.length === 0 ? (
                            <div className="empty-state">
                                <Book size={48} />
                                <p>No intents found</p>
                            </div>
                        ) : (
                            filteredIntents.map((intent, idx) => (
                                <div key={intent.id || idx} className="intent-card">
                                    <div
                                        className="intent-header"
                                        onClick={() => toggleExpand(`intent_${idx}`)}
                                    >
                                        <span className="intent-name">{intent.intent || intent.name || `Intent ${idx + 1}`}</span>
                                        <span className="intent-patterns">
                                            {intent.patterns?.length || 0} patterns
                                        </span>
                                        {expandedItems.has(`intent_${idx}`) ?
                                            <ChevronUp size={18} /> : <ChevronDown size={18} />
                                        }
                                    </div>

                                    {expandedItems.has(`intent_${idx}`) && (
                                        <div className="intent-content">
                                            <div className="intent-section">
                                                <strong>Patterns:</strong>
                                                <div className="patterns-list">
                                                    {intent.patterns?.map((p, i) => (
                                                        <span key={i} className="pattern-tag">{p}</span>
                                                    )) || <span>No patterns</span>}
                                                </div>
                                            </div>
                                            <div className="intent-section">
                                                <strong>Response:</strong>
                                                <p>{intent.response || 'No response'}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Test Search Tab */}
                {activeTab === 'test' && (
                    <div className="test-search">
                        <div className="test-input">
                            <input
                                type="text"
                                placeholder="Enter a test query..."
                                value={testQuery}
                                onChange={(e) => setTestQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleTestSearch()}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={handleTestSearch}
                                disabled={loading || !testQuery.trim()}
                            >
                                <Search size={18} />
                                Search
                            </button>
                        </div>

                        {testResult && (
                            <div className="test-result">
                                <h4>Search Result:</h4>
                                {testResult.error ? (
                                    <div className="result-error">{testResult.error}</div>
                                ) : testResult.found ? (
                                    <div className="result-found">
                                        <div className="result-score">
                                            Score: {(testResult.score || 0).toFixed(3)}
                                        </div>
                                        <div className="result-content">
                                            {testResult.response || testResult.content || 'No content'}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="result-not-found">
                                        No matching content found
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Add Document Dialog */}
            {showAddDialog && (
                <div className="dialog-overlay" onClick={() => setShowAddDialog(false)}>
                    <div className="dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="dialog-header">
                            <h3>Add Document</h3>
                            <button onClick={() => setShowAddDialog(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="dialog-body">
                            <div className="form-group">
                                <label>Title *</label>
                                <input
                                    type="text"
                                    value={newDoc.title}
                                    onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                                    placeholder="Document title"
                                />
                            </div>

                            <div className="form-group">
                                <label>Category</label>
                                <select
                                    value={newDoc.category}
                                    onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}
                                >
                                    <option value="general">General</option>
                                    <option value="company">Company Setup</option>
                                    <option value="visa">Visas</option>
                                    <option value="documents">Documents</option>
                                    <option value="services">Services</option>
                                    <option value="faq">FAQ</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Content *</label>
                                <textarea
                                    value={newDoc.content}
                                    onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                                    placeholder="Document content..."
                                    rows={6}
                                />
                            </div>

                            <div className="form-group">
                                <label>Keywords (comma-separated)</label>
                                <input
                                    type="text"
                                    value={newDoc.keywords}
                                    onChange={(e) => setNewDoc({ ...newDoc, keywords: e.target.value })}
                                    placeholder="keyword1, keyword2, keyword3"
                                />
                            </div>
                        </div>

                        <div className="dialog-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowAddDialog(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleAddDocument}
                                disabled={loading}
                            >
                                <Save size={18} />
                                Save Document
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .kb-container {
                    padding: 24px;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .kb-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                    flex-wrap: wrap;
                    gap: 16px;
                }

                .kb-header h2 {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin: 0;
                    font-size: 24px;
                    color: #1a1a2e;
                }

                .kb-actions {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .search-box {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    background: #f5f5f5;
                    border-radius: 8px;
                    border: 1px solid #e0e0e0;
                }

                .search-box input {
                    border: none;
                    background: none;
                    outline: none;
                    font-size: 14px;
                    min-width: 200px;
                }

                .btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 16px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .btn-primary {
                    background: #667eea;
                    color: white;
                }

                .btn-primary:hover {
                    background: #5a6fd6;
                }

                .btn-secondary {
                    background: #f0f0f0;
                    color: #333;
                }

                .btn-secondary:hover {
                    background: #e0e0e0;
                }

                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .alert {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                }

                .alert button {
                    margin-left: auto;
                    background: none;
                    border: none;
                    cursor: pointer;
                    opacity: 0.7;
                }

                .alert-error {
                    background: #ffebee;
                    color: #c62828;
                }

                .alert-success {
                    background: #e8f5e9;
                    color: #2e7d32;
                }

                .kb-tabs {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 16px;
                    border-bottom: 2px solid #e0e0e0;
                    padding-bottom: 8px;
                }

                .tab {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    background: none;
                    border: none;
                    border-radius: 8px 8px 0 0;
                    cursor: pointer;
                    font-size: 14px;
                    color: #666;
                    transition: all 0.2s;
                }

                .tab:hover {
                    background: #f5f5f5;
                }

                .tab.active {
                    background: #667eea;
                    color: white;
                }

                .kb-content {
                    background: white;
                    border-radius: 12px;
                    border: 1px solid #e0e0e0;
                    min-height: 400px;
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px;
                    color: #999;
                }

                .empty-state p {
                    margin: 16px 0;
                }

                .doc-card, .intent-card {
                    border-bottom: 1px solid #eee;
                }

                .doc-header, .intent-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .doc-header:hover, .intent-header:hover {
                    background: #fafafa;
                }

                .doc-info {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .doc-title, .intent-name {
                    font-weight: 600;
                    color: #333;
                }

                .doc-category {
                    padding: 2px 10px;
                    background: #e3f2fd;
                    color: #1976d2;
                    border-radius: 12px;
                    font-size: 12px;
                }

                .doc-date {
                    font-size: 12px;
                    color: #999;
                }

                .intent-patterns {
                    font-size: 12px;
                    color: #666;
                    background: #f5f5f5;
                    padding: 4px 12px;
                    border-radius: 12px;
                }

                .doc-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .icon-btn {
                    width: 32px;
                    height: 32px;
                    background: none;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #666;
                    transition: all 0.2s;
                }

                .icon-btn:hover {
                    background: #ffebee;
                    border-color: #ef5350;
                    color: #ef5350;
                }

                .doc-content, .intent-content {
                    padding: 16px 20px;
                    background: #fafafa;
                    border-top: 1px solid #eee;
                }

                .doc-content p, .intent-section p {
                    margin: 0;
                    color: #555;
                    line-height: 1.6;
                    white-space: pre-wrap;
                }

                .doc-keywords {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 12px;
                }

                .keyword-tag, .pattern-tag {
                    padding: 4px 10px;
                    background: #e8f5e9;
                    color: #2e7d32;
                    border-radius: 12px;
                    font-size: 12px;
                }

                .pattern-tag {
                    background: #fff3e0;
                    color: #e65100;
                }

                .intent-section {
                    margin-bottom: 12px;
                }

                .intent-section strong {
                    display: block;
                    margin-bottom: 8px;
                    color: #333;
                }

                .patterns-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .test-search {
                    padding: 24px;
                }

                .test-input {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 24px;
                }

                .test-input input {
                    flex: 1;
                    padding: 12px 16px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 14px;
                    outline: none;
                }

                .test-input input:focus {
                    border-color: #667eea;
                }

                .test-result {
                    padding: 20px;
                    background: #f5f5f5;
                    border-radius: 8px;
                }

                .test-result h4 {
                    margin: 0 0 16px;
                    color: #333;
                }

                .result-found {
                    background: white;
                    padding: 16px;
                    border-radius: 8px;
                    border: 1px solid #e0e0e0;
                }

                .result-score {
                    font-size: 12px;
                    color: #667eea;
                    margin-bottom: 8px;
                }

                .result-content {
                    color: #333;
                    line-height: 1.6;
                }

                .result-not-found, .result-error {
                    padding: 16px;
                    background: #ffebee;
                    color: #c62828;
                    border-radius: 8px;
                }

                /* Dialog */
                .dialog-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }

                .dialog {
                    background: white;
                    border-radius: 12px;
                    width: 500px;
                    max-width: 90vw;
                    max-height: 90vh;
                    overflow: auto;
                }

                .dialog-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid #eee;
                }

                .dialog-header h3 {
                    margin: 0;
                }

                .dialog-header button {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #666;
                }

                .dialog-body {
                    padding: 20px;
                }

                .form-group {
                    margin-bottom: 16px;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 500;
                    color: #333;
                }

                .form-group input,
                .form-group select,
                .form-group textarea {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 14px;
                    outline: none;
                    box-sizing: border-box;
                }

                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    border-color: #667eea;
                }

                .dialog-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding: 20px;
                    border-top: 1px solid #eee;
                }
            `}</style>
        </div>
    );
};

export default KnowledgeBase;