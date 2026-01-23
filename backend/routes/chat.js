// backend/routes/chat.js

const express = require('express');
const router = express.Router();
const customerService = require('../services/customerService');
const conversationService = require('../services/conversationService');
const chatbotService = require('../services/chatbotService');

router.post('/start', async (req, res) => {
    try {
        const { name, email, phone } = req.body;

        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Please provide a valid email address' });
        }

        const customer = customerService.createOrGetCustomer(name, email, phone);
        const conversation = conversationService.createConversation(customer.id);
        const greeting = chatbotService.getGreeting(name);

        conversationService.addMessage(conversation.id, 'assistant', greeting);

        res.json({
            success: true,
            customerId: customer.id,
            conversationId: conversation.id,
            greeting
        });

    } catch (error) {
        console.error('Error starting chat:', error);
        res.status(500).json({ error: error.message || 'Failed to start chat session' });
    }
});

router.post('/message', async (req, res) => {
    try {
        const { conversationId, message } = req.body;

        if (!conversationId || !message) {
            return res.status(400).json({ error: 'Conversation ID and message are required' });
        }

        const conversation = conversationService.getConversation(conversationId);

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (conversation.status === 'ended') {
            return res.status(400).json({ error: 'This conversation has ended' });
        }

        const customerInfo = {
            name: conversation.customer_name,
            email: conversation.customer_email
        };

        const response = await chatbotService.generateResponse(conversationId, message, customerInfo);

        if (response.success) {
            res.json({
                success: true,
                response: response.message,
                sourcesUsed: response.sourcesUsed
            });
        } else {
            res.status(500).json({ error: response.error });
        }

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message || 'Failed to process message' });
    }
});

router.get('/history/:conversationId', (req, res) => {
    try {
        const { conversationId } = req.params;
        const conversation = conversationService.getConversation(conversationId);

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const messages = conversationService.getMessages(conversationId);

        res.json({ success: true, conversation, messages });

    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch conversation history' });
    }
});

router.post('/end/:conversationId', (req, res) => {
    try {
        const { conversationId } = req.params;
        conversationService.endConversation(conversationId);
        res.json({ success: true, message: 'Conversation ended' });
    } catch (error) {
        console.error('Error ending conversation:', error);
        res.status(500).json({ error: 'Failed to end conversation' });
    }
});

module.exports = router;