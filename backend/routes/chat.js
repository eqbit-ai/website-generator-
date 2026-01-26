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
        anthropic = new (require('@anthropic-ai/sdk'))({ apiKey: process.env.ANTHROPIC_API_KEY });
        console.log('✅ Chat AI ready');
    } catch (e) { }
}

// Database for user memory
let db;
try { db = require('../database'); } catch (e) {
    db = { userAccounts: { getBy: () => null, insert: () => { }, update: () => { }, getAll: () => [] } };
}

// Session storage
const chatSessions = new Map();

// Phone storage for outbound calls
if (!global.phoneStore) global.phoneStore = new Map();

// Conversation logs storage
if (!global.chatLogs) global.chatLogs = [];

// ============================================
// HELPER FUNCTIONS
// ============================================

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

// Natural conversational responses
function getConversationalResponse(message, name) {
    const m = message.toLowerCase().trim();

    // Greetings
    if (/^(hi|hello|hey|hiya)\.?!?$/i.test(m)) {
        const greetings = [
            `Hey ${name}! 👋 How can I help you today?`,
            `Hello ${name}! Great to hear from you. What can I do for you?`,
            `Hi there! How may I assist you today?`
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    // Thanks
    if (/^(thanks|thank you|thx|ty|cheers)\.?!?$/i.test(m)) {
        const thanks = [
            `You're welcome! 😊 Anything else I can help with?`,
            `Happy to help! Let me know if you need anything else.`,
            `No problem at all! Is there anything else on your mind?`
        ];
        return thanks[Math.floor(Math.random() * thanks.length)];
    }

    // Goodbyes
    if (/^(bye|goodbye|see you|later|take care|cya)\.?!?$/i.test(m)) {
        return `Goodbye! Take care and feel free to reach out anytime. 👋`;
    }

    // Acknowledgments
    if (/^(ok|okay|alright|sure|got it|understood|perfect|great|cool|nice|awesome)\.?!?$/i.test(m)) {
        return `Great! Is there anything else you'd like to know about Meydan Free Zone?`;
    }

    // Negative responses
    if (/^(no|nope|nah|nothing|that'?s? (it|all)|i'?m? (good|done|fine))\.?!?$/i.test(m)) {
        return `Alright! It was great chatting with you. Have a wonderful day! 🌟`;
    }

    // How are you
    if (/how are you|how'?s? it going|what'?s? up/i.test(m)) {
        return `I'm doing great, thanks for asking! 😊 How can I help you with Meydan Free Zone today?`;
    }

    return null;
}

// Check if user wants a call
function wantsCall(message) {
    const m = message.toLowerCase();
    const callPhrases = [
        'call me', 'give me a call', 'phone me', 'ring me',
        'speak to someone', 'talk to someone', 'talk to a person',
        'human agent', 'real person', 'live agent',
        'callback', 'call back', 'contact me',
        'can someone call', 'want a call', 'need a call'
    ];
    return callPhrases.some(phrase => m.includes(phrase));
}

// Extract phone number
function extractPhone(message) {
    const patterns = [
        /\+?\d{1,4}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/,
        /\+?\d{10,15}/
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
            let phone = match[0].replace(/[\s.\-\(\)]/g, '');
            if (phone.length >= 10) {
                if (!phone.startsWith('+')) phone = '+' + phone;
                return phone;
            }
        }
    }
    return null;
}

// Get verification choice
function getVerifyChoice(message) {
    const m = message.toLowerCase();
    if (m.includes('sms') || m.includes('text') || m.includes('otp') || m === '1') return 'sms';
    if (m.includes('google') || m.includes('authenticator') || m.includes('auth') || m === '2') return 'google_auth';
    return null;
}

// Look up or create user by phone
function getOrCreateUser(phone, name, email) {
    if (!db?.userAccounts) return null;

    try {
        let user = db.userAccounts.getBy('phone', phone);
        if (!user && email) {
            user = db.userAccounts.getBy('email', email.toLowerCase());
        }

        if (user) {
            db.userAccounts.update(user.id, {
                name: name || user.name,
                last_contact: formatTimestamp()
            });
            console.log('👤 User found:', phone);
            return user;
        }

        // Create new user
        const { v4: uuidv4 } = require('uuid');
        user = db.userAccounts.insert({
            id: uuidv4(),
            name: name || 'Customer',
            email: email?.toLowerCase() || '',
            phone: phone,
            source: 'chatbot',
            created_at: formatTimestamp(),
            last_contact: formatTimestamp()
        });
        console.log('👤 New user created:', phone);
        return user;
    } catch (e) {
        console.log('User lookup error:', e.message);
        return null;
    }
}

// Trigger outgoing call
async function triggerCall(phone, name, sessionId, method) {
    console.log('📞 Triggering call:', { phone, name, sessionId, method });

    // Store phone for outbound.js
    global.phoneStore.set(sessionId, phone);

    // Use chatbot-specific assistant if available
    const assistantId = process.env.VAPI_CHATBOT_ASSISTANT_ID || process.env.VAPI_OUTGOING_ASSISTANT_ID;

    if (!process.env.VAPI_API_KEY || !assistantId || !process.env.VAPI_PHONE_NUMBER_ID) {
        console.log('⚠️ Vapi not configured');
        return { success: false, error: 'Call service not configured' };
    }

    try {
        const res = await fetch('https://api.vapi.ai/call', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + process.env.VAPI_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
                assistantId: assistantId,
                customer: { number: phone, name: name || 'Customer' },
                metadata: {
                    sessionId: sessionId,
                    verificationMethod: method,
                    customerPhone: phone,
                    source: 'chatbot'
                }
            })
        });

        if (res.ok) {
            const data = await res.json();
            console.log('📞 Call initiated:', data.id);
            global.phoneStore.set(data.id, phone);
            return { success: true, callId: data.id };
        }

        const error = await res.text();
        console.log('📞 Call failed:', error);
        return { success: false, error };
    } catch (e) {
        console.log('📞 Call error:', e.message);
        return { success: false, error: e.message };
    }
}

