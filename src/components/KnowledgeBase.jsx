// src/components/KnowledgeBase.jsx
// Knowledge Base Admin Modal

import React, { useState, useEffect, useCallback } from 'react';
import {
    Database, X, FileText, Book, Search, Plus, Trash2,
    RefreshCw, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
    Globe, Loader2
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

    // Website scraping
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [scraping, setScraping] = useState(false);
    const [scrapeResult, setScrapeResult] = useState(null);

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

    const handleScrapeWebsite = async () => {
        if (!websiteUrl.trim()) {
            setError('Website URL is required');
            return;
        }

        // Validate URL
        try {
            new URL(websiteUrl);
        } catch (e) {
            setError('Invalid URL format. Please include http:// or https://');
            return;
        }

        setScraping(true);
        setError(null);
        setScrapeResult(null);

        try {
            const res = await fetch(`${API_URL}/api/knowledge/scrape-website`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: websiteUrl })
            });

            const data = await res.json();

            if (data.success) {
                setSuccess(`Scraped ${data.stats.pagesScraped} pages, generated ${data.stats.intentsGenerated} intents!`);
                setScrapeResult(data);
                setWebsiteUrl('');
                fetchData(); // Refresh knowledge base
            } else {
                setError(data.error || 'Failed to scrape website');
            }
        } catch (e) {
            setError('Scraping failed: ' + e.message);
        } finally {
            setScraping(false);
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
                    <button className={`kb-tab ${activeTab === 'scrape' ? 'active' : ''}`} onClick={() => setActiveTab('scrape')}>
                        <Globe size={16} /> Scrape Website
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

                    {/* Scrape Website Tab */}
                    {activeTab === 'scrape' && (
                        <div className="kb-scrape">
                            <div className="kb-scrape-header">
                                <Globe size={32} style={{ color: 'var(--accent)' }} />
                                <h3>Scrape Website & Generate Intents</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                    Enter a website URL to automatically crawl all pages, extract content, and generate AI-powered intents for your knowledge base.
                                </p>
                            </div>

                            <div className="kb-form-group" style={{ marginTop: '1.5rem' }}>
                                <label>Website URL</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="url"
                                        value={websiteUrl}
                                        onChange={e => setWebsiteUrl(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && !scraping && handleScrapeWebsite()}
                                        placeholder="https://example.com"
                                        disabled={scraping}
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        className="kb-btn primary"
                                        onClick={handleScrapeWebsite}
                                        disabled={scraping || !websiteUrl.trim()}
                                        style={{ minWidth: '120px' }}
                                    >
                                        {scraping ? (
                                            <>
                                                <Loader2 size={18} className="spinning" />
                                                Scraping...
                                            </>
                                        ) : (
                                            <>
                                                <Globe size={18} />
                                                Scrape
                                            </>
                                        )}
                                    </button>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'block' }}>
                                    Example: https://www.example.com (max 10 pages per website)
                                </span>
                            </div>

                            {scraping && (
                                <div style={{
                                    marginTop: '1.5rem',
                                    padding: '1rem',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '10px',
                                    textAlign: 'center'
                                }}>
                                    <Loader2 size={32} className="spinning" style={{ color: 'var(--accent)', marginBottom: '0.5rem' }} />
                                    <p style={{ color: 'var(--text-secondary)' }}>Crawling website and generating intents...</p>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>This may take 1-2 minutes</span>
                                </div>
                            )}

                            {scrapeResult && (
                                <div style={{
                                    marginTop: '1.5rem',
                                    padding: '1.5rem',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '10px',
                                    border: '1px solid var(--success)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <CheckCircle size={24} style={{ color: 'var(--success)' }} />
                                        <h4 style={{ margin: 0 }}>Scraping Complete!</h4>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                        <div className="kb-stat" style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px' }}>
                                            <span className="kb-stat-value">{scrapeResult.stats?.pagesScraped || 0}</span>
                                            <span className="kb-stat-label">Pages Scraped</span>
                                        </div>
                                        <div className="kb-stat" style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px' }}>
                                            <span className="kb-stat-value">{scrapeResult.stats?.intentsGenerated || 0}</span>
                                            <span className="kb-stat-label">Intents Generated</span>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        <p style={{ marginBottom: '0.5rem' }}>
                                            <strong>URL:</strong> {scrapeResult.url}
                                        </p>
                                        <p style={{ marginBottom: '0.5rem' }}>
                                            <strong>Text File:</strong> {scrapeResult.stats?.textFile}
                                        </p>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1rem' }}>
                                            All intents have been added to the knowledge base and are now available for chatbot and voice agents.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div style={{
                                marginTop: '1.5rem',
                                padding: '1rem',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '10px',
                                border: '1px solid var(--border)'
                            }}>
                                <h4 style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>How it works:</h4>
                                <ol style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', paddingLeft: '1.5rem', margin: 0 }}>
                                    <li>Crawls the website and all linked pages (max 10 pages)</li>
                                    <li>Extracts all text content from each page</li>
                                    <li>Uses AI to analyze content and generate 5-6 intents per section</li>
                                    <li>Creates organized text file with all content</li>
                                    <li>Adds intents to knowledge base automatically</li>
                                    <li>Chatbot and voice agents can now answer questions about this content</li>
                                </ol>
                            </div>
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