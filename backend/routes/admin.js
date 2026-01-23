// backend/routes/admin.js

const express = require('express');
const router = express.Router();
const customerService = require('../services/customerService');
const conversationService = require('../services/conversationService');
const knowledgeService = require('../services/knowledgeService');

router.get('/stats', (req, res) => {
    try {
        const customers = customerService.getAllCustomers();
        const conversations = conversationService.getAllConversations(100);
        const knowledgeStats = knowledgeService.getStats();

        const activeConversations = conversations.filter(c => c.status === 'active').length;
        const totalMessages = conversations.reduce((sum, c) => sum + (c.message_count || 0), 0);

        res.json({
            success: true,
            stats: {
                totalCustomers: customers.length,
                totalConversations: conversations.length,
                activeConversations,
                totalMessages,
                knowledgeBase: knowledgeStats
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

router.get('/customers', (req, res) => {
    try {
        const customers = customerService.getAllCustomers();
        res.json({ success: true, customers });
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

router.get('/conversations', (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const conversations = conversationService.getAllConversations(parseInt(limit));
        res.json({ success: true, conversations });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

router.get('/conversations/:id', (req, res) => {
    try {
        const { id } = req.params;
        const conversation = conversationService.getConversation(id);

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const messages = conversationService.getMessages(id);
        res.json({ success: true, conversation, messages });
    } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({ error: 'Failed to fetch conversation' });
    }
});

module.exports = router;