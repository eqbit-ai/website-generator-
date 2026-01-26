// backend/routes/logs.js
// Unified logs for chat and voice conversations

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Logs directory
const LOGS_DIR = path.join(__dirname, '..', 'data', 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// In-memory logs (for current session)
if (!global.chatLogs) global.chatLogs = [];
if (!global.voiceLogs) global.voiceLogs = [];

// Persist logs to file
function saveLogsToFile() {
    try {
        const allLogs = {
            chat: global.chatLogs || [],
            voice: global.voiceLogs || [],
            lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(
            path.join(LOGS_DIR, 'conversations.json'),
            JSON.stringify(allLogs, null, 2)
        );
    } catch (e) {
        console.error('Failed to save logs:', e.message);
    }
}

// Load logs from file on startup
function loadLogsFromFile() {
    try {
        const filePath = path.join(LOGS_DIR, 'conversations.json');
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            global.chatLogs = data.chat || [];
            global.voiceLogs = data.voice || [];
            console.log(`✅ Loaded ${global.chatLogs.length} chat logs and ${global.voiceLogs.length} voice logs`);
        }
    } catch (e) {
        console.error('Failed to load logs:', e.message);
    }
}

// Load logs on startup
loadLogsFromFile();

// Auto-save logs every 30 seconds
setInterval(saveLogsToFile, 30000);

// Log chat message
function logChatMessage(sessionId, role, content, userName, userEmail, userPhone) {
    const log = {
        id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        type: 'chat',
        sessionId,
        role,
        content,
        userName,
        userEmail,
        userPhone,
        timestamp: new Date().toISOString()
    };
    global.chatLogs.unshift(log);
    if (global.chatLogs.length > 1000) global.chatLogs = global.chatLogs.slice(0, 1000);
    return log;
}

// Get all logs (unified)
router.get('/all', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const type = req.query.type; // 'chat', 'voice', or undefined (all)

    let logs = [];

    if (!type || type === 'chat') {
        logs = [...logs, ...(global.chatLogs || [])];
    }

    if (!type || type === 'voice') {
        logs = [...logs, ...(global.voiceLogs || [])];
    }

    // Sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
        success: true,
        total: logs.length,
        showing: Math.min(limit, logs.length),
        logs: logs.slice(0, limit)
    });
});

// Get chat sessions grouped
router.get('/sessions', (req, res) => {
    const sessions = new Map();

    // Group chat logs by sessionId
    (global.chatLogs || []).forEach(log => {
        if (!log.sessionId) return;

        if (!sessions.has(log.sessionId)) {
            sessions.set(log.sessionId, {
                sessionId: log.sessionId,
                userName: log.userName,
                userEmail: log.userEmail,
                userPhone: log.userPhone,
                messages: [],
                startTime: log.timestamp,
                lastActivity: log.timestamp
            });
        }

        const session = sessions.get(log.sessionId);
        session.messages.push({
            role: log.role,
            content: log.content,
            timestamp: log.timestamp
        });

        // Update last activity
        if (new Date(log.timestamp) > new Date(session.lastActivity)) {
            session.lastActivity = log.timestamp;
        }
    });

    const sessionArray = Array.from(sessions.values()).sort(
        (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
    );

    res.json({
        success: true,
        count: sessionArray.length,
        sessions: sessionArray
    });
});

// Get voice calls
router.get('/calls', (req, res) => {
    // Group voice logs by callId
    const calls = new Map();

    (global.voiceLogs || []).forEach(log => {
        if (!log.callId) return;

        if (!calls.has(log.callId)) {
            calls.set(log.callId, {
                callId: log.callId,
                events: [],
                startTime: log.timestamp
            });
        }

        const call = calls.get(log.callId);
        call.events.push({
            action: log.action,
            details: log.details,
            timestamp: log.timestamp
        });
    });

    const callArray = Array.from(calls.values()).sort(
        (a, b) => new Date(b.startTime) - new Date(a.startTime)
    );

    res.json({
        success: true,
        count: callArray.length,
        calls: callArray
    });
});

// Clear logs (admin only)
router.delete('/clear', (req, res) => {
    const { type } = req.body;

    if (!type || type === 'chat') {
        global.chatLogs = [];
    }

    if (!type || type === 'voice') {
        global.voiceLogs = [];
    }

    saveLogsToFile();

    res.json({
        success: true,
        message: `${type || 'All'} logs cleared`
    });
});

// Health
router.get('/health', (req, res) => {
    res.json({
        ok: true,
        chatLogs: global.chatLogs?.length || 0,
        voiceLogs: global.voiceLogs?.length || 0,
        logsFile: fs.existsSync(path.join(LOGS_DIR, 'conversations.json'))
    });
});

module.exports = {
    router,
    logChatMessage,
    saveLogsToFile
};
