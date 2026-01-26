// backend/routes/chat.js
// Natural conversational chatbot with KB + AI + Call trigger

const express = require('express');
const router = express.Router();

// ============================
// SERVICES
// ============================

let knowledgeService;
try { knowledgeService = require('../services/knowledgeService'); } catch (e) { }

let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
    try {
        const Anthropic = require('@anthropic-ai/sdk');
        anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        console.log('✅ Chat AI ready');
    } catch (e) { }
}

// Database (safe fallback)
let db;
try { db = require('../database'); } catch (e) {
    db = { userAccounts: { getBy: () => null, insert: () => { }, update: () => { } } };
}

// ============================
// STATE
// ============================

const chatSessions = new Map();

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

function extractPhone(message) {
    const match = message.match(/\+?\d{10,15}/);
    if (!match) return null;

    let phone = match[0];
    if (!phone.startsWith('+')) phone = '+' + phone;
    return phone;
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
        awaitingPhone: false,
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
            awaitingPhone: false,
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

    // 2️⃣ Phone capture flow
    if (!response && session.awaitingPhone) {
        const phone = extractPhone(message);
        if (phone) {
            session.awaitingPhone = false;
            global.phoneStore.set(session.id, phone);

            response = `✅ Got it! Our team will call you shortly at ${phone} 📞  
Is there anything else I can help you with meanwhile?`;
        } else {
            response = `Please share a valid phone number with country code.  
Example: +971501234567`;
        }
    }

    // 3️⃣ Call intent
    if (!response && wantsCall(message)) {
        session.awaitingPhone = true;
        response = `📞 Sure! Please share your phone number with country code so our team can call you.`;
    }

    // 4️⃣ Knowledge Base + AI
    if (!response && knowledgeService && anthropic) {
        try {
            const results = knowledgeService.search(message, 1);

            if (results.length > 0 && results[0].score > 0.1) {
                const kbContext = results[0].content;

                const ai = await anthropic.messages.create({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 200,
                    system: `You are a helpful, human-sounding assistant for Meydan Free Zone.
Answer ONLY using the information below.
Be clear and concise.

KNOWLEDGE:
${kbContext}`,
                    messages: [{ role: 'user', content: message }]
                });

                response = ai.content[0].text;
            }
        } catch (err) {
            console.log('AI KB error:', err.message);
        }
    }

    // 5️⃣ Fallback (LAST)
    if (!response) {
        response = `I can help with:

🏢 Company setup  
📋 Visas  
📞 Speaking with our team  

What would you like to know?`;
    }

    // Save assistant response
    session.messages.push({
        role: 'assistant',
        content: response,
        time: formatTime()
    });

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
