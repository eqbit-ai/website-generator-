// backend/routes/knowledge.js
// Knowledge Base Routes

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const webScraperService = require('../services/webScraperService');

// Get Anthropic API client
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

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

    // Use __dirname for reliable path (works in Railway and local)
    const intentsPath = path.join(__dirname, '..', 'config', 'meydan_intents.json');

    try {
        console.log('🔎 Looking for intents at:', intentsPath);

        if (!fs.existsSync(intentsPath)) {
            console.log('❌ Intents file NOT FOUND');
            console.log('📁 __dirname:', __dirname);
            console.log('📁 process.cwd():', process.cwd());
            return;
        }

        const raw = fs.readFileSync(intentsPath, 'utf-8');
        const data = JSON.parse(raw);

        intentsData = Array.isArray(data.intents) ? data.intents : [];

        console.log(`✅ Loaded ${intentsData.length} intents from ${intentsPath}`);
    } catch (e) {
        console.log('❌ Failed loading intents:', e.message);
    }

    console.log(
        `📚 KB Ready: ${intentsData.length} intents, ${documentsData.length} docs\n`
    );
}



// ===============================
// SEARCH (USES SAME LOGIC AS CHAT.JS)
// ===============================

// Normalize word (singular/plural, common variations)
function normalizeWord(word) {
    word = word.toLowerCase().trim();
    // Handle plural/singular
    if (word.endsWith('s')) return word.slice(0, -1);
    return word;
}

// Simple Levenshtein distance for typo tolerance
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// Helper: Randomly select a response from intent (supports multiple variations)
function selectResponse(intent) {
    // New format: multiple response variations
    if (intent.responses && Array.isArray(intent.responses) && intent.responses.length > 0) {
        const randomIndex = Math.floor(Math.random() * intent.responses.length);
        return intent.responses[randomIndex];
    }

    // Old format: single response (backward compatibility)
    if (intent.response) {
        return intent.response;
    }

    return 'No response available';
}

function search(query) {
    if (!query || query.length < 2) {
        return { found: false };
    }

    const q = query.toLowerCase().trim();

    // Normalize for matching (remove punctuation, extra spaces)
    const qNormalized = q.replace(/[?!.,]/g, '').replace(/\s+/g, ' ').trim();
    const qWords = qNormalized.split(/\s+/).map(normalizeWord);

    console.log(`🔍 KB Search: "${q}"`);
    console.log(`📝 Normalized: "${qNormalized}"`);
    console.log(`📝 Words: [${qWords.join(', ')}]`);

    for (const intent of intentsData) {
        // Check if intent has valid response (support both new and old format)
        const hasResponse = (intent.responses && Array.isArray(intent.responses) && intent.responses.length > 0) ||
                           intent.response;

        if (!intent || !hasResponse || !intent.keywords) continue;

        for (const keyword of intent.keywords) {
            const kw = keyword.toLowerCase();
            const kwNormalized = kw.replace(/[?!.,]/g, '').replace(/\s+/g, ' ').trim();

            // 1. Exact phrase match (after normalization)
            if (qNormalized.includes(kwNormalized)) {
                console.log(`✅ Intent matched (exact): "${intent.name}" via keyword "${keyword}"`);
                return {
                    found: true,
                    type: 'intent',
                    response: selectResponse(intent),
                    intent: intent.name,
                    keyword: keyword
                };
            }

            // 2. Word-level matching - check if all important words from keyword appear in query
            const kwWords = kwNormalized.split(/\s+/).filter(w => w.length > 2).map(normalizeWord);

            // Must have at least 1 keyword word
            if (kwWords.length === 0) continue;

            const allWordsPresent = kwWords.every(kwWord =>
                qWords.some(qWord => {
                    // Exact match after normalization
                    if (qWord === kwWord) return true;
                    // Contains match (for compound words)
                    if (qWord.length > 3 && kwWord.length > 3) {
                        if (qWord.includes(kwWord) || kwWord.includes(qWord)) return true;
                    }
                    // Fuzzy match: allow 1 character difference for typos (only for longer words)
                    if (kwWord.length > 4 && levenshteinDistance(qWord, kwWord) <= 1) return true;
                    return false;
                })
            );

            if (allWordsPresent) {
                console.log(`✅ Intent matched (word-level): "${intent.name}" via keyword "${keyword}"`);
                console.log(`   Matched words: [${kwWords.join(', ')}]`);
                return {
                    found: true,
                    type: 'intent',
                    response: selectResponse(intent),
                    intent: intent.name,
                    keyword: keyword
                };
            }
        }
    }

    console.log(`❌ No intent matched in KB search`);
    return { found: false };
}

