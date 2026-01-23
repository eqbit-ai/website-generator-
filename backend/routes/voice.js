// backend/routes/voice.js
// Voice Agent - Incoming & Outgoing Calls with TOTP

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// ============================================
// CONFIG
// ============================================

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;
const VAPI_INCOMING_ASSISTANT_ID = process.env.VAPI_INCOMING_ASSISTANT_ID;
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;

// TOTP Service
let totpService = null;
try {
    totpService = require('../services/totpService');
    console.log('✅ TOTP service ready');
} catch (e) {
    console.log('⚠️ TOTP service not available:', e.message);
}

// Twilio
let twilioClient = null;
let VoiceResponse = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio');
    twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
    );
    VoiceResponse = twilio.twiml.VoiceResponse;
    console.log('✅ Twilio ready');
}

// Knowledge Service
let knowledgeService = null;
try {
    knowledgeService = require('../services/knowledgeService');
    console.log('✅ Knowledge service ready');
} catch (e) {
    console.log('⚠️ Knowledge service not available');
}

// ============================================
// STORAGE
// ============================================

const callStore = new Map();

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================
// 2FA SETUP ENDPOINTS
// ============================================

/**
 * Setup Google Authenticator for a user
 */
router.post('/setup-2fa', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        if (!totpService) {
            return res.status(500).json({ error: 'TOTP service not available' });
        }

        const cleanEmail = email.toLowerCase().trim();

        // Find or create user
        let user = db.userAccounts.getBy('email', cleanEmail);

        if (!user) {
            // Create new user with TOTP secret
            const secret = totpService.generateSecret();

            user = db.userAccounts.insert({
                id: uuidv4(),
                email: cleanEmail,
                name: email.split('@')[0],
                phone: '',
                account_number: `ACC-${Date.now().toString().slice(-8)}`,
                status: 'Active',
                balance: '$0.00',
                plan: 'Basic',
                google_auth_secret: secret,
                google_auth_enabled: false,
                created_at: new Date().toISOString()
            });
            console.log(`✅ New user created: ${cleanEmail}`);
        } else if (!user.google_auth_secret) {
            // Existing user without 2FA - generate secret
            const secret = totpService.generateSecret();
            db.userAccounts.update(user.id, { google_auth_secret: secret });
            user.google_auth_secret = secret;
            console.log(`✅ Generated 2FA secret for existing user: ${cleanEmail}`);
        }

        // Generate QR code
        const qrData = await totpService.generateQRCode(cleanEmail, user.google_auth_secret);

        res.json({
            success: true,
            message: 'Scan this QR code with Google Authenticator',
            qrCode: qrData.qrCodeDataUrl,
            manualEntry: qrData.manualEntry,
            // For testing only - remove in production
            currentCode: totpService.generateCurrentCode(user.google_auth_secret)
        });

    } catch (error) {
        console.error('Setup 2FA error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Verify 2FA setup - user enters code after scanning QR
 */
router.post('/verify-2fa-setup', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ error: 'Email and code are required' });
        }

        if (!totpService) {
            return res.status(500).json({ error: 'TOTP service not available' });
        }

        const user = db.userAccounts.getBy('email', email.toLowerCase());

        if (!user) {
            return res.status(404).json({ error: 'User not found. Please setup 2FA first.' });
        }

        if (!user.google_auth_secret) {
            return res.status(400).json({ error: 'Please setup 2FA first' });
        }

        // Verify the code
        const isValid = totpService.verifyCode(user.google_auth_secret, code);

        if (isValid) {
            db.userAccounts.update(user.id, { google_auth_enabled: true });

            res.json({
                success: true,
                message: 'Google Authenticator enabled successfully!'
            });
        } else {
            res.json({
                success: false,
                message: 'Invalid code. Please try again with the current code from your app.'
            });
        }

    } catch (error) {
        console.error('Verify 2FA setup error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Verify TOTP code (for API use)
 */
router.post('/verify-totp', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ error: 'Email and code are required' });
        }

        const user = db.userAccounts.getBy('email', email.toLowerCase());

        if (!user || !user.google_auth_secret) {
            return res.status(404).json({ error: 'User not found or 2FA not setup' });
        }

        const isValid = totpService.verifyCode(user.google_auth_secret, code);

        res.json({
            success: isValid,
            message: isValid ? 'Code verified!' : 'Invalid code.'
        });

    } catch (error) {
        console.error('Verify TOTP error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get current code for testing (REMOVE IN PRODUCTION)
 */
router.get('/test-totp/:email', (req, res) => {
    if (!totpService) {
        return res.status(500).json({ error: 'TOTP service not available' });
    }

    const email = req.params.email.toLowerCase();
    const user = db.userAccounts.getBy('email', email);

    if (!user || !user.google_auth_secret) {
        return res.status(404).json({ error: 'User not found or 2FA not setup' });
    }

    const currentCode = totpService.generateCurrentCode(user.google_auth_secret);
    const timeLeft = 30 - (Math.floor(Date.now() / 1000) % 30);

    res.json({
        email,
        currentCode,
        expiresIn: `${timeLeft} seconds`
    });
});

// ============================================
// INCOMING CALL HANDLER
// ============================================

router.post('/incoming', async (req, res) => {
    console.log('\n' + '='.repeat(60));
    console.log('📞 INCOMING CALL');
    console.log('='.repeat(60));
    console.log('From:', req.body.From);
    console.log('To:', req.body.To);
    console.log('CallSid:', req.body.CallSid);

    const callId = uuidv4();
    const callerPhone = req.body.From;
    const twilioCallSid = req.body.CallSid;

    callStore.set(callId, {
        callId,
        type: 'incoming',
        callerPhone,
        twilioCallSid,
        userId: null,
        userEmail: null,
        smsVerified: true, // Not needed for incoming
        googleVerified: false,
        customerLookedUp: false,
        googleAttempts: 0,
        createdAt: new Date().toISOString()
    });

    db.voiceCalls.insert({
        id: callId,
        type: 'incoming',
        phone_number: callerPhone,
        call_sid: twilioCallSid,
        status: 'incoming',
        sms_verified: false,
        google_auth_verified: false,
        created_at: new Date().toISOString()
    });

    console.log(`✅ Incoming call registered: ${callId}`);

    if (!VoiceResponse) {
        return res.status(500).send('TwiML not available');
    }

    const twiml = new VoiceResponse();

    if (VAPI_INCOMING_ASSISTANT_ID && VAPI_API_KEY) {
        const connect = twiml.connect();
        connect.stream({
            url: `wss://api.vapi.ai/ws?assistantId=${VAPI_INCOMING_ASSISTANT_ID}&apiKey=${VAPI_API_KEY}&callId=${callId}`,
            parameters: {
                callId: callId,
                callerPhone: callerPhone
            }
        });
    } else {
        twiml.say({ voice: 'Polly.Joanna' }, 'Hi! Thanks for calling. Please try again later.');
        twiml.hangup();
    }

    res.type('text/xml');
    res.send(twiml.toString());
});

// ============================================
// OUTGOING CALL
// ============================================

router.post('/initiate', async (req, res) => {
    try {
        console.log('📞 Outgoing call request:', req.body);

        const { name, email, phone } = req.body;

        if (!name || !email || !phone) {
            return res.status(400).json({ error: 'Name, email, and phone required' });
        }

        let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
        if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

        const callId = uuidv4();
        const otp = generateOTP();

        // Get or create user
        let user = db.userAccounts.getBy('email', email.toLowerCase());

        if (!user) {
            const secret = totpService ? totpService.generateSecret() : null;

            user = db.userAccounts.insert({
                id: uuidv4(),
                name,
                email: email.toLowerCase(),
                phone: cleanPhone,
                account_number: `ACC-${Date.now().toString().slice(-8)}`,
                status: 'Active',
                balance: '$1,234.56',
                plan: 'Premium',
                google_auth_secret: secret,
                google_auth_enabled: false,
                created_at: new Date().toISOString()
            });
        }

        callStore.set(callId, {
            callId,
            type: 'outgoing',
            userId: user.id,
            userName: name,
            userEmail: email.toLowerCase(),
            phone: cleanPhone,
            otpCode: otp,
            otpExpires: Date.now() + 5 * 60 * 1000,
            smsAttempts: 0,
            googleAttempts: 0,
            smsVerified: false,
            googleVerified: false,
            vapiCallId: null
        });

        db.voiceCalls.insert({
            id: callId,
            type: 'outgoing',
            user_id: user.id,
            phone_number: cleanPhone,
            status: 'initiated',
            otp_code: otp,
            sms_verified: false,
            google_auth_verified: false,
            created_at: new Date().toISOString()
        });

        console.log(`✅ Call ${callId} created`);
        console.log(`🔐 OTP: ${otp}`);

        // Send SMS
        if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
            try {
                await twilioClient.messages.create({
                    body: `Your verification code is: ${otp}`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: cleanPhone
                });
                console.log(`✅ SMS sent to ${cleanPhone}`);
            } catch (e) {
                console.log('⚠️ SMS failed:', e.message);
            }
        }

        // Start Vapi call
        const vapiPayload = {
            assistantId: VAPI_ASSISTANT_ID,
            customer: { number: cleanPhone, name: name },
            assistantOverrides: {
                variableValues: { customerName: name, callId: callId },
                serverUrl: `${process.env.BASE_URL}/api/voice/vapi/function`
            }
        };

        if (VAPI_PHONE_NUMBER_ID) {
            vapiPayload.phoneNumberId = VAPI_PHONE_NUMBER_ID;
        }

        console.log('📞 Starting Vapi call...');

        const vapiRes = await fetch('https://api.vapi.ai/call/phone', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VAPI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(vapiPayload)
        });

        const vapiData = await vapiRes.json();

        if (vapiData.id) {
            callStore.get(callId).vapiCallId = vapiData.id;
            db.voiceCalls.update(callId, { vapi_call_id: vapiData.id, status: 'calling' });
            console.log(`✅ Vapi call started: ${vapiData.id}`);

            // Generate QR code URL for response
            let qrCodeUrl = null;
            if (totpService && user.google_auth_secret) {
                try {
                    const qrData = await totpService.generateQRCode(email, user.google_auth_secret);
                    qrCodeUrl = qrData.qrCodeDataUrl;
                } catch (e) {
                    console.log('QR generation failed:', e.message);
                }
            }

            res.json({
                success: true,
                callId,
                message: 'Call started! Check your phone.',
                otp,
                qrCode: qrCodeUrl,
                setupUrl: `/setup-2fa?email=${encodeURIComponent(email)}`
            });
        } else {
            console.log('❌ Vapi error:', vapiData);
            res.status(500).json({ error: vapiData.message || 'Failed to start call' });
        }

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// VAPI FUNCTION HANDLER
// ============================================

router.post('/vapi/function', (req, res) => {
    req.setTimeout(30000);
    res.setTimeout(30000);

    console.log('\n' + '='.repeat(60));
    console.log('⚡ VAPI REQUEST');
    console.log('='.repeat(60));

    try {
        const body = req.body;
        const messageType = body.message?.type;

        console.log(`📨 Type: ${messageType || 'unknown'}`);

        if (messageType === 'tool-calls') {
            const toolCalls = body.message?.toolCalls || [];
            const callId = body.message?.call?.assistantOverrides?.variableValues?.callId;

            console.log(`📞 CallId: ${callId}`);

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

                console.log(`🔧 Function: ${funcName}`);
                console.log(`📝 Params:`, params);

                const result = executeFunction(funcName, params, callId);

                console.log(`✅ Result:`, result);

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

        if (messageType === 'end-of-call-report' || messageType === 'status-update') {
            return res.status(200).json({ received: true });
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
    const normalizedName = (funcName || '').toLowerCase().replace(/[_\s]/g, '');
    console.log(`🔧 Normalized: ${normalizedName}`);

    let callData = callId ? callStore.get(callId) : null;
    if (!callData) {
        const allCalls = Array.from(callStore.values());
        if (allCalls.length > 0) {
            callData = allCalls[allCalls.length - 1];
            console.log(`⚠️ Using fallback call: ${callData.callId}`);
        }
    }

    // Lookup customer by email
    if (normalizedName.includes('lookup') || normalizedName.includes('findcustomer') || normalizedName.includes('customerbyemail')) {
        return lookupCustomerByEmail(callData, params.email);
    }

    // Knowledge base search
    if (normalizedName.includes('search') || normalizedName.includes('knowledge') || normalizedName.includes('faq')) {
        return searchKnowledgeBase(params.query || params.question);
    }

    // SMS verification
    if (normalizedName.includes('verifysms') || normalizedName.includes('smscode')) {
        if (!callData) return { verified: false, message: "System error." };
        return verifySmsCode(callData, params.code);
    }

    // Google Auth verification
    if (normalizedName.includes('verifygoogle') || normalizedName.includes('googleauth')) {
        if (!callData) return { verified: false, message: "System error." };
        return verifyGoogleAuth(callData, params.code);
    }

    // Account info
    if (normalizedName.includes('getaccount') || normalizedName.includes('accountinfo')) {
        if (!callData) return { success: false, message: "System error." };
        return getAccountInfo(callData);
    }

    // Schedule callback
    if (normalizedName.includes('schedule') || normalizedName.includes('callback')) {
        if (!callData) return { success: false, message: "System error." };
        return scheduleCallback(callData, params.callback_time || params.time);
    }

    // Transfer to human
    if (normalizedName.includes('transfer') || normalizedName.includes('human') || normalizedName.includes('agent')) {
        return transferToHuman(callData);
    }

    return { error: `Unknown function: ${funcName}` };
}

// ============================================
// CUSTOMER LOOKUP
// ============================================

function lookupCustomerByEmail(callData, email) {
    console.log(`🔍 Looking up customer: ${email}`);

    if (!email || !email.includes('@')) {
        return {
            found: false,
            message: "That doesn't look like a valid email. Can you please tell me the email address registered on your account?"
        };
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = db.userAccounts.getBy('email', cleanEmail);

    if (user) {
        console.log(`✅ Customer found: ${user.name}`);

        if (callData) {
            callData.userId = user.id;
            callData.userEmail = cleanEmail;
            callData.customerLookedUp = true;
        }

        return {
            found: true,
            customerName: user.name,
            has2FA: !!user.google_auth_secret,
            message: `I found your account, ${user.name}! For security, please enter your Google Authenticator code on your keypad.`
        };
    } else {
        console.log(`❌ Customer not found: ${email}`);
        return {
            found: false,
            message: "I couldn't find an account with that email address. Would you like to try a different email, or should I transfer you to a team member who can help?"
        };
    }
}

// ============================================
// VERIFICATION FUNCTIONS
// ============================================

function verifySmsCode(callData, code) {
    const enteredCode = String(code || '').trim();
    const correctCode = String(callData.otpCode || '').trim();

    console.log(`🔐 SMS: entered="${enteredCode}" correct="${correctCode}"`);

    if (!enteredCode || enteredCode.length === 0) {
        return { verified: false, needsInput: true, message: "Please enter the 6-digit SMS code on your keypad." };
    }

    if (Date.now() > callData.otpExpires) {
        return { verified: false, message: "Code expired. Want a new one?" };
    }

    callData.smsAttempts++;

    if (callData.smsAttempts > 3) {
        return { verified: false, message: "Too many attempts.", blocked: true };
    }

    if (enteredCode === correctCode) {
        callData.smsVerified = true;
        db.voiceCalls.update(callData.callId, { sms_verified: true });
        console.log(`✅ SMS VERIFIED!`);
        return { verified: true, message: "Perfect, you're verified! How can I help?" };
    } else {
        const left = 3 - callData.smsAttempts;
        console.log(`❌ WRONG. ${left} left`);
        return { verified: false, message: `Wrong code. ${left} tries left.` };
    }
}

function verifyGoogleAuth(callData, code) {
    const enteredCode = String(code || '').trim();

    console.log(`🔐 Google Auth: code="${enteredCode}"`);

    if (!enteredCode || enteredCode.length === 0) {
        return {
            verified: false,
            needsInput: true,
            message: "Please enter your 6-digit Google Authenticator code on the keypad."
        };
    }

    if (enteredCode.length !== 6) {
        return { verified: false, message: "The code should be 6 digits. Please try again." };
    }

    // For incoming calls, check if customer was looked up
    if (callData.type === 'incoming' && !callData.customerLookedUp) {
        return {
            verified: false,
            message: "I need to look up your account first. What's the email address on your account?"
        };
    }

    // For outgoing calls, check SMS verification
    if (callData.type === 'outgoing' && !callData.smsVerified) {
        return { verified: false, message: "Please verify your SMS code first." };
    }

    callData.googleAttempts = (callData.googleAttempts || 0) + 1;

    if (callData.googleAttempts > 3) {
        return { verified: false, message: "Too many attempts. Let me connect you with someone.", blocked: true };
    }

    // Get user and verify with real TOTP
    const user = db.userAccounts.getById(callData.userId);

    if (!user) {
        return { verified: false, message: "Couldn't find your account. Let me transfer you." };
    }

    if (!user.google_auth_secret) {
        return { verified: false, message: "You haven't set up Google Authenticator yet. Please set it up on our website first." };
    }

    // VERIFY USING REAL TOTP (or fallback to test code)
    let isValid = false;

    if (totpService) {
        isValid = totpService.verifyCode(user.google_auth_secret, enteredCode);
        console.log(`🔐 TOTP verification: ${isValid ? 'VALID' : 'INVALID'}`);
    }

    // Fallback: Accept test code 123456 if TOTP fails or not setup
    if (!isValid && enteredCode === '123456') {
        isValid = true;
        console.log('🔐 Using test code 123456');
    }

    if (isValid) {
        callData.googleVerified = true;
        db.voiceCalls.update(callData.callId, { google_auth_verified: true });
        console.log(`✅ GOOGLE AUTH VERIFIED!`);
        return { verified: true, message: "Great, you're verified! Let me get your account information." };
    } else {
        const left = 3 - callData.googleAttempts;
        console.log(`❌ Invalid code. ${left} attempts left`);
        return {
            verified: false,
            message: `That code doesn't match. You have ${left} ${left === 1 ? 'try' : 'tries'} left. Make sure you're using the latest code from your authenticator app.`
        };
    }
}

function getAccountInfo(callData) {
    console.log(`📋 Get account info - Type: ${callData.type}, GoogleVerified: ${callData.googleVerified}`);

    if (callData.type === 'incoming') {
        if (!callData.customerLookedUp || !callData.userId) {
            return {
                success: false,
                message: "I need to look up your account first. What's the email address on your account?"
            };
        }
        if (!callData.googleVerified) {
            return {
                success: false,
                requiresGoogleAuth: true,
                message: "For security, please enter your Google Authenticator code on the keypad."
            };
        }
    }

    if (callData.type === 'outgoing') {
        if (!callData.smsVerified) {
            return { success: false, message: "Please verify your SMS code first." };
        }
        if (!callData.googleVerified) {
            return {
                success: false,
                requiresGoogleAuth: true,
                message: "For account information, please enter your Google Authenticator code."
            };
        }
    }

    const user = db.userAccounts.getById(callData.userId);
    if (!user) return { success: false, message: "Account not found." };

    console.log(`✅ Returning account info for ${user.name}`);

    return {
        success: true,
        name: user.name,
        accountNumber: user.account_number,
        balance: user.balance,
        status: user.status,
        message: `Your account number is ${user.account_number}. Your balance is ${user.balance}. Your status is ${user.status}. Is there anything else I can help with?`
    };
}

function scheduleCallback(callData, time) {
    db.voiceCalls.update(callData.callId, { status: 'callback_scheduled', callback_time: time });
    return { success: true, message: `Callback scheduled for ${time}. Talk soon!` };
}

function transferToHuman(callData) {
    console.log('📞 Transfer to human requested');

    if (callData) {
        db.voiceCalls.update(callData.callId, { status: 'transfer_requested' });
    }

    return {
        success: true,
        transfer: true,
        message: "I'll connect you with a team member. Please hold."
    };
}

function searchKnowledgeBase(query) {
    console.log('\n' + '='.repeat(50));
    console.log(`🔍 KNOWLEDGE BASE SEARCH: "${query}"`);
    console.log('='.repeat(50));

    if (!knowledgeService) {
        return {
            found: false,
            answer: null,
            message: "I don't have access to that information right now. Let me connect you with a team member."
        };
    }

    try {
        const results = knowledgeService.searchChunks(query, 5);

        if (results && results.length > 0) {
            results.forEach((r, i) => {
                console.log(`  [${i}] Score: ${r.score?.toFixed(3)} | ${r.content?.substring(0, 80)}...`);
            });

            const best = results[0];

            if (best.score > 0.1) {
                console.log(`\n✅ Using result with score ${best.score?.toFixed(3)}`);

                return {
                    found: true,
                    answer: best.content,
                    score: best.score,
                    message: best.content,
                    instruction: "USE ONLY THIS EXACT INFORMATION. DO NOT ADD ANYTHING."
                };
            }
        }

        console.log('❌ No relevant results found');
        return {
            found: false,
            answer: null,
            message: "I don't have specific information about that. Would you like me to connect you with a team member?"
        };

    } catch (error) {
        console.log('❌ Search error:', error.message);
        return {
            found: false,
            answer: null,
            message: "I'm having trouble looking that up. Let me connect you with someone."
        };
    }
}

// ============================================
// API ENDPOINTS
// ============================================

router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        vapi: !!VAPI_API_KEY,
        vapiIncoming: !!VAPI_INCOMING_ASSISTANT_ID,
        twilio: !!twilioClient,
        totp: !!totpService,
        knowledgeBase: !!knowledgeService,
        activeCalls: callStore.size
    });
});

router.get('/debug', (req, res) => {
    const calls = Array.from(callStore.entries()).map(([id, data]) => ({
        callId: id,
        type: data.type,
        phone: data.phone || data.callerPhone,
        smsVerified: data.smsVerified,
        googleVerified: data.googleVerified,
        customerLookedUp: data.customerLookedUp
    }));
    res.json({ activeCalls: calls });
});

router.get('/calls', (req, res) => {
    res.json({ calls: db.voiceCalls.getAll() });
});

router.get('/users', (req, res) => {
    const users = db.userAccounts.getAll().map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        has2FA: !!u.google_auth_secret,
        enabled2FA: !!u.google_auth_enabled
    }));
    res.json({ users });
});

module.exports = router;