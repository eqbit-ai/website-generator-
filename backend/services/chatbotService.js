// backend/services/chatbotService.js

const Anthropic = require('@anthropic-ai/sdk');
const knowledgeService = require('./knowledgeService');
const conversationService = require('./conversationService');
const db = require('../database');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

class ChatbotService {
    constructor() {
        const SYSTEM_PROMPT = `You are a helpful and friendly customer support assistant for [Company Name]. 

## YOUR PERSONALITY
- Warm, helpful, and conversational
- Professional but not stiff or corporate
- Concise - get to the point without rambling
- Empathetic when customers have issues

## HOW TO RESPOND
- Keep responses SHORT and scannable (2-4 sentences usually)
- Use simple, everyday language
- Be direct - answer the question first, then add details if needed
- Use bullet points ONLY for lists of 3+ items
- Don't be overly enthusiastic or use excessive exclamation marks

## KNOWLEDGE BASE
You can ONLY answer questions based on the information in your knowledge base.
- If you find relevant information → Share it naturally
- If you DON'T find information → Say "I don't have specific information about that. Would you like me to connect you with our support team?"
- NEVER make up information or guess

## EXAMPLES OF GOOD RESPONSES

User: "What are your hours?"
Good: "We're open Monday to Friday, 9 AM to 6 PM. Closed on weekends. Need anything else?"

User: "How do I reset my password?"
Good: "You can reset your password by clicking 'Forgot Password' on the login page. You'll get an email with a reset link. Let me know if you run into any issues!"

User: "I'm having a problem with my order"
Good: "Sorry to hear that! Can you tell me a bit more about what's going on? I'll do my best to help sort it out."

## WHAT NOT TO DO
- Don't start every message with "Great question!" or "I'd be happy to help!"
- Don't use corporate jargon
- Don't write long paragraphs
- Don't make up information
- Don't be overly apologetic

## FOR VOICE AGENT INQUIRIES
If someone asks about calling or the phone agent:
"You can call us at [phone number] and our voice assistant Sarah will help you. For account info, you'll need your Google Authenticator code handy."
`;
    }

    checkIntentMatch(message) {
        try {
            const intents = db.intents.getAll();
            const lowerMessage = message.toLowerCase().trim();

            for (const intent of intents) {
                for (const pattern of intent.patterns) {
                    const lowerPattern = pattern.toLowerCase().trim();

                    if (lowerMessage === lowerPattern ||
                        lowerMessage.includes(lowerPattern) ||
                        this.fuzzyMatch(lowerMessage, lowerPattern)) {
                        return {
                            matched: true,
                            intentName: intent.name,
                            response: intent.responses[Math.floor(Math.random() * intent.responses.length)]
                        };
                    }
                }
            }

            return { matched: false };
        } catch (error) {
            console.error('Intent matching error:', error);
            return { matched: false };
        }
    }

    fuzzyMatch(text, pattern) {
        const words = pattern.split(' ').filter(w => w.length > 2);
        if (words.length === 0) return false;
        const matchCount = words.filter(word => text.includes(word)).length;
        return matchCount >= Math.ceil(words.length * 0.7);
    }

