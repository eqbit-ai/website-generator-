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

    const intentsPath = path.join(process.cwd(), 'config', 'meydan_intents.json');



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

// Stub endpoint for documents (not implemented yet)
router.get('/documents', (req, res) => {
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
        const filePath = path.join(process.cwd(), 'config', filename);

        fs.writeFileSync(filePath, textContent, 'utf-8');
        console.log(`✅ Saved scraped content to: ${filename}`);

        // Step 5: Add intents to in-memory knowledge base
        const newIntents = intentsResult.intents.map(intent => ({
            name: intent.name || intent.question || 'Untitled Intent',
            keywords: intent.keywords || [],
            response: intent.answer,
            question: intent.question,
            source: intent.source,
            sourceTitle: intent.sourceTitle
        }));

        intentsData.push(...newIntents);

        // Step 6: Save to meydan_intents.json
        const intentsPath = path.join(process.cwd(), 'config', 'meydan_intents.json');
        const currentIntents = fs.existsSync(intentsPath)
            ? JSON.parse(fs.readFileSync(intentsPath, 'utf-8'))
            : { intents: [] };

        currentIntents.intents.push(...newIntents);

        fs.writeFileSync(intentsPath, JSON.stringify(currentIntents, null, 2), 'utf-8');
        console.log(`✅ Added ${newIntents.length} intents to knowledge base`);

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
router.get('/scrape-status', (req, res) => {
    const configPath = path.join(process.cwd(), 'config');
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
        const intentsPath = path.join(process.cwd(), 'config', 'meydan_intents.json');
        if (fs.existsSync(intentsPath)) {
            fs.writeFileSync(intentsPath, JSON.stringify({ intents: intentsData }, null, 2), 'utf-8');
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

loadData();

// 🔴 THIS IS THE CRITICAL LINE THAT WAS BROKEN
module.exports = router;
