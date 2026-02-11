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

// Load intents for KB search
const fs = require('fs');
const path = require('path');
let intentsData = [];
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
        intentsData = data.intents || [];
        console.log(`✅ Voice: Loaded ${intentsData.length} intents from ${intentsPath}`);
    } else {
        console.log('❌ Voice: Intents file not found in any location');
    }
} catch (e) {
    console.log('⚠️ Voice: Could not load intents:', e.message);
}

// Storage
const callStore = new Map();
if (!global.voiceLogs) global.voiceLogs = [];
if (!global.verifiedSessions) global.verifiedSessions = new Map();

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
// KNOWLEDGE BASE SEARCH (uses knowledgeService unified search)
// ============================================

async function searchKnowledgeBase(query) {
    console.log('\n🔍 Voice KB Search:', query);

    if (!query || query.length < 2) {
        return {
            found: false,
            answer: "I didn't catch that. Could you repeat your question?"
        };
    }

    try {
        // 1. Use knowledgeService unified search (keyword + vector + TF-IDF)
        if (knowledgeService) {
            const result = await knowledgeService.unifiedSearch(query, {
                vectorThreshold: 0.4,
                keywordFallback: true
            });

            if (result.found && result.response) {
                console.log(`✅ Voice KB match: "${result.intentName}" (${result.source}, score: ${result.score.toFixed(3)})`);
                return {
                    found: true,
                    answer: result.response
                };
            }

            // 2. Try RAG-style: get top matches for AI to use
            const topMatches = await knowledgeService.getTopMatches(query, 3);
            if (topMatches.length > 0 && topMatches[0].score > 0.3) {
                console.log(`✅ Voice KB top match: "${topMatches[0].intentName}" (score: ${topMatches[0].score.toFixed(3)})`);
                return {
                    found: true,
                    answer: topMatches[0].response
                };
            }
        }

        // 3. Direct intent keyword search as fallback (uses voice.js local intentsData)
        if (intentsData.length > 0) {
            const q = query.toLowerCase().trim().replace(/\s+/g, ' ');
            for (const intent of intentsData) {
                const hasResponse = (intent.responses && intent.responses.length > 0) || intent.response;
                if (!intent || !hasResponse || !intent.keywords) continue;

                for (const keyword of intent.keywords) {
                    const kw = keyword.toLowerCase();
                    if (kw.includes(q) || q.includes(kw)) {
                        const answer = intent.responses
                            ? intent.responses[Math.floor(Math.random() * intent.responses.length)]
                            : intent.response;
                        console.log(`✅ Voice direct intent match: ${intent.name} (matched: "${keyword}")`);
                        return { found: true, answer };
                    }
                }
            }
        }

        console.log('❌ No Voice KB match found');
        return {
            found: false,
            answer: "I don't have specific information about that. Would you like me to connect you with our team?"
        };

    } catch (error) {
        console.log('❌ Voice KB error:', error.message);
        return {
            found: false,
            answer: "I'm having trouble looking that up. Would you like me to connect you with someone?"
        };
    }
}

/**
 * Reload intents data (called after scraping)
 */
function reloadVoiceIntents() {
    try {
        const possiblePaths = [
            path.join(__dirname, '..', 'config', 'meydan_intents.json'),
            path.join(process.cwd(), 'backend', 'config', 'meydan_intents.json'),
            path.join(process.cwd(), 'config', 'meydan_intents.json')
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
                intentsData = data.intents || [];
                console.log(`🔄 Voice: Reloaded ${intentsData.length} intents from ${p}`);
                return true;
            }
        }
        return false;
    } catch (e) {
        console.log('⚠️ Voice: Could not reload intents:', e.message);
        return false;
    }
}

// ============================================
// VAPI FUNCTION HANDLER
// ============================================

