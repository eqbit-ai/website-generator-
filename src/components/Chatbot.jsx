// src/components/Chatbot.jsx
// Modern chatbot with proper timestamps and natural flow

import React, { useState, useEffect, useRef } from 'react';
import {
    MessageSquare, X, Send, Phone, Minimize2,
    Loader, Bot, User, Clock
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const Chatbot = ({ userName = '', userPhone = '', userEmail = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Format time for display
    const formatTime = (timestamp) => {
        if (!timestamp) {
            return new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }

        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                return new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            }
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }
    };

    // Auto scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && !isMinimized) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, isMinimized]);

    // Start chat session
    const startSession = async () => {
        try {
            const response = await fetch(`${API_URL}/api/chat/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: userName || 'Guest',
                    phone: userPhone,
                    email: userEmail
                })
            });

            const data = await response.json();

            if (data.success) {
                setSessionId(data.sessionId);
                const greeting = {
                    id: 'msg_' + Date.now(),
                    role: 'assistant',
                    content: data.message,
                    time: data.time || formatTime()
                };
                setMessages([greeting]);
            }
        } catch (error) {
            console.error('Failed to start chat:', error);
            setMessages([{
                id: 'msg_error',
                role: 'assistant',
                content: 'Welcome! How can I help you today?',
                time: formatTime()
            }]);
        }
    };

    // Open chat
    const openChat = () => {
        setIsOpen(true);
        setIsMinimized(false);
        if (!sessionId) {
            startSession();
        }
    };

    // Send message
    const sendMessage = async () => {
        const message = inputValue.trim();
        if (!message || isLoading) return;

        const userMessage = {
            id: 'msg_' + Date.now(),
            role: 'user',
            content: message,
            time: formatTime()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/chat/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    message
                })
            });

            const data = await response.json();

            if (data.success) {
                const botMessage = {
                    id: 'msg_' + Date.now() + '_bot',
                    role: 'assistant',
                    content: data.response,
                    time: data.time || formatTime(),
                    callInitiated: data.callInitiated
                };
                setMessages(prev => [...prev, botMessage]);
            } else {
                throw new Error(data.error || 'Failed to get response');
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                id: 'msg_error_' + Date.now(),
                role: 'assistant',
                content: 'Sorry, I had trouble processing that. Please try again.',
                time: formatTime()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle enter key
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Quick actions
    const quickActions = [
        { label: '📞 Call Me', message: 'I would like someone to call me' },
        { label: '🏢 Company Setup', message: 'Tell me about company setup' },
        { label: '📋 Visa Info', message: 'What are the visa requirements?' }
    ];

    const handleQuickAction = (action) => {
        setInputValue(action.message);
        setTimeout(() => sendMessage(), 100);
    };

    if (!isOpen) {
        return (
            <button
                className="chatbot-trigger"
                onClick={openChat}
                aria-label="Open chat"
            >
                <MessageSquare size={24} />
                <span className="trigger-text">Chat with us</span>
            </button>
        );
    }

    return (
        <div className={`chatbot-container ${isMinimized ? 'minimized' : ''}`}>
            {/* Header */}
            <div className="chatbot-header">
                <div className="header-info">
                    <div className="header-avatar">
                        <Bot size={20} />
                    </div>
                    <div className="header-text">
                        <span className="header-title">Meydan Support</span>
                        <span className="header-status">
                            <span className="status-dot"></span>
                            Online
                        </span>
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className="header-btn"
                        onClick={() => setIsMinimized(!isMinimized)}
                        aria-label={isMinimized ? 'Expand' : 'Minimize'}
                    >
                        <Minimize2 size={18} />
                    </button>
                    <button
                        className="header-btn"
                        onClick={() => setIsOpen(false)}
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Messages */}
                    <div className="chatbot-messages">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`message ${msg.role}`}
                            >
                                <div className="message-avatar">
                                    {msg.role === 'user' ? (
                                        <User size={16} />
                                    ) : (
                                        <Bot size={16} />
                                    )}
                                </div>
                                <div className="message-content">
                                    <div className="message-text">
                                        {msg.content}
                                    </div>
                                    <div className="message-time">
                                        <Clock size={10} />
                                        {msg.time}
                                    </div>
                                    {msg.callInitiated && (
                                        <div className="call-badge">
                                            <Phone size={12} />
                                            Call scheduled
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="message assistant">
                                <div className="message-avatar">
                                    <Bot size={16} />
                                </div>
                                <div className="message-content">
                                    <div className="typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Actions */}
                    {messages.length <= 1 && (
                        <div className="quick-actions">
                            {quickActions.map((action, idx) => (
                                <button
                                    key={idx}
                                    className="quick-action-btn"
                                    onClick={() => handleQuickAction(action)}
                                >
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="chatbot-input">
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Type your message..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={isLoading}
                        />
                        <button
                            className="send-btn"
                            onClick={sendMessage}
                            disabled={!inputValue.trim() || isLoading}
                        >
                            {isLoading ? (
                                <Loader size={18} className="spin" />
                            ) : (
                                <Send size={18} />
                            )}
                        </button>
                    </div>
                </>
            )}

            <style jsx>{`
                .chatbot-trigger {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 14px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 50px;
                    cursor: pointer;
                    font-size: 15px;
                    font-weight: 500;
                    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
                    transition: transform 0.2s, box-shadow 0.2s;
                    z-index: 1000;
                }

                .chatbot-trigger:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 30px rgba(102, 126, 234, 0.5);
                }

                .chatbot-container {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    width: 380px;
                    max-height: 600px;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    z-index: 1000;
                    animation: slideUp 0.3s ease;
                }

                .chatbot-container.minimized {
                    max-height: auto;
                }

                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .chatbot-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }

                .header-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .header-avatar {
                    width: 40px;
                    height: 40px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .header-text {
                    display: flex;
                    flex-direction: column;
                }

                .header-title {
                    font-weight: 600;
                    font-size: 16px;
                }

                .header-status {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    opacity: 0.9;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    background: #4ade80;
                    border-radius: 50%;
                }

                .header-actions {
                    display: flex;
                    gap: 8px;
                }

                .header-btn {
                    width: 32px;
                    height: 32px;
                    background: rgba(255, 255, 255, 0.15);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                }

                .header-btn:hover {
                    background: rgba(255, 255, 255, 0.25);
                }

                .chatbot-messages {
                    flex: 1;
                    padding: 16px;
                    overflow-y: auto;
                    min-height: 300px;
                    max-height: 400px;
                    background: #f8f9fa;
                }

                .message {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 16px;
                    animation: fadeIn 0.3s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .message.user {
                    flex-direction: row-reverse;
                }

                .message-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .message.assistant .message-avatar {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }

                .message.user .message-avatar {
                    background: #e0e0e0;
                    color: #666;
                }

                .message-content {
                    max-width: 75%;
                }

                .message-text {
                    padding: 12px 16px;
                    border-radius: 16px;
                    font-size: 14px;
                    line-height: 1.5;
                    white-space: pre-wrap;
                }

                .message.assistant .message-text {
                    background: white;
                    color: #333;
                    border-radius: 16px 16px 16px 4px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
                }

                .message.user .message-text {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 16px 16px 4px 16px;
                }

                .message-time {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                    color: #999;
                    margin-top: 4px;
                    padding: 0 4px;
                }

                .message.user .message-time {
                    justify-content: flex-end;
                }

                .call-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    margin-top: 8px;
                    padding: 4px 10px;
                    background: #e8f5e9;
                    color: #2e7d32;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 500;
                }

                .typing-indicator {
                    display: flex;
                    gap: 4px;
                    padding: 12px 16px;
                    background: white;
                    border-radius: 16px;
                }

                .typing-indicator span {
                    width: 8px;
                    height: 8px;
                    background: #bbb;
                    border-radius: 50%;
                    animation: bounce 1.4s infinite;
                }

                .typing-indicator span:nth-child(2) {
                    animation-delay: 0.2s;
                }

                .typing-indicator span:nth-child(3) {
                    animation-delay: 0.4s;
                }

                @keyframes bounce {
                    0%, 60%, 100% { transform: translateY(0); }
                    30% { transform: translateY(-6px); }
                }

                .quick-actions {
                    display: flex;
                    gap: 8px;
                    padding: 0 16px 12px;
                    flex-wrap: wrap;
                }

                .quick-action-btn {
                    padding: 8px 14px;
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 20px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .quick-action-btn:hover {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }

                .chatbot-input {
                    display: flex;
                    gap: 8px;
                    padding: 16px;
                    border-top: 1px solid #eee;
                    background: white;
                }

                .chatbot-input input {
                    flex: 1;
                    padding: 12px 16px;
                    border: 1px solid #e0e0e0;
                    border-radius: 24px;
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.2s;
                }

                .chatbot-input input:focus {
                    border-color: #667eea;
                }

                .send-btn {
                    width: 44px;
                    height: 44px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                    border-radius: 50%;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.2s, opacity 0.2s;
                }

                .send-btn:hover:not(:disabled) {
                    transform: scale(1.05);
                }

                .send-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 480px) {
                    .chatbot-container {
                        width: calc(100vw - 32px);
                        right: 16px;
                        bottom: 16px;
                        max-height: calc(100vh - 100px);
                    }

                    .trigger-text {
                        display: none;
                    }

                    .chatbot-trigger {
                        padding: 14px;
                        border-radius: 50%;
                    }
                }
            `}</style>
        </div>
    );
};

export default Chatbot;