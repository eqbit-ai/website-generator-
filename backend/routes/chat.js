// backend/routes/chat.js
// Natural conversational chatbot with KB + AI + Call trigger

const express = require('express');
const router = express.Router();

// Logs service
let logChatMessage;
try {
    const logsModule = require('./logs');
    logChatMessage = logsModule.logChatMessage;
} catch (e) {
    console.log('⚠️ Logs service not available');
    // Fallback logger
    logChatMessage = () => { };
}

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
    // Try multiple paths for Railway compatibility
    const possiblePaths = [
        path.join(__dirname, '..', 'config', 'meydan_intents.json'),
        path.join(process.cwd(), 'backend', 'config', 'meydan_intents.json'),
        path.join(process.cwd(), 'config', 'meydan_intents.json')
    ];

    let intentsPath = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            intentsPath = p;
            break;
        }
    }

    if (intentsPath) {
        const data = JSON.parse(fs.readFileSync(intentsPath, 'utf-8'));
        intents = data.intents || [];
        console.log(`✅ Chat: Loaded ${intents.length} intents from ${intentsPath}`);
    } else {
        console.log('❌ Chat: Intents file not found in any location');
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
        'speak to someone',
        'speak to a person',
        'speak with someone',
        'speak with team',
        'speaking with team',
        'human agent',
        'real person',
        'live agent',
        'callback',
        'call back',
        'can someone call',
        'someone call me',
        'get a call',
        'phone call'
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

// Normalize word (singular/plural, common variations)
function normalizeWord(word) {
    word = word.toLowerCase().trim();
    // Handle plural/singular
    if (word.endsWith('s')) return word.slice(0, -1);
    return word;
}

// Check if message matches any intent
function checkIntent(message) {
    if (!message || !intents.length) return null;

    const q = message.toLowerCase().trim();
    const qWords = q.split(/\s+/).map(normalizeWord); // Normalize words

    for (const intent of intents) {
        if (!intent || !intent.response || !intent.keywords) continue;

        for (const keyword of intent.keywords) {
            const kw = keyword.toLowerCase();

            // 1. Exact phrase match
            if (q.includes(kw)) {
                console.log(`✅ Intent matched (exact): "${intent.name}" via keyword "${keyword}"`);
                return intent.response;
            }

            // 2. Word-level matching - check if all important words from keyword appear in query
            const kwWords = kw.split(/\s+/).filter(w => w.length > 2).map(normalizeWord);
            const allWordsPresent = kwWords.every(kwWord =>
                qWords.some(qWord => {
                    // Exact match after normalization
                    if (qWord === kwWord) return true;
                    // Contains match
                    if (qWord.includes(kwWord) || kwWord.includes(qWord)) return true;
                    // Fuzzy match: allow 1 character difference for typos
                    if (kwWord.length > 4 && levenshteinDistance(qWord, kwWord) <= 1) return true;
                    return false;
                })
            );

            if (allWordsPresent && kwWords.length > 0) {
                console.log(`✅ Intent matched (word-level): "${intent.name}" via keyword "${keyword}"`);
                return intent.response;
            }
        }
    }
    return null;
}

// Simple Levenshtein distance for typo tolerance
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// Trigger Vapi outbound call
async function triggerVapiCall(name, email, phone, sessionId) {
    try {
        const response = await fetch(`${BASE_URL}/api/voice/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                email,
                phone,
                sessionId,
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
    const { name, email, phone } = req.body;

    // Require name, email, and phone
    if (!name || !email || !phone) {
        return res.status(400).json({
            error: 'Name, email, and phone number are required',
            missing: {
                name: !name,
                email: !email,
                phone: !phone
            }
        });
    }

    const customerName = name.trim();
    const customerEmail = email.trim().toLowerCase();
    let customerPhone = phone.trim();

    // Ensure phone has country code
    if (!customerPhone.startsWith('+')) {
        customerPhone = '+' + customerPhone;
    }

    const sessionId = 'chat_' + Date.now();

    const greeting = `Hello ${customerName}! Welcome to Meydan Free Zone. How can I assist you today?`;

    const session = {
        id: sessionId,
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        awaitingPhone: false,
        awaitingEmail: false,
        messages: [{
            role: 'assistant',
            content: greeting,
            time: formatTime()
        }],
        createdAt: formatTimestamp()
    };

    chatSessions.set(sessionId, session);

    // Store phone for potential Vapi call
    global.phoneStore.set(sessionId, customerPhone);

    // Log the greeting message
    logChatMessage(sessionId, 'assistant', greeting, customerName, customerEmail, customerPhone);

    console.log(`💬 Chat started: ${customerName} (${customerEmail}, ${customerPhone})`);

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
        return res.status(404).json({ error: 'Session not found. Please start a new chat.' });
    }

    // Save user message
    session.messages.push({
        role: 'user',
        content: message,
        time: formatTime()
    });

    // Log user message
    logChatMessage(sessionId, 'user', message, session.name, session.email, session.phone);

    let response = null;

    // 1️⃣ Small talk
    response = getConversationalResponse(message, session.name);

    // 2️⃣ Call intent - Trigger call immediately since we have all info
    if (!response && wantsCall(message)) {
        response = `Perfect! Connecting you with our voice agent now...`;

        // Trigger call asynchronously - we already have name, email, phone from session
        triggerVapiCall(session.name, session.email, session.phone, sessionId)
            .then(result => {
                if (result) {
                    console.log(`✅ Vapi call initiated for ${session.name} at ${session.phone}`);
                } else {
                    console.log(`❌ Failed to initiate call for ${session.name}`);
                }
            })
            .catch(err => console.error('Call trigger error:', err));

        response += `\n\nOur voice agent will call you at ${session.phone} in a few moments. Please answer the call to proceed with verification. You'll receive an SMS with a verification code shortly.`;
    }

    // 5️⃣ Check intents first
    if (!response) {
        response = checkIntent(message);
    }

    // 6️⃣ Conversational AI with Knowledge Base context (ONLY if KB has high confidence)
    if (!response && anthropic) {
        try {
            // Search knowledge base for relevant information
            let kbContext = '';
            let kbScore = 0;

            if (knowledgeService) {
                const results = knowledgeService.search(message, 3);
                if (results.length > 0) {
                    kbScore = results[0].score;
                    console.log(`🔍 KB Search Score: ${kbScore.toFixed(3)} for "${message}"`);

                    // ⚠️ CRITICAL: Only use KB if confidence is HIGH (>= 0.6)
                    if (kbScore >= 0.6) {
                        kbContext = results.slice(0, 3).map(r => r.content).join('\n\n');
                    } else {
                        console.log(`⚠️ KB score too low (${kbScore.toFixed(3)} < 0.6), escalating to human`);
                    }
                }
            }

            // If KB confidence is too low, escalate immediately
            if (!kbContext || kbScore < 0.6) {
                response = `I don't have specific information about that in my knowledge base.\n\nWould you like me to connect you with our team who can help? They can provide detailed answers about company setup, visas, and licensing.`;
            } else {
                // KB confidence is high - use AI with strict KB-only constraint

                // Build conversation history (last 6 messages for context)
                const conversationHistory = session.messages.slice(-12).map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }));

                // ✅ CRITICAL: Embed KB context IN the user message (not system prompt)
                // This forces Claude to treat KB as the ONLY source
                const kbConstrainedMessage = `USER QUESTION:
"${message}"

KNOWLEDGE BASE CONTEXT (ONLY USE THIS TO ANSWER):
${kbContext}

INSTRUCTIONS:
- Answer ONLY from the context above
- If the answer is not clearly present in the context, say you don't have that information
- Keep answer to 2-3 sentences maximum
- Use at most ONE emoji
- Do NOT guess or invent information`;

                conversationHistory.push({
                    role: 'user',
                    content: kbConstrainedMessage
                });

                const systemPrompt = `You are a professional business consultant for Meydan Free Zone Dubai.

CRITICAL RULES (DO NOT BREAK):
1. Answer ONLY using information in the knowledge base context provided
2. If the context does NOT clearly contain the answer, say you don't have that information
3. NEVER guess, assume, or invent information
4. NEVER repeat unrelated information from the knowledge base
5. Keep answers brief (2-3 sentences)
6. Sound human and conversational
7. Use at most ONE emoji

ESCALATION RULE:
If you cannot answer from the provided context, offer to connect them with the team.`;

                const ai = await anthropic.messages.create({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 200,
                    system: systemPrompt,
                    messages: conversationHistory
                });

                response = ai.content[0].text;

                // Validate response isn't hallucinating
                if (response.toLowerCase().includes('i don\'t have') ||
                    response.toLowerCase().includes('i\'m not sure') ||
                    response.toLowerCase().includes('i cannot find')) {
                    // AI admitted it doesn't know - provide escalation
                    response = `I don't have specific information about that.\n\nWould you like me to arrange a call with our team? They can provide accurate answers about ${message.includes('visa') ? 'visas' : message.includes('company') ? 'company setup' : 'your question'}.`;
                }
            }
        } catch (err) {
            console.log('AI error:', err.message);
            response = null; // Fall through to default fallback
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

    // Log assistant response
    logChatMessage(sessionId, 'assistant', response, session.name, session.email, session.phone);

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
