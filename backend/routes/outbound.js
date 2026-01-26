// backend/routes/outbound.js
// Handles OTP, verification, and KB search for voice agents

const express = require('express');
const router = express.Router();

// Twilio
let twilioClient = null;
try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('✅ Outbound: Twilio ready');
    }
} catch (e) { }

// TOTP Service
let totpService = null;
try { totpService = require('../services/totpService'); } catch (e) { }

// Knowledge Service
let knowledgeService = null;
try {
    knowledgeService = require('../services/knowledgeService');
    console.log('✅ Outbound: Knowledge service ready');
} catch (e) {
    console.log('⚠️ Knowledge service not loaded');
}

// Database for user lookup
let db;
try { db = require('../database'); } catch (e) {
    db = { userAccounts: { getBy: () => null, getById: () => null, insert: () => { }, update: () => { }, getAll: () => [] } };
}

// Initialize global stores
if (!global.phoneStore) global.phoneStore = new Map();
if (!global.voiceLogs) global.voiceLogs = [];

const otpStore = new Map();

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getToolCallId(body) {
    return body?.message?.toolCalls?.[0]?.id || null;
}

// Log voice interactions
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
    console.log(`📝 [${action}] ${log.details}`);
}

// Get phone from stored data
function getPhone(body) {
    const sessionId = body?.call?.metadata?.sessionId;
    const callId = body?.call?.id;
    const metaPhone = body?.call?.metadata?.customerPhone;

    // 1. Look up by sessionId
    if (sessionId && global.phoneStore.has(sessionId)) {
        return global.phoneStore.get(sessionId);
    }

    // 2. Look up by callId
    if (callId && global.phoneStore.has(callId)) {
        return global.phoneStore.get(callId);
    }

    // 3. From metadata
    if (metaPhone && metaPhone.length > 10 && /^\+?\d+$/.test(metaPhone)) {
        return metaPhone;
    }

    // 4. Most recent (fallback)
    if (global.phoneStore.size > 0) {
        let lastPhone = null;
        global.phoneStore.forEach(v => lastPhone = v);
        return lastPhone;
    }

    // 5. Direct body
    if (body?.phoneNumber) return body.phoneNumber;

    return null;
}

function getCode(body) {
    const args = body?.message?.toolCalls?.[0]?.function?.arguments;
    if (args) {
        let parsed = args;
        if (typeof args === 'string') {
            try { parsed = JSON.parse(args); } catch (e) {
                const digits = args.replace(/\D/g, '');
                if (digits.length === 6) return digits;
            }
        }
        if (typeof parsed === 'object') {
            const c = parsed.code || parsed.otp || parsed.totp || parsed.digits;
            if (c) return c.toString().replace(/\D/g, '').substring(0, 6);
        }
    }
    if (body?.code) return body.code.toString().replace(/\D/g, '').substring(0, 6);
    return null;
}

function getQuery(body) {
    const args = body?.message?.toolCalls?.[0]?.function?.arguments;
    if (args) {
        let parsed = args;
        if (typeof args === 'string') {
            try { parsed = JSON.parse(args); } catch (e) { return args; }
        }
        if (typeof parsed === 'object') {
            return parsed.query || parsed.question || parsed.text || parsed.search || '';
        }
    }
    return body?.query || body?.question || '';
}

function respond(toolCallId, msg) {
    console.log('📤', msg.substring(0, 100));
    return { results: [{ toolCallId, result: msg }] };
}

// ============================================
// KNOWLEDGE BASE SEARCH
// ============================================

router.post('/search-knowledge-base', async (req, res) => {
    console.log('\n🔍 ====== KNOWLEDGE BASE SEARCH ======');

    const toolCallId = getToolCallId(req.body);
    const query = getQuery(req.body);

    console.log('🔍 Query:', query);
    logVoice(req.body?.call?.id, 'kb_search', query);

    if (!query || query.length < 2) {
        return res.json(respond(toolCallId, JSON.stringify({
            found: false,
            answer: "I didn't catch that. Could you please repeat your question?"
        })));
    }

    if (!knowledgeService) {
        console.log('❌ Knowledge service not available');
        return res.json(respond(toolCallId, JSON.stringify({
            found: false,
            answer: "I'm having trouble accessing our knowledge base. Would you like me to connect you with a team member?"
        })));
    }

    try {
        // Try findBestResponse first
        if (typeof knowledgeService.findBestResponse === 'function') {
            const result = knowledgeService.findBestResponse(query);
            console.log('📚 KB result:', result.found ? 'FOUND' : 'NOT FOUND');

            if (result.found && result.response) {
                console.log('✅ Answer:', result.response.substring(0, 100) + '...');
                logVoice(req.body?.call?.id, 'kb_result', 'Found answer');

                return res.json(respond(toolCallId, JSON.stringify({
                    found: true,
                    answer: result.response,
                    instruction: "Read this answer to the customer. Use ONLY this information."
                })));
            }
        }

        // Fallback to searchChunks
        if (typeof knowledgeService.searchChunks === 'function') {
            const results = knowledgeService.searchChunks(query, 3);
            if (results && results.length > 0 && results[0].score > 0.05) {
                return res.json(respond(toolCallId, JSON.stringify({
                    found: true,
                    answer: results[0].content,
                    instruction: "Read this answer to the customer."
                })));
            }
        }

        // No results
        console.log('❌ No matching answer found');
        logVoice(req.body?.call?.id, 'kb_result', 'No match');

        return res.json(respond(toolCallId, JSON.stringify({
            found: false,
            answer: "I don't have specific information about that. Is there something else I can help with, or would you like to speak with a team member?"
        })));

    } catch (error) {
        console.log('❌ KB error:', error.message);
        return res.json(respond(toolCallId, JSON.stringify({
            found: false,
            answer: "I'm having trouble looking that up. Would you like me to connect you with someone?"
        })));
    }
});

