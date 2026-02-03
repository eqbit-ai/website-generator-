// backend/services/embeddingService.js
// OpenAI Vector Embeddings for Semantic Search

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class EmbeddingService {
    constructor() {
        this.openai = null;
        this.embeddings = [];
        this.intentsHash = null;
        this.model = 'text-embedding-3-small';
        this.embeddingsPath = path.join(__dirname, '..', 'data', 'embeddings.json');
        this.initialized = false;
        this.initializing = false;
    }

    /**
     * Initialize the embedding service
     * @param {Array} intents - Array of intent objects from meydan_intents.json
     */
    async init(intents) {
        if (this.initializing) {
            console.log('⏳ Embedding service already initializing...');
            return;
        }

        this.initializing = true;

        try {
            // Initialize OpenAI client
            if (!process.env.OPENAI_API_KEY) {
                console.log('⚠️ Embedding service: OPENAI_API_KEY not set, vector search disabled');
                this.initializing = false;
                return;
            }

            const OpenAI = require('openai');
            this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

            // Calculate hash of current intents
            const currentHash = this.calculateIntentsHash(intents);

            // Try to load cached embeddings
            const cached = this.loadCachedEmbeddings();

            if (cached && cached.intentsHash === currentHash && cached.model === this.model) {
                // Use cached embeddings
                this.embeddings = cached.embeddings;
                this.intentsHash = cached.intentsHash;
                this.initialized = true;
                console.log(`🧠 Embedding service: ${this.embeddings.length} intent embeddings loaded from cache`);
            } else {
                // Generate new embeddings
                console.log('🔄 Embedding service: Generating new embeddings...');
                await this.generateEmbeddings(intents);
                this.intentsHash = currentHash;
                this.saveEmbeddings();
                this.initialized = true;
                console.log(`🧠 Embedding service: ${this.embeddings.length} intent embeddings generated and cached`);
            }
        } catch (error) {
            console.error('❌ Embedding service initialization failed:', error.message);
        } finally {
            this.initializing = false;
        }
    }

    /**
     * Calculate MD5 hash of intents for change detection
     */
    calculateIntentsHash(intents) {
        const content = JSON.stringify(intents.map(i => ({
            name: i.name,
            keywords: i.keywords,
            response: i.response,
            responses: i.responses
        })));
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Load cached embeddings from file
     */
    loadCachedEmbeddings() {
        try {
            if (fs.existsSync(this.embeddingsPath)) {
                const data = JSON.parse(fs.readFileSync(this.embeddingsPath, 'utf-8'));
                return data;
            }
        } catch (error) {
            console.log('⚠️ Could not load cached embeddings:', error.message);
        }
        return null;
    }

    /**
     * Save embeddings to cache file
     */
    saveEmbeddings() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.embeddingsPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            const data = {
                model: this.model,
                intentsHash: this.intentsHash,
                generatedAt: new Date().toISOString(),
                embeddings: this.embeddings
            };

            fs.writeFileSync(this.embeddingsPath, JSON.stringify(data, null, 2));
            console.log(`💾 Embeddings saved to ${this.embeddingsPath}`);
        } catch (error) {
            console.error('❌ Failed to save embeddings:', error.message);
        }
    }

    /**
     * Generate embeddings for all intents
     */
    async generateEmbeddings(intents) {
        this.embeddings = [];

        for (let i = 0; i < intents.length; i++) {
            const intent = intents[i];

            // Skip invalid intents
            const hasResponse = (intent.responses && intent.responses.length > 0) || intent.response;
            if (!intent || !hasResponse || !intent.keywords) continue;

            // Combine keywords and response for richer embedding
            const keywords = intent.keywords.join(', ');
            const response = intent.responses ? intent.responses[0] : intent.response;
            const text = `${intent.name}. Keywords: ${keywords}. ${response}`;

            try {
                const embedding = await this.getEmbedding(text);

                this.embeddings.push({
                    intentName: intent.name,
                    intentIndex: i,
                    text: text.substring(0, 500), // Store truncated text for debugging
                    embedding: embedding,
                    generatedAt: new Date().toISOString()
                });

                // Rate limiting - small delay between API calls
                if (i < intents.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } catch (error) {
                console.error(`❌ Failed to generate embedding for intent "${intent.name}":`, error.message);
            }
        }
    }

    /**
     * Get embedding vector for text using OpenAI API
     */
    async getEmbedding(text) {
        const response = await this.openai.embeddings.create({
            model: this.model,
            input: text,
            encoding_format: 'float'
        });

        return response.data[0].embedding;
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) {
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (normA * normB);
    }

    /**
     * Search for similar intents using vector similarity
     * @param {string} query - The search query
     * @param {Array} intents - The original intents array to get responses from
     * @param {number} limit - Maximum number of results to return
     * @returns {Array} - Array of { intent, score, source: 'vector' }
     */
    async search(query, intents, limit = 3) {
        if (!this.initialized || !this.openai || this.embeddings.length === 0) {
            console.log('⚠️ Embedding service not ready, skipping vector search');
            return [];
        }

        try {
            // Get embedding for the query
            const queryEmbedding = await this.getEmbedding(query);

            // Calculate similarity scores
            const scores = this.embeddings.map((item, index) => ({
                index: item.intentIndex,
                intentName: item.intentName,
                score: this.cosineSimilarity(queryEmbedding, item.embedding)
            }));

            // Sort by score descending
            scores.sort((a, b) => b.score - a.score);

            // Return top results with intents
            const results = scores
                .slice(0, limit)
                .map(s => {
                    const intent = intents[s.index];
                    if (!intent) return null;

                    return {
                        intent: intent,
                        intentName: s.intentName,
                        score: s.score,
                        source: 'vector'
                    };
                })
                .filter(Boolean);

            console.log(`🔍 Vector search for "${query.substring(0, 50)}...": top score ${results[0]?.score?.toFixed(3) || 'N/A'}`);

            return results;
        } catch (error) {
            console.error('❌ Vector search error:', error.message);
            return [];
        }
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            model: this.model,
            embeddingsCount: this.embeddings.length,
            intentsHash: this.intentsHash,
            hasOpenAI: !!this.openai
        };
    }
}

// Export singleton instance
module.exports = new EmbeddingService();
