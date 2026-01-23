// backend/services/knowledgeService.js

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const natural = require('natural');

const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();

class KnowledgeService {
    constructor() {
        this.tfidf = new TfIdf();
        this.loadChunksIntoTfIdf();
    }

    loadChunksIntoTfIdf() {
        const chunks = db.chunks.getAll();
        chunks.forEach(chunk => {
            this.tfidf.addDocument(chunk.content, chunk.id);
        });
        console.log(`📚 Loaded ${chunks.length} knowledge chunks into memory`);
    }

    splitIntoChunks(text, maxChunkSize = 500, overlap = 50) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const chunks = [];
        let currentChunk = '';
        let currentTokens = 0;

        for (const sentence of sentences) {
            const sentenceTokens = tokenizer.tokenize(sentence).length;

            if (currentTokens + sentenceTokens > maxChunkSize && currentChunk) {
                chunks.push({
                    content: currentChunk.trim(),
                    tokens: currentTokens
                });

                const words = currentChunk.split(' ');
                currentChunk = words.slice(-overlap).join(' ') + ' ' + sentence;
                currentTokens = tokenizer.tokenize(currentChunk).length;
            } else {
                currentChunk += ' ' + sentence;
                currentTokens += sentenceTokens;
            }
        }

        if (currentChunk.trim()) {
            chunks.push({
                content: currentChunk.trim(),
                tokens: currentTokens
            });
        }

        return chunks;
    }

    addDocument(documentId, filename, originalName, fileType, fileSize, content) {
        // Save document
        db.documents.insert({
            id: documentId,
            filename,
            original_name: originalName,
            file_type: fileType,
            file_size: fileSize,
            uploaded_at: new Date().toISOString()
        });

        // Split and save chunks
        const textChunks = this.splitIntoChunks(content);

        textChunks.forEach((chunk, index) => {
            const chunkId = uuidv4();
            db.chunks.insert({
                id: chunkId,
                document_id: documentId,
                content: chunk.content,
                chunk_index: index,
                tokens: chunk.tokens,
                created_at: new Date().toISOString()
            });
            this.tfidf.addDocument(chunk.content, chunkId);
        });

        return {
            documentId,
            chunksCreated: textChunks.length
        };
    }

    searchChunks(query, topK = 5) {
        const results = [];

        this.tfidf.tfidfs(query, (i, measure, key) => {
            if (measure > 0) {
                results.push({ chunkId: key, score: measure });
            }
        });

        results.sort((a, b) => b.score - a.score);
        const topResults = results.slice(0, topK);

        if (topResults.length === 0) {
            return [];
        }

        return topResults.map(result => {
            const chunk = db.chunks.getById(result.chunkId);
            if (!chunk) return null;

            const doc = db.documents.getById(chunk.document_id);
            return {
                id: chunk.id,
                content: chunk.content,
                chunk_index: chunk.chunk_index,
                source: doc?.original_name || 'Unknown',
                score: result.score
            };
        }).filter(Boolean);
    }

    getAllDocuments() {
        const documents = db.documents.getAll();
        return documents.map(doc => ({
            ...doc,
            chunk_count: db.chunks.filterBy('document_id', doc.id).length
        })).sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
    }

    deleteDocument(documentId) {
        // Delete chunks
        const chunks = db.chunks.filterBy('document_id', documentId);
        chunks.forEach(chunk => db.chunks.delete(chunk.id));

        // Delete document
        db.documents.delete(documentId);

        // Rebuild TF-IDF
        this.tfidf = new TfIdf();
        this.loadChunksIntoTfIdf();
    }

    getStats() {
        const documents = db.documents.getAll();
        const chunks = db.chunks.getAll();
        const totalTokens = chunks.reduce((sum, c) => sum + (c.tokens || 0), 0);

        return {
            documents: documents.length,
            chunks: chunks.length,
            totalTokens
        };
    }
}

module.exports = new KnowledgeService();