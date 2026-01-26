// backend/services/knowledgeService.js
// Knowledge Service (TF-IDF based, NO side effects)

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const natural = require('natural');

const TfIdf = natural.TfIdf;

class KnowledgeService {
    constructor() {
        this.tfidf = new TfIdf();
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
            chunks: db.chunks.getAll().length
        };
    }
}

module.exports = new KnowledgeService();
