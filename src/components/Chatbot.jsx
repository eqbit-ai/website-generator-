// src/components/Chatbot.jsx

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, User, Bot, X, MessageCircle, Minimize2 } from 'lucide-react';

const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [sessionStarted, setSessionStarted] = useState(false);
    const [conversationId, setConversationId] = useState(null);

    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        email: '',
        phone: ''
    });
    const [formErrors, setFormErrors] = useState({});

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen && sessionStarted && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen, sessionStarted]);

    const validateForm = () => {
        const errors = {};

        if (!customerInfo.name.trim()) {
            errors.name = 'Name is required';
        }

        if (!customerInfo.email.trim()) {
            errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
            errors.email = 'Please enter a valid email';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleStartChat = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);

        try {
            const response = await fetch(`${config.apiUrl}/api/chat/start`, {

                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customerInfo)
            });

            const data = await response.json();

            if (data.success) {
                setConversationId(data.conversationId);
                setSessionStarted(true);
                setMessages([{
                    id: Date.now(),
                    role: 'assistant',
                    content: data.greeting,
                    timestamp: new Date()
                }]);
            } else {
                setFormErrors({ submit: data.error || 'Failed to start chat' });
            }
        } catch (error) {
            setFormErrors({ submit: 'Failed to connect to server. Make sure backend is running.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!inputValue.trim() || isLoading) return;

        const userMessage = inputValue.trim();
        setInputValue('');

        setMessages(prev => [...prev, {
            id: Date.now(),
            role: 'user',
            content: userMessage,
            timestamp: new Date()
        }]);

        setIsLoading(true);

        try {
            const response = await fetch(`${config.apiUrl}/api/chat/message`, {

                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId,
                    message: userMessage
                })
            });

            const data = await response.json();

            if (data.success) {
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    role: 'assistant',
                    content: data.response,
                    timestamp: new Date()
                }]);
            } else {
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    role: 'assistant',
                    content: 'Sorry, I encountered an error. Please try again.',
                    timestamp: new Date(),
                    isError: true
                }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: 'Sorry, I couldn\'t connect to the server. Please try again.',
                timestamp: new Date(),
                isError: true
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetChat = () => {
        setSessionStarted(false);
        setConversationId(null);
        setMessages([]);
        setCustomerInfo({ name: '', email: '', phone: '' });
        setFormErrors({});
    };

    // Chat button (when closed)
    if (!isOpen) {
        return (
            <button className="chatbot-button" onClick={() => setIsOpen(true)}>
                <MessageCircle size={24} />
                <span className="chatbot-button-text">Chat with us</span>
            </button>
        );
    }

    return (
        <div className={`chatbot-container ${isMinimized ? 'minimized' : ''}`}>
            {/* Header */}
            <div className="chatbot-header">
                <div className="chatbot-header-info">
                    <div className="chatbot-avatar">
                        <Bot size={20} />
                    </div>
                    <div>
                        <h3>Support Assistant</h3>
                        <span className="chatbot-status">
                            <span className="status-dot"></span>
                            Online
                        </span>
                    </div>
                </div>
                <div className="chatbot-header-actions">
                    <button onClick={() => setIsMinimized(!isMinimized)} title="Minimize">
                        <Minimize2 size={18} />
                    </button>
                    <button onClick={() => setIsOpen(false)} title="Close">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Customer Info Form */}
                    {!sessionStarted ? (
                        <div className="chatbot-form-container">
                            <div className="chatbot-welcome">
                                <h4>Welcome! 👋</h4>
                                <p>Please provide your details to start chatting with our support team.</p>
                            </div>

                            <form onSubmit={handleStartChat} className="chatbot-form">
                                <div className="chatbot-input-group">
                                    <label>Name *</label>
                                    <input
                                        type="text"
                                        value={customerInfo.name}
                                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Your name"
                                        className={formErrors.name ? 'error' : ''}
                                    />
                                    {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                                </div>

                                <div className="chatbot-input-group">
                                    <label>Email *</label>
                                    <input
                                        type="email"
                                        value={customerInfo.email}
                                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="your@email.com"
                                        className={formErrors.email ? 'error' : ''}
                                    />
                                    {formErrors.email && <span className="error-text">{formErrors.email}</span>}
                                </div>

                                <div className="chatbot-input-group">
                                    <label>Phone (optional)</label>
                                    <input
                                        type="tel"
                                        value={customerInfo.phone}
                                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                                        placeholder="+1 (123) 456-7890"
                                    />
                                </div>

                                {formErrors.submit && (
                                    <div className="chatbot-error">{formErrors.submit}</div>
                                )}

                                <button type="submit" className="chatbot-start-button" disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="spinning" size={18} />
                                            Starting...
                                        </>
                                    ) : (
                                        'Start Chat'
                                    )}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <>
                            {/* Messages */}
                            <div className="chatbot-messages">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`chatbot-message ${message.role} ${message.isError ? 'error' : ''}`}
                                    >
                                        <div className="message-avatar">
                                            {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                        </div>
                                        <div className="message-content">
                                            <p>{message.content}</p>
                                            <span className="message-time">
                                                {new Date(message.timestamp).toLocaleTimeString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {isLoading && (
                                    <div className="chatbot-message assistant">
                                        <div className="message-avatar">
                                            <Bot size={16} />
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
                            <form onSubmit={handleSendMessage} className="chatbot-input-container">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Type your message..."
                                    disabled={isLoading}
                                />
                                <button type="submit" disabled={!inputValue.trim() || isLoading}>
                                    <Send size={18} />
                                </button>
                            </form>

                            {/* Footer */}
                            <div className="chatbot-footer">
                                <button onClick={handleResetChat} className="reset-chat-button">
                                    Start New Chat
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default Chatbot;