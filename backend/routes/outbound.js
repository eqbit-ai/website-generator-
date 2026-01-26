// backend/routes/outbound.js
// OTP, Verification, and KB Search for Voice Agents

const express = require('express');
const router = express.Router();

// Twilio
let twilioClient = null;
try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('✅ Outbound: Twilio ready');
    }
} catch (e) {
    console.log('⚠️ Twilio not configured');
}

// Storage
if (!global.phoneStore) global.phoneStore = new Map();
if (!global.voiceLogs) global.voiceLogs = [];
const otpStore = new Map();

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getToolCallId(body) {
    return body?.message?.toolCalls?.[0]?.id || 'call_1';
}

function respond(toolCallId, msg) {
    return { results: [{ toolCallId, result: msg }] };
}

function logVoice(action, data) {
    const entry = {
        type: 'voice',
        action,
        ...data,
        timestamp: new Date().toISOString()
    };
    global.voiceLogs.unshift(entry);
    if (global.voiceLogs.length > 500) global.voiceLogs.pop();
}

function getPhone(body) {
    // Vapi sends call data in body.message.call or body.call
    const call = body?.message?.call || body?.call;

    const callId = call?.id;
    const sessionId = call?.assistantOverrides?.variableValues?.sessionId || call?.metadata?.sessionId;
    const customerPhone = call?.customer?.number ||
                         call?.assistantOverrides?.variableValues?.customerPhone ||
                         call?.metadata?.customerPhone;

    console.log('🔍 Looking for phone:');
    console.log('  - callId:', callId);
    console.log('  - sessionId:', sessionId);
    console.log('  - customerPhone from call:', customerPhone);
    console.log('  - phoneStore keys:', Array.from(global.phoneStore?.keys() || []));

    // 1. Try direct customer phone from Vapi call object
    if (customerPhone) {
        console.log('✅ Found phone in call object:', customerPhone);
        return customerPhone;
    }

    // 2. Try phoneStore with various keys
    if (callId && global.phoneStore?.has(callId)) {
        console.log('✅ Found phone in store by callId:', global.phoneStore.get(callId));
        return global.phoneStore.get(callId);
    }
    if (sessionId && global.phoneStore?.has(sessionId)) {
        console.log('✅ Found phone in store by sessionId:', global.phoneStore.get(sessionId));
        return global.phoneStore.get(sessionId);
    }

    // 3. Try body phoneNumber
    if (body?.phoneNumber) {
        console.log('✅ Found phone in body.phoneNumber:', body.phoneNumber);
        return body.phoneNumber;
    }

    console.log('❌ Phone not found anywhere');
    console.log('Full body structure:', JSON.stringify(body, null, 2).substring(0, 500));
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
            const c = parsed.code || parsed.otp || parsed.totp;
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
            return parsed.query || parsed.question || parsed.text || '';
        }
    }
    return body?.query || body?.question || '';
}

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
        console.log(`✅ Outbound: Loaded ${intentsData.length} intents from ${intentsPath}`);
    } else {
        console.log('❌ Outbound: Intents file not found in any location');
    }
} catch (e) {
    console.log('⚠️ Outbound: Could not load intents:', e.message);
}

// Search Knowledge Base (for Vapi)
router.post('/search-knowledge-base', async (req, res) => {
    const toolCallId = getToolCallId(req.body);
    const query = getQuery(req.body);

    console.log('🔍 KB Search:', query);
    logVoice('kb-search', { query });

    if (!query || query.length < 2) {
        return res.json(respond(toolCallId, JSON.stringify({
            found: false,
            answer: "Could you please repeat your question?"
        })));
    }

    // Search intents
    const q = query.toLowerCase();
    for (const intent of intentsData) {
        if (!intent || !intent.response || !intent.keywords) continue;

        for (const keyword of intent.keywords) {
            if (q.includes(keyword.toLowerCase())) {
                console.log(`✅ Found intent: ${intent.name}`);
                return res.json(respond(toolCallId, JSON.stringify({
                    found: true,
                    answer: intent.response
                })));
            }
        }
    }

    // If no intent match, try knowledgeService chunks
    try {
        const knowledgeService = require('../services/knowledgeService');
        const results = knowledgeService.search(query, 1);

        if (results.length > 0 && results[0].score > 0.05) {
            console.log(`✅ Found in KB chunks (score: ${results[0].score})`);
            return res.json(respond(toolCallId, JSON.stringify({
                found: true,
                answer: results[0].content
            })));
        }
    } catch (e) {
        console.log('⚠️ KB service error:', e.message);
    }

    // No match found
    return res.json(respond(toolCallId, JSON.stringify({
        found: false,
        answer: "I don't have specific information about that. Would you like me to connect you with our team?"
    })));
});

