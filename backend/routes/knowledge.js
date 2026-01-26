// backend/routes/knowledge.js
// Knowledge Base Routes

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Data storage
let intentsData = [];
let documentsData = [];

// Load data
function loadData() {
    console.log('\n📚 Loading Knowledge Base...');

    intentsData = [];
    documentsData = [];

    // Find intents file
    const intentsPaths = [
        path.join(__dirname, '../data/meydan_intents.json'),
        path.join(__dirname, '../../data/meydan_intents.json'),
        path.join(process.cwd(), 'data/meydan_intents.json'),
        path.join(process.cwd(), 'meydan_intents.json'),
        '/app/data/meydan_intents.json'
    ];

    for (const intentsPath of intentsPaths) {
        try {
            if (fs.existsSync(intentsPath)) {
                const raw = fs.readFileSync(intentsPath, 'utf-8');
                const data = JSON.parse(raw);
                intentsData = Array.isArray(data.intents) ? data.intents : (Array.isArray(data) ? data : []);
                console.log('✅ Loaded', intentsData.length, 'intents from', intentsPath);
                break;
            }
        } catch (e) {
            console.log('Error:', e.message);
        }
    }

    // Load documents
    try {
        const docsPath = path.join(__dirname, '../data/knowledge_base.json');
        if (fs.existsSync(docsPath)) {
            const raw = fs.readFileSync(docsPath, 'utf-8');
            const data = JSON.parse(raw);
            documentsData = Array.isArray(data.documents) ? data.documents : [];
            console.log('✅ Loaded', documentsData.length, 'documents');
        }
    } catch (e) {
        documentsData = [];
    }

    if (!Array.isArray(intentsData)) intentsData = [];
    if (!Array.isArray(documentsData)) documentsData = [];

    console.log('📚 KB Ready:', intentsData.length, 'intents,', documentsData.length, 'docs\n');
}

loadData();

// Search function
function search(query) {
    if (!query || query.trim().length < 2) {
        return { found: false, response: null, score: 0 };
    }

    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/).filter(w => w.length > 1);

    let bestMatch = null;
    let bestScore = 0;

    const intents = Array.isArray(intentsData) ? intentsData : [];
    const documents = Array.isArray(documentsData) ? documentsData : [];

    // Search intents
    for (const intent of intents) {
        if (!intent) continue;

        const keywords = Array.isArray(intent.keywords) ? intent.keywords : [];
        for (const kw of keywords) {
            if (!kw) continue;
            const kwLower = kw.toLowerCase();

            if (q.includes(kwLower) || kwLower.includes(q)) {
                if (0.9 > bestScore && intent.response) {
                    bestScore = 0.9;
                    bestMatch = { response: intent.response, type: 'intent', name: intent.name };
                }
            }

            let wordScore = 0;
            for (const word of words) {
                if (kwLower.includes(word)) wordScore++;
            }
            const score = words.length > 0 ? wordScore / words.length : 0;
            if (score > bestScore && intent.response) {
                bestScore = score;
                bestMatch = { response: intent.response, type: 'intent', name: intent.name };
            }
        }

        const name = (intent.name || '').toLowerCase();
        if (name && (q.includes(name) || name.includes(q))) {
            if (0.85 > bestScore && intent.response) {
                bestScore = 0.85;
                bestMatch = { response: intent.response, type: 'intent', name: intent.name };
            }
        }
    }

    // Search documents
    for (const doc of documents) {
        if (!doc) continue;
        const title = (doc.title || '').toLowerCase();
        const content = (doc.content || '').toLowerCase();
        let wordScore = 0;

        for (const word of words) {
            if (title.includes(word)) wordScore += 2;
            if (content.includes(word)) wordScore += 1;
        }

        const maxPossible = words.length * 3;
        const score = maxPossible > 0 ? wordScore / maxPossible : 0;

        if (score > bestScore && doc.content) {
            bestScore = score;
            bestMatch = { response: doc.content, type: 'document', title: doc.title };
        }
    }

    if (bestScore >= 0.25 && bestMatch) {
        return { found: true, response: bestMatch.response, type: bestMatch.type, score: bestScore };
    }

    return { found: false, response: null, score: bestScore };
}

// Routes
router.get('/documents', (req, res) => {
    const docs = Array.isArray(documentsData) ? documentsData : [];
    res.json({ success: true, count: docs.length, documents: docs });
});

router.get('/intents', (req, res) => {
    const ints = Array.isArray(intentsData) ? intentsData : [];
    res.json({ success: true, count: ints.length, intents: ints });
});

router.get('/search', (req, res) => {
    try {
        const query = req.query.q || req.query.query || '';
        const result = search(query);
        res.json(result);
    } catch (e) {
        res.json({ found: false, error: e.message, score: 0 });
    }
});

router.post('/documents', (req, res) => {
    try {
        const { title, content, category } = req.body;
        if (!title || !content) {
            return res.status(400).json({ success: false, error: 'Title and content required' });
        }

        if (!Array.isArray(documentsData)) documentsData = [];

        const newDoc = {
            id: 'doc_' + Date.now(),
            title, content,
            category: category || 'general',
            createdAt: new Date().toISOString()
        };

        documentsData.push(newDoc);

        try {
            const dataDir = path.join(__dirname, '../data');
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
            fs.writeFileSync(path.join(dataDir, 'knowledge_base.json'),
                JSON.stringify({ documents: documentsData }, null, 2));
        } catch (e) { }

        res.json({ success: true, document: newDoc });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/documents/:id', (req, res) => {
    if (!Array.isArray(documentsData)) documentsData = [];
    const idx = documentsData.findIndex(d => d && d.id === req.params.id);
    if (idx >= 0) {
        documentsData.splice(idx, 1);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, error: 'Not found' });
    }
});

router.get('/stats', (req, res) => {
    res.json({
        documents: Array.isArray(documentsData) ? documentsData.length : 0,
        intents: Array.isArray(intentsData) ? intentsData.length : 0,
        loaded: true
    });
});

router.get('/health', (req, res) => {
    res.json({
        ok: true,
        documents: Array.isArray(documentsData) ? documentsData.length : 0,
        intents: Array.isArray(intentsData) ? intentsData.length : 0
    });
});

router.post('/reload', (req, res) => {
    loadData();
    res.json({
        success: true,
        documents: Array.isArray(documentsData) ? documentsData.length : 0,
        intents: Array.isArray(intentsData) ? intentsData.length : 0
    });
});

router.get('/debug', (req, res) => {
    const info = {
        dirname: __dirname,
        cwd: process.cwd(),
        intentsCount: Array.isArray(intentsData) ? intentsData.length : 0,
        documentsCount: Array.isArray(documentsData) ? documentsData.length : 0,
        files: {}
    };

    const dirsToCheck = [
        path.join(__dirname, '..'),
        path.join(__dirname, '../data'),
        process.cwd(),
        path.join(process.cwd(), 'data')
    ];

    for (const dir of dirsToCheck) {
        try {
            if (fs.existsSync(dir)) {
                info.files[dir] = fs.readdirSync(dir).slice(0, 15);
            }
        } catch (e) { }
    }

    res.json(info);
});

module.exports = router;