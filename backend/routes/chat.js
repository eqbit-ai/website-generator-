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

// Function to load/reload intents
function loadIntents() {
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
            return true;
        } else {
            console.log('❌ Chat: Intents file not found in any location');
            return false;
        }
    } catch (e) {
        console.log('⚠️ Chat: Could not load intents:', e.message);
        return false;
    }
}

// Load intents on startup
loadIntents();

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

    // Normalize for matching (remove punctuation, extra spaces)
    const qNormalized = q.replace(/[?!.,]/g, '').replace(/\s+/g, ' ').trim();
    const qWords = qNormalized.split(/\s+/).map(normalizeWord);

    console.log(`🔍 Intent Check: "${q}"`);
    console.log(`📝 Normalized: "${qNormalized}"`);
    console.log(`📝 Words: [${qWords.join(', ')}]`);

    for (const intent of intents) {
        // Check if intent has valid response (support both new and old format)
        const hasResponse = (intent.responses && Array.isArray(intent.responses) && intent.responses.length > 0) ||
                           intent.response;

        if (!intent || !hasResponse || !intent.keywords) continue;

        for (const keyword of intent.keywords) {
            const kw = keyword.toLowerCase();
            const kwNormalized = kw.replace(/[?!.,]/g, '').replace(/\s+/g, ' ').trim();

            // 1. Exact phrase match (after normalization)
            if (qNormalized.includes(kwNormalized)) {
                console.log(`✅ Intent matched (exact): "${intent.name}" via keyword "${keyword}"`);
                return selectResponse(intent);
            }

            // 2. Word-level matching - check if all important words from keyword appear in query
            const kwWords = kwNormalized.split(/\s+/).filter(w => w.length > 2).map(normalizeWord);

            // Must have at least 1 keyword word
            if (kwWords.length === 0) continue;

            const allWordsPresent = kwWords.every(kwWord =>
                qWords.some(qWord => {
                    // Exact match after normalization
                    if (qWord === kwWord) return true;
                    // Contains match (for compound words)
                    if (qWord.length > 3 && kwWord.length > 3) {
                        if (qWord.includes(kwWord) || kwWord.includes(qWord)) return true;
                    }
                    // Fuzzy match: allow 1 character difference for typos (only for longer words)
                    if (kwWord.length > 4 && levenshteinDistance(qWord, kwWord) <= 1) return true;
                    return false;
                })
            );

            if (allWordsPresent) {
                console.log(`✅ Intent matched (word-level): "${intent.name}" via keyword "${keyword}"`);
                console.log(`   Matched words: [${kwWords.join(', ')}]`);
                return selectResponse(intent);
            }
        }
    }

    console.log(`❌ No intent matched`);
    return null;
}

