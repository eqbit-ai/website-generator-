// backend/services/unsplashService.js
// Unsplash API Integration for Context-Aware Images

const UNSPLASH_API_KEY = process.env.UNSPLASH_ACCESS_KEY;
const UNSPLASH_BASE_URL = 'https://api.unsplash.com';

/**
 * Extract relevant keywords from user prompt for image search
 */
function extractKeywords(prompt) {
    // Remove common words and extract meaningful keywords
    const stopWords = new Set([
        'a', 'an', 'the', 'for', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'with',
        'website', 'page', 'landing', 'site', 'web', 'create', 'make', 'build', 'design',
        'modern', 'professional', 'premium', 'beautiful', 'stunning'
    ]);

    const words = prompt
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));

    // Return top 3 most relevant keywords
    return words.slice(0, 3);
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
            `${UNSPLASH_BASE_URL}/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=${count}&orientation=landscape`,
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
                alt: img.alt_description || searchQuery,
                photographer: img.user.name,
                photographerUrl: img.user.links.html
            }));

            console.log(`✅ Found ${images.length} Unsplash images`);
            return images;
        } else {
            console.log('⚠️ No Unsplash results, using fallback');
            return generateFallbackImages(topic, count);
        }

    } catch (error) {
        console.error('❌ Unsplash error:', error.message);
        return generateFallbackImages(topic, count);
    }
}

/**
 * Generate fallback Unsplash URLs when API is unavailable
 */
function generateFallbackImages(topic, count) {
    const keywords = extractKeywords(topic);
    const searchTerm = keywords[0] || 'business';

    const images = [];
    for (let i = 0; i < count; i++) {
        images.push({
            url: `https://source.unsplash.com/800x600/?${searchTerm},${keywords[1] || 'professional'},${i}`,
            thumb: `https://source.unsplash.com/400x300/?${searchTerm},${keywords[1] || 'professional'},${i}`,
            alt: `${topic} image ${i + 1}`,
            photographer: 'Unsplash',
            photographerUrl: 'https://unsplash.com'
        });
    }

    console.log(`✅ Generated ${images.length} fallback Unsplash URLs`);
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
