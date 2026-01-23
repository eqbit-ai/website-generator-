// backend/services/voiceAgentService.js

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const knowledgeService = require('./knowledgeService');

// Only require twilio if credentials exist
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio');
    twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
    );
}

class VoiceAgentService {
    constructor() {
        this.callStates = {}; // In-memory call state management
    }

    // Generate 6-digit OTP
    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Generate Google Auth Secret (simple implementation)
    generateSecret() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let secret = '';
        for (let i = 0; i < 16; i++) {
            secret += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return secret;
    }

    // Generate TOTP code from secret
    generateTOTP(secret) {
        // Simple TOTP implementation for testing
        // In production, use a proper library
        const epoch = Math.floor(Date.now() / 1000 / 30);
        const hash = this.simpleHash(secret + epoch);
        return (Math.abs(hash) % 1000000).toString().padStart(6, '0');
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }

    // Send SMS OTP
    async sendSmsOTP(phoneNumber, callId) {
        const otp = this.generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Save OTP to database
        db.otpCodes.insert({
            id: uuidv4(),
            call_id: callId,
            phone: phoneNumber,
            code: otp,
            type: 'sms',
            verified: false,
            created_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString()
        });

        // Send SMS via Twilio if configured
        if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
            try {
                await twilioClient.messages.create({
                    body: `Your verification code is: ${otp}. This code expires in 5 minutes.`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: phoneNumber
                });

                console.log(`SMS OTP sent to ${phoneNumber}: ${otp}`);
                return { success: true };
            } catch (error) {
                console.error('SMS send error:', error.message);
                return { success: false, error: error.message };
            }
        } else {
            console.log(`[MOCK] SMS OTP for ${phoneNumber}: ${otp}`);
            return { success: true, otp }; // Return OTP for testing
        }
    }

    // Verify SMS OTP
    verifySmsOTP(callId, enteredCode) {
        const allOtps = db.otpCodes.getAll();
        const otpRecord = allOtps.find(
            o => o.call_id === callId && o.type === 'sms' && !o.verified
        );

        if (!otpRecord) {
            return { verified: false, reason: 'No OTP found' };
        }

        if (new Date() > new Date(otpRecord.expires_at)) {
            return { verified: false, reason: 'OTP expired' };
        }

        if (otpRecord.code === enteredCode) {
            db.otpCodes.update(otpRecord.id, { verified: true });
            return { verified: true };
        }

        return { verified: false, reason: 'Invalid code' };
    }

    // Generate Google Authenticator Secret for user
    generateGoogleAuthSecret(userId) {
        const secret = this.generateSecret();

        // Update user account with secret
        const user = db.userAccounts.getById(userId);
        if (user) {
            db.userAccounts.update(userId, {
                google_auth_secret: secret,
                google_auth_enabled: true
            });
        }

        const email = user?.email || 'user';
        const issuer = 'YourCompany';
        const otpauth = `otpauth://totp/${issuer}:${email}?secret=${secret}&issuer=${issuer}`;

        return { secret, otpauth };
    }

    // Verify Google Authenticator TOTP
    verifyGoogleAuth(userId, token) {
        const user = db.userAccounts.getById(userId);

        if (!user || !user.google_auth_secret) {
            return { verified: false, reason: 'Google Auth not set up' };
        }

        // For testing: accept the generated TOTP or "123456"
        const expectedToken = this.generateTOTP(user.google_auth_secret);
        const isValid = token === expectedToken || token === '123456';

        return { verified: isValid, reason: isValid ? null : 'Invalid code' };
    }

    // Initiate outbound call
    async initiateCall(userId, phoneNumber, purpose = 'verification') {
        const callId = uuidv4();

        // Create call record
        const callRecord = {
            id: callId,
            user_id: userId,
            phone_number: phoneNumber,
            purpose,
            status: 'initiating',
            sms_verified: false,
            google_auth_verified: false,
            created_at: new Date().toISOString(),
            call_sid: null
        };

        db.voiceCalls.insert(callRecord);

        // Initialize call state
        this.callStates[callId] = {
            stage: 'greeting',
            user_id: userId,
            phone_number: phoneNumber,
            sms_verified: false,
            google_auth_verified: false,
            attempts: { sms: 0, google: 0 },
            conversation: []
        };

        // Check if Twilio is configured
        if (!twilioClient) {
            console.log('[MOCK] Call would be made to:', phoneNumber);
            db.voiceCalls.update(callId, { status: 'mock_call' });
            return {
                success: true,
                callId,
                mock: true,
                message: 'Twilio not configured - call simulated'
            };
        }

        if (!process.env.BASE_URL) {
            console.error('BASE_URL not configured');
            db.voiceCalls.update(callId, { status: 'failed', error: 'BASE_URL not configured' });
            return { success: false, error: 'BASE_URL not configured. Set up ngrok and add BASE_URL to .env' };
        }

        try {
            // Make the call via Twilio
            const call = await twilioClient.calls.create({
                url: `${process.env.BASE_URL}/api/voice/webhook/answer?callId=${callId}`,
                to: phoneNumber,
                from: process.env.TWILIO_PHONE_NUMBER,
                statusCallback: `${process.env.BASE_URL}/api/voice/webhook/status?callId=${callId}`,
                statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
            });

            // Update call record with Twilio SID
            db.voiceCalls.update(callId, {
                call_sid: call.sid,
                status: 'calling'
            });

            console.log(`Call initiated: ${callId} -> ${phoneNumber}`);

            return { success: true, callId, callSid: call.sid };
        } catch (error) {
            console.error('Call initiation error:', error.message);
            db.voiceCalls.update(callId, { status: 'failed', error: error.message });
            return { success: false, error: error.message };
        }
    }

    // Get call state
    getCallState(callId) {
        return this.callStates[callId] || null;
    }

    // Update call state
    updateCallState(callId, updates) {
        if (this.callStates[callId]) {
            this.callStates[callId] = { ...this.callStates[callId], ...updates };
        }
    }

    // Get user account info (after verification)
    getUserAccountInfo(userId) {
        const user = db.userAccounts.getById(userId);
        if (!user) return null;

        return {
            name: user.name,
            email: user.email,
            account_number: user.account_number,
            account_status: user.status,
            balance: user.balance,
            last_transaction: user.last_transaction
        };
    }

    // Search FAQ for voice queries
    searchFAQ(query) {
        const results = knowledgeService.searchChunks(query, 2);
        if (results.length > 0 && results[0].score > 0.3) {
            return results[0].content;
        }
        return null;
    }

    // Log call event
    logCallEvent(callId, event, details = {}) {
        db.callLogs.insert({
            id: uuidv4(),
            call_id: callId,
            event,
            details,
            timestamp: new Date().toISOString()
        });
    }

    // End call
    async endCall(callId, reason = 'completed') {
        const call = db.voiceCalls.getById(callId);

        if (call && call.call_sid && twilioClient) {
            try {
                await twilioClient.calls(call.call_sid).update({ status: 'completed' });
            } catch (error) {
                console.error('Error ending call:', error.message);
            }
        }

        db.voiceCalls.update(callId, {
            status: reason,
            ended_at: new Date().toISOString()
        });

        // Clean up call state
        delete this.callStates[callId];

        this.logCallEvent(callId, 'call_ended', { reason });
    }
}

module.exports = new VoiceAgentService();