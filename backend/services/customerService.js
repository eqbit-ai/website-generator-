// backend/services/customerService.js

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class CustomerService {
    createOrGetCustomer(name, email, phone = null) {
        const existing = db.customers.getBy('email', email);

        if (existing) {
            db.customers.update(existing.id, { updated_at: new Date().toISOString() });
            return existing;
        }

        const customer = {
            id: uuidv4(),
            name,
            email,
            phone,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        return db.customers.insert(customer);
    }

    getCustomer(customerId) {
        return db.customers.getById(customerId);
    }

    getCustomerByEmail(email) {
        return db.customers.getBy('email', email);
    }

    getAllCustomers() {
        const customers = db.customers.getAll();
        return customers.map(c => {
            const conversations = db.conversations.filterBy('customer_id', c.id);
            return {
                ...c,
                conversation_count: conversations.length,
                last_conversation: conversations.length > 0
                    ? conversations.sort((a, b) => new Date(b.started_at) - new Date(a.started_at))[0].started_at
                    : null
            };
        });
    }

    updateCustomer(customerId, updates) {
        return db.customers.update(customerId, {
            ...updates,
            updated_at: new Date().toISOString()
        });
    }
}

module.exports = new CustomerService();