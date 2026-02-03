// backend/services/knowledgeService.js
// Knowledge Service (TF-IDF based + Vector Embeddings)

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const natural = require('natural');

const TfIdf = natural.TfIdf;

// Embedding service for vector search
let embeddingService = null;
try {
    embeddingService = require('./embeddingService');
} catch (e) {
    console.log('⚠️ Embedding service not available');
}

class KnowledgeService {
    constructor() {
        this.tfidf = new TfIdf();
        this.intents = [];
    }

    /**
     * Set intents for unified search
     * @param {Array} intents - Array of intent objects
     */
    setIntents(intents) {
        this.intents = intents || [];
        console.log(`📚 KnowledgeService: ${this.intents.length} intents loaded`);
    }

    // Rebuild index from DB chunks
    rebuildIndex() {
        this.tfidf = new TfIdf();
        const chunks = db.chunks.getAll();

        chunks.forEach(chunk => {
            if (chunk?.content) {
                this.tfidf.addDocument(chunk.content, chunk.id);
            }
        });

        console.log(`📚 Knowledge index rebuilt (${chunks.length} chunks)`);
    }

    // Add a document + chunks (used ONLY when explicitly called)
    addDocument(id, filename, name, type, size, content) {
        if (!content || db.documents.getById(id)) return;

        db.documents.insert({
            id,
            filename,
            original_name: name,
            file_type: type,
            file_size: size,
            uploaded_at: new Date().toISOString()
        });

        const chunks = this.splitIntoChunks(content);
        chunks.forEach((text, i) => {
            const cid = uuidv4();
            db.chunks.insert({
                id: cid,
                document_id: id,
                content: text,
                chunk_index: i,
                created_at: new Date().toISOString()
            });
            this.tfidf.addDocument(text, cid);
        });
    }

    // Simple sentence chunking (unchanged logic)
    splitIntoChunks(text, maxSize = 500) {
        const sentences = text.split(/[.!?]+/).filter(Boolean);
        const chunks = [];
        let current = '';

        for (const s of sentences) {
            if ((current + s).length > maxSize) {
                chunks.push(current.trim());
                current = s;
            } else {
                current += ' ' + s;
            }
        }

        if (current.trim()) chunks.push(current.trim());
        return chunks;
    }

    // Search (safe even if empty)
    search(query, limit = 5) {
        if (!query || query.length < 2) return [];

        const results = [];
        this.tfidf.tfidfs(query, (i, score, id) => {
            if (score > 0) {
                results.push({ id, score });
            }
        });

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(r => {
                const chunk = db.chunks.getById(r.id);
                return chunk
                    ? { content: chunk.content, score: r.score }
                    : null;
            })
            .filter(Boolean);
    }

    // Stats (used by server.js logs)
    getStats() {
        return {
            documents: db.documents.getAll().length,
            chunks: db.chunks.getAll().length,
            intents: this.intents.length
        };
    }

    /**
     * Unified search combining vector search and keyword matching
     * @param {string} query - The search query
     * @param {Object} options - Search options
     * @returns {Object} - { found: boolean, response: string, score: number, source: string, intentName: string }
     */
    async unifiedSearch(query, options = {}) {
        const { vectorThreshold = 0.5, keywordFallback = true } = options;

        if (!query || query.length < 2) {
            return { found: false, response: null, score: 0, source: 'none' };
        }

        console.log(`🔍 Unified search: "${query.substring(0, 50)}..."`);

        // 1. Try vector search first (if available)
        if (embeddingService && embeddingService.initialized && this.intents.length > 0) {
            try {
                const vectorResults = await embeddingService.search(query, this.intents, 1);

                if (vectorResults.length > 0 && vectorResults[0].score >= vectorThreshold) {
                    const result = vectorResults[0];
                    const response = this.selectIntentResponse(result.intent);

                    console.log(`✅ Vector match: "${result.intentName}" (score: ${result.score.toFixed(3)})`);

                    return {
                        found: true,
                        response: response,
                        score: result.score,
                        source: 'vector',
                        intentName: result.intentName
                    };
                } else if (vectorResults.length > 0) {
                    console.log(`⚠️ Vector score too low: ${vectorResults[0].score.toFixed(3)} < ${vectorThreshold}`);
                }
            } catch (error) {
                console.error('❌ Vector search error:', error.message);
            }
        }

        // 2. Fall back to keyword matching (if enabled)
        if (keywordFallback && this.intents.length > 0) {
            const keywordResult = this.keywordSearch(query);
            if (keywordResult.found) {
                return keywordResult;
            }
        }

        // 3. No match found
        return { found: false, response: null, score: 0, source: 'none' };
    }

    /**
     * Keyword-based search (existing logic)
     */
    keywordSearch(query) {
        const q = query.toLowerCase().trim();
        const qNormalized = q.replace(/[?!.,]/g, '').replace(/\s+/g, ' ').trim();

        for (const intent of this.intents) {
            const hasResponse = (intent.responses && intent.responses.length > 0) || intent.response;
            if (!intent || !hasResponse || !intent.keywords) continue;

            for (const keyword of intent.keywords) {
                const kw = keyword.toLowerCase();
                const kwNormalized = kw.replace(/[?!.,]/g, '').replace(/\s+/g, ' ').trim();

                if (qNormalized.includes(kwNormalized)) {
                    const response = this.selectIntentResponse(intent);
                    console.log(`✅ Keyword match: "${intent.name}" via "${keyword}"`);

                    return {
                        found: true,
                        response: response,
                        score: 0.7, // Keyword matches get a medium-high score
                        source: 'keyword',
                        intentName: intent.name
                    };
                }
            }
        }

        return { found: false, response: null, score: 0, source: 'none' };
    }

    /**
     * Helper to select response from intent (handles both response and responses formats)
     */
    selectIntentResponse(intent) {
        if (intent.responses && Array.isArray(intent.responses) && intent.responses.length > 0) {
            const randomIndex = Math.floor(Math.random() * intent.responses.length);
            return intent.responses[randomIndex];
        }
        return intent.response || 'No response available';
    }
}

module.exports = new KnowledgeService();