// ============================================
// SEND OTP
// ============================================

router.post('/send-otp', async (req, res) => {
    console.log('\n📱 ====== SEND OTP ======');

    const toolCallId = getToolCallId(req.body);
    const phone = getPhone(req.body);
    const callId = req.body?.call?.id;

    logVoice(callId, 'send_otp', `Phone: ${phone}`);

    if (!phone) {
        return res.json(respond(toolCallId, 'ERROR: Phone not found. Cannot send verification code.'));
    }

    let cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

    if (cleanPhone.replace('+', '').length < 10) {
        return res.json(respond(toolCallId, 'ERROR: Invalid phone number.'));
    }

    console.log('📱 Sending to:', cleanPhone);

    const otp = generateOTP();
    otpStore.set(cleanPhone, { otp, expires: Date.now() + 300000, attempts: 0 });
    console.log('📱 OTP:', otp);

    if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
        try {
            const msg = await twilioClient.messages.create({
                body: `Meydan Free Zone verification code: ${otp}`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: cleanPhone
            });
            console.log('✅ SMS sent:', msg.sid);
            logVoice(callId, 'sms_sent', cleanPhone);

            return res.json(respond(toolCallId,
                'SUCCESS: Code sent. Say: "I\'ve sent a 6-digit code to your phone. Please enter it on your keypad and press pound when done."'
            ));
        } catch (e) {
            console.log('❌ SMS error:', e.message);
            logVoice(callId, 'sms_error', e.message);
            return res.json(respond(toolCallId, 'SMS failed: ' + e.message));
        }
    }

    return res.json(respond(toolCallId, 'TEST MODE: Code is ' + otp + '. Ask customer to enter it on keypad.'));
});

// ============================================
// VERIFY OTP
// ============================================

router.post('/verify-otp', async (req, res) => {
    console.log('\n🔐 ====== VERIFY OTP ======');

    const toolCallId = getToolCallId(req.body);
    const phone = getPhone(req.body);
    const code = getCode(req.body);
    const callId = req.body?.call?.id;

    console.log('🔐 Phone:', phone, 'Code:', code);
    logVoice(callId, 'verify_otp', `Code: ${code}`);

    if (!phone) return res.json(respond(toolCallId, 'ERROR: Phone not found.'));
    if (!code) return res.json(respond(toolCallId, 'Need 6-digit code. Ask customer to enter it on keypad.'));

    let cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

    const stored = otpStore.get(cleanPhone);
    if (!stored) return res.json(respond(toolCallId, 'No code found. Send a new one.'));
    if (Date.now() > stored.expires) {
        otpStore.delete(cleanPhone);
        return res.json(respond(toolCallId, 'Code expired. Send a new one.'));
    }

    if (code === stored.otp) {
        otpStore.delete(cleanPhone);
        console.log('✅ VERIFIED');
        logVoice(callId, 'otp_verified', cleanPhone);

        // Update user verification status
        if (db?.userAccounts) {
            const user = db.userAccounts.getBy('phone', cleanPhone);
            if (user) {
                db.userAccounts.update(user.id, {
                    sms_verified: true,
                    last_verified: new Date().toISOString()
                });
            }
        }

        return res.json(respond(toolCallId, 'VERIFIED! Say: "Thank you! You\'re verified. How can I help you today?"'));
    }

    stored.attempts++;
    if (stored.attempts >= 3) {
        otpStore.delete(cleanPhone);
        return res.json(respond(toolCallId, 'Too many attempts. Send a new code.'));
    }

    console.log('❌ Wrong code:', code, '!=', stored.otp);
    logVoice(callId, 'otp_failed', `Expected ${stored.otp}, got ${code}`);
    return res.json(respond(toolCallId, `Wrong code. ${3 - stored.attempts} tries left.`));
});

// ============================================
// VERIFY TOTP (Google Authenticator)
// ============================================

