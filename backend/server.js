// backend/server.js
// Complete backend server

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// DATABASE
// ============================================
const db = require('./database');

// ============================================
// SERVICES
// ============================================
let knowledgeService;
let embeddingService;
let intentsData = [];

// Load intents from config
try {
    const possiblePaths = [
        path.join(__dirname, 'config', 'meydan_intents.json'),
        path.join(process.cwd(), 'backend', 'config', 'meydan_intents.json'),
        path.join(process.cwd(), 'config', 'meydan_intents.json')
    ];

    let intentsPath = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            intentsPath = p;
            break;
        }
    }

    if (intentsPath) {
        const data = JSON.parse(fs.readFileSync(intentsPath, 'utf-8'));
        intentsData = data.intents || [];
        console.log(`✅ Server: Loaded ${intentsData.length} intents from ${intentsPath}`);
    }
} catch (e) {
    console.log('⚠️ Could not load intents:', e.message);
}

try {
    knowledgeService = require('./services/knowledgeService');

    // ✅ REQUIRED: initialize AFTER DB is ready
    if (knowledgeService.init) {
        knowledgeService.init();
    }

    // Set intents for unified search
    if (intentsData.length > 0) {
        knowledgeService.setIntents(intentsData);
    }

    const stats = knowledgeService.getStats();
    console.log(`📚 Knowledge base: ${stats.chunks} chunks loaded`);

} catch (e) {
    console.log('⚠️ Knowledge service not available:', e.message);
}

// Initialize embedding service asynchronously (don't block startup)
try {
    embeddingService = require('./services/embeddingService');

    if (intentsData.length > 0 && process.env.OPENAI_API_KEY) {
        // Initialize asynchronously
        embeddingService.init(intentsData)
            .then(() => {
                const status = embeddingService.getStatus();
                console.log(`🧠 Embedding service ready: ${status.embeddingsCount} embeddings`);
            })
            .catch(err => {
                console.log('⚠️ Embedding service init failed:', err.message);
            });
    } else if (!process.env.OPENAI_API_KEY) {
        console.log('⚠️ OPENAI_API_KEY not set, vector search disabled');
    }
} catch (e) {
    console.log('⚠️ Embedding service not available:', e.message);
}

// ============================================
// ROUTES
// ============================================

// Voice routes (Vapi)
try {
    const voiceRoutes = require('./routes/voice');
    app.use('/api/voice', voiceRoutes);
    console.log('✅ Voice routes loaded');
} catch (e) {
    console.log('⚠️ Voice routes error:', e.message);
}

// Chat routes
try {
    const chatRoutes = require('./routes/chat');
    app.use('/api/chat', chatRoutes);
    console.log('✅ Chat routes loaded');
} catch (e) {
    console.log('⚠️ Chat routes not available:', e.message);
}

// Outbound routes (OTP, Verification, KB for Voice Agents)
try {
    const outboundRoutes = require('./routes/outbound');
    app.use('/api/outbound', outboundRoutes);
    console.log('✅ Outbound routes loaded');
} catch (e) {
    console.log('⚠️ Outbound routes not available:', e.message);
}

// Knowledge routes
try {
    const knowledgeRoutes = require('./routes/knowledge');
    app.use('/api/knowledge', knowledgeRoutes);
    console.log('✅ Knowledge routes loaded');
} catch (e) {
    console.log('⚠️ Knowledge routes not available:', e.message);
}

// Admin routes
try {
    const adminRoutes = require('./routes/admin');
    app.use('/api/admin', adminRoutes);
    console.log('✅ Admin routes loaded');
} catch (e) {
    console.log('⚠️ Admin routes not available:', e.message);
}

// Logs routes
try {
    const { router: logsRouter } = require('./routes/logs');
    app.use('/api/logs', logsRouter);
    console.log('✅ Logs routes loaded');
} catch (e) {
    console.log('⚠️ Logs routes not available:', e.message);
}

// Generator routes (NEW - Premium website generator with conversation context)
try {
    const generatorRoutes = require('./routes/generator');
    app.use('/api/generator', generatorRoutes);
    console.log('✅ Generator routes loaded');
} catch (e) {
    console.log('⚠️ Generator routes not available:', e.message);
}

// Deploy routes (Website deployment and domain search)
try {
    const deployRoutes = require('./routes/deploy');
    app.use('/api/deploy', deployRoutes);
    app.use('/api/domains', deployRoutes); // Domains search is also in deploy.js
    console.log('✅ Deploy & Domains routes loaded');
} catch (e) {
    console.log('⚠️ Deploy routes not available:', e.message);
}

// ============================================
// STATIC FILES
// ============================================
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
}
app.use('/audio', express.static(audioDir));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
    const embeddingStatus = embeddingService ? embeddingService.getStatus() : { initialized: false };

    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        embeddings: {
            initialized: embeddingStatus.initialized,
            count: embeddingStatus.embeddingsCount || 0,
            model: embeddingStatus.model || null
        },
        intents: intentsData.length
    });
});

// ============================================
// WEBSITE GENERATION (Anthropic)
// ============================================
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
    try {
        const Anthropic = require('@anthropic-ai/sdk');
        anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        console.log('✅ Anthropic Claude ready');
    } catch (e) {
        console.log('⚠️ Anthropic not available:', e.message);
    }
}

app.post('/api/generate/website', async (req, res) => {
    try {
        const { prompt, options = {} } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        if (!anthropic) {
            return res.status(500).json({ error: 'Anthropic not configured' });
        }

        console.log('🎨 Generating website:', prompt.substring(0, 50));

        const htmlResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: 'Generate only HTML body content. No html/head/body tags. Use https://picsum.photos for images. Return raw HTML only.',
            messages: [{ role: 'user', content: `Create HTML for: ${prompt}` }]
        });

        let html = htmlResponse.content[0].text
            .replace(/^```html?\n?/i, '')
            .replace(/\n?```$/i, '')
            .trim();

        const cssResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: 'Generate complete CSS with responsive design. Include Google Fonts @import. Return raw CSS only.',
            messages: [{ role: 'user', content: `Style this HTML (${options.style || 'modern'} style):\n${html}` }]
        });

        let css = cssResponse.content[0].text
            .replace(/^```css?\n?/i, '')
            .replace(/\n?```$/i, '')
            .trim();

        const jsResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            system: 'Generate vanilla JavaScript for interactivity. Return raw JS only.',
            messages: [{ role: 'user', content: `Add interactivity to:\n${html}` }]
        });

        let js = jsResponse.content[0].text
            .replace(/^```javascript?\n?/i, '')
            .replace(/\n?```$/i, '')
            .trim();

        res.json({ success: true, website: { html, css, js } });

    } catch (error) {
        console.error('❌ Generate error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('='.repeat(50));
    console.log('');
    console.log('📞 Voice Agent:');
    console.log(`   POST /api/voice/initiate - Start a call`);
    console.log(`   POST /api/voice/vapi/function - Vapi webhook`);
    console.log(`   GET  /api/voice/health - Check status`);
    console.log(`   GET  /api/voice/debug - See active calls`);
    console.log('');
    console.log('🔧 Config:');
    console.log(`   Vapi: ${process.env.VAPI_API_KEY ? '✅' : '❌'}`);
    console.log(`   Twilio: ${process.env.TWILIO_ACCOUNT_SID ? '✅' : '❌'}`);
    console.log(`   Base URL: ${process.env.BASE_URL || '❌ NOT SET'}`);
    console.log('');
    console.log('='.repeat(50));
});

module.exports = app;