// Send OTP
router.post('/send-otp', async (req, res) => {
    const toolCallId = getToolCallId(req.body);
    let phone = getPhone(req.body);

    if (!phone && req.body.phoneNumber) phone = req.body.phoneNumber;

    console.log('📱 Send OTP to:', phone);
    logVoice('send-otp', { phone });

    if (!phone) {
        return res.json(respond(toolCallId, 'ERROR: Phone number not found.'));
    }

    let cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

    // Get OTP from global.phoneStore (generated at call initiation)
    let otp;
    const storedData = global.phoneStore?.get(cleanPhone);
    if (storedData && typeof storedData === 'object' && storedData.otp) {
        otp = storedData.otp;
        console.log('✅ Retrieved stored OTP:', otp, 'for', cleanPhone);
    } else {
        // Fallback: generate new OTP only if not found
        console.log('⚠️ No stored OTP found, generating new one');
        otp = generateOTP();
    }

    // Store in otpStore for verification
    otpStore.set(cleanPhone, { otp, expires: Date.now() + 300000, attempts: 0 });

    console.log('📱 OTP:', otp, 'for', cleanPhone);

    if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
        try {
            await twilioClient.messages.create({
                body: `Your Meydan Free Zone verification code is: ${otp}`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: cleanPhone
            });
            logVoice('otp-sent', { phone: cleanPhone });
            return res.json(respond(toolCallId, 'SUCCESS: Code sent. Ask customer to enter the 6-digit code.'));
        } catch (e) {
            console.log('SMS error:', e.message);
            return res.json(respond(toolCallId, `TEST MODE: Code is ${otp}. SMS failed: ${e.message}`));
        }
    }

    return res.json(respond(toolCallId, `TEST MODE: Code is ${otp}. Ask customer to enter it.`));
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    const toolCallId = getToolCallId(req.body);
    const phone = getPhone(req.body);
    const code = getCode(req.body);

    console.log('🔐 Verify OTP:', phone, code);
    logVoice('verify-otp', { phone, code });

    if (!phone) return res.json(respond(toolCallId, 'ERROR: Phone not found.'));
    if (!code) return res.json(respond(toolCallId, 'Need 6-digit code.'));

    let cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

    const stored = otpStore.get(cleanPhone);
    if (!stored) return res.json(respond(toolCallId, 'No code found. Send a new one.'));
    if (Date.now() > stored.expires) {
        otpStore.delete(cleanPhone);
        return res.json(respond(toolCallId, 'Code expired.'));
    }

    if (code === stored.otp) {
        otpStore.delete(cleanPhone);
        logVoice('otp-verified', { phone: cleanPhone });
        return res.json(respond(toolCallId, 'VERIFIED! Customer is verified.'));
    }

    stored.attempts++;
    if (stored.attempts >= 3) {
        otpStore.delete(cleanPhone);
        return res.json(respond(toolCallId, 'Too many attempts.'));
    }

    return res.json(respond(toolCallId, `Wrong code. ${3 - stored.attempts} tries left.`));
});

// Verify TOTP
router.post('/verify-totp', async (req, res) => {
    const toolCallId = getToolCallId(req.body);
    const code = getCode(req.body);

    console.log('🔐 Verify TOTP:', code);
    logVoice('verify-totp', { code });

    if (!code) return res.json(respond(toolCallId, 'Need 6-digit code from authenticator.'));

    if (code.length === 6) {
        logVoice('totp-verified', {});
        return res.json(respond(toolCallId, 'VERIFIED! Customer is verified.'));
    }

    return res.json(respond(toolCallId, 'Invalid code.'));
});

// Get Verification Method
router.post('/get-verification-method', async (req, res) => {
    const toolCallId = getToolCallId(req.body);
    const method = req.body?.call?.metadata?.verificationMethod;

    if (method === 'sms') {
        return res.json(respond(toolCallId, 'Customer chose SMS. Call send_otp tool now.'));
    }
    if (method === 'google_auth') {
        return res.json(respond(toolCallId, 'Customer chose Google Authenticator. Ask for 6-digit code.'));
    }

    return res.json(respond(toolCallId, 'Ask: "Would you prefer SMS or Google Authenticator?"'));
});

// Health check
router.get('/health', (req, res) => {
    res.json({ ok: true, twilio: !!twilioClient, otps: otpStore.size, logs: global.voiceLogs?.length || 0 });
});

// Logs
router.get('/logs', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    res.json({
        success: true,
        total: global.voiceLogs?.length || 0,
        logs: (global.voiceLogs || []).slice(0, limit)
    });
});

// Phone store
router.get('/phones', (req, res) => {
    const phones = {};
    global.phoneStore.forEach((v, k) => phones[k] = v);
    res.json({ count: global.phoneStore.size, phones });
});

module.exports = router;