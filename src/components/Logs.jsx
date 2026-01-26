// src/components/admin/Logs.jsx
// Admin panel tab for viewing chat and voice logs

import React, { useState, useEffect, useCallback } from 'react';
import {
    MessageSquare, Phone, RefreshCw, Search,
    User, Clock, Filter, ChevronDown, ChevronUp,
    AlertCircle, CheckCircle, XCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const Logs = () => {
    const [activeTab, setActiveTab] = useState('chat');
    const [chatLogs, setChatLogs] = useState([]);
    const [voiceLogs, setVoiceLogs] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedSessions, setExpandedSessions] = useState(new Set());
    const [autoRefresh, setAutoRefresh] = useState(false);

    const fetchChatLogs = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/chat/logs?limit=200`);
            const data = await res.json();
            if (data.success) {
                setChatLogs(data.logs || []);
            }
        } catch (e) {
            console.error('Failed to fetch chat logs:', e);
        }
    }, []);

    const fetchVoiceLogs = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/outbound/logs?limit=200`);
            const data = await res.json();
            if (data.success) {
                setVoiceLogs(data.logs || []);
            }
        } catch (e) {
            console.error('Failed to fetch voice logs:', e);
        }
    }, []);

    const fetchSessions = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/chat/sessions`);
            const data = await res.json();
            if (data.success) {
                setSessions(data.sessions || []);
            }
        } catch (e) {
            console.error('Failed to fetch sessions:', e);
        }
    }, []);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await Promise.all([fetchChatLogs(), fetchVoiceLogs(), fetchSessions()]);
        } catch (e) {
            setError('Failed to fetch logs');
        } finally {
            setLoading(false);
        }
    }, [fetchChatLogs, fetchVoiceLogs, fetchSessions]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    useEffect(() => {
        let interval;
        if (autoRefresh) {
            interval = setInterval(fetchAll, 5000);
        }
        return () => clearInterval(interval);
    }, [autoRefresh, fetchAll]);

    const toggleSession = (sessionId) => {
        const newExpanded = new Set(expandedSessions);
        if (newExpanded.has(sessionId)) {
            newExpanded.delete(sessionId);
        } else {
            newExpanded.add(sessionId);
        }
        setExpandedSessions(newExpanded);
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        try {
            const date = new Date(timestamp);
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        } catch {
            return timestamp;
        }
    };

    const getActionIcon = (action) => {
        if (action?.includes('verified')) return <CheckCircle size={14} className="text-green-500" />;
        if (action?.includes('error') || action?.includes('failed')) return <XCircle size={14} className="text-red-500" />;
        if (action?.includes('search') || action?.includes('kb')) return <Search size={14} className="text-blue-500" />;
        if (action?.includes('otp') || action?.includes('sms')) return <Phone size={14} className="text-purple-500" />;
        return <AlertCircle size={14} className="text-gray-400" />;
    };

    const filteredChatLogs = chatLogs.filter(log =>
        !searchTerm ||
        log.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.sessionId?.includes(searchTerm)
    );

    const filteredVoiceLogs = voiceLogs.filter(log =>
        !searchTerm ||
        log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.callId?.includes(searchTerm)
    );

    // Group chat logs by session
    const groupedChatLogs = filteredChatLogs.reduce((acc, log) => {
        const sessionId = log.sessionId || 'unknown';
        if (!acc[sessionId]) {
            acc[sessionId] = {
                sessionId,
                userName: log.userName || 'Guest',
                logs: []
            };
        }
        acc[sessionId].logs.push(log);
        return acc;
    }, {});

    return (
        <div className="logs-container">
            <div className="logs-header">
                <h2>📊 Logs & Conversations</h2>

                <div className="logs-controls">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search logs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <label className="auto-refresh-toggle">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        <span>Auto-refresh</span>
                    </label>

                    <button
                        className="refresh-btn"
                        onClick={fetchAll}
                        disabled={loading}
                    >
                        <RefreshCw size={18} className={loading ? 'spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="logs-error">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            <div className="logs-tabs">
                <button
                    className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chat')}
                >
                    <MessageSquare size={18} />
                    Chat Logs ({filteredChatLogs.length})
                </button>
                <button
                    className={`tab ${activeTab === 'voice' ? 'active' : ''}`}
                    onClick={() => setActiveTab('voice')}
                >
                    <Phone size={18} />
                    Voice Logs ({filteredVoiceLogs.length})
                </button>
                <button
                    className={`tab ${activeTab === 'sessions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sessions')}
                >
                    <User size={18} />
                    Active Sessions ({sessions.length})
                </button>
            </div>

            <div className="logs-content">
                {/* Chat Logs Tab */}
                {activeTab === 'chat' && (
                    <div className="chat-logs">
                        {Object.keys(groupedChatLogs).length === 0 ? (
                            <div className="no-logs">No chat logs found</div>
                        ) : (
                            Object.values(groupedChatLogs).map(session => (
                                <div key={session.sessionId} className="session-group">
                                    <div
                                        className="session-header"
                                        onClick={() => toggleSession(session.sessionId)}
                                    >
                                        <div className="session-info">
                                            <User size={16} />
                                            <span className="session-name">{session.userName}</span>
                                            <span className="session-id">{session.sessionId.substring(0, 15)}...</span>
                                            <span className="message-count">{session.logs.length} messages</span>
                                        </div>
                                        {expandedSessions.has(session.sessionId) ?
                                            <ChevronUp size={18} /> : <ChevronDown size={18} />
                                        }
                                    </div>

                                    {expandedSessions.has(session.sessionId) && (
                                        <div className="session-messages">
                                            {session.logs.map((log, idx) => (
                                                <div key={idx} className={`log-message ${log.role}`}>
                                                    <div className="message-header">
                                                        <span className={`role-badge ${log.role}`}>
                                                            {log.role === 'user' ? '👤 User' : '🤖 Bot'}
                                                        </span>
                                                        <span className="source-badge">{log.source}</span>
                                                        <span className="timestamp">
                                                            <Clock size={12} />
                                                            {log.time || formatTime(log.timestamp)}
                                                        </span>
                                                    </div>
                                                    <div className="message-content">{log.content}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Voice Logs Tab */}
                {activeTab === 'voice' && (
                    <div className="voice-logs">
                        {filteredVoiceLogs.length === 0 ? (
                            <div className="no-logs">No voice logs found</div>
                        ) : (
                            <table className="logs-table">
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Call ID</th>
                                        <th>Action</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredVoiceLogs.map((log, idx) => (
                                        <tr key={idx}>
                                            <td className="timestamp-cell">
                                                {formatTime(log.timestamp)}
                                            </td>
                                            <td className="callid-cell">
                                                {log.callId?.substring(0, 8) || '-'}...
                                            </td>
                                            <td className="action-cell">
                                                {getActionIcon(log.action)}
                                                <span>{log.action}</span>
                                            </td>
                                            <td className="details-cell">
                                                {log.details}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Active Sessions Tab */}
                {activeTab === 'sessions' && (
                    <div className="sessions-list">
                        {sessions.length === 0 ? (
                            <div className="no-logs">No active sessions</div>
                        ) : (
                            <table className="logs-table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Phone</th>
                                        <th>Messages</th>
                                        <th>Last Message</th>
                                        <th>Started</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.map((session, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <div className="user-cell">
                                                    <User size={14} />
                                                    {session.name}
                                                </div>
                                            </td>
                                            <td>{session.phone || '-'}</td>
                                            <td>{session.messageCount}</td>
                                            <td className="last-message-cell">
                                                {session.lastMessage || '-'}
                                            </td>
                                            <td>{formatTime(session.createdAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            <style jsx>{`
                .logs-container {
                    padding: 24px;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .logs-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                    flex-wrap: wrap;
                    gap: 16px;
                }

                .logs-header h2 {
                    margin: 0;
                    font-size: 24px;
                    color: #1a1a2e;
                }

                .logs-controls {
                    display: flex;
                    align-items: center;
                    gap: 16px;
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

                .auto-refresh-toggle {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    color: #666;
                }

                .refresh-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.2s;
                }

                .refresh-btn:hover {
                    background: #5a6fd6;
                }

                .refresh-btn:disabled {
                    opacity: 0.7;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .logs-error {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 16px;
                    background: #ffebee;
                    color: #c62828;
                    border-radius: 8px;
                    margin-bottom: 16px;
                }

                .logs-tabs {
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

                .logs-content {
                    background: white;
                    border-radius: 12px;
                    border: 1px solid #e0e0e0;
                    overflow: hidden;
                }

                .no-logs {
                    padding: 48px;
                    text-align: center;
                    color: #999;
                }

                /* Session Groups */
                .session-group {
                    border-bottom: 1px solid #eee;
                }

                .session-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    cursor: pointer;
                    background: #fafafa;
                    transition: background 0.2s;
                }

                .session-header:hover {
                    background: #f0f0f0;
                }

                .session-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .session-name {
                    font-weight: 600;
                    color: #333;
                }

                .session-id {
                    font-size: 12px;
                    color: #999;
                    font-family: monospace;
                }

                .message-count {
                    font-size: 12px;
                    background: #667eea;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 12px;
                }

                .session-messages {
                    padding: 16px 20px;
                    background: white;
                }

                .log-message {
                    margin-bottom: 16px;
                    padding: 12px 16px;
                    border-radius: 8px;
                }

                .log-message.user {
                    background: #e3f2fd;
                    margin-left: 40px;
                }

                .log-message.assistant {
                    background: #f5f5f5;
                    margin-right: 40px;
                }

                .message-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 8px;
                    font-size: 12px;
                }

                .role-badge {
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-weight: 500;
                }

                .role-badge.user {
                    background: #2196f3;
                    color: white;
                }

                .role-badge.assistant {
                    background: #4caf50;
                    color: white;
                }

                .source-badge {
                    padding: 2px 8px;
                    background: #eee;
                    border-radius: 4px;
                    color: #666;
                }

                .timestamp {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    color: #999;
                    margin-left: auto;
                }

                .message-content {
                    color: #333;
                    line-height: 1.5;
                    white-space: pre-wrap;
                }

                /* Table Styles */
                .logs-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .logs-table th {
                    text-align: left;
                    padding: 16px 20px;
                    background: #fafafa;
                    font-weight: 600;
                    color: #333;
                    border-bottom: 2px solid #e0e0e0;
                }

                .logs-table td {
                    padding: 12px 20px;
                    border-bottom: 1px solid #eee;
                    color: #555;
                    font-size: 14px;
                }

                .logs-table tr:hover {
                    background: #fafafa;
                }

                .timestamp-cell {
                    font-size: 12px;
                    color: #888;
                    white-space: nowrap;
                }

                .callid-cell {
                    font-family: monospace;
                    font-size: 12px;
                    color: #999;
                }

                .action-cell {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .details-cell {
                    max-width: 400px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .user-cell {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .last-message-cell {
                    max-width: 200px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #888;
                    font-size: 12px;
                }
            `}</style>
        </div>
    );
};

export default Logs;