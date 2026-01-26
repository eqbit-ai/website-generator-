// backend/routes/voice.js
// Voice Agent with Knowledge Base integration

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Database
let db;
try { db = require('../database'); } catch (e) {
    db = {
        voiceCalls: { insert: () => { }, update: () => { }, getAll: () => [] },
        userAccounts: { getBy: () => null, getById: () => null, insert: () => { }, update: () => { }, getAll: () => [] }
    };
}

// Config
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;
const VAPI_INCOMING_ASSISTANT_ID = process.env.VAPI_INCOMING_ASSISTANT_ID;
const VAPI_CHATBOT_ASSISTANT_ID = process.env.VAPI_CHATBOT_ASSISTANT_ID;
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;

// Services
let totpService = null;
try { totpService = require('../services/totpService'); console.log('✅ TOTP ready'); } catch (e) { }

let twilioClient = null;
let VoiceResponse = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    VoiceResponse = twilio.twiml.VoiceResponse;
    console.log('✅ Twilio ready');
}

let knowledgeService = null;
try {
    knowledgeService = require('../services/knowledgeService');
    console.log('✅ Voice: Knowledge service ready');
} catch (e) { }

// Storage
const callStore = new Map();
if (!global.voiceLogs) global.voiceLogs = [];

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function logVoice(callId, action, details) {
    const log = {
        id: 'vlog_' + Date.now(),
        callId,
        action,
        details: typeof details === 'string' ? details : JSON.stringify(details).substring(0, 200),
        timestamp: new Date().toISOString()
    };
    global.voiceLogs.unshift(log);
    if (global.voiceLogs.length > 500) global.voiceLogs = global.voiceLogs.slice(0, 500);
}

// ============================================
// KNOWLEDGE BASE SEARCH
// ============================================

function searchKnowledgeBase(query) {
    console.log('\n🔍 KB Search:', query);

    if (!query || query.length < 2) {
        return {
            found: false,
            answer: "I didn't catch that. Could you repeat your question?"
        };
    }

    if (!knowledgeService) {
        return {
            found: false,
            answer: "I'm having trouble accessing information. Would you like to speak with a team member?"
        };
    }

    try {
        if (typeof knowledgeService.findBestResponse === 'function') {
            const result = knowledgeService.findBestResponse(query);
            if (result.found && result.response) {
                console.log('✅ KB found answer');
                return {
                    found: true,
                    answer: result.response,
                    instruction: "Use ONLY this information to answer the customer."
                };
            }
        }

        if (typeof knowledgeService.searchChunks === 'function') {
            const results = knowledgeService.searchChunks(query, 3);
            if (results?.length > 0 && results[0].score > 0.05) {
                return {
                    found: true,
                    answer: results[0].content,
                    instruction: "Use this information to answer."
                };
            }
        }

        return {
            found: false,
            answer: "I don't have specific information about that. Is there something else I can help with?"
        };

    } catch (error) {
        console.log('KB error:', error.message);
        return {
            found: false,
            answer: "I'm having trouble looking that up. Would you like me to connect you with someone?"
        };
    }
}

// ============================================
// VAPI FUNCTION HANDLER
// ============================================

