// backend/services/conversationalAgent.js
// AI-powered conversational voice agent

const Anthropic = require('@anthropic-ai/sdk');
const knowledgeService = require('./knowledgeService');
const db = require('../database');

let totpService = null;
try { totpService = require('./totpService'); } catch (e) { }

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

class ConversationalAgent {
    constructor() {
        this.conversations = new Map(); // Store conversation history per call
    }

    // Initialize conversation for a new call
    initConversation(callId, userData) {
        this.conversations.set(callId, {
            messages: [],
            userData,
            state: {
                greeted: false,
                askedIfGoodTime: false,
                userSaidYes: false,
                userSaidNo: false,
                scheduledCallback: null,
                smsVerified: false,
                googleVerified: false,
                waitingForDTMF: false,
                dtmfType: null, // 'sms' or 'google'
            }
        });
    }

    // Get conversation state
    getConversation(callId) {
        return this.conversations.get(callId);
    }

    // Generate AI response based on user input
    async generateResponse(callId, userInput, inputType = 'speech') {
        const convo = this.conversations.get(callId);
        if (!convo) {
            return {
                text: "I'm sorry, there was an error. Please try again later.",
                action: 'hangup'
            };
        }

        const { userData, state, messages } = convo;

        // Handle DTMF input (keypad)
        if (inputType === 'dtmf') {
            return this.handleDTMF(callId, userInput);
        }

        // Handle spoken verification codes — extract digits from speech
        // e.g., "one two three four five six", "1 2 3 4 5 6", "my code is 483921"
        if (state.waitingForDTMF || state.dtmfType === 'sms' || state.dtmfType === 'google') {
            const spokenDigits = this.extractSpokenDigits(userInput);
            if (spokenDigits && spokenDigits.length === 6) {
                console.log(`🎤 Extracted spoken code: ${spokenDigits} from "${userInput}"`);
                return this.handleDTMF(callId, spokenDigits);
            }
        }

        // Add user message to history
        messages.push({ role: 'user', content: userInput });

        // Build context for Claude
        const systemPrompt = this.buildSystemPrompt(userData, state);

        // Search knowledge base if user is asking a question
        let knowledgeContext = '';
        if (state.smsVerified && userInput.length > 3) {
            try {
                // Use unified search (keyword + vector + TF-IDF)
                const searchResult = await knowledgeService.unifiedSearch(userInput, {
                    vectorThreshold: 0.4,
                    keywordFallback: true
                });

                if (searchResult.found && searchResult.response) {
                    knowledgeContext = `\n\nKNOWLEDGE BASE INFO:\nTopic: ${searchResult.intentName}\n${searchResult.response}`;
                } else {
                    // Fall back to getting top matches for context
                    const topMatches = await knowledgeService.getTopMatches(userInput, 2);
                    if (topMatches.length > 0 && topMatches[0].score > 0.3) {
                        knowledgeContext = `\n\nKNOWLEDGE BASE INFO:\n${topMatches.map(m => `Topic: ${m.intentName}\n${m.response}`).join('\n\n')}`;
                    }
                }
            } catch (e) {
                console.log('⚠️ ConversationalAgent KB search error:', e.message);
                // Fallback to basic search
                const results = knowledgeService.searchChunks(userInput, 2);
                if (results.length > 0 && results[0].score > 0.3) {
                    knowledgeContext = `\n\nKNOWLEDGE BASE INFO:\n${results.map(r => r.content).join('\n')}`;
                }
            }
        }

        try {
            const response = await anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 300,
                system: systemPrompt + knowledgeContext,
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content
                }))
            });

            const aiResponse = response.content[0].text;

            // Parse AI response for actions
            const parsed = this.parseResponse(aiResponse, state, userInput);

            // Add assistant message to history
            messages.push({ role: 'assistant', content: parsed.text });

            // Update state based on response
            this.updateState(callId, parsed, userInput);

            return parsed;

        } catch (error) {
            console.error('AI response error:', error);
            return {
                text: "I'm having trouble understanding. Could you please repeat that?",
                action: 'listen'
            };
        }
    }

    // Build system prompt based on conversation state
    buildSystemPrompt(userData, state) {
        const name = userData.name || 'there';

        let stateContext = '';
        if (!state.greeted) {
            stateContext = `
This is the START of the call. Greet the user warmly by name and ask if this is a good time to talk.
Example: "Hello ${name}! How are you? We received your inquiry on our website. Is this a good time to talk?"`;
        } else if (!state.askedIfGoodTime) {
            stateContext = `
You've greeted the user. Now ask if this is a good time to talk.`;
        } else if (state.userSaidNo) {
            stateContext = `
The user said it's NOT a good time. Ask when would be better. Suggest times if they're unsure.
Be understanding and offer to call back. Once they give a time, confirm it and say goodbye politely.`;
        } else if (!state.smsVerified && state.userSaidYes) {
            stateContext = `
User said YES, it's a good time. Now you need to verify their identity.
Say: "Great! For security, I've sent a 6-digit verification code to your phone. Please enter it using your keypad when ready."
Then WAIT for them to enter the code.
IMPORTANT: Include [WAIT_FOR_SMS_CODE] at the end of your response.`;
        } else if (state.smsVerified && !state.googleVerified) {
            stateContext = `
User is SMS VERIFIED. You can now help them with general questions using the knowledge base.
If they ask about sensitive account information (balance, account details, personal info), 
you must ask for Google Authenticator verification:
"For account information, I need additional verification. Please enter your Google Authenticator code."
Include [WAIT_FOR_GOOGLE_CODE] if asking for Google Auth.
Answer general questions directly from the knowledge base provided.`;
        } else if (state.googleVerified) {
            stateContext = `
User is FULLY VERIFIED (both SMS and Google Auth). You can share their account information:
- Name: ${userData.name}
- Account Number: ${userData.account_number || 'ACC-12345678'}
- Status: ${userData.status || 'Active'}
- Balance: ${userData.balance || '$1,234.56'}
- Plan: ${userData.plan || 'Premium'}

Answer any questions they have about their account.`;
        }

        return `You are a friendly, professional phone agent for a company. Your name is Sarah.

CURRENT USER: ${name}
EMAIL: ${userData.email}
PHONE: ${userData.phone}

CONVERSATION STATE:
${stateContext}

RULES:
1. Be conversational and natural - you're on a phone call, not sending text
2. Keep responses SHORT (1-3 sentences max) - this is a phone conversation
3. Be warm, friendly, and professional
4. If user says goodbye or wants to end the call, say goodbye and include [HANGUP]
5. If user seems confused or frustrated, offer to connect them with a human agent
6. NEVER make up information - only use what's in the knowledge base
7. If you don't know something, say so and offer to find out

SPECIAL MARKERS (include these when needed):
- [WAIT_FOR_SMS_CODE] - When waiting for SMS verification code
- [WAIT_FOR_GOOGLE_CODE] - When waiting for Google Auth code
- [HANGUP] - When ending the call
- [TRANSFER] - When transferring to human agent
- [SCHEDULE_CALLBACK:TIME] - When scheduling a callback (e.g., [SCHEDULE_CALLBACK:3pm])

IMPORTANT: Always be listening. After each response, you'll hear what the user says next.`;
    }

    // Parse AI response for special actions
    parseResponse(aiResponse, state, userInput) {
        let text = aiResponse;
        let action = 'listen'; // Default: keep listening
        let data = {};

        // Check for special markers
        if (text.includes('[WAIT_FOR_SMS_CODE]')) {
            text = text.replace('[WAIT_FOR_SMS_CODE]', '').trim();
            action = 'gather_dtmf';
            data.dtmfType = 'sms';
            data.numDigits = 6;
        }

        if (text.includes('[WAIT_FOR_GOOGLE_CODE]')) {
            text = text.replace('[WAIT_FOR_GOOGLE_CODE]', '').trim();
            action = 'gather_dtmf';
            data.dtmfType = 'google';
            data.numDigits = 6;
        }

        if (text.includes('[HANGUP]')) {
            text = text.replace('[HANGUP]', '').trim();
            action = 'hangup';
        }

        if (text.includes('[TRANSFER]')) {
            text = text.replace('[TRANSFER]', '').trim();
            action = 'transfer';
        }

        // Check for callback scheduling
        const callbackMatch = text.match(/\[SCHEDULE_CALLBACK:([^\]]+)\]/);
        if (callbackMatch) {
            text = text.replace(callbackMatch[0], '').trim();
            data.scheduledCallback = callbackMatch[1];
            action = 'schedule_callback';
        }

        // Clean up any remaining markers
        text = text.replace(/\[.*?\]/g, '').trim();

        return { text, action, data };
    }

    // Update conversation state based on user input and AI response
    updateState(callId, parsed, userInput) {
        const convo = this.conversations.get(callId);
        if (!convo) return;

        const { state } = convo;
        const lowerInput = userInput.toLowerCase();

        // Track if greeted
        if (!state.greeted) {
            state.greeted = true;
            state.askedIfGoodTime = true;
        }

        // Check if user said yes or no to "good time to talk"
        if (!state.userSaidYes && !state.userSaidNo) {
            if (this.isNegativeResponse(lowerInput)) {
                state.userSaidNo = true;
            } else if (this.isPositiveResponse(lowerInput)) {
                state.userSaidYes = true;
            }
        }

        // Track if waiting for DTMF
        if (parsed.action === 'gather_dtmf') {
            state.waitingForDTMF = true;
            state.dtmfType = parsed.data.dtmfType;
        }

        // Track scheduled callback
        if (parsed.data.scheduledCallback) {
            state.scheduledCallback = parsed.data.scheduledCallback;

            // Save to database
            const call = db.voiceCalls.getBy('id', callId);
            if (call) {
                db.voiceCalls.update(callId, {
                    status: 'callback_scheduled',
                    callback_time: parsed.data.scheduledCallback
                });
            }
        }
    }

    // Handle DTMF (keypad) input
    handleDTMF(callId, digits) {
        const convo = this.conversations.get(callId);
        if (!convo) {
            return { text: "Sorry, there was an error.", action: 'hangup' };
        }

        const { state, userData } = convo;

        if (state.dtmfType === 'sms') {
            // Get OTP from database/memory
            const call = db.voiceCalls.getBy('id', callId);
            const expectedOTP = call?.otp_code;

            // For testing, accept any 6-digit code or check against stored OTP
            if (digits.length === 6 && (digits === expectedOTP || expectedOTP === undefined)) {
                state.smsVerified = true;
                state.waitingForDTMF = false;
                db.voiceCalls.update(callId, { sms_verified: true, status: 'sms_verified' });

                return {
                    text: "Thank you! You're verified. How can I help you today?",
                    action: 'listen'
                };
            } else {
                return {
                    text: "That code doesn't seem right. Please try again.",
                    action: 'gather_dtmf',
                    data: { dtmfType: 'sms', numDigits: 6 }
                };
            }
        }

        if (state.dtmfType === 'google') {
            // Look up user's TOTP secret and verify the real code
            let user = null;
            if (userData.user_id) user = db.userAccounts.getById(userData.user_id);
            if (!user && userData.userId) user = db.userAccounts.getById(userData.userId);
            if (!user && userData.email) user = db.userAccounts.getBy('email', userData.email.toLowerCase());
            if (!user && userData.phone) user = db.userAccounts.getBy('phone', userData.phone);
            const secret = user?.google_auth_secret || user?.totp_secret;
            let isValid = false;

            if (totpService && secret && digits.length === 6) {
                isValid = totpService.verifyCode(secret, digits);
                console.log(`🔐 TOTP verify: code=${digits}, secret=${secret ? 'yes' : 'no'}, valid=${isValid}`);
            }

            // Fallback: check global.verifiedSessions (set by outbound/verify-totp)
            if (!isValid && userData.phone && global.verifiedSessions) {
                let cleanPhone = userData.phone.replace(/[^\d+]/g, '');
                if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;
                const session = global.verifiedSessions.get(cleanPhone);
                if (session?.verified && (Date.now() - session.timestamp) < 30 * 60 * 1000) {
                    isValid = true;
                    console.log('✅ User already verified via global session');
                }
            }

            // Dev fallback: accept "123456" only when no real secret exists
            if (!isValid && !secret && digits === '123456') {
                isValid = true;
                console.log('⚠️ Using test code 123456 (no secret configured)');
            }

            if (isValid) {
                state.googleVerified = true;
                state.waitingForDTMF = false;
                db.voiceCalls.update(callId, { google_auth_verified: true, status: 'fully_verified' });

                return {
                    text: `Verified! Here's your account information. Your account number is ${user?.account_number || 'ACC-12345678'}. Your balance is ${user?.balance || '$1,234.56'}. Your account status is ${user?.status || 'Active'}. Is there anything else you'd like to know?`,
                    action: 'listen'
                };
            } else {
                state.googleAttempts = (state.googleAttempts || 0) + 1;
                if (state.googleAttempts >= 3) {
                    return {
                        text: "Too many incorrect attempts. Please try again later or contact support.",
                        action: 'listen'
                    };
                }
                return {
                    text: `That code is incorrect. Please check your Google Authenticator app and try again. You have ${3 - state.googleAttempts} attempts left.`,
                    action: 'gather_dtmf',
                    data: { dtmfType: 'google', numDigits: 6 }
                };
            }
        }

        return { text: "I didn't understand that input.", action: 'listen' };
    }

    // Extract 6-digit code from spoken input
    // Handles: "one two three four five six", "123456", "my code is 4 8 3 9 2 1",
    // "it's one two three, four five six", "the code is 483921"
    extractSpokenDigits(input) {
        if (!input) return null;

        const text = input.toLowerCase().trim();

        // Word-to-digit mapping
        const wordMap = {
            'zero': '0', 'oh': '0', 'o': '0',
            'one': '1', 'won': '1',
            'two': '2', 'to': '2', 'too': '2',
            'three': '3', 'tree': '3',
            'four': '4', 'for': '4', 'fore': '4',
            'five': '5',
            'six': '6', 'sic': '6',
            'seven': '7',
            'eight': '8', 'ate': '8',
            'nine': '9', 'niner': '9'
        };

        // Method 1: Direct digit string (e.g., "483921" or "4 8 3 9 2 1")
        const digitsOnly = text.replace(/[^\d]/g, '');
        if (digitsOnly.length === 6) {
            return digitsOnly;
        }

        // Method 2: Convert spoken words to digits
        const words = text.replace(/[,.\-]/g, ' ').split(/\s+/);
        let digits = '';
        for (const word of words) {
            if (wordMap[word]) {
                digits += wordMap[word];
            } else if (/^\d$/.test(word)) {
                digits += word;
            }
        }

        if (digits.length === 6) {
            return digits;
        }

        // Method 3: Mixed (e.g., "one 2 three 4 five 6")
        // Already handled by Method 2 above

        return null;
    }

    // Helper: Check if response is negative
    isNegativeResponse(text) {
        const negativeWords = ['no', 'not', "can't", 'cannot', 'busy', 'bad time', 'later', 'call back', 'not now', "don't", 'nope'];
        return negativeWords.some(word => text.includes(word));
    }

    // Helper: Check if response is positive
    isPositiveResponse(text) {
        const positiveWords = ['yes', 'yeah', 'yep', 'sure', 'okay', 'ok', 'good', 'fine', 'perfect', 'go ahead', 'please', 'of course'];
        return positiveWords.some(word => text.includes(word));
    }

    // Get opening message for a call
    getOpeningMessage(callId) {
        const convo = this.conversations.get(callId);
        if (!convo) return "Hello! How can I help you today?";

        const { userData } = convo;
        const name = userData.name || 'there';

        return `Hello ${name}! How are you? We received your inquiry on our website. Is this a good time to talk?`;
    }

    // Clean up conversation when call ends
    endConversation(callId) {
        this.conversations.delete(callId);
    }
}

module.exports = new ConversationalAgent();