// ===============================
// ROUTES (VALID EXPRESS ROUTER)
// ===============================
router.get('/health', (_req, res) => {
    res.json({
        ok: true,
        intents: intentsData.length,
        documents: documentsData.length
    });
});

router.get('/intents', (_req, res) => {
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

router.post('/reload', (_req, res) => {
    loadData();
    res.json({
        success: true,
        intents: intentsData.length
    });
});

// Stub endpoint for documents (not implemented yet)
router.get('/documents', (_req, res) => {
    res.json({ documents: documentsData });
});

/**
 * Scrape website and generate intents
 * POST /api/knowledge/scrape-website
 */
router.post('/scrape-website', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'Website URL is required'
            });
        }

        if (!anthropic) {
            return res.status(500).json({
                success: false,
                error: 'AI service not available. Please configure ANTHROPIC_API_KEY'
            });
        }

        console.log(`🕷️ Starting website scrape: ${url}`);

        // Step 1: Scrape the website
        const scrapedData = await webScraperService.scrapeWebsite(url);

        if (!scrapedData.success) {
            return res.status(500).json({
                success: false,
                error: scrapedData.error || 'Failed to scrape website'
            });
        }

        // Step 2: Generate intents from scraped content
        const intentsResult = await webScraperService.generateIntents(scrapedData, anthropic);

        if (!intentsResult.success) {
            return res.status(500).json({
                success: false,
                error: intentsResult.error || 'Failed to generate intents'
            });
        }

        // Step 3: Format as text file
        const textContent = webScraperService.formatAsTextFile(scrapedData, intentsResult.intents);

        // Step 4: Save text file to config directory
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `kb_scraped_${timestamp}.txt`;
        const configDir = path.join(__dirname, '..', 'config');

        // Ensure config directory exists
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        const filePath = path.join(configDir, filename);

        fs.writeFileSync(filePath, textContent, 'utf-8');
        console.log(`✅ Saved scraped content to: ${filename}`);

        // Step 5: Add intents to in-memory knowledge base
        const newIntents = intentsResult.intents.map(intent => {
            // Support both new format (responses array) and old format (single answer)
            let responses;
            if (intent.responses && Array.isArray(intent.responses)) {
                responses = intent.responses; // New format: multiple variations
            } else if (intent.answer) {
                responses = [intent.answer]; // Old format: convert to array
            } else {
                responses = ['No response available'];
            }

            return {
                name: intent.name || intent.question || 'Untitled Intent',
                keywords: intent.keywords || [],
                responses: responses, // Store as array
                response: responses[0], // Backward compatibility: first response as default
                question: intent.question,
                source: intent.source,
                sourceTitle: intent.sourceTitle
            };
        });

        intentsData.push(...newIntents);

        // Step 6: Save to meydan_intents.json
        const intentsPath = path.join(__dirname, '..', 'config', 'meydan_intents.json');
        console.log(`📁 Intents file path: ${intentsPath}`);

        const currentIntents = fs.existsSync(intentsPath)
            ? JSON.parse(fs.readFileSync(intentsPath, 'utf-8'))
            : { intents: [] };

        console.log(`📊 Current intents: ${currentIntents.intents.length}, Adding: ${newIntents.length}`);

        currentIntents.intents.push(...newIntents);

        fs.writeFileSync(intentsPath, JSON.stringify(currentIntents, null, 2), 'utf-8');
        console.log(`✅ Saved ${currentIntents.intents.length} total intents to ${intentsPath}`);

        // CRITICAL: Reload chat intents so chatbot knows about new data
        try {
            const chatModule = require('./chat');
            if (chatModule.loadIntents) {
                chatModule.loadIntents();
                console.log('🔄 Chat intents reloaded after scraping');
            }
        } catch (e) {
            console.warn('⚠️ Could not reload chat intents:', e.message);
        }

        res.json({
            success: true,
            message: 'Website scraped and intents generated successfully',
            url: url,
            stats: {
                pagesScraped: scrapedData.totalPages,
                intentsGenerated: intentsResult.totalIntents,
                textFile: filename
            },
            intents: intentsResult.intents,
            textContent: textContent, // For browser download
            filename: filename
        });

    } catch (error) {
        console.error('❌ Scrape website error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to scrape website'
        });
    }
});

/**
 * Get scraping status
 * GET /api/knowledge/scrape-status
 */
router.get('/scrape-status', (_req, res) => {
    const configPath = path.join(__dirname, '..', 'config');
    const scrapedFiles = fs.existsSync(configPath)
        ? fs.readdirSync(configPath).filter(f => f.startsWith('kb_scraped_'))
        : [];

    res.json({
        success: true,
        scrapedFiles: scrapedFiles,
        totalScrapedFiles: scrapedFiles.length,
        totalIntents: intentsData.length
    });
});

