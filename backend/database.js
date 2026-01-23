// backend/database.js
// Simple JSON file-based database

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class JSONDatabase {
  constructor(filename) {
    this.filepath = path.join(dataDir, filename);
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filepath)) {
        const content = fs.readFileSync(this.filepath, 'utf-8');
        if (content.trim()) {
          return JSON.parse(content);
        }
      }
    } catch (e) {
      console.error(`Error loading ${this.filepath}:`, e.message);
    }
    return [];
  }

  save() {
    try {
      fs.writeFileSync(this.filepath, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error(`Error saving ${this.filepath}:`, e.message);
    }
  }

  getAll() {
    return this.data || [];
  }

  getById(id) {
    return (this.data || []).find(item => item.id === id);
  }

  getBy(field, value) {
    return (this.data || []).find(item => item[field] === value);
  }

  filterBy(field, value) {
    return (this.data || []).filter(item => item[field] === value);
  }

  insert(item) {
    if (!this.data) this.data = [];
    this.data.push(item);
    this.save();
    return item;
  }

  update(id, updates) {
    if (!this.data) this.data = [];
    const index = this.data.findIndex(item => item.id === id);
    if (index !== -1) {
      this.data[index] = { ...this.data[index], ...updates };
      this.save();
      return this.data[index];
    }
    return null;
  }

  delete(id) {
    if (!this.data) return false;
    const index = this.data.findIndex(item => item.id === id);
    if (index !== -1) {
      this.data.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  count() {
    return (this.data || []).length;
  }
}

// Create all database instances
const db = {
  // Chatbot
  customers: new JSONDatabase('customers.json'),
  conversations: new JSONDatabase('conversations.json'),
  messages: new JSONDatabase('messages.json'),
  documents: new JSONDatabase('documents.json'),
  chunks: new JSONDatabase('chunks.json'),
  intents: new JSONDatabase('intents.json'),

  // Voice Agent
  voiceCalls: new JSONDatabase('voice_calls.json'),
  otpCodes: new JSONDatabase('otp_codes.json'),
  userAccounts: new JSONDatabase('user_accounts.json'),
  callLogs: new JSONDatabase('call_logs.json')
};

console.log('✅ Database initialized (JSON-based)');

module.exports = db;