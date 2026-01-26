// backend/routes/chat.js
// Natural conversational chatbot with user memory and proper timestamps

const express = require('express');
const router = express.Router();

// Services
let knowledgeService;
try { knowledgeService = require('../services/knowledgeService'); } catch (e) { }

let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
    try {
        anthropic = new (require('@anthropic-ai/sdk'))({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        console.log('✅ Chat AI ready');
    } catch (e) { }
}

// Database
let db;
try { db = require('../database'); } catch (e) {
    db = { userAccounts: { getBy: () => null, insert: () => { }, update: () => { } } };
}

// Session storage
const chatSessions = new Map();

// Global stores
if (!global.phoneStore) global.phoneStore = new Map();
if (!global.chatLogs) global.chatLogs = [];

// ============================
// HELPERS
// ============================

function formatTime() {
    return new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function formatTimestamp() {
    return new Date().toISOString();
}

function getConversationalResponse(message, name) {
    const m = message.toLowerCase().trim();

    if (/^(hi|hello|hey|hiya)\.?!?$/.test(m)) {
        return `Hey ${name}! 👋 How can I help you today?`;
    }

    if (/^(thanks|thank you|thx|ty)\.?!?$/.test(m)) {
        return `You're welcome! 😊 Anything else I can help with?`;
    }

    if (/^(bye|goodbye|see you)\.?!?$/.test(m)) {
        return `Goodbye! Take care 👋`;
    }

    return null;
}

// ============================
// ROUTES
// ============================

// Start chat
router.post('/start', (req, res) => {
    const { name } = req.body;
    const customerName = name || 'there';
    const sessionId = 'chat_' + Date.now();

    const greeting = `Hello ${customerName}! 👋 Welcome to Meydan Free Zone. How can I help you today?`;

    const session = {
        id: sessionId,
        name: customerName,
        messages: [{
            role: 'assistant',
            content: greeting,
            time: formatTime()
        }],
        createdAt: formatTimestamp()
    };

    chatSessions.set(sessionId, session);

    res.json({
        success: true,
        sessionId,
        message: greeting,
        messages: session.messages,
        time: session.messages[0].time
    });
});

// Send message
router.post('/message', async (req, res) => {
    const { sessionId, message } = req.body;

    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message required' });
    }

    let session = chatSessions.get(sessionId);
    if (!session) {
        session = {
            id: sessionId,
            name: 'Guest',
            messages: []
        };
        chatSessions.set(sessionId, session);
    }

    session.messages.push({
        role: 'user',
        content: message,
        time: formatTime()
    });

    let response = getConversationalResponse(message, session.name);

    if (!response && knowledgeService) {
        try {
            const kb = knowledgeService.findBestResponse?.(message);
            if (kb?.found) response = kb.response;
        } catch (e) { }
    }

    if (!response) {
        response = `I can help with:\n\n🏢 Company setup\n📋 Visas\n📞 Speaking with our team\n\nWhat would you like to know?`;
    }

    session.messages.push({
        role: 'assistant',
        content: response,
        time: formatTime()
    });

    // ✅ THIS WAS MISSING BEFORE (CRITICAL FIX)
    res.json({
        success: true,
        message: response,
        sessionId: session.id,
        time: formatTime()
    });
});

// Chat history
router.get('/history/:sessionId', (req, res) => {
    const session = chatSessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true, messages: session.messages });
});

// Admin – sessions
router.get('/sessions', (req, res) => {
    const sessions = Array.from(chatSessions.values()).map(s => ({
        id: s.id,
        name: s.name,
        messageCount: s.messages.length,
        createdAt: s.createdAt
    }));

    res.json({ success: true, sessions });
});

// Health
router.get('/health', (req, res) => {
    res.json({
        ok: true,
        sessions: chatSessions.size
    });
});

module.exports = router;
