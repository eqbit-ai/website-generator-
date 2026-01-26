// backend/routes/knowledge.js
// Knowledge Base Routes - Fixed with robust error handling

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Data storage
let intentsData = [];
let documentsData = [];

// Find data directory
function findDataDir() {
    const possiblePaths = [
        path.join(__dirname, '../data'),
        path.join(__dirname, '../../data'),
        path.join(process.cwd(), 'data'),
        path.join(process.cwd(), 'backend/data')
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }

    // Create default
    const defaultPath = path.join(__dirname, '../data');
    try {
        fs.mkdirSync(defaultPath, { recursive: true });
    } catch (e) { }
    return defaultPath;
}

// Load data
function loadData() {
    const dataDir = findDataDir();
    console.log('📁 Data directory:', dataDir);

    // Load intents
    const intentsPaths = [
        path.join(dataDir, 'meydan_intents.json'),
        path.join(__dirname, '../data/meydan_intents.json'),
        path.join(process.cwd(), 'meydan_intents.json'),
        path.join(process.cwd(), 'data/meydan_intents.json')
    ];

    for (const intentsPath of intentsPaths) {
        try {
            if (fs.existsSync(intentsPath)) {
                const raw = fs.readFileSync(intentsPath, 'utf-8');
                const data = JSON.parse(raw);
                intentsData = data.intents || data || [];
                console.log('✅ Loaded', intentsData.length, 'intents from', intentsPath);
                break;
            }
        } catch (e) {
            console.log('⚠️ Could not load intents from', intentsPath, ':', e.message);
        }
    }

    // Load documents
    const docsPath = path.join(dataDir, 'knowledge_base.json');
    try {
        if (fs.existsSync(docsPath)) {
            const raw = fs.readFileSync(docsPath, 'utf-8');
            const data = JSON.parse(raw);
            documentsData = data.documents || [];
            console.log('✅ Loaded', documentsData.length, 'documents');
        } else {
            // Create empty file
            fs.writeFileSync(docsPath, JSON.stringify({ documents: [] }, null, 2));
            console.log('📝 Created empty knowledge_base.json');
        }
    } catch (e) {
        console.log('⚠️ Documents load error:', e.message);
        documentsData = [];
    }

    console.log('📚 KB Ready:', intentsData.length, 'intents,', documentsData.length, 'docs');
}

// Initialize
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

    // Search intents by keywords
    for (const intent of intentsData) {
        // Check keywords array
        if (intent.keywords && Array.isArray(intent.keywords)) {
            for (const kw of intent.keywords) {
                const kwLower = (kw || '').toLowerCase();

                // Direct keyword match
                if (q.includes(kwLower) || kwLower.includes(q)) {
                    const score = 0.9;
                    if (score > bestScore && intent.response) {
                        bestScore = score;
                        bestMatch = { response: intent.response, type: 'intent', name: intent.name };
                    }
                }

                // Word-by-word match
                let wordScore = 0;
                for (const word of words) {
                    if (kwLower.includes(word)) wordScore++;
                }
                const normalizedScore = words.length > 0 ? wordScore / words.length : 0;
                if (normalizedScore > bestScore && intent.response) {
                    bestScore = normalizedScore;
                    bestMatch = { response: intent.response, type: 'intent', name: intent.name };
                }
            }
        }

        // Check patterns array
        if (intent.patterns && Array.isArray(intent.patterns)) {
            for (const pattern of intent.patterns) {
                const patternLower = (pattern || '').toLowerCase();
                let wordScore = 0;
                for (const word of words) {
                    if (patternLower.includes(word)) wordScore++;
                }
                const normalizedScore = words.length > 0 ? wordScore / words.length : 0;
                if (normalizedScore > bestScore && intent.response) {
                    bestScore = normalizedScore;
                    bestMatch = { response: intent.response, type: 'intent', name: intent.name };
                }
            }
        }

        // Check intent name
        const name = (intent.name || '').toLowerCase();
        if (name && (q.includes(name) || name.includes(q))) {
            if (0.85 > bestScore && intent.response) {
                bestScore = 0.85;
                bestMatch = { response: intent.response, type: 'intent', name: intent.name };
            }
        }
    }

    // Search documents
    for (const doc of documentsData) {
        const title = (doc.title || '').toLowerCase();
        const content = (doc.content || '').toLowerCase();
        let wordScore = 0;

        for (const word of words) {
            if (title.includes(word)) wordScore += 2;
            if (content.includes(word)) wordScore += 1;
        }

        const maxPossible = words.length * 3;
        const normalizedScore = maxPossible > 0 ? wordScore / maxPossible : 0;

        if (normalizedScore > bestScore && doc.content) {
            bestScore = normalizedScore;
            bestMatch = { response: doc.content, type: 'document', title: doc.title };
        }
    }

    if (bestScore >= 0.25 && bestMatch) {
        return { found: true, response: bestMatch.response, type: bestMatch.type, score: bestScore };
    }

    return { found: false, response: null, score: bestScore };
}

// Save documents
function saveDocuments() {
    try {
        const dataDir = findDataDir();
        const docsPath = path.join(dataDir, 'knowledge_base.json');
        fs.writeFileSync(docsPath, JSON.stringify({ documents: documentsData, updatedAt: new Date().toISOString() }, null, 2));
    } catch (e) {
        console.error('Save error:', e.message);
    }
}

// ========== ROUTES ==========

// Get documents
router.get('/documents', (req, res) => {
    res.json({ success: true, count: documentsData.length, documents: documentsData });
});

// Get intents
router.get('/intents', (req, res) => {
    res.json({ success: true, count: intentsData.length, intents: intentsData });
});

// Search
router.get('/search', (req, res) => {
    try {
        const query = req.query.q || req.query.query || '';
        const result = search(query);
        res.json(result);
    } catch (e) {
        console.error('Search error:', e);
        res.json({ found: false, error: e.message, score: 0 });
    }
});

// Add document
router.post('/documents', (req, res) => {
    try {
        const { title, content, category, keywords } = req.body;
        if (!title || !content) {
            return res.status(400).json({ success: false, error: 'Title and content required' });
        }

        const newDoc = {
            id: 'doc_' + Date.now(),
            title, content,
            category: category || 'general',
            keywords: keywords || [],
            createdAt: new Date().toISOString()
        };

        documentsData.push(newDoc);
        saveDocuments();
        res.json({ success: true, document: newDoc });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Delete document
router.delete('/documents/:id', (req, res) => {
    try {
        const idx = documentsData.findIndex(d => d.id === req.params.id);
        if (idx >= 0) {
            documentsData.splice(idx, 1);
            saveDocuments();
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'Not found' });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Stats
router.get('/stats', (req, res) => {
    res.json({ documents: documentsData.length, intents: intentsData.length, loaded: true });
});

// Health
router.get('/health', (req, res) => {
    res.json({ ok: true, documents: documentsData.length, intents: intentsData.length });
});

// Reload
router.post('/reload', (req, res) => {
    loadData();
    res.json({ success: true, documents: documentsData.length, intents: intentsData.length });
});

module.exports = router;