// src/components/AdminDashboard.jsx

import React, { useState, useEffect } from 'react';
import {
    Database,
    Upload,
    FileText,
    Trash2,
    Search,
    Users,
    MessageSquare,
    BarChart3,
    Plus,
    X,
    Loader2,
    Check,
    AlertCircle,
    ChevronRight,
    RefreshCw,
    Eye,
    Download
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('knowledge');
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await fetch(`${API_URL}/api/admin/stats`);
            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="admin-dashboard">
            {/* Sidebar */}
            <aside className="admin-sidebar">
                <div className="admin-logo">
                    <Database size={24} />
                    <span>Admin Panel</span>
                </div>

                <nav className="admin-nav">
                    <button
                        className={`admin-nav-item ${activeTab === 'knowledge' ? 'active' : ''}`}
                        onClick={() => setActiveTab('knowledge')}
                    >
                        <FileText size={20} />
                        Knowledge Base
                    </button>
                    <button
                        className={`admin-nav-item ${activeTab === 'customers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('customers')}
                    >
                        <Users size={20} />
                        Customers
                    </button>
                    <button
                        className={`admin-nav-item ${activeTab === 'conversations' ? 'active' : ''}`}
                        onClick={() => setActiveTab('conversations')}
                    >
                        <MessageSquare size={20} />
                        Conversations
                    </button>
                    <button
                        className={`admin-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
                        onClick={() => setActiveTab('analytics')}
                    >
                        <BarChart3 size={20} />
                        Analytics
                    </button>
                </nav>

                {/* Stats Summary */}
                {stats && (
                    <div className="admin-stats-summary">
                        <div className="stat-mini">
                            <span className="stat-mini-value">{stats.knowledgeBase?.documents || 0}</span>
                            <span className="stat-mini-label">Documents</span>
                        </div>
                        <div className="stat-mini">
                            <span className="stat-mini-value">{stats.totalCustomers || 0}</span>
                            <span className="stat-mini-label">Customers</span>
                        </div>
                        <div className="stat-mini">
                            <span className="stat-mini-value">{stats.totalConversations || 0}</span>
                            <span className="stat-mini-label">Chats</span>
                        </div>
                    </div>
                )}
            </aside>

            {/* Main Content */}
            <main className="admin-main">
                {activeTab === 'knowledge' && <KnowledgeBaseTab onUpdate={fetchStats} />}
                {activeTab === 'customers' && <CustomersTab />}
                {activeTab === 'conversations' && <ConversationsTab />}
                {activeTab === 'analytics' && <AnalyticsTab stats={stats} isLoading={isLoading} />}
            </main>
        </div>
    );
};

// ============================================
// KNOWLEDGE BASE TAB
// ============================================

