// src/components/Chatbot.jsx
// AI Chatbot with styled button

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Minimize2, User, Bot, RotateCcw } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [userName, setUserName] = useState('');
    const [showForm, setShowForm] = useState(true);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const startChat = async (e) => {
        e.preventDefault();
        if (!userName.trim()) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/chat/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: userName.trim() })
            });

            if (res.ok) {
                const data = await res.json();
                setSessionId(data.sessionId);
                setMessages(data.messages || [{
                    role: 'assistant',
                    content: data.message,
                    time: data.time
                }]);
                setShowForm(false);
            }
        } catch (e) {
            console.error('Start chat error:', e);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading || !sessionId) return;

        const userMessage = {
            role: 'user',
            content: input.trim(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/chat/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    message: userMessage.content
                })
            });

            if (res.ok) {
                const data = await res.json();
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.message,
                    time: data.time
                }]);
            }
        } catch (e) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } finally {
            setLoading(false);
        }
    };

    const resetChat = () => {
        setMessages([]);
        setSessionId(null);
        setShowForm(true);
        setUserName('');
    };

    if (!isOpen) {
        return (
            <button
                className="chat-fab"
                onClick={() => setIsOpen(true)}
            >
                <MessageCircle size={24} />
                <span>Chat with us</span>
            </button>
        );
    }

    return (
        <div className="chatbot-container">
            {/* Header */}
            <div className="chatbot-header">
                <div className="chatbot-header-info">
                    <div className="chatbot-avatar">
                        <Bot size={20} />
                    </div>
                    <div>
                        <h3>Meydan Assistant</h3>
                        <div className="chatbot-status">
                            <span className="status-dot"></span>
                            Online
                        </div>
                    </div>
                </div>
                <div className="chatbot-header-actions">
                    <button onClick={() => setIsOpen(false)} title="Minimize">
                        <Minimize2 size={18} />
                    </button>
                    <button onClick={() => { setIsOpen(false); resetChat(); }} title="Close">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Form or Chat */}
            {showForm ? (
                <div className="chatbot-form-container">
                    <div className="chatbot-welcome">
                        <h4>Welcome! 👋</h4>
                        <p>Please enter your name to start chatting</p>
                    </div>
                    <form className="chatbot-form" onSubmit={startChat}>
                        <div className="chatbot-input-group">
                            <label>Your Name</label>
                            <input
                                type="text"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                placeholder="Enter your name"
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            className="chatbot-start-button"
                            disabled={!userName.trim() || loading}
                        >
                            {loading ? 'Starting...' : 'Start Chat'}
                        </button>
                    </form>
                </div>
            ) : (
                <>
                    {/* Messages */}
                    <div className="chatbot-messages">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`chatbot-message ${msg.role}`}>
                                <div className="message-avatar">
                                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                                </div>
                                <div className="message-content">
                                    <p>{msg.content}</p>
                                    {msg.time && <span className="message-time">{msg.time}</span>}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="chatbot-message assistant">
                                <div className="message-avatar">
                                    <Bot size={14} />
                                </div>
                                <div className="message-content typing">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form className="chatbot-input-container" onSubmit={sendMessage}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type a message..."
                            disabled={loading}
                        />
                        <button type="submit" disabled={!input.trim() || loading}>
                            <Send size={18} />
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="chatbot-footer">
                        <button className="reset-chat-button" onClick={resetChat}>
                            <RotateCcw size={12} /> Reset conversation
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default Chatbot;