    isSmallTalk(message) {
        const smallTalkPatterns = [
            /^(hi|hello|hey|good morning|good afternoon|good evening|howdy)[\s!.,]*$/i,
            /^(bye|goodbye|see you|take care|thanks|thank you|thx|ty)[\s!.,]*$/i,
            /^(how are you|what's up|wassup)[\s?!.,]*$/i,
            /^(ok|okay|sure|got it|understood|alright)[\s!.,]*$/i
        ];

        return smallTalkPatterns.some(pattern => pattern.test(message.trim()));
    }

    getSmallTalkResponse(message, customerName) {
        const lowerMessage = message.toLowerCase().trim();

        // Greetings
        if (/^(hi|hello|hey|good morning|good afternoon|good evening|howdy)/i.test(lowerMessage)) {
            const responses = [
                `Hey ${customerName}! How can I help you today?`,
                `Hi ${customerName}! What can I assist you with?`,
                `Hello ${customerName}! What would you like to know?`
            ];
            return responses[Math.floor(Math.random() * responses.length)];
        }

        // Thanks
        if (/^(thanks|thank you|thx|ty)/i.test(lowerMessage)) {
            const responses = [
                `You're welcome, ${customerName}! Anything else you need?`,
                `Happy to help! Is there anything else?`,
                `No problem! Let me know if you have more questions.`
            ];
            return responses[Math.floor(Math.random() * responses.length)];
        }

        // Bye
        if (/^(bye|goodbye|see you|take care)/i.test(lowerMessage)) {
            const responses = [
                `Goodbye ${customerName}! Have a great day!`,
                `Take care! Feel free to reach out anytime.`,
                `Bye! Thanks for chatting with us.`
            ];
            return responses[Math.floor(Math.random() * responses.length)];
        }

        // How are you
        if (/^(how are you|what's up|wassup)/i.test(lowerMessage)) {
            return `I'm doing well, thanks for asking! How can I help you today, ${customerName}?`;
        }

        // Acknowledgment
        if (/^(ok|okay|sure|got it|understood|alright)/i.test(lowerMessage)) {
            return `Great! Let me know if you have any other questions.`;
        }

        return null;
    }

    async generateResponse(conversationId, userMessage, customerInfo) {
        try {
            // Check for direct intent match first
            const intentMatch = this.checkIntentMatch(userMessage);

            if (intentMatch.matched) {
                conversationService.addMessage(conversationId, 'user', userMessage);
                conversationService.addMessage(conversationId, 'assistant', intentMatch.response);

                return {
                    success: true,
                    message: intentMatch.response,
                    matchedIntent: intentMatch.intentName,
                    sourcesUsed: []
                };
            }

            // Check for small talk
            if (this.isSmallTalk(userMessage)) {
                const smallTalkResponse = this.getSmallTalkResponse(userMessage, customerInfo.name);
                if (smallTalkResponse) {
                    conversationService.addMessage(conversationId, 'user', userMessage);
                    conversationService.addMessage(conversationId, 'assistant', smallTalkResponse);

                    return {
                        success: true,
                        message: smallTalkResponse,
                        sourcesUsed: []
                    };
                }
            }

            // Search knowledge base
            const relevantChunks = knowledgeService.searchChunks(userMessage, 3);

            // Build context from knowledge base
            let knowledgeContext = '';
            let hasRelevantInfo = false;

            if (relevantChunks.length > 0 && relevantChunks[0].score > 0.5) {
                hasRelevantInfo = true;
                knowledgeContext = '\n\n[KNOWLEDGE BASE CONTEXT - ONLY use this information to answer]:\n';
                relevantChunks.forEach((chunk, index) => {
                    knowledgeContext += `\nSource ${index + 1}: ${chunk.content}\n`;
                });
            }

            // If no relevant context found, return "don't have info" response
            if (!hasRelevantInfo) {
                const noInfoResponse = `I don't have that information with me, ${customerInfo.name}. Would you like me to arrange a call with our team?`;

                conversationService.addMessage(conversationId, 'user', userMessage);
                conversationService.addMessage(conversationId, 'assistant', noInfoResponse);

                return {
                    success: true,
                    message: noInfoResponse,
                    sourcesUsed: []
                };
            }

            // Get recent messages (last 4 only to keep context focused)
            const allMessages = conversationService.getMessages(conversationId);
            const recentMessages = allMessages.slice(-4);

            const conversationMessages = recentMessages.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            }));

            // Add current message with strict instructions
            const enhancedUserMessage = `Customer Question: "${userMessage}"

${knowledgeContext}

INSTRUCTIONS:
- Answer ONLY using the information above
- If the answer is not in the context above, say: "I don't have that information with me. Would you like me to arrange a call with our team?"
- Keep answer to 1-3 sentences
- Be friendly but direct`;

            conversationMessages.push({
                role: 'user',
                content: enhancedUserMessage
            });

            // Build system prompt with customer info
            const personalizedSystemPrompt = `${this.systemPrompt}

CURRENT CUSTOMER: ${customerInfo.name}

CRITICAL REMINDER: You can ONLY answer from the [KNOWLEDGE BASE CONTEXT] provided. If the information is not there, say you don't have it and offer to arrange a call.`;

            // Call Claude API
            const response = await anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 200, // Limit response length even more
                system: personalizedSystemPrompt,
                messages: conversationMessages
            });

            let assistantMessage = response.content[0].text;

            // Double-check: if response seems like AI is making stuff up, replace it
            const suspiciousPhrases = [
                'based on my knowledge',
                'generally speaking',
                'typically',
                'usually',
                'in most cases',
                'i believe',
                'i think',
                'from what i understand',
                'as far as i know'
            ];

            const lowerResponse = assistantMessage.toLowerCase();
            if (suspiciousPhrases.some(phrase => lowerResponse.includes(phrase))) {
                assistantMessage = `I don't have that specific information with me, ${customerInfo.name}. Would you like me to arrange a call with our team to get you accurate details?`;
            }

            // Save messages
            conversationService.addMessage(conversationId, 'user', userMessage);
            conversationService.addMessage(conversationId, 'assistant', assistantMessage);

            return {
                success: true,
                message: assistantMessage,
                sourcesUsed: relevantChunks.map(c => c.source)
            };

        } catch (error) {
            console.error('Chatbot error:', error);
            return {
                success: false,
                error: error.message || 'Failed to generate response'
            };
        }
    }

    getGreeting(customerName) {
        const greetings = [
            `Hey ${customerName}! 👋 How can I help you today?`,
            `Hi ${customerName}! What can I assist you with?`,
            `Hello ${customerName}! What would you like to know?`
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    }
}

module.exports = new ChatbotService();