router.post('/verify-totp', async (req, res) => {
    console.log('\n🔐 ====== VERIFY TOTP ======');

    const toolCallId = getToolCallId(req.body);
    const code = getCode(req.body);
    const phone = getPhone(req.body);
    const callId = req.body?.call?.id;

    console.log('🔐 Code:', code);
    logVoice(callId, 'verify_totp', `Code: ${code}`);

    if (!code) {
        return res.json(respond(toolCallId, 'Need 6-digit code. Ask customer to enter it on keypad.'));
    }

    const cleanCode = code.replace(/\D/g, '');

    // Try real TOTP verification
    if (totpService && phone) {
        const user = db?.userAccounts?.getBy('phone', phone);
        if (user?.google_auth_secret) {
            const isValid = totpService.verifyCode(user.google_auth_secret, cleanCode);
            if (isValid) {
                console.log('✅ TOTP VERIFIED');
                logVoice(callId, 'totp_verified', phone);
                db.userAccounts.update(user.id, {
                    google_verified: true,
                    last_verified: new Date().toISOString()
                });
                return res.json(respond(toolCallId, 'VERIFIED! Say: "Thank you! You\'re verified. How can I help you today?"'));
            }
        }
    }

    // Test mode - accept any 6-digit code
    if (cleanCode.length === 6) {
        console.log('✅ TOTP VERIFIED (test mode)');
        logVoice(callId, 'totp_verified_test', cleanCode);
        return res.json(respond(toolCallId, 'VERIFIED! Say: "Thank you! You\'re verified. How can I help you today?"'));
    }

    return res.json(respond(toolCallId, 'Invalid code. Ask customer for current 6-digit code from authenticator app.'));
});

// ============================================
// GET VERIFICATION METHOD
// ============================================

router.post('/get-verification-method', async (req, res) => {
    console.log('\n🔍 ====== GET VERIFICATION METHOD ======');

    const toolCallId = getToolCallId(req.body);
    const method = req.body?.call?.metadata?.verificationMethod;
    const callId = req.body?.call?.id;

    console.log('🔍 Method:', method);
    logVoice(callId, 'get_method', method || 'not set');

    if (method === 'sms') {
        return res.json(respond(toolCallId,
            'Customer chose SMS verification. Call send_otp tool NOW to send the code, then ask them to enter it on keypad.'
        ));
    }

    if (method === 'google_auth') {
        return res.json(respond(toolCallId,
            'Customer chose Google Authenticator. Ask them to open their authenticator app and enter the 6-digit code on their keypad, then call verify_totp.'
        ));
    }

    return res.json(respond(toolCallId,
        'Verification method not set. Ask customer: "Would you like to verify using SMS or Google Authenticator?"'
    ));
});

// ============================================
// LOOKUP USER BY PHONE
// ============================================

router.post('/lookup-user', async (req, res) => {
    console.log('\n👤 ====== LOOKUP USER ======');

    const toolCallId = getToolCallId(req.body);
    const phone = getPhone(req.body);
    const callId = req.body?.call?.id;

    console.log('👤 Looking up:', phone);
    logVoice(callId, 'user_lookup', phone);

    if (!phone) {
        return res.json(respond(toolCallId, JSON.stringify({
            found: false,
            message: "I need a phone number to look up the customer."
        })));
    }

    let cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

    const user = db?.userAccounts?.getBy('phone', cleanPhone);

    if (user) {
        console.log('✅ User found:', user.name);
        return res.json(respond(toolCallId, JSON.stringify({
            found: true,
            name: user.name,
            email: user.email,
            phone: user.phone,
            lastContact: user.last_contact,
            message: `I found your account, ${user.name}!`
        })));
    }

    console.log('❌ User not found');
    return res.json(respond(toolCallId, JSON.stringify({
        found: false,
        message: "I don't have your information on file yet. That's okay - let me verify your identity first."
    })));
});

// ============================================
// HEALTH & DEBUG ENDPOINTS
// ============================================

router.get('/health', (req, res) => {
    res.json({
        ok: true,
        twilio: !!twilioClient,
        knowledge: !!knowledgeService,
        otps: otpStore.size,
        phones: global.phoneStore.size,
        logs: global.voiceLogs?.length || 0
    });
});

router.get('/phones', (req, res) => {
    const phones = {};
    global.phoneStore.forEach((v, k) => phones[k] = v);
    res.json({ count: global.phoneStore.size, phones });
});

router.get('/logs', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    res.json({
        success: true,
        total: global.voiceLogs?.length || 0,
        logs: (global.voiceLogs || []).slice(0, limit)
    });
});

// Test KB search endpoint
router.get('/test-kb', (req, res) => {
    const query = req.query.q || 'company setup';

    if (!knowledgeService) {
        return res.json({ error: 'Knowledge service not available' });
    }

    try {
        const result = knowledgeService.findBestResponse(query);
        res.json({ query, found: result.found, response: result.response?.substring(0, 300) });
    } catch (e) {
        res.json({ error: e.message });
    }
});

module.exports = router;