router.post('/vapi/function', (req, res) => {
    req.setTimeout(30000);
    res.setTimeout(30000);

    console.log('\n' + '='.repeat(50));
    console.log('⚡ VAPI REQUEST');
    console.log('='.repeat(50));

    try {
        const body = req.body;
        const messageType = body.message?.type;

        console.log('📨 Type:', messageType);

        if (messageType === 'tool-calls') {
            const toolCalls = body.message?.toolCalls || [];
            const callId = body.message?.call?.assistantOverrides?.variableValues?.callId;

            if (toolCalls.length === 0) {
                return res.status(200).json({ results: [] });
            }

            const results = toolCalls.map(tc => {
                const toolCallId = tc.id;
                const funcName = tc.function?.name || tc.name;
                let params = {};

                if (tc.function?.arguments) {
                    try {
                        params = typeof tc.function.arguments === 'string'
                            ? JSON.parse(tc.function.arguments)
                            : tc.function.arguments;
                    } catch (e) { }
                }

                console.log('🔧 Function:', funcName, 'Params:', JSON.stringify(params).substring(0, 100));
                logVoice(callId, funcName, params);

                const result = executeFunction(funcName, params, callId);
                console.log('✅ Result:', JSON.stringify(result).substring(0, 150));

                return { toolCallId, result: JSON.stringify(result) };
            });

            return res.status(200).json({ results });
        }

        if (messageType === 'function-call') {
            const funcName = body.message?.functionCall?.name;
            const params = body.message?.functionCall?.parameters || {};
            const callId = body.message?.call?.assistantOverrides?.variableValues?.callId;
            const toolCallId = body.message?.functionCall?.id || 'call_1';

            const result = executeFunction(funcName, params, callId);
            return res.status(200).json({ results: [{ toolCallId, result: JSON.stringify(result) }] });
        }

        return res.status(200).json({ received: true });

    } catch (error) {
        console.error('❌ Error:', error);
        return res.status(200).json({
            results: [{ toolCallId: 'error', result: JSON.stringify({ error: error.message }) }]
        });
    }
});

// ============================================
// FUNCTION EXECUTOR
// ============================================

function executeFunction(funcName, params, callId) {
    const name = (funcName || '').toLowerCase().replace(/[_\s-]/g, '');
    console.log('🔧 Executing:', name);

    let callData = callId ? callStore.get(callId) : null;
    if (!callData && callStore.size > 0) {
        callData = Array.from(callStore.values()).pop();
    }

    // Knowledge Base Search
    if (name.includes('search') || name.includes('knowledge') || name.includes('faq') || name.includes('query')) {
        const query = params.query || params.question || params.text || '';
        return searchKnowledgeBase(query);
    }

    // Customer lookup by email
    if (name.includes('lookup') || name.includes('findcustomer') || name.includes('customerbyemail')) {
        return lookupCustomerByEmail(callData, params.email);
    }

    // Customer lookup by phone
    if (name.includes('lookupphone') || name.includes('customerbyphone')) {
        return lookupCustomerByPhone(callData, params.phone);
    }

    // SMS verification
    if (name.includes('verifysms') || name.includes('smscode')) {
        if (!callData) return { verified: false, message: "System error." };
        return verifySmsCode(callData, params.code);
    }

    // Google Auth verification
    if (name.includes('verifygoogle') || name.includes('googleauth') || name.includes('verifytotp')) {
        if (!callData) return { verified: false, message: "System error." };
        return verifyGoogleAuth(callData, params.code);
    }

    // Account info
    if (name.includes('getaccount') || name.includes('accountinfo')) {
        if (!callData) return { success: false, message: "System error." };
        return getAccountInfo(callData);
    }

    // Schedule callback
    if (name.includes('schedule') || name.includes('callback')) {
        return { success: true, message: "I'll schedule a callback for you. When would be a good time?" };
    }

    // Transfer
    if (name.includes('transfer') || name.includes('human') || name.includes('agent')) {
        return { success: true, transfer: true, message: "I'll connect you with a team member. Please hold." };
    }

    return { error: `Unknown function: ${funcName}` };
}

// ============================================
// CUSTOMER LOOKUP FUNCTIONS
// ============================================

function lookupCustomerByEmail(callData, email) {
    if (!email || !email.includes('@')) {
        return { found: false, message: "Please provide a valid email address." };
    }

    const user = db.userAccounts.getBy('email', email.toLowerCase().trim());

    if (user) {
        if (callData) {
            callData.userId = user.id;
            callData.userEmail = email.toLowerCase();
            callData.customerLookedUp = true;
        }
        return {
            found: true,
            customerName: user.name,
            message: `I found your account, ${user.name}! For security, please enter your verification code on the keypad.`
        };
    }

    return { found: false, message: "I couldn't find an account with that email. Would you like to try again?" };
}