const KnowledgeBaseTab = ({ onUpdate }) => {
    const [documents, setDocuments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showTextModal, setShowTextModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            const response = await fetch(`${API_URL}/api/knowledge/documents`);
            const data = await response.json();
            if (data.success) {
                setDocuments(data.documents);
            }
        } catch (error) {
            console.error('Failed to fetch documents:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (documentId) => {
        if (!window.confirm('Are you sure you want to delete this document?')) return;

        try {
            const response = await fetch(`${API_URL}/api/knowledge/documents/${documentId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                fetchDocuments();
                onUpdate();
            }
        } catch (error) {
            console.error('Failed to delete document:', error);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const response = await fetch(
                `${API_URL}/api/knowledge/search?query=${encodeURIComponent(searchQuery)}&limit=10`
            );
            const data = await response.json();
            if (data.success) {
                setSearchResults(data.results);
            }
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="admin-tab">
            <div className="admin-tab-header">
                <div>
                    <h1>Knowledge Base</h1>
                    <p>Manage documents and content for your AI assistant</p>
                </div>
                <div className="admin-tab-actions">
                    <button className="admin-btn secondary" onClick={() => setShowTextModal(true)}>
                        <Plus size={18} />
                        Add Text
                    </button>
                    <button className="admin-btn primary" onClick={() => setShowUploadModal(true)}>
                        <Upload size={18} />
                        Upload File
                    </button>
                </div>
            </div>

            {/* Search Section */}
            <div className="knowledge-search-section">
                <div className="search-box">
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder="Test your knowledge base - ask a question..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button onClick={handleSearch} disabled={isSearching}>
                        {isSearching ? <Loader2 className="spinning" size={18} /> : 'Search'}
                    </button>
                </div>

                {searchResults.length > 0 && (
                    <div className="search-results">
                        <h3>Search Results</h3>
                        {searchResults.map((result, index) => (
                            <div key={index} className="search-result-item">
                                <div className="result-source">
                                    <FileText size={16} />
                                    {result.source || 'Unknown Source'}
                                </div>
                                <p className="result-content">{result.content}</p>
                                <span className="result-score">Relevance: {(result.score * 100).toFixed(1)}%</span>
                            </div>
                        ))}
                        <button className="clear-results" onClick={() => setSearchResults([])}>
                            Clear Results
                        </button>
                    </div>
                )}
            </div>

            {/* Documents List */}
            <div className="documents-section">
                <div className="section-header">
                    <h2>Documents ({documents.length})</h2>
                    <button className="admin-btn icon" onClick={fetchDocuments}>
                        <RefreshCw size={18} />
                    </button>
                </div>

                {isLoading ? (
                    <div className="loading-state">
                        <Loader2 className="spinning" size={32} />
                        <p>Loading documents...</p>
                    </div>
                ) : documents.length === 0 ? (
                    <div className="empty-state">
                        <FileText size={48} />
                        <h3>No documents yet</h3>
                        <p>Upload files or add text to build your knowledge base</p>
                        <button className="admin-btn primary" onClick={() => setShowUploadModal(true)}>
                            <Upload size={18} />
                            Upload First Document
                        </button>
                    </div>
                ) : (
                    <div className="documents-grid">
                        {documents.map((doc) => (
                            <div key={doc.id} className="document-card">
                                <div className="document-icon">
                                    <FileText size={24} />
                                </div>
                                <div className="document-info">
                                    <h4>{doc.original_name}</h4>
                                    <div className="document-meta">
                                        <span>{doc.chunk_count} chunks</span>
                                        <span>•</span>
                                        <span>{formatFileSize(doc.file_size)}</span>
                                        <span>•</span>
                                        <span>{formatDate(doc.uploaded_at)}</span>
                                    </div>
                                </div>
                                <div className="document-actions">
                                    <button className="action-btn delete" onClick={() => handleDelete(doc.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <UploadModal
                    onClose={() => setShowUploadModal(false)}
                    onSuccess={() => {
                        fetchDocuments();
                        onUpdate();
                        setShowUploadModal(false);
                    }}
                />
            )}

            {/* Add Text Modal */}
            {showTextModal && (
                <AddTextModal
                    onClose={() => setShowTextModal(false)}
                    onSuccess={() => {
                        fetchDocuments();
                        onUpdate();
                        setShowTextModal(false);
                    }}
                />
            )}
        </div>
    );
};

// ============================================
// UPLOAD MODAL
// ============================================

const UploadModal = ({ onClose, onSuccess }) => {
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const [dragOver, setDragOver] = useState(false);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            validateAndSetFile(droppedFile);
        }
    };

    const validateAndSetFile = (selectedFile) => {
        const allowedTypes = ['.pdf', '.txt', '.doc', '.docx', '.md'];
        const ext = '.' + selectedFile.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(ext)) {
            setError(`File type not supported. Allowed: ${allowedTypes.join(', ')}`);
            return;
        }

        if (selectedFile.size > 10 * 1024 * 1024) {
            setError('File size must be less than 10MB');
            return;
        }

        setFile(selectedFile);
        setError(null);
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_URL}/api/knowledge/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                onSuccess();
            } else {
                setError(data.error || 'Upload failed');
            }
        } catch (err) {
            setError('Failed to upload file');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="modal-header">
                    <Upload size={32} className="modal-icon" />
                    <h2>Upload Document</h2>
                    <p>Add PDF, TXT, DOC, DOCX, or MD files to your knowledge base</p>
                </div>

                <div className="modal-body">
                    <div
                        className={`upload-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                    >
                        {file ? (
                            <div className="selected-file">
                                <FileText size={40} />
                                <div className="file-details">
                                    <span className="file-name">{file.name}</span>
                                    <span className="file-size">{formatFileSize(file.size)}</span>
                                </div>
                                <button className="remove-file" onClick={() => setFile(null)}>
                                    <X size={18} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <Upload size={40} />
                                <p>Drag and drop your file here, or</p>
                                <label className="browse-btn">
                                    Browse Files
                                    <input
                                        type="file"
                                        accept=".pdf,.txt,.doc,.docx,.md"
                                        onChange={(e) => e.target.files[0] && validateAndSetFile(e.target.files[0])}
                                        hidden
                                    />
                                </label>
                                <span className="upload-hint">PDF, TXT, DOC, DOCX, MD up to 10MB</span>
                            </>
                        )}
                    </div>

                    {error && (
                        <div className="modal-error">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        className="admin-btn primary full-width"
                        onClick={handleUpload}
                        disabled={!file || isUploading}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="spinning" size={18} />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Upload size={18} />
                                Upload & Process
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// ADD TEXT MODAL
// ============================================

const AddTextModal = ({ onClose, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async () => {
        if (!content.trim()) {
            setError('Content is required');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/api/knowledge/add-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title || 'Manual Entry', content })
            });

            const data = await response.json();

            if (data.success) {
                onSuccess();
            } else {
                setError(data.error || 'Failed to add text');
            }
        } catch (err) {
            setError('Failed to add text');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="modal-header">
                    <Plus size={32} className="modal-icon" />
                    <h2>Add Text Content</h2>
                    <p>Manually add FAQ, documentation, or any text to your knowledge base</p>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>Title (optional)</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Company FAQ, Product Guide..."
                            className="form-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>Content *</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Enter your FAQ, documentation, or any information you want the chatbot to know..."
                            className="form-textarea"
                            rows={12}
                        />
                        <span className="char-count">{content.length} characters</span>
                    </div>

                    {error && (
                        <div className="modal-error">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        className="admin-btn primary full-width"
                        onClick={handleSubmit}
                        disabled={!content.trim() || isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="spinning" size={18} />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Check size={18} />
                                Add to Knowledge Base
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// CUSTOMERS TAB
// ============================================

const CustomersTab = () => {
    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            const response = await fetch(`${API_URL}/api/admin/customers`);
            const data = await response.json();
            if (data.success) {
                setCustomers(data.customers);
            }
        } catch (error) {
            console.error('Failed to fetch customers:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="admin-tab">
            <div className="admin-tab-header">
                <div>
                    <h1>Customers</h1>
                    <p>View and manage customer information</p>
                </div>
                <button className="admin-btn icon" onClick={fetchCustomers}>
                    <RefreshCw size={18} />
                </button>
            </div>

            {isLoading ? (
                <div className="loading-state">
                    <Loader2 className="spinning" size={32} />
                    <p>Loading customers...</p>
                </div>
            ) : customers.length === 0 ? (
                <div className="empty-state">
                    <Users size={48} />
                    <h3>No customers yet</h3>
                    <p>Customers will appear here when they start a chat</p>
                </div>
            ) : (
                <div className="data-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Conversations</th>
                                <th>Last Active</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map((customer) => (
                                <tr key={customer.id}>
                                    <td>
                                        <div className="customer-name">
                                            <div className="avatar">{customer.name.charAt(0).toUpperCase()}</div>
                                            {customer.name}
                                        </div>
                                    </td>
                                    <td>{customer.email}</td>
                                    <td>{customer.phone || '-'}</td>
                                    <td>{customer.conversation_count || 0}</td>
                                    <td>{customer.last_conversation ? formatDate(customer.last_conversation) : '-'}</td>
                                    <td>
                                        <button
                                            className="action-btn view"
                                            onClick={() => setSelectedCustomer(customer)}
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {selectedCustomer && (
                <CustomerDetailModal
                    customer={selectedCustomer}
                    onClose={() => setSelectedCustomer(null)}
                />
            )}
        </div>
    );
};

// ============================================
// CUSTOMER DETAIL MODAL
// ============================================

const CustomerDetailModal = ({ customer, onClose }) => {
    const [conversations, setConversations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchConversations();
    }, [customer.id]);

    const fetchConversations = async () => {
        try {
            const response = await fetch(`${API_URL}/api/chat/customer/${customer.id}/conversations`);
            const data = await response.json();
            if (data.success) {
                setConversations(data.conversations);
            }
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="modal-header">
                    <div className="customer-avatar-large">
                        {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <h2>{customer.name}</h2>
                    <p>{customer.email}</p>
                </div>

                <div className="modal-body">
                    <div className="customer-details">
                        <div className="detail-item">
                            <span className="detail-label">Phone</span>
                            <span className="detail-value">{customer.phone || 'Not provided'}</span>
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Customer Since</span>
                            <span className="detail-value">{formatDate(customer.created_at)}</span>
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Total Conversations</span>
                            <span className="detail-value">{customer.conversation_count || 0}</span>
                        </div>
                    </div>

                    <h3>Conversation History</h3>
                    {isLoading ? (
                        <div className="loading-state small">
                            <Loader2 className="spinning" size={24} />
                        </div>
                    ) : conversations.length === 0 ? (
                        <p className="no-data">No conversations yet</p>
                    ) : (
                        <div className="conversation-list">
                            {conversations.map((conv) => (
                                <div key={conv.id} className="conversation-item">
                                    <div className="conv-info">
                                        <span className={`conv-status ${conv.status}`}>{conv.status}</span>
                                        <span className="conv-date">{formatDate(conv.started_at)}</span>
                                    </div>
                                    <p className="conv-preview">{conv.last_message || 'No messages'}</p>
                                    <span className="conv-messages">{conv.message_count} messages</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================
// CONVERSATIONS TAB
// ============================================

const ConversationsTab = () => {
    const [conversations, setConversations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedConversation, setSelectedConversation] = useState(null);

    useEffect(() => {
        fetchConversations();
    }, []);

    const fetchConversations = async () => {
        try {
            const response = await fetch(`${API_URL}/api/admin/conversations`);
            const data = await response.json();
            if (data.success) {
                setConversations(data.conversations);
            }
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="admin-tab">
            <div className="admin-tab-header">
                <div>
                    <h1>Conversations</h1>
                    <p>View all chat conversations</p>
                </div>
                <button className="admin-btn icon" onClick={fetchConversations}>
                    <RefreshCw size={18} />
                </button>
            </div>

            {isLoading ? (
                <div className="loading-state">
                    <Loader2 className="spinning" size={32} />
                    <p>Loading conversations...</p>
                </div>
            ) : conversations.length === 0 ? (
                <div className="empty-state">
                    <MessageSquare size={48} />
                    <h3>No conversations yet</h3>
                    <p>Conversations will appear here when customers start chatting</p>
                </div>
            ) : (
                <div className="conversations-grid">
                    {conversations.map((conv) => (
                        <div
                            key={conv.id}
                            className="conversation-card"
                            onClick={() => setSelectedConversation(conv)}
                        >
                            <div className="conv-card-header">
                                <div className="conv-customer">
                                    <div className="avatar">{conv.customer_name?.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <span className="customer-name">{conv.customer_name}</span>
                                        <span className="customer-email">{conv.customer_email}</span>
                                    </div>
                                </div>
                                <span className={`conv-status-badge ${conv.status}`}>{conv.status}</span>
                            </div>
                            <p className="conv-card-preview">{conv.last_message || 'No messages'}</p>
                            <div className="conv-card-footer">
                                <span>{conv.message_count} messages</span>
                                <span>{formatDate(conv.started_at)}</span>
                            </div>
                            <ChevronRight className="conv-arrow" size={20} />
                        </div>
                    ))}
                </div>
            )}

            {selectedConversation && (
                <ConversationDetailModal
                    conversation={selectedConversation}
                    onClose={() => setSelectedConversation(null)}
                />
            )}
        </div>
    );
};

// ============================================
// CONVERSATION DETAIL MODAL
// ============================================

const ConversationDetailModal = ({ conversation, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchMessages();
    }, [conversation.id]);

    const fetchMessages = async () => {
        try {
            const response = await fetch(`${API_URL}/api/admin/conversations/${conversation.id}`);
            const data = await response.json();
            if (data.success) {
                setMessages(data.messages);
            }
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content xlarge" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="modal-header">
                    <MessageSquare size={32} className="modal-icon" />
                    <h2>Conversation with {conversation.customer_name}</h2>
                    <p>{conversation.customer_email} • {formatDate(conversation.started_at)}</p>
                </div>

                <div className="modal-body">
                    {isLoading ? (
                        <div className="loading-state">
                            <Loader2 className="spinning" size={24} />
                        </div>
                    ) : (
                        <div className="message-thread">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`thread-message ${msg.role}`}>
                                    <div className="thread-message-header">
                                        <span className="thread-role">{msg.role === 'user' ? conversation.customer_name : 'Assistant'}</span>
                                        <span className="thread-time">{formatTime(msg.created_at)}</span>
                                    </div>
                                    <p className="thread-content">{msg.content}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================
// ANALYTICS TAB
// ============================================

const AnalyticsTab = ({ stats, isLoading }) => {
    if (isLoading) {
        return (
            <div className="admin-tab">
                <div className="loading-state">
                    <Loader2 className="spinning" size={32} />
                    <p>Loading analytics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-tab">
            <div className="admin-tab-header">
                <div>
                    <h1>Analytics</h1>
                    <p>Overview of your chatbot performance</p>
                </div>
            </div>

            <div className="analytics-grid">
                <div className="analytics-card">
                    <div className="analytics-icon customers">
                        <Users size={24} />
                    </div>
                    <div className="analytics-data">
                        <span className="analytics-value">{stats?.totalCustomers || 0}</span>
                        <span className="analytics-label">Total Customers</span>
                    </div>
                </div>

                <div className="analytics-card">
                    <div className="analytics-icon conversations">
                        <MessageSquare size={24} />
                    </div>
                    <div className="analytics-data">
                        <span className="analytics-value">{stats?.totalConversations || 0}</span>
                        <span className="analytics-label">Total Conversations</span>
                    </div>
                </div>

                <div className="analytics-card">
                    <div className="analytics-icon active">
                        <BarChart3 size={24} />
                    </div>
                    <div className="analytics-data">
                        <span className="analytics-value">{stats?.activeConversations || 0}</span>
                        <span className="analytics-label">Active Chats</span>
                    </div>
                </div>

                <div className="analytics-card">
                    <div className="analytics-icon messages">
                        <FileText size={24} />
                    </div>
                    <div className="analytics-data">
                        <span className="analytics-value">{stats?.totalMessages || 0}</span>
                        <span className="analytics-label">Total Messages</span>
                    </div>
                </div>
            </div>

            <div className="analytics-section">
                <h2>Knowledge Base Stats</h2>
                <div className="kb-stats-grid">
                    <div className="kb-stat">
                        <span className="kb-stat-value">{stats?.knowledgeBase?.documents || 0}</span>
                        <span className="kb-stat-label">Documents</span>
                    </div>
                    <div className="kb-stat">
                        <span className="kb-stat-value">{stats?.knowledgeBase?.chunks || 0}</span>
                        <span className="kb-stat-label">Text Chunks</span>
                    </div>
                    <div className="kb-stat">
                        <span className="kb-stat-value">{stats?.knowledgeBase?.totalTokens || 0}</span>
                        <span className="kb-stat-label">Total Tokens</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

export default AdminDashboard;