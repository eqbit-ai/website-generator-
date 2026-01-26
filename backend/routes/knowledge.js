// backend/routes/knowledge.js
// Knowledge Base Routes

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// In-memory storage (AS BEFORE)
let intentsData = [];
let documentsData = [];

// ===============================
// LOAD DATA (NO SIDE EFFECTS)
// ===============================
function loadData() {
    console.log('\n📚 Loading Knowledge Base...');

    intentsData = [];
    documentsData = [];

    const intentsPaths = [
        path.join(__dirname, '../data/meydan_intents.json'),
        path.join(process.cwd(), 'data/meydan_intents.json'),
        '/app/data/meydan_intents.json'
    ];

    for (const p of intentsPaths) {
        try {
            if (fs.existsSync(p)) {
                const raw = fs.readFileSync(p, 'utf8');
                const json = JSON.parse(raw);
                intentsData = Array.isArray(json.intents) ? json.intents : [];
                console.log(`📚 KB Ready: ${intentsData.length} intents loaded`);
                break;
            }
        } catch (e) {
            console.log('KB load error:', e.message);
        }
    }
}

loadData();

// ===============================
// SEARCH (UNCHANGED)
// ===============================
function search(query) {
    if (!query || query.length < 2) {
        return { found: false };
    }

    const q = query.toLowerCase();
    for (const intent of intentsData) {
        if (!intent || !intent.response) continue;

        const keywords = intent.keywords || [];
        for (const k of keywords) {
            if (q.includes(k.toLowerCase())) {
                return {
                    found: true,
                    type: 'intent',
                    response: intent.response
                };
            }
        }
    }
    return { found: false };
}

// ===============================
// ROUTES (VALID EXPRESS ROUTER)
// ===============================
router.get('/health', (req, res) => {
    res.json({
        ok: true,
        intents: intentsData.length,
        documents: documentsData.length
    });
});

router.get('/intents', (req, res) => {
    res.json({
        success: true,
        count: intentsData.length,
        intents: intentsData
    });
});

router.get('/search', (req, res) => {
    const q = req.query.q || '';
    res.json(search(q));
});

router.post('/reload', (req, res) => {
    loadData();
    res.json({
        success: true,
        intents: intentsData.length
    });
});

// 🔴 THIS IS THE CRITICAL LINE THAT WAS BROKEN
module.exports = router;
