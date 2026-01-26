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
// Load data
function loadData() {
    console.log('\n📚 Loading Knowledge Base...');

    intentsData = [];
    documentsData = [];

    const intentsPath = path.join(
        process.cwd(),
        'backend',
        'data',
        'meydan_intents.json'
    );

    try {
        console.log('🔎 Looking for intents at:', intentsPath);

        if (!fs.existsSync(intentsPath)) {
            console.log('❌ Intents file NOT FOUND');
            return;
        }

        const raw = fs.readFileSync(intentsPath, 'utf-8');
        const data = JSON.parse(raw);

        intentsData = Array.isArray(data.intents) ? data.intents : [];

        console.log(`✅ Loaded ${intentsData.length} intents`);
    } catch (e) {
        console.log('❌ Failed loading intents:', e.message);
    }

    console.log(
        `📚 KB Ready: ${intentsData.length} intents, ${documentsData.length} docs\n`
    );
}



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
loadData();

// 🔴 THIS IS THE CRITICAL LINE THAT WAS BROKEN
module.exports = router;
