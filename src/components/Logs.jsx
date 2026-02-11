// src/components/Logs.jsx
// Logs Modal - View Chat and Voice logs

import React, { useState, useEffect, useCallback } from 'react';
import {
    FileText, X, MessageSquare, Phone, RefreshCw,
    User, Clock, AlertCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const Logs = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState('chat');
    const [chatLogs, setChatLogs] = useState([]);
    const [voiceLogs, setVoiceLogs] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch chat logs from unified logs API
            const chatRes = await fetch(`${API_URL}/api/logs/all?type=chat&limit=100`).catch(() => ({ ok: false }));
            if (chatRes.ok) {
                const data = await chatRes.json();
                setChatLogs(data.logs || []);
            }

            // Fetch voice logs from unified logs API
            const voiceRes = await fetch(`${API_URL}/api/logs/all?type=voice&limit=100`).catch(() => ({ ok: false }));
            if (voiceRes.ok) {
                const data = await voiceRes.json();
                setVoiceLogs(data.logs || []);
            }

            // Fetch sessions
            const sessionsRes = await fetch(`${API_URL}/api/logs/sessions`).catch(() => ({ ok: false }));
            if (sessionsRes.ok) {
                const data = await sessionsRes.json();
                setSessions(data.sessions || []);
            }
        } catch (e) {
            console.error('Fetch logs error:', e);
            setError('Failed to load logs');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '';
            return date.toLocaleString();
        } catch (e) {
            return '';
        }
    };

    return (
        <div className="logs-overlay" onClick={onClose}>
            <div className="logs-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="logs-header">
                    <div className="logs-header-title">
                        <FileText size={24} />
                        <h2>System Logs</h2>
                    </div>
                    <button className="kb-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="logs-tabs">
                    <button
                        className={`logs-tab ${activeTab === 'chat' ? 'active' : ''}`}
                        onClick={() => setActiveTab('chat')}
                    >
                        <MessageSquare size={16} />
                        Chat Logs ({chatLogs.length})
                    </button>
                    <button
                        className={`logs-tab ${activeTab === 'voice' ? 'active' : ''}`}
                        onClick={() => setActiveTab('voice')}
                    >
                        <Phone size={16} />
                        Voice Logs ({voiceLogs.length})
                    </button>
                    <button
                        className={`logs-tab ${activeTab === 'sessions' ? 'active' : ''}`}
                        onClick={() => setActiveTab('sessions')}
                    >
                        <User size={16} />
                        Sessions ({sessions.length})
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="kb-message error">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {/* Content */}
                <div className="logs-content">
                    {/* Chat Logs */}
                    {activeTab === 'chat' && (
                        <div className="logs-list">
                            {chatLogs.length === 0 ? (
                                <div className="logs-empty">
                                    <MessageSquare size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                                    <p>No chat logs yet</p>
                                </div>
                            ) : (
                                chatLogs.map((log, idx) => (
                                    <div key={idx} className="log-item">
                                        <div className="log-item-header">
                                            <span className="log-item-type chat">
                                                {log.role === 'user' ? '👤 User' : '🤖 Assistant'}
                                                {log.userName && ` - ${log.userName}`}
                                            </span>
                                            <span className="log-item-time">
                                                <Clock size={12} style={{ marginRight: 4 }} />
                                                {formatTime(log.timestamp)}
                                            </span>
                                        </div>
                                        <div className="log-item-content">
                                            {log.content || log.message || 'No content'}
                                        </div>
                                        {(log.userEmail || log.userPhone || log.sessionId) && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                {log.userEmail && <span>📧 {log.userEmail}</span>}
                                                {log.userPhone && <span>📱 {log.userPhone}</span>}
                                                {log.sessionId && <span>Session: {log.sessionId}</span>}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Voice Logs */}
                    {activeTab === 'voice' && (
                        <div className="logs-list">
                            {voiceLogs.length === 0 ? (
                                <div className="logs-empty">
                                    <Phone size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                                    <p>No voice logs yet</p>
                                </div>
                            ) : (
                                voiceLogs.map((log, idx) => (
                                    <div key={idx} className="log-item">
                                        <div className="log-item-header">
                                            <span className="log-item-type voice">
                                                {log.type || 'Voice'}
                                            </span>
                                            <span className="log-item-time">
                                                <Clock size={12} style={{ marginRight: 4 }} />
                                                {formatTime(log.timestamp)}
                                            </span>
                                        </div>
                                        <div className="log-item-content">
                                            {log.action || log.message || log.content || 'Voice event'}
                                        </div>
                                        {log.phone && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                                Phone: {log.phone}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Sessions */}
                    {activeTab === 'sessions' && (
                        <div className="logs-list">
                            {sessions.length === 0 ? (
                                <div className="logs-empty">
                                    <User size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                                    <p>No active sessions</p>
                                </div>
                            ) : (
                                sessions.map((session, idx) => (
                                    <div key={idx} className="log-item">
                                        <div className="log-item-header">
                                            <span className="log-item-type">
                                                👤 {session.userName || 'Anonymous'}
                                            </span>
                                            <span className="log-item-time">
                                                {session.messages?.length || 0} messages
                                            </span>
                                        </div>
                                        <div className="log-item-content">
                                            Session: {session.sessionId || session.id || 'Unknown'}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                            {session.userEmail && <span>📧 {session.userEmail}</span>}
                                            {session.userPhone && <span>📱 {session.userPhone}</span>}
                                            {session.startTime && <span>Started: {formatTime(session.startTime)}</span>}
                                            {session.lastActivity && <span>Last: {formatTime(session.lastActivity)}</span>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="logs-footer">
                    <button className="kb-btn secondary" onClick={fetchLogs} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        Refresh
                    </button>
                    <button className="kb-btn secondary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Logs;