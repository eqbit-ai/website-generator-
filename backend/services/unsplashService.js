// backend/services/unsplashService.js
// Unsplash API Integration for Context-Aware Images

const UNSPLASH_API_KEY = process.env.UNSPLASH_ACCESS_KEY;
const UNSPLASH_BASE_URL = 'https://api.unsplash.com';

/**
 * Extract relevant keywords from user prompt for image search
 * Enhanced with compound keyword support and better stop word filtering
 */
function extractKeywords(prompt) {
    const stopWords = new Set([
        'a', 'an', 'the', 'for', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'with',
        'of', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
        'website', 'page', 'landing', 'site', 'web', 'create', 'make', 'build', 'design',
        'modern', 'professional', 'premium', 'beautiful', 'stunning', 'need', 'want',
        'please', 'generate', 'give', 'me', 'i', 'my', 'we', 'our', 'us', 'that', 'this',
        'it', 'its', 'they', 'them', 'their', 'just', 'like', 'can', 'get', 'new',
        'about', 'also', 'very', 'really', 'much', 'some', 'good', 'great', 'best',
        'looking', 'something', 'thing', 'things', 'way', 'all', 'each', 'every'
    ]);

    // Check for compound keywords first (preserved as single search terms)
    const compoundKeywords = [
        'real estate', 'ice cream', 'web design', 'graphic design',
        'social media', 'digital marketing', 'machine learning',
        'interior design', 'event planning', 'personal training',
        'hair salon', 'nail salon', 'pet care', 'car wash',
        'food truck', 'co-working', 'coworking', 'fine dining',
        'wedding planner', 'fitness center', 'law firm',
        'dental clinic', 'coffee shop', 'tea house',
        'auto repair', 'car dealer', 'pet grooming',
        'home decor', 'organic food', 'craft beer',
        'yoga studio', 'dance studio', 'music school',
        'art gallery', 'photo studio', 'video production'
    ];

    const p = prompt.toLowerCase();
    const compounds = compoundKeywords.filter(kw => p.includes(kw));

    // Extract single meaningful words
    const words = prompt
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));

    // Remove single words that are already part of compound keywords
    const filteredWords = words.filter(w =>
        !compounds.some(c => c.split(' ').includes(w))
    );

    // Combine: compounds first (more specific), then single words
    const allKeywords = [...compounds, ...filteredWords];

    // Return top 4 keywords for better search accuracy
    return allKeywords.slice(0, 4);
}

/**
 * Get context-aware images from Unsplash based on topic
 */
async function getContextualImages(topic, count = 6) {
    if (!UNSPLASH_API_KEY) {
        console.log('⚠️ Unsplash API key not configured, using fallback');
        return generateFallbackImages(topic, count);
    }

    try {
        const keywords = extractKeywords(topic);
        const searchQuery = keywords.join(' ');

        console.log(`🖼️ Searching Unsplash for: "${searchQuery}"`);

        const response = await fetch(
            `${UNSPLASH_BASE_URL}/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=${count}&orientation=landscape&content_filter=high`,
            {
                headers: {
                    'Authorization': `Client-ID ${UNSPLASH_API_KEY}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Unsplash API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const images = data.results.map(img => ({
                url: img.urls.regular,
                thumb: img.urls.small,
                alt: img.alt_description || img.description || searchQuery,
                photographer: img.user.name,
                photographerUrl: img.user.links.html
            }));

            console.log(`✅ Found ${images.length} Unsplash images`);
            return images;
        } else {
            console.log('⚠️ No Unsplash results, trying broader search');

            // Retry with just the first keyword for broader results
            if (keywords.length > 1) {
                const broadResponse = await fetch(
                    `${UNSPLASH_BASE_URL}/search/photos?query=${encodeURIComponent(keywords[0])}&per_page=${count}&orientation=landscape&content_filter=high`,
                    {
                        headers: {
                            'Authorization': `Client-ID ${UNSPLASH_API_KEY}`
                        }
                    }
                );

                if (broadResponse.ok) {
                    const broadData = await broadResponse.json();
                    if (broadData.results && broadData.results.length > 0) {
                        const images = broadData.results.map(img => ({
                            url: img.urls.regular,
                            thumb: img.urls.small,
                            alt: img.alt_description || img.description || keywords[0],
                            photographer: img.user.name,
                            photographerUrl: img.user.links.html
                        }));

                        console.log(`✅ Found ${images.length} images with broader search`);
                        return images;
                    }
                }
            }

            console.log('⚠️ No results even with broader search, using fallback');
            return generateFallbackImages(topic, count);
        }

    } catch (error) {
        console.error('❌ Unsplash error:', error.message);
        return generateFallbackImages(topic, count);
    }
}

/**
 * Generate reliable fallback images when Unsplash API is unavailable
 * Uses picsum.photos (reliable, free, no API key needed)
 */
function generateFallbackImages(topic, count) {
    const keywords = extractKeywords(topic);
    const seedBase = keywords[0] || 'business';

    const images = [];
    for (let i = 0; i < count; i++) {
        // Use seeded URLs for deterministic images (same keyword = same images)
        const seed = `${seedBase}-${i}`;
        images.push({
            url: `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`,
            thumb: `https://picsum.photos/seed/${encodeURIComponent(seed)}/400/300`,
            alt: `${topic} - professional image ${i + 1}`,
            photographer: 'Picsum',
            photographerUrl: 'https://picsum.photos'
        });
    }

    console.log(`✅ Generated ${images.length} fallback image URLs (picsum.photos)`);
    return images;
}

/**
 * Get hero image for main banner
 */
async function getHeroImage(topic) {
    const images = await getContextualImages(topic, 1);
    return images[0];
}

/**
 * Get gallery images for features/showcase sections
 */
async function getGalleryImages(topic, count = 6) {
    return await getContextualImages(topic, count);
}

module.exports = {
    getContextualImages,
    getHeroImage,
    getGalleryImages,
    extractKeywords
};
