// backend/routes/chat.js
// Natural conversational chatbot with KB + AI + Call trigger

const express = require('express');
const router = express.Router();

// ============================
// SERVICES
// ============================

let knowledgeService;
try { knowledgeService = require('../services/knowledgeService'); } catch (e) { }

// Load intents from config
const fs = require('fs');
const path = require('path');
let intents = [];
try {
    const intentsPath = path.join(process.cwd(), 'backend', 'config', 'meydan_intents.json');
    if (fs.existsSync(intentsPath)) {
        const data = JSON.parse(fs.readFileSync(intentsPath, 'utf-8'));
        intents = data.intents || [];
        console.log(`✅ Chat: Loaded ${intents.length} intents`);
    }
} catch (e) {
    console.log('⚠️ Chat: Could not load intents:', e.message);
}

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

// For triggering Vapi calls
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

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
        return `Hello ${name}! How can I assist you today?`;
    }
    if (/^(thanks|thank you|thx|ty)\.?!?$/.test(m)) {
        return `You're welcome! Is there anything else I can help you with?`;
    }
    if (/^(bye|goodbye|see you)\.?!?$/.test(m)) {
        return `Goodbye ${name}, have a great day!`;
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

function extractEmail(message) {
    const match = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0].toLowerCase() : null;
}

// Check if message matches any intent
function checkIntent(message) {
    if (!message || !intents.length) return null;

    const q = message.toLowerCase();
    for (const intent of intents) {
        if (!intent || !intent.response || !intent.keywords) continue;

        for (const keyword of intent.keywords) {
            if (q.includes(keyword.toLowerCase())) {
                return intent.response;
            }
        }
    }
    return null;
}

// Trigger Vapi outbound call
async function triggerVapiCall(name, email, phone) {
    try {
        const response = await fetch(`${BASE_URL}/api/voice/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                email,
                phone,
                purpose: 'Chat-initiated call',
                message: 'User requested a call via chatbot'
            })
        });

        const data = await response.json();
        return data.success ? data : null;
    } catch (error) {
        console.error('❌ Failed to trigger Vapi call:', error.message);
        return null;
    }
}

// ============================
// ROUTES
// ============================

// Start chat
router.post('/start', (req, res) => {
    const { name } = req.body;
    const customerName = name || 'there';
    const sessionId = 'chat_' + Date.now();

    const greeting = `Hello ${customerName}! Welcome to Meydan Free Zone. How can I assist you today?`;

    const session = {
        id: sessionId,
        name: customerName,
        awaitingPhone: false,
        awaitingEmail: false,
        phone: null,
        email: null,
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
            awaitingEmail: false,
            phone: null,
            email: null,
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

    // 2️⃣ Email capture flow
    if (!response && session.awaitingEmail) {
        const email = extractEmail(message);
        if (email) {
            session.awaitingEmail = false;
            session.email = email;

            // Now we have name, phone, and email - trigger Vapi call!
            response = `Perfect! Connecting you with our voice agent now...`;

            // Trigger call asynchronously
            triggerVapiCall(session.name, session.email, session.phone)
                .then(result => {
                    if (result) {
                        console.log(`✅ Vapi call initiated for ${session.name} at ${session.phone}`);
                    } else {
                        console.log(`❌ Failed to initiate call for ${session.name}`);
                    }
                })
                .catch(err => console.error('Call trigger error:', err));

            response += `\n\nOur voice agent will call you at ${session.phone} in a few moments. Please answer the call to proceed with verification. You'll receive an SMS with a verification code shortly.`;

        } else {
            response = `Please provide a valid email address.\nExample: yourname@example.com`;
        }
    }

    // 3️⃣ Phone capture flow
    if (!response && session.awaitingPhone) {
        const phone = extractPhone(message);
        if (phone) {
            session.awaitingPhone = false;
            session.awaitingEmail = true;
            session.phone = phone;
            global.phoneStore.set(session.id, phone);

            response = `Great! And what's your email address?`;
        } else {
            response = `Please provide a valid phone number with country code.\nExample: +971501234567 or +918284852687`;
        }
    }

    // 4️⃣ Call intent
    if (!response && wantsCall(message)) {
        session.awaitingPhone = true;
        response = `I'll connect you with our voice agent. Please provide your phone number with country code.`;
    }

    // 5️⃣ Check intents first
    if (!response) {
        response = checkIntent(message);
    }

    // 6️⃣ Knowledge Base + AI (TF-IDF chunks)
    if (!response && knowledgeService && anthropic) {
        try {
            const results = knowledgeService.search(message, 3);

            // Lower threshold to 0.05 to catch more results
            if (results.length > 0 && results[0].score > 0.05) {
                // Combine top results for better context
                const kbContext = results.slice(0, 2).map(r => r.content).join('\n\n');

                const ai = await anthropic.messages.create({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 300,
                    system: `You are a professional, knowledgeable business consultant for Meydan Free Zone in Dubai.

Your communication style:
- Professional yet warm and approachable
- Clear, concise, and informative
- Natural conversational tone (avoid robotic responses)
- Use minimal emojis (max 1 per response, and only when truly appropriate)
- Focus on providing accurate information and genuine help

Answer questions using ONLY the information provided in the knowledge base below.
If the question is outside the knowledge base, politely indicate that and suggest they speak with a team member for more specific information.

KNOWLEDGE BASE:
${kbContext}

Important: Provide complete, helpful answers. Don't be overly brief or generic. Show expertise.`,
                    messages: [{ role: 'user', content: message }]
                });

                response = ai.content[0].text;
            }
        } catch (err) {
            console.log('AI KB error:', err.message);
        }
    }

    // 7️⃣ Fallback (LAST)
    if (!response) {
        response = `I can help you with information about:

• Company setup and business licenses
• Visa and immigration services
• Meydan Free Zone facilities and services

What would you like to know? Or if you'd prefer to speak with someone directly, just let me know and I can arrange a call.`;
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