// Helper: Randomly select a response from intent (supports multiple variations)
function selectResponse(intent) {
    // New format: multiple response variations
    if (intent.responses && Array.isArray(intent.responses) && intent.responses.length > 0) {
        const randomIndex = Math.floor(Math.random() * intent.responses.length);
        const selectedResponse = intent.responses[randomIndex];
        console.log(`🎲 Selected response variation ${randomIndex + 1}/${intent.responses.length}`);
        return selectedResponse;
    }

    // Old format: single response (backward compatibility)
    if (intent.response) {
        return intent.response;
    }

    return 'No response available';
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

    // 1️⃣ Call intent fast-path — trigger Vapi immediately (no AI needed)
    if (wantsCall(message)) {
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

    // 2️⃣ AI-powered conversational response with KB context + conversation history
    if (!response) {
        try {
            // Gather KB context
            let kbContext = '';

            if (knowledgeService) {
                // Try unified search for best match
                try {
                    const searchResult = await knowledgeService.unifiedSearch(message, {
                        vectorThreshold: 0.3,
                        keywordFallback: false
                    });

                    if (searchResult.found) {
                        console.log(`📚 KB match: "${searchResult.intentName}" (score: ${searchResult.score.toFixed(3)})`);
                        kbContext = `Topic: ${searchResult.intentName}\n${searchResult.response}`;
                    }
                } catch (e) {
                    console.log('⚠️ Unified search error:', e.message);
                }

                // Also get top 3 matches for broader context
                try {
                    const topMatches = await knowledgeService.getTopMatches(message, 3);
                    if (topMatches && topMatches.length > 0) {
                        console.log(`📚 Top matches: ${topMatches.map(m => `${m.intentName} (${m.score.toFixed(3)})`).join(', ')}`);
                        kbContext += '\n\nRelated topics:\n' + topMatches.map(m =>
                            `- ${m.intentName}: ${m.response.substring(0, 200)}`
                        ).join('\n');
                    }
                } catch (e) {
                    console.log('⚠️ Top matches error:', e.message);
                }
            }

            // Build conversation history (last 10 messages for context window efficiency)
            // Ensure messages start with 'user' role (Claude API requirement)
            let recentMessages = session.messages.slice(-10).map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            }));
            // Drop leading assistant messages so the array starts with a user message
            while (recentMessages.length > 0 && recentMessages[0].role === 'assistant') {
                recentMessages.shift();
            }

            if (anthropic) {
                // Build system prompt
                const systemPrompt = `You are a helpful assistant for Meydan Free Zone Dubai. Your name is Meydan Assistant.

RULES:
- Be conversational and friendly — this is a live chat, not a FAQ page
- Keep responses concise (2-4 sentences) unless the user asks for detail
- ONLY answer from the KNOWLEDGE BASE CONTEXT provided. Never make up information about Meydan, pricing, services, or policies
- If no relevant KB context is provided, say you don't have that specific information and offer to connect them with the team
- Use the conversation history to understand follow-up questions ("more options", "tell me more", "what about pricing")
- Address the user by name occasionally
- When listing multiple items, use bullet points
- If the user asks something vague, ask a clarifying question
- For greetings, respond naturally and offer to help
- For thanks/goodbye, respond warmly

CURRENT USER: ${session.name} (${session.email})` +
                    (kbContext
                        ? `\n\nKNOWLEDGE BASE CONTEXT:\n${kbContext}`
                        : '\n\nNo relevant knowledge base context found for this query.');

                console.log(`🤖 Sending to Claude with ${recentMessages.length} messages of history`);

                const aiResponse = await anthropic.messages.create({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 300,
                    system: systemPrompt,
                    messages: recentMessages
                });

                response = aiResponse.content[0].text;
                console.log(`✅ Claude responded conversationally`);
            } else {
                // No AI available — fall back to keyword intent check
                response = checkIntent(message);
            }
        } catch (err) {
            console.log('⚠️ AI response error, falling back to intent check:', err.message);
            // Fallback to keyword-based intent matching if Claude fails
            response = checkIntent(message);
        }
    }

    // 3️⃣ Final fallback if nothing worked
    if (!response) {
        response = `I appreciate your question! I don't have specific information on that topic right now. I can help you with:

• Company setup and business licenses
• Visa and immigration services
• Meydan Free Zone facilities and services

What would you like to know? Or if you'd prefer to speak with someone directly, just say "call me" and I'll connect you with our team.`;
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

/**
 * Reload intents from file
 * POST /api/chat/reload-intents
 */
router.post('/reload-intents', (req, res) => {
    const oldCount = intents.length;
    const success = loadIntents();

    if (success) {
        console.log(`🔄 Chat intents reloaded: ${oldCount} → ${intents.length}`);
        res.json({
            success: true,
            message: 'Intents reloaded successfully',
            oldCount: oldCount,
            newCount: intents.length,
            added: intents.length - oldCount
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Failed to reload intents'
        });
    }
});

module.exports = router;
module.exports.loadIntents = loadIntents; // Export for other modules
