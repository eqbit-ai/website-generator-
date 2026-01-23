// backend/routes/knowledge.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const knowledgeService = require('../services/knowledgeService');

// Configure multer
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.txt', '.doc', '.docx', '.md'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${ext} not supported. Please use TXT, DOCX, or MD files. For PDFs, copy the text and use "Add Text" instead.`));
        }
    }
});

// Extract text from file
async function extractText(filePath, fileType) {
    const ext = fileType.toLowerCase();

    if (ext === '.txt' || ext === '.md') {
        return fs.readFileSync(filePath, 'utf-8');
    }

    if (ext === '.docx' || ext === '.doc') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    }

    throw new Error(`Unsupported file type: ${ext}`);
}

// Upload document
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { filename, originalname, size, path: filePath } = req.file;
        const fileType = path.extname(originalname).toLowerCase();

        console.log(`Processing uploaded file: ${originalname}`);

        const content = await extractText(filePath, fileType);

        if (!content || content.trim().length === 0) {
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: 'Could not extract text from file' });
        }

        console.log(`Extracted ${content.length} characters from file`);

        const documentId = uuidv4();
        const result = knowledgeService.addDocument(documentId, filename, originalname, fileType, size, content);

        console.log(`Document processed: ${result.chunksCreated} chunks created`);

        res.json({
            success: true,
            documentId: result.documentId,
            filename: originalname,
            chunksCreated: result.chunksCreated,
            message: `Document uploaded and processed into ${result.chunksCreated} chunks`
        });

    } catch (error) {
        console.error('Upload error:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: error.message || 'Failed to process document' });
    }
});

// Add text directly
router.post('/add-text', async (req, res) => {
    try {
        const { title, content } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const documentId = uuidv4();
        const result = knowledgeService.addDocument(
            documentId,
            `text-${documentId}.txt`,
            title || 'Manual Entry',
            '.txt',
            content.length,
            content
        );

        res.json({
            success: true,
            documentId: result.documentId,
            chunksCreated: result.chunksCreated,
            message: `Text added and processed into ${result.chunksCreated} chunks`
        });

    } catch (error) {
        console.error('Add text error:', error);
        res.status(500).json({ error: error.message || 'Failed to add text' });
    }
});

// Get all documents
router.get('/documents', (req, res) => {
    try {
        const documents = knowledgeService.getAllDocuments();
        res.json({ success: true, documents });
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// Delete document
router.delete('/documents/:id', (req, res) => {
    try {
        const { id } = req.params;
        knowledgeService.deleteDocument(id);
        res.json({ success: true, message: 'Document deleted' });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// Search knowledge base
router.get('/search', (req, res) => {
    try {
        const { query, limit = 5 } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const results = knowledgeService.searchChunks(query, parseInt(limit));
        res.json({ success: true, query, results });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Get stats
router.get('/stats', (req, res) => {
    try {
        const stats = knowledgeService.getStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ============================================
// INTENT ENDPOINTS
// ============================================

// Get all intents
router.get('/intents', (req, res) => {
    try {
        const intents = db.intents.getAll();
        res.json({ success: true, intents });
    } catch (error) {
        console.error('Error fetching intents:', error);
        res.status(500).json({ error: 'Failed to fetch intents' });
    }
});

// Add new intent
router.post('/intents', (req, res) => {
    try {
        const { name, patterns, responses } = req.body;

        if (!name || !patterns || !responses) {
            return res.status(400).json({ error: 'Name, patterns, and responses are required' });
        }

        if (!Array.isArray(patterns) || !Array.isArray(responses)) {
            return res.status(400).json({ error: 'Patterns and responses must be arrays' });
        }

        // Check if intent already exists
        const existing = db.intents.getBy('name', name.toLowerCase());
        if (existing) {
            return res.status(400).json({ error: 'Intent with this name already exists' });
        }

        const intent = {
            id: uuidv4(),
            name: name.toLowerCase(),
            patterns,
            responses,
            created_at: new Date().toISOString()
        };

        db.intents.insert(intent);

        res.json({ success: true, intent });

    } catch (error) {
        console.error('Error adding intent:', error);
        res.status(500).json({ error: 'Failed to add intent' });
    }
});

// Delete intent
router.delete('/intents/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.intents.delete(id);
        res.json({ success: true, message: 'Intent deleted' });
    } catch (error) {
        console.error('Error deleting intent:', error);
        res.status(500).json({ error: 'Failed to delete intent' });
    }
});

module.exports = router;