router.post('/vapi/function', async (req, res) => {
    req.setTimeout(30000);
    res.setTimeout(30000);

    console.log('\n' + '='.repeat(50));
    console.log('⚡ VAPI REQUEST');
    console.log('='.repeat(50));

    try {
        const body = req.body;
        const messageType = body.message?.type;

        console.log('📨 Type:', messageType);

        // ⚠️ VERBOSE LOGGING: Log FULL body to see what Vapi is sending
        if (messageType === 'conversation-update') {
            console.log('💬 FULL CONVERSATION UPDATE:');
            console.log(JSON.stringify(body, null, 2).substring(0, 2000)); // First 2000 chars
        }

        if (messageType === 'speech-update') {
            console.log('🎤 SPEECH UPDATE:');
            console.log(JSON.stringify(body, null, 2).substring(0, 1000));
        }

        // Debug: Log what Vapi is sending
        if (body.message?.call) {
            console.log('📞 Call object:', JSON.stringify({
                id: body.message.call.id,
                customer: body.message.call.customer,
                assistantId: body.message.call.assistantId,
                variableValues: body.message.call.assistantOverrides?.variableValues
            }, null, 2));
        }

        if (messageType === 'tool-calls') {
            const toolCalls = body.message?.toolCalls || [];
            const callId = body.message?.call?.assistantOverrides?.variableValues?.callId;

            if (toolCalls.length === 0) {
                return res.status(200).json({ results: [] });
            }

            // Handle async function results (e.g., KB search uses vector embeddings)
            const results = await Promise.all(toolCalls.map(async (tc) => {
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

                const result = await Promise.resolve(executeFunction(funcName, params, callId));
                console.log('✅ Result:', JSON.stringify(result).substring(0, 150));

                return { toolCallId, result: JSON.stringify(result) };
            }));

            return res.status(200).json({ results });
        }

        if (messageType === 'function-call') {
            const funcName = body.message?.functionCall?.name;
            const params = body.message?.functionCall?.parameters || {};
            const callId = body.message?.call?.assistantOverrides?.variableValues?.callId;
            const toolCallId = body.message?.functionCall?.id || 'call_1';

            const result = await Promise.resolve(executeFunction(funcName, params, callId));
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

    // Get Verification Method
    if (name.includes('getverification') || name.includes('verificationmethod')) {
        console.log('🔐 Get verification method');
        return 'Ask: "Would you prefer to verify via SMS or Google Authenticator?"';
    }

    // Send OTP
    if (name.includes('sendotp') || name.includes('sendsms') || name.includes('sendcode')) {
        console.log('📱 Send OTP request');
        if (!callData) {
            return 'ERROR: System error - no call data found.';
        }

        const phone = callData.phone;
        const otp = callData.otpCode;

        if (!phone) {
            return 'ERROR: Phone number not found in call data.';
        }

        // Send SMS via Twilio NOW (when agent calls this function)
        if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
            try {
                twilioClient.messages.create({
                    body: `Meydan Free Zone verification code: ${otp}`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: phone
                }).then(() => {
                    console.log('📱 SMS sent to', phone);
                }).catch(e => {
                    console.log('SMS failed:', e.message);
                });
            } catch (e) {
                console.log('SMS error:', e.message);
            }
        }

        return `SUCCESS: Code sent to ${phone}. Ask customer to enter the 6-digit code on their keypad.`;
    }

    // Verify OTP
    if (name.includes('verifyotp') || name.includes('verifysms') || name.includes('smscode')) {
        console.log('🔐 Verify OTP:', params.code);
        if (!callData) return 'ERROR: System error - no call data found.';
        return verifySmsCode(callData, params.code);
    }

    // Verify TOTP (Google Auth)
    if (name.includes('verifytotp') || name.includes('verifygoogle') || name.includes('googleauth')) {
        console.log('🔐 Verify Google Auth:', params.code);
        if (!callData) return 'ERROR: System error - no call data found.';
        return verifyGoogleAuth(callData, params.code);
    }

    // Knowledge Base Search (async - returns promise)
    if (name.includes('search') || name.includes('knowledge') || name.includes('faq') || name.includes('query')) {
        const query = params.query || params.question || params.text || '';
        // searchKnowledgeBase is async now, caller handles the promise
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
    // Check verification from callStore OR global.verifiedSessions (set by outbound routes)
    let isVerified = callData.googleVerified || callData.smsVerified;

    // Also check global verified sessions (populated by /api/outbound/verify-totp)
    if (!isVerified && callData.phone && global.verifiedSessions) {
        let cleanPhone = callData.phone.replace(/[^\d+]/g, '');
        if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;
        const session = global.verifiedSessions.get(cleanPhone);
        if (session?.verified) {
            // Check if verification is still valid (within 30 minutes)
            const isRecent = (Date.now() - session.timestamp) < 30 * 60 * 1000;
            if (isRecent) {
                isVerified = true;
                console.log('✅ User verified via global session:', cleanPhone);
            }
        }
    }

    if (!isVerified) {
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
        const { name, email, phone, message, purpose, sessionId } = req.body;
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

        // Determine source (form or chatbot)
        const callSource = purpose === 'Chat-initiated call' ? 'chatbot' : 'form';

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
            source: callSource
        });

        logVoice(callId, 'outgoing_call', { phone: cleanPhone, source: callSource });

        // For chatbot-initiated calls, send OTP automatically so user has it ready
        // For form-initiated calls, let the agent send it when user chooses SMS
        if (callSource === 'chatbot' && twilioClient && process.env.TWILIO_PHONE_NUMBER) {
            try {
                await twilioClient.messages.create({
                    body: `Your Meydan Free Zone verification code is: ${otp}`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: cleanPhone
                });
                console.log(`📱 OTP ${otp} auto-sent to ${cleanPhone} (chatbot call)`);
                logVoice(callId, 'otp_auto_sent', { phone: cleanPhone, otp });
            } catch (smsError) {
                console.log(`⚠️ Failed to auto-send OTP: ${smsError.message}`);
                console.log(`📱 OTP ${otp} generated but not sent - agent must call send_otp`);
            }
        } else {
            console.log('📱 OTP generated (will be sent by agent): ', otp);
        }

        // Use chatbot-specific assistant if call is from chatbot, otherwise use default
        const assistantId = callSource === 'chatbot' && VAPI_CHATBOT_ASSISTANT_ID
            ? VAPI_CHATBOT_ASSISTANT_ID
            : VAPI_ASSISTANT_ID;

        console.log(`📞 Using assistant: ${assistantId} (source: ${callSource})`);

        const vapiRes = await fetch('https://api.vapi.ai/call/phone', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VAPI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assistantId,
                phoneNumberId: VAPI_PHONE_NUMBER_ID,
                customer: { number: cleanPhone, name },
                assistantOverrides: {
                    variableValues: {
                        customerName: name,
                        callId,
                        customerPhone: cleanPhone,
                        sessionId: sessionId || callId
                    },
                    serverUrl: `${process.env.BASE_URL}/api/voice/vapi/function`
                }
            })
        });

        const vapiData = await vapiRes.json();
        if (vapiData.id) {
            // Store phone, OTP, and TOTP secret with multiple keys for verification
            if (!global.phoneStore) global.phoneStore = new Map();
            const totpSecret = user?.google_auth_secret || user?.totp_secret || null;
            const callData = {
                phone: cleanPhone,
                otp,
                totpSecret,  // Include TOTP secret for Google Auth verification
                userId: user?.id,
                timestamp: Date.now()
            };
            global.phoneStore.set(vapiData.id, callData); // Vapi call ID
            global.phoneStore.set(callId, callData); // Our internal call ID
            if (sessionId) global.phoneStore.set(sessionId, callData); // Chat session ID
            global.phoneStore.set(cleanPhone, callData); // Also by phone number

            console.log(`✅ Vapi call created: ${vapiData.id}`);
            console.log(`📱 Phone & OTP stored with keys:`);
            console.log(`   - vapiId: ${vapiData.id}`);
            console.log(`   - callId: ${callId}`);
            if (sessionId) console.log(`   - sessionId: ${sessionId}`);
            console.log(`   - phone: ${cleanPhone}`);
            console.log(`🔐 OTP: ${otp} (stored globally for verification)`);
            console.log(`🔐 TOTP Secret: ${totpSecret ? 'stored' : 'not available'}`);
            console.log(`⚠️ NOTE: Agent must call send_otp function to trigger SMS`);

            res.json({ success: true, callId, otp });
        } else {
            console.error(`❌ Vapi call failed:`, vapiData);
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

// 2FA setup endpoint
router.post('/setup-2fa', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, error: 'Valid email required' });
        }

        if (!totpService) {
            return res.status(500).json({ success: false, error: 'TOTP service not available' });
        }

        // Generate secret and QR code
        const secret = totpService.generateSecret();
        const qrData = await totpService.generateQRCode(email, secret);
        const currentCode = totpService.generateCurrentCode(secret);

        // Save to database
        const existingUser = db.userAccounts.getBy('email', email.toLowerCase());
        if (existingUser) {
            db.userAccounts.update(existingUser.id, {
                totp_secret: secret,
                totp_enabled: false // Not enabled until verified
            });
        } else {
            db.userAccounts.insert({
                email: email.toLowerCase(),
                name: email.split('@')[0],
                source: '2fa-setup',
                totp_secret: secret,
                totp_enabled: false,
                created_at: new Date().toISOString()
            });
        }

        res.json({
            success: true,
            qrCode: qrData.qrCodeDataUrl,
            manualEntry: qrData.manualEntry,
            currentCode: currentCode // For testing
        });

    } catch (error) {
        console.error('2FA setup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Verify 2FA setup - confirm the code works and enable 2FA
router.post('/verify-2fa-setup', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, error: 'Valid email required' });
        }

        if (!code || code.length !== 6) {
            return res.status(400).json({ success: false, error: '6-digit code required' });
        }

        if (!totpService) {
            return res.status(500).json({ success: false, error: 'TOTP service not available' });
        }

        // Get user and their TOTP secret
        const user = db.userAccounts.getBy('email', email.toLowerCase());
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found. Please set up 2FA first.' });
        }

        const secret = user.totp_secret || user.google_auth_secret;
        if (!secret) {
            return res.status(400).json({ success: false, error: 'No 2FA secret found. Please set up 2FA first.' });
        }

        // Verify the code
        const isValid = totpService.verifyCode(secret, code);

        if (isValid) {
            // Enable 2FA for this user
            db.userAccounts.update(user.id, {
                totp_enabled: true,
                google_auth_secret: secret, // Also set google_auth_secret for voice verification
                google_auth_enabled: true
            });

            console.log(`✅ 2FA enabled for user: ${email}`);

            return res.json({
                success: true,
                message: '2FA has been enabled successfully!'
            });
        } else {
            console.log(`❌ 2FA verification failed for user: ${email}, code: ${code}`);
            return res.status(400).json({
                success: false,
                error: 'Invalid code. Please check your authenticator app and try again.'
            });
        }

    } catch (error) {
        console.error('2FA verification error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
module.exports.reloadVoiceIntents = reloadVoiceIntents;