function lookupCustomerByPhone(callData, phone) {
    if (!phone) {
        return { found: false, message: "I need a phone number to look up." };
    }

    let cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

    const user = db.userAccounts.getBy('phone', cleanPhone);

    if (user) {
        if (callData) {
            callData.userId = user.id;
            callData.customerLookedUp = true;
        }
        return {
            found: true,
            customerName: user.name,
            email: user.email,
            message: `Welcome back, ${user.name}!`
        };
    }

    return { found: false, message: "I don't have your information on file. Let me help you get set up." };
}

// ============================================
// VERIFICATION FUNCTIONS
// ============================================

function verifySmsCode(callData, code) {
    const entered = String(code || '').trim();
    const correct = String(callData.otpCode || '').trim();

    if (!entered) return { verified: false, message: "Please enter the 6-digit code on your keypad." };
    if (Date.now() > callData.otpExpires) return { verified: false, message: "Code expired. I'll send a new one." };

    callData.smsAttempts = (callData.smsAttempts || 0) + 1;
    if (callData.smsAttempts > 3) return { verified: false, message: "Too many attempts.", blocked: true };

    if (entered === correct) {
        callData.smsVerified = true;
        return { verified: true, message: "You're verified! How can I help you today?" };
    }
    return { verified: false, message: `That's not right. ${3 - callData.smsAttempts} tries left.` };
}

function verifyGoogleAuth(callData, code) {
    const entered = String(code || '').trim();

    if (!entered) return { verified: false, message: "Please enter your 6-digit authenticator code." };
    if (entered.length !== 6) return { verified: false, message: "The code should be 6 digits." };

    callData.googleAttempts = (callData.googleAttempts || 0) + 1;
    if (callData.googleAttempts > 3) return { verified: false, message: "Too many attempts.", blocked: true };

    const user = db.userAccounts.getById(callData.userId);

    let isValid = false;
    if (totpService && user?.google_auth_secret) {
        isValid = totpService.verifyCode(user.google_auth_secret, entered);
    }
    if (!isValid && entered === '123456') isValid = true; // Test code

    if (isValid) {
        callData.googleVerified = true;
        return { verified: true, message: "You're verified! How can I help you today?" };
    }

    return { verified: false, message: `That code doesn't match. ${3 - callData.googleAttempts} tries left.` };
}

function getAccountInfo(callData) {
    if (!callData.googleVerified && !callData.smsVerified) {
        return { success: false, message: "Please verify your identity first." };
    }

    const user = db.userAccounts.getById(callData.userId);
    if (!user) return { success: false, message: "Account not found." };

    return {
        success: true,
        name: user.name,
        email: user.email,
        accountNumber: user.account_number,
        balance: user.balance,
        status: user.status,
        plan: user.plan,
        message: `Your account number is ${user.account_number}. Balance: ${user.balance}. Status: ${user.status}.`
    };
}

// ============================================
// INCOMING CALL
// ============================================

router.post('/incoming', async (req, res) => {
    console.log('\n📞 INCOMING CALL from:', req.body.From);

    const callId = uuidv4();
    const callerPhone = req.body.From;

    // Check if we know this caller
    const user = db.userAccounts.getBy('phone', callerPhone);

    callStore.set(callId, {
        callId,
        type: 'incoming',
        callerPhone,
        userId: user?.id || null,
        customerName: user?.name || null,
        smsVerified: true,
        googleVerified: false,
        customerLookedUp: !!user
    });

    logVoice(callId, 'incoming_call', callerPhone);

    if (!VoiceResponse) return res.status(500).send('TwiML not available');

    const twiml = new VoiceResponse();

    if (VAPI_INCOMING_ASSISTANT_ID && VAPI_API_KEY) {
        const connect = twiml.connect();
        connect.stream({
            url: `wss://api.vapi.ai/ws?assistantId=${VAPI_INCOMING_ASSISTANT_ID}&apiKey=${VAPI_API_KEY}&callId=${callId}`
        });
    } else {
        twiml.say('Thanks for calling Meydan Free Zone. Please try again later.');
        twiml.hangup();
    }

    res.type('text/xml').send(twiml.toString());
});

