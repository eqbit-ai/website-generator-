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
     * Initialize the knowledge service - rebuild TF-IDF index from DB chunks
     * Called by server.js on startup
     */
    init() {
        this.rebuildIndex();
        console.log(`📚 KnowledgeService initialized`);
    }

    /**
     * Set intents for unified search AND propagate to embedding service
     * @param {Array} intents - Array of intent objects
     */
    setIntents(intents) {
        this.intents = intents || [];
        console.log(`📚 KnowledgeService: ${this.intents.length} intents loaded`);
    }

    /**
     * Reload intents from file and propagate to all services
     * Called after scraping or intent changes
     */
    async reloadIntents(newIntents) {
        this.intents = newIntents || [];
        console.log(`🔄 KnowledgeService: Reloaded ${this.intents.length} intents`);

        // Re-generate embeddings for new intents
        if (embeddingService && process.env.OPENAI_API_KEY && this.intents.length > 0) {
            try {
                await embeddingService.init(this.intents);
                console.log(`🧠 Embeddings regenerated for ${this.intents.length} intents`);
            } catch (e) {
                console.log('⚠️ Failed to regenerate embeddings:', e.message);
            }
        }
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

    /**
     * Search DB chunks using TF-IDF (safe even if empty)
     * This is the method that chatbotService, conversationalAgent, and voice route call
     */
    searchChunks(query, limit = 5) {
        if (!query || query.length < 2) return [];

        const results = [];

        // 1. Search TF-IDF chunks from documents
        this.tfidf.tfidfs(query, (i, score, id) => {
            if (score > 0) {
                results.push({ id, score, source: 'tfidf' });
            }
        });

        const tfidfResults = results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(r => {
                const chunk = db.chunks.getById(r.id);
                return chunk
                    ? { content: chunk.content, score: r.score, source: 'document' }
                    : null;
            })
            .filter(Boolean);

        // 2. Also search intents by keyword (so this method always returns something useful)
        const intentResults = [];
        if (this.intents.length > 0) {
            const keywordResult = this.keywordSearch(query);
            if (keywordResult.found) {
                intentResults.push({
                    content: keywordResult.response,
                    score: keywordResult.score,
                    source: 'intent'
                });
            }
        }

        // Merge and sort by score
        const merged = [...intentResults, ...tfidfResults]
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        return merged;
    }

    // Alias for backward compatibility
    search(query, limit = 5) {
        return this.searchChunks(query, limit);
    }

    /**
     * Find the single best response for a query
     * Used by voice agent for direct answers
     */
    async findBestResponse(query) {
        if (!query || query.length < 2) {
            return { found: false, response: null, score: 0 };
        }

        // Use unified search which tries keyword first, then vector
        return await this.unifiedSearch(query, { vectorThreshold: 0.45 });
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
     * Unified search combining keyword matching + vector search
     * @param {string} query - The search query
     * @param {Object} options - Search options
     * @returns {Object} - { found: boolean, response: string, score: number, source: string, intentName: string }
     */
    async unifiedSearch(query, options = {}) {
        const { vectorThreshold = 0.45, keywordFallback = true } = options;

        if (!query || query.length < 2) {
            return { found: false, response: null, score: 0, source: 'none' };
        }

        console.log(`🔍 Unified search: "${query.substring(0, 50)}..."`);

        // 1. Try keyword matching FIRST (more precise)
        if (this.intents.length > 0) {
            const keywordResult = this.keywordSearch(query);
            if (keywordResult.found) {
                return keywordResult;
            }
        }

        // 2. Try advanced keyword matching (word-level + fuzzy)
        if (this.intents.length > 0) {
            const advancedResult = this.advancedKeywordSearch(query);
            if (advancedResult.found) {
                return advancedResult;
            }
        }

        // 3. Fall back to vector search (semantic matching)
        if (embeddingService && embeddingService.initialized && this.intents.length > 0) {
            try {
                const vectorResults = await embeddingService.search(query, this.intents, 3);

                if (vectorResults.length > 0) {
                    const topResult = vectorResults[0];

                    if (topResult.score >= vectorThreshold) {
                        const response = this.selectIntentResponse(topResult.intent);
                        console.log(`✅ Vector match: "${topResult.intentName}" (score: ${topResult.score.toFixed(3)})`);

                        return {
                            found: true,
                            response: response,
                            score: topResult.score,
                            source: 'vector',
                            intentName: topResult.intentName
                        };
                    } else {
                        console.log(`⚠️ Vector score too low: ${topResult.score.toFixed(3)} < ${vectorThreshold}`);
                    }
                }
            } catch (error) {
                console.error('❌ Vector search error:', error.message);
            }
        }

        // 4. Fall back to TF-IDF document search
        if (keywordFallback) {
            const tfidfResults = this.searchChunks(query, 1);
            if (tfidfResults.length > 0 && tfidfResults[0].score > 0.3) {
                return {
                    found: true,
                    response: tfidfResults[0].content,
                    score: tfidfResults[0].score,
                    source: 'tfidf',
                    intentName: 'document'
                };
            }
        }

        // 5. No match found
        return { found: false, response: null, score: 0, source: 'none' };
    }

    /**
     * Basic keyword-based search (substring matching)
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

                if (qNormalized.includes(kwNormalized) || kwNormalized.includes(qNormalized)) {
                    const response = this.selectIntentResponse(intent);
                    console.log(`✅ Keyword match: "${intent.name}" via "${keyword}"`);

                    return {
                        found: true,
                        response: response,
                        score: 0.8,
                        source: 'keyword',
                        intentName: intent.name
                    };
                }
            }

            // Also check against the question field if it exists
            if (intent.question) {
                const intentQ = intent.question.toLowerCase().replace(/[?!.,]/g, '').replace(/\s+/g, ' ').trim();
                if (qNormalized.includes(intentQ) || intentQ.includes(qNormalized)) {
                    const response = this.selectIntentResponse(intent);
                    console.log(`✅ Question match: "${intent.name}"`);
                    return {
                        found: true,
                        response: response,
                        score: 0.85,
                        source: 'question',
                        intentName: intent.name
                    };
                }
            }
        }

        return { found: false, response: null, score: 0, source: 'none' };
    }

    /**
     * Advanced keyword search with word-level matching and fuzzy/typo tolerance
     */
    advancedKeywordSearch(query) {
        const q = query.toLowerCase().trim();
        const qNormalized = q.replace(/[?!.,]/g, '').replace(/\s+/g, ' ').trim();
        const qWords = qNormalized.split(/\s+/).map(w => this._normalizeWord(w));

        for (const intent of this.intents) {
            const hasResponse = (intent.responses && intent.responses.length > 0) || intent.response;
            if (!intent || !hasResponse || !intent.keywords) continue;

            for (const keyword of intent.keywords) {
                const kwNormalized = keyword.toLowerCase().replace(/[?!.,]/g, '').replace(/\s+/g, ' ').trim();
                const kwWords = kwNormalized.split(/\s+/).filter(w => w.length > 2).map(w => this._normalizeWord(w));

                if (kwWords.length === 0) continue;

                const allWordsPresent = kwWords.every(kwWord =>
                    qWords.some(qWord => {
                        if (qWord === kwWord) return true;
                        if (qWord.length > 3 && kwWord.length > 3) {
                            if (qWord.includes(kwWord) || kwWord.includes(qWord)) return true;
                        }
                        if (kwWord.length > 4 && this._levenshtein(qWord, kwWord) <= 1) return true;
                        return false;
                    })
                );

                if (allWordsPresent) {
                    const response = this.selectIntentResponse(intent);
                    console.log(`✅ Advanced keyword match: "${intent.name}" via "${keyword}"`);
                    return {
                        found: true,
                        response: response,
                        score: 0.65,
                        source: 'advanced_keyword',
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

    /**
     * Get top N matches from vector search (regardless of threshold)
     * Used for RAG - letting AI decide relevance
     */
    async getTopMatches(query, limit = 3) {
        if (!embeddingService || !embeddingService.initialized || this.intents.length === 0) {
            // Fall back to keyword-based matches if no embeddings
            if (this.intents.length > 0) {
                return this._getKeywordTopMatches(query, limit);
            }
            console.log('⚠️ No search method available for getTopMatches');
            return [];
        }

        try {
            const vectorResults = await embeddingService.search(query, this.intents, limit);

            return vectorResults.map(result => ({
                intentName: result.intentName,
                response: this.selectIntentResponse(result.intent),
                score: result.score,
                source: 'vector'
            }));
        } catch (error) {
            console.error('❌ getTopMatches error:', error.message);
            // Fall back to keyword matches
            return this._getKeywordTopMatches(query, limit);
        }
    }

    /**
     * Fallback: get top keyword matches when vector search is unavailable
     */
    _getKeywordTopMatches(query, limit = 3) {
        const q = query.toLowerCase().trim().replace(/[?!.,]/g, '').replace(/\s+/g, ' ');
        const qWords = q.split(/\s+/).map(w => this._normalizeWord(w));
        const scored = [];

        for (const intent of this.intents) {
            const hasResponse = (intent.responses && intent.responses.length > 0) || intent.response;
            if (!intent || !hasResponse || !intent.keywords) continue;

            let bestScore = 0;

            for (const keyword of intent.keywords) {
                const kwNormalized = keyword.toLowerCase().replace(/[?!.,]/g, '').replace(/\s+/g, ' ').trim();
                const kwWords = kwNormalized.split(/\s+/).filter(w => w.length > 2).map(w => this._normalizeWord(w));
                if (kwWords.length === 0) continue;

                const matchedCount = kwWords.filter(kwWord =>
                    qWords.some(qWord => qWord === kwWord || (qWord.length > 3 && kwWord.length > 3 && (qWord.includes(kwWord) || kwWord.includes(qWord))))
                ).length;

                const score = matchedCount / kwWords.length;
                if (score > bestScore) bestScore = score;
            }

            if (bestScore > 0.3) {
                scored.push({
                    intentName: intent.name || intent.question || 'Unknown',
                    response: this.selectIntentResponse(intent),
                    score: bestScore,
                    source: 'keyword_fallback'
                });
            }
        }

        return scored.sort((a, b) => b.score - a.score).slice(0, limit);
    }

    // Normalize word (singular/plural)
    _normalizeWord(word) {
        word = word.toLowerCase().trim();
        if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
        return word;
    }

    // Simple Levenshtein distance for typo tolerance
    _levenshtein(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
        }
        return matrix[b.length][a.length];
    }
}

module.exports = new KnowledgeService();
