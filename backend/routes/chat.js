// backend/routes/chat.js
// Natural conversational chatbot with user memory and proper timestamps

const express = require('express');
const router = express.Router();

// Services
let knowledgeService;
try { knowledgeService = require('../services/knowledgeService'); } catch (e) { }

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

function wantsCall(message) {
    const m = message.toLowerCase();
    return [
        'call me',
        'ring me',
        'talk to someone',
        'talk to a person',
        'speak with team',
        'speaking with team',
        'human agent',
        'real person',
        'live agent',
        'callback',
        'call back'
    ].some(p => m.includes(p));
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

    // Save user message
    session.messages.push({
        role: 'user',
        content: message,
        time: formatTime()
    });

    let response = null;

    // 1️⃣ Small talk
    response = getConversationalResponse(message, session.name);

    // 2️⃣ CALL INTENT (🔥 FIX — must come BEFORE fallback)
    if (!response && wantsCall(message)) {
        response = `📞 I can arrange a call for you!

Please share your phone number with country code.
Example: +971501234567`;
    }

    // 3️⃣ Knowledge base
    if (!response && knowledgeService) {
        try {
            const kb = knowledgeService.findBestResponse?.(message);
            if (kb?.found) response = kb.response;
        } catch (e) { }
    }

    // 4️⃣ Fallback (LAST)
    if (!response) {
        response = `I can help with:

🏢 Company setup
📋 Visas
📞 Speaking with our team

What would you like to know?`;
    }

    // Save assistant reply
    session.messages.push({
        role: 'assistant',
        content: response,
        time: formatTime()
    });

    // ✅ REQUIRED RESPONSE (was missing before)
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