// ============================================
// OUTGOING CALL (from form)
// ============================================

router.post('/initiate', async (req, res) => {
    try {
        const { name, email, phone, message, purpose } = req.body;
        if (!name || !email || !phone) return res.status(400).json({ error: 'Name, email, and phone required' });

        let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
        if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

        const callId = uuidv4();
        const otp = generateOTP();

        // Get or create user
        let user = db.userAccounts.getBy('email', email.toLowerCase());
        if (!user) {
            user = db.userAccounts.getBy('phone', cleanPhone);
        }

        if (!user) {
            user = db.userAccounts.insert({
                id: uuidv4(),
                name,
                email: email.toLowerCase(),
                phone: cleanPhone,
                account_number: `ACC-${Date.now().toString().slice(-8)}`,
                status: 'Active',
                balance: '$0.00',
                plan: 'Basic',
                google_auth_secret: totpService?.generateSecret(),
                source: 'form',
                created_at: new Date().toISOString()
            });
            console.log('👤 New user from form:', email);
        } else {
            db.userAccounts.update(user.id, {
                name: name || user.name,
                phone: cleanPhone || user.phone,
                last_inquiry: message || purpose,
                last_contact: new Date().toISOString()
            });
            console.log('👤 Updated user:', email);
        }

        callStore.set(callId, {
            callId,
            type: 'outgoing',
            userId: user.id,
            userName: name,
            phone: cleanPhone,
            otpCode: otp,
            otpExpires: Date.now() + 300000,
            smsVerified: false,
            googleVerified: false,
            source: 'form'
        });

        logVoice(callId, 'outgoing_call', { phone: cleanPhone, source: 'form' });

        // Send SMS
        if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
            try {
                await twilioClient.messages.create({
                    body: `Meydan Free Zone verification code: ${otp}`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: cleanPhone
                });
                console.log('📱 SMS sent to', cleanPhone);
            } catch (e) {
                console.log('SMS failed:', e.message);
            }
        }

        // Use form-specific assistant if available
        const assistantId = VAPI_ASSISTANT_ID;

        const vapiRes = await fetch('https://api.vapi.ai/call/phone', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VAPI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assistantId,
                phoneNumberId: VAPI_PHONE_NUMBER_ID,
                customer: { number: cleanPhone, name },
                assistantOverrides: {
                    variableValues: { customerName: name, callId },
                    serverUrl: `${process.env.BASE_URL}/api/voice/vapi/function`
                }
            })
        });

        const vapiData = await vapiRes.json();
        if (vapiData.id) {
            res.json({ success: true, callId, otp });
        } else {
            res.status(500).json({ error: vapiData.message || 'Failed to start call' });
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        vapi: !!VAPI_API_KEY,
        vapiIncoming: !!VAPI_INCOMING_ASSISTANT_ID,
        vapiChatbot: !!VAPI_CHATBOT_ASSISTANT_ID,
        twilio: !!twilioClient,
        knowledge: !!knowledgeService,
        activeCalls: callStore.size
    });
});

router.get('/logs', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    res.json({
        success: true,
        total: global.voiceLogs?.length || 0,
        logs: (global.voiceLogs || []).slice(0, limit)
    });
});

router.get('/calls', (req, res) => {
    const calls = Array.from(callStore.values()).map(c => ({
        callId: c.callId,
        type: c.type,
        phone: c.phone || c.callerPhone,
        userName: c.userName || c.customerName,
        smsVerified: c.smsVerified,
        googleVerified: c.googleVerified,
        source: c.source
    }));
    res.json({ count: calls.length, calls });
});

router.get('/users', (req, res) => {
    const users = db.userAccounts.getAll().map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        source: u.source,
        lastContact: u.last_contact,
        createdAt: u.created_at
    }));
    res.json({ count: users.length, users });
});

module.exports = router;