// Log conversation
function logConversation(sessionId, name, role, content, source) {
    const log = {
        id: 'log_' + Date.now(),
        sessionId,
        userName: name,
        role,
        content: content.substring(0, 500),
        source,
        timestamp: formatTimestamp(),
        time: formatTime()
    };
    global.chatLogs.unshift(log);

    // Keep only last 500 logs
    if (global.chatLogs.length > 500) {
        global.chatLogs = global.chatLogs.slice(0, 500);
    }
}

// ============================================
// ROUTES
// ============================================

// Start chat session
router.post('/start', (req, res) => {
    const { name, email, phone } = req.body;
    const customerName = name || 'there';
    const sessionId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Create/update user if phone provided
    if (phone) {
        getOrCreateUser(phone, name, email);
        global.phoneStore.set(sessionId, phone);
    }

    const now = new Date();
    const greeting = `Hello ${customerName}! 👋 Welcome to Meydan Free Zone. I'm here to help you with company setup, visas, and any questions you might have. What can I assist you with today?`;

    const session = {
        id: sessionId,
        name: customerName,
        email: email || '',
        phone: phone || '',
        messages: [{
            id: 'msg_0',
            role: 'assistant',
            content: greeting,
            timestamp: now.toISOString(),
            time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        }],
        awaitingPhone: false,
        awaitingVerify: false,
        pendingPhone: null,
        createdAt: now.toISOString()
    };

    chatSessions.set(sessionId, session);
    logConversation(sessionId, customerName, 'assistant', greeting, 'system');

    console.log('💬 Chat started:', sessionId);

    res.json({
        success: true,
        sessionId,
        message: greeting,
        messages: session.messages,
        time: session.messages[0].time
    });
});