/**
 * Delete an intent
 * DELETE /api/knowledge/intents/:index
 */
router.delete('/intents/:index', (req, res) => {
    try {
        const index = parseInt(req.params.index);

        if (isNaN(index) || index < 0 || index >= intentsData.length) {
            return res.status(400).json({
                success: false,
                error: 'Invalid intent index'
            });
        }

        // Remove from in-memory array
        const deletedIntent = intentsData.splice(index, 1)[0];

        // Update the file
        const intentsPath = path.join(__dirname, '..', 'config', 'meydan_intents.json');
        if (fs.existsSync(intentsPath)) {
            fs.writeFileSync(intentsPath, JSON.stringify({ intents: intentsData }, null, 2), 'utf-8');
            console.log(`💾 Updated ${intentsPath} with ${intentsData.length} intents`);
        }

        // Reload chat intents
        try {
            const chatModule = require('./chat');
            if (chatModule.loadIntents) {
                chatModule.loadIntents();
                console.log('🔄 Chat intents reloaded after deletion');
            }
        } catch (e) {
            console.warn('⚠️ Could not reload chat intents:', e.message);
        }

        console.log(`🗑️ Deleted intent: ${deletedIntent.name || deletedIntent.question || 'Unnamed'}`);

        res.json({
            success: true,
            message: 'Intent deleted successfully',
            deletedIntent: deletedIntent,
            remainingCount: intentsData.length
        });

    } catch (error) {
        console.error('❌ Delete intent error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete intent'
        });
    }
});

/**
 * Bulk delete intents by indices
 * POST /api/knowledge/intents/bulk-delete
 * Body: { indices: [0, 2, 5, ...] }
 */
router.post('/intents/bulk-delete', (req, res) => {
    try {
        const { indices } = req.body;

        if (!Array.isArray(indices) || indices.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Indices array is required'
            });
        }

        // Sort indices in descending order to delete from highest index first
        // This prevents index shifting issues
        const sortedIndices = [...indices].sort((a, b) => b - a);

        const deletedIntents = [];

        for (const index of sortedIndices) {
            if (index >= 0 && index < intentsData.length) {
                const deleted = intentsData.splice(index, 1)[0];
                deletedIntents.push(deleted);
            }
        }

        // Update the file
        const intentsPath = path.join(__dirname, '..', 'config', 'meydan_intents.json');
        if (fs.existsSync(intentsPath)) {
            fs.writeFileSync(intentsPath, JSON.stringify({ intents: intentsData }, null, 2), 'utf-8');
            console.log(`💾 Updated ${intentsPath} with ${intentsData.length} intents`);
        }

        // Reload chat intents
        try {
            const chatModule = require('./chat');
            if (chatModule.loadIntents) {
                chatModule.loadIntents();
                console.log('🔄 Chat intents reloaded after bulk deletion');
            }
        } catch (e) {
            console.warn('⚠️ Could not reload chat intents:', e.message);
        }

        console.log(`🗑️ Bulk deleted ${deletedIntents.length} intents`);

        res.json({
            success: true,
            message: `Deleted ${deletedIntents.length} intent(s) successfully`,
            deletedCount: deletedIntents.length,
            remainingCount: intentsData.length
        });

    } catch (error) {
        console.error('❌ Bulk delete error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete intents'
        });
    }
});

/**
 * Delete all intents
 * DELETE /api/knowledge/intents/delete-all
 */
router.delete('/intents/delete-all', (_req, res) => {
    try {
        const deletedCount = intentsData.length;

        // Clear in-memory array
        intentsData = [];

        // Update the file
        const intentsPath = path.join(__dirname, '..', 'config', 'meydan_intents.json');
        if (fs.existsSync(intentsPath)) {
            fs.writeFileSync(intentsPath, JSON.stringify({ intents: [] }, null, 2), 'utf-8');
            console.log(`💾 Cleared all intents in ${intentsPath}`);
        }

        // Reload chat intents
        try {
            const chatModule = require('./chat');
            if (chatModule.loadIntents) {
                chatModule.loadIntents();
                console.log('🔄 Chat intents reloaded after delete all');
            }
        } catch (e) {
            console.warn('⚠️ Could not reload chat intents:', e.message);
        }

        console.log(`🗑️ Deleted all ${deletedCount} intents`);

        res.json({
            success: true,
            message: `Deleted all ${deletedCount} intent(s) successfully`,
            deletedCount: deletedCount
        });

    } catch (error) {
        console.error('❌ Delete all error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete all intents'
        });
    }
});

loadData();

// 🔴 THIS IS THE CRITICAL LINE THAT WAS BROKEN
module.exports = router;
