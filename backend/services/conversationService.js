// backend/services/conversationService.js

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class ConversationService {
  createConversation(customerId) {
    const conversation = {
      id: uuidv4(),
      customer_id: customerId,
      status: 'active',
      started_at: new Date().toISOString(),
      ended_at: null
    };

    return db.conversations.insert(conversation);
  }

  getConversation(conversationId) {
    const conv = db.conversations.getById(conversationId);
    if (!conv) return null;

    const customer = db.customers.getById(conv.customer_id);
    return {
      ...conv,
      customer_name: customer?.name || 'Unknown',
      customer_email: customer?.email || 'Unknown'
    };
  }

  getMessages(conversationId) {
    return db.messages.filterBy('conversation_id', conversationId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  addMessage(conversationId, role, content) {
    const message = {
      id: uuidv4(),
      conversation_id: conversationId,
      role,
      content,
      created_at: new Date().toISOString()
    };

    return db.messages.insert(message);
  }

  endConversation(conversationId) {
    return db.conversations.update(conversationId, {
      status: 'ended',
      ended_at: new Date().toISOString()
    });
  }

  getCustomerConversations(customerId) {
    const conversations = db.conversations.filterBy('customer_id', customerId);
    return conversations.map(conv => {
      const messages = this.getMessages(conv.id);
      return {
        ...conv,
        last_message: messages.length > 0 ? messages[messages.length - 1].content : null,
        message_count: messages.length
      };
    }).sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
  }

  getAllConversations(limit = 50) {
    const conversations = db.conversations.getAll();
    return conversations.map(conv => {
      const customer = db.customers.getById(conv.customer_id);
      const messages = this.getMessages(conv.id);
      return {
        ...conv,
        customer_name: customer?.name || 'Unknown',
        customer_email: customer?.email || 'Unknown',
        last_message: messages.length > 0 ? messages[messages.length - 1].content : null,
        message_count: messages.length
      };
    })
      .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
      .slice(0, limit);
  }
}

module.exports = new ConversationService();