// Handle message
router.post('/message', async (req, res) => {
    const { sessionId, message } = req.body;

    if (!message?.trim()) {
        return res.status(400).json({ error: 'Message required' });
    }

    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Get or create session
    let session = chatSessions.get(sessionId);
    if (!session) {
        session = {
            id: sessionId || 'anon_' + Date.now(),
            name: 'Guest',
            messages: [],
            awaitingPhone: false,
            awaitingVerify: false
        };
        chatSessions.set(session.id, session);
    }

    // Add user message
    session.messages.push({
        id: 'msg_' + Date.now(),
        role: 'user',
        content: message,
        timestamp: now.toISOString(),
        time: currentTime
    });

    logConversation(session.id, session.name, 'user', message, 'user');

    let response = '';
    let source = 'fallback';
    let callInitiated = false;

    // Check conversational response first (if not in a flow)
    if (!session.awaitingPhone && !session.awaitingVerify) {
        response = getConversationalResponse(message, session.name);
        if (response) source = 'conversational';
    }

    // Handle verification choice
    if (!response && session.awaitingVerify) {
        const choice = getVerifyChoice(message);
        if (choice) {
            session.awaitingVerify = false;
            const result = await triggerCall(session.pendingPhone, session.name, session.id, choice);

            if (result.success) {
                const methodName = choice === 'sms' ? 'SMS code' : 'Google Authenticator';
                response = `✅ Perfect! I'm connecting you now.\n\n📞 You'll receive a call shortly at ${session.pendingPhone}.\n\n🔐 Our agent will verify your identity using ${methodName}.\n\nIs there anything else I can help with while you wait?`;
                callInitiated = true;
            } else {
                response = `I've noted your request for a callback to ${session.pendingPhone}. Our team will reach out to you shortly!\n\nAnything else I can help with?`;
            }
            source = 'system';
        } else {
            response = `Please let me know how you'd like to verify:\n\n1️⃣ SMS - We'll text you a code\n2️⃣ Google Authenticator - Use your auth app\n\nJust type "SMS" or "Google"`;
            source = 'system';
        }
    }

    // Handle phone input
    if (!response && session.awaitingPhone) {
        const phone = extractPhone(message);
        if (phone) {
            session.phone = phone;
            session.pendingPhone = phone;
            session.awaitingPhone = false;
            session.awaitingVerify = true;
            global.phoneStore.set(session.id, phone);
            getOrCreateUser(phone, session.name, session.email);

            response = `Got it! I have your number as ${phone} 📱\n\nHow would you like to verify your identity when we call?\n\n1️⃣ SMS - We'll text you a verification code\n2️⃣ Google Authenticator - Use your authenticator app`;
            source = 'system';
        } else {
            response = `I couldn't recognize that phone number. Please enter it with your country code, like:\n\n📱 +971 50 123 4567\n📱 +91 98765 43210`;
            source = 'system';
        }
    }

    // Check if user wants a call
    if (!response && wantsCall(message)) {
        if (session.phone) {
            session.pendingPhone = session.phone;
            session.awaitingVerify = true;
            response = `Great! I'll arrange a call to ${session.phone} 📞\n\nHow would you like to verify your identity?\n\n1️⃣ SMS - We'll text you a code\n2️⃣ Google Authenticator - Use your auth app`;
        } else {
            session.awaitingPhone = true;
            response = `I'd be happy to arrange a call for you! 📞\n\nPlease share your phone number with country code so we can reach you.\n\nExample: +971 50 123 4567`;
        }
        source = 'system';
    }

    // Knowledge base + AI response
    if (!response) {
        let kbAnswer = null;

        // Search knowledge base
        if (knowledgeService) {
            try {
                const result = knowledgeService.findBestResponse(message);
                if (result.found && result.response) {
                    kbAnswer = result.response;
                }
            } catch (e) {
                console.log('KB search error:', e.message);
            }
        }

        // Use AI to make response natural
        if (anthropic && kbAnswer) {
            try {
                const aiRes = await anthropic.messages.create({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 250,
                    system: `You are a friendly, helpful assistant for Meydan Free Zone Dubai. Be warm and conversational.

RULES:
- Use ONLY the information provided below
- Be concise (2-4 sentences max)
- Sound natural, not robotic
- Add a brief follow-up question when appropriate
- Use 1 emoji max

INFORMATION:
${kbAnswer}`,
                    messages: [{ role: 'user', content: message }]
                });
                response = aiRes.content[0].text;
                source = 'ai_knowledge';
            } catch (e) {
                response = kbAnswer + '\n\nWould you like more details?';
                source = 'knowledge';
            }
        } else if (kbAnswer) {
            response = kbAnswer + '\n\nAnything else you\'d like to know?';
            source = 'knowledge';
        } else {
            // Fallback with helpful suggestions
            const conv = getConversationalResponse(message, session.name);
            if (conv) {
                response = conv;
                source = 'conversational';
            } else {
                response = `I'd be happy to help you with that! Here's what I can assist with:\n\n🏢 Company formation & licensing\n📋 Visa services & requirements\n💼 Office space options\n📞 Speaking with our team\n\nWhat interests you most?`;
                source = 'fallback';
            }
        }
    }

    // Add assistant response
    const responseTime = new Date();
    session.messages.push({
        id: 'msg_' + Date.now() + '_a',
        role: 'assistant',
        content: response,
        timestamp: responseTime.toISOString(),
        time: responseTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    });

    logConversation(session.id, session.name, 'assistant', response, source);

    res.json({
        success: true,
        response,
        source,
        sessionId: session.id,
        callInitiated,
        time: responseTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    });
});

// Get chat history
router.get('/history/:sessionId', (req, res) => {
    const session = chatSessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true, messages: session.messages });
});

router.get('/messages/:sessionId', (req, res) => {
    const session = chatSessions.get(req.params.sessionId);
    res.json({ success: true, messages: session?.messages || [] });
});

// End session
router.post('/end', (req, res) => {
    const { sessionId } = req.body;
    if (sessionId) {
        chatSessions.delete(sessionId);
        global.phoneStore.delete(sessionId);
    }
    res.json({ success: true });
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

// Get all chat logs
router.get('/logs', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    res.json({
        success: true,
        total: global.chatLogs.length,
        logs: global.chatLogs.slice(0, limit)
    });
});

// Get all active sessions
router.get('/sessions', (req, res) => {
    const sessions = Array.from(chatSessions.values()).map(s => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        messageCount: s.messages.length,
        createdAt: s.createdAt,
        lastMessage: s.messages[s.messages.length - 1]?.content?.substring(0, 50)
    }));
    res.json({ success: true, count: sessions.length, sessions });
});

// Health check
router.get('/health', (req, res) => {
    res.json({
        ok: true,
        ai: !!anthropic,
        kb: !!knowledgeService,
        sessions: chatSessions.size,
        logs: global.chatLogs.length,
        phones: global.phoneStore.size
    });
});

module.exports = router;