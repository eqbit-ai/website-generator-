// backend/services/unsplashService.js
// Unsplash API Integration for Context-Aware Images

const UNSPLASH_API_KEY = process.env.UNSPLASH_ACCESS_KEY;
const UNSPLASH_BASE_URL = 'https://api.unsplash.com';

/**
 * Niche-specific search queries that return HIGH QUALITY, relevant images
 * These override raw prompt keywords to avoid bad results (fast food logos, stock clip art, etc.)
 */
const NICHE_SEARCH_QUERIES = {
    restaurant: [
        'gourmet food plating fine dining',
        'restaurant interior ambient lighting',
        'chef cooking professional kitchen',
        'elegant table setting restaurant',
        'fresh ingredients cooking',
        'wine glass fine dining',
        'dessert plating gourmet',
        'restaurant exterior night'
    ],
    technology: [
        'modern office workspace technology',
        'developer coding laptop',
        'data visualization dashboard',
        'server room technology',
        'team meeting modern office',
        'abstract technology gradient',
        'smartphone app interface',
        'startup office workspace'
    ],
    fitness: [
        'gym workout equipment weights',
        'fitness training person gym',
        'crossfit class group workout',
        'personal trainer coaching client',
        'running athlete fitness outdoors',
        'weightlifting barbell strength',
        'gym interior modern equipment',
        'yoga class stretching fitness'
    ],
    health: [
        'doctor patient consultation',
        'modern medical clinic interior',
        'wellness spa treatment',
        'healthy food nutrition lifestyle',
        'dental clinic modern',
        'medical team professional',
        'therapy session calm',
        'pharmacy medicine healthcare'
    ],
    legal: [
        'law office professional interior',
        'lawyer courthouse professional',
        'legal books library',
        'business handshake professional',
        'modern office building exterior',
        'conference room meeting',
        'city skyline business district',
        'professional portrait business'
    ],
    pets: [
        'cute dogs playing park',
        'kittens adorable pets',
        'pet store interior colorful',
        'veterinarian dog checkup',
        'dog playing fetch outdoors',
        'pet grooming salon dog',
        'tropical aquarium fish',
        'puppies golden retriever'
    ],
    beauty: [
        'salon interior modern elegant',
        'hair styling professional salon',
        'makeup artist beauty studio',
        'nail art manicure elegant',
        'spa facial treatment relaxing',
        'barbershop classic interior',
        'beauty products cosmetics display',
        'salon chair mirror station'
    ],
    homeservices: [
        'plumber fixing pipes repair',
        'electrician wiring professional',
        'house cleaning spotless home',
        'landscaping garden beautiful',
        'roof repair construction worker',
        'handyman tools workshop',
        'pressure washing exterior house',
        'painting walls home interior'
    ],
    church: [
        'church interior stained glass',
        'worship service community',
        'community gathering volunteers',
        'church exterior architecture',
        'peaceful prayer meditation',
        'choir singing worship',
        'bible study group people',
        'volunteers community service'
    ],
    sports: [
        'soccer field match game',
        'swimming pool lanes sports',
        'tennis court match playing',
        'basketball court game action',
        'sports team celebration',
        'golf course green landscape',
        'running track athletics',
        'sports facility gym modern'
    ],
    food: [
        'food truck colorful street',
        'ice cream cone scoops',
        'fresh juice bar colorful',
        'artisan bakery bread pastry',
        'dessert plating beautiful',
        'smoothie bowl tropical fruits',
        'chocolate pastry gourmet',
        'donut shop colorful display'
    ],
    consulting: [
        'business strategy meeting professional',
        'consultant presentation boardroom',
        'corporate office modern interior',
        'handshake professional deal',
        'whiteboard planning strategy',
        'executive portrait professional',
        'team collaboration workspace',
        'conference room modern meeting'
    ],
    ecommerce: [
        'product photography minimal',
        'online shopping lifestyle',
        'fashion model editorial',
        'jewelry product photography',
        'packaging design minimal',
        'clothing flat lay photography',
        'luxury product display',
        'retail store modern interior'
    ],
    realestate: [
        'luxury home interior design',
        'modern house exterior architecture',
        'apartment living room stylish',
        'real estate aerial neighborhood',
        'kitchen interior modern design',
        'swimming pool luxury home',
        'bedroom interior elegant',
        'house exterior garden'
    ],
    education: [
        'students studying university',
        'classroom modern learning',
        'graduation ceremony celebration',
        'library books studying',
        'online learning laptop',
        'campus university building',
        'teacher classroom education',
        'workshop training group'
    ],
    creative: [
        'creative studio workspace',
        'photographer camera artistic',
        'design studio interior',
        'art gallery modern exhibition',
        'creative team brainstorming',
        'graphic design workspace',
        'painting art creative',
        'music studio recording'
    ],
    finance: [
        'financial district skyline',
        'business meeting corporate',
        'stock market trading chart',
        'office modern corporate',
        'handshake business deal',
        'calculator financial planning',
        'professional portrait corporate',
        'city business downtown'
    ],
    travel: [
        'tropical beach paradise vacation',
        'mountain landscape adventure',
        'luxury resort pool',
        'cultural landmark travel destination',
        'airplane window sky travel',
        'hotel room luxury interior',
        'scenic landscape nature travel',
        'city tourism landmark'
    ],
    nonprofit: [
        'community volunteer helping',
        'diverse group people community',
        'charity work helping hands',
        'children education developing',
        'nature environment conservation',
        'humanitarian aid community',
        'team volunteer outdoor',
        'community garden people'
    ],
    automotive: [
        'luxury car showroom',
        'sports car road driving',
        'car dealership modern',
        'mechanic auto repair workshop',
        'car detail photography',
        'modern car interior dashboard',
        'car wash detailing',
        'motorcycle road adventure'
    ],
    wedding: [
        'wedding ceremony elegant',
        'bride bouquet wedding',
        'wedding venue decoration',
        'wedding couple romantic',
        'wedding table setting elegant',
        'wedding cake beautiful',
        'bridesmaids celebration',
        'wedding rings closeup'
    ],
    gaming: [
        'gaming setup rgb lighting',
        'esports tournament competition',
        'gaming controller neon',
        'gaming pc setup desk',
        'virtual reality gaming',
        'gaming headset player',
        'gaming room neon lights',
        'retro arcade gaming'
    ]
};

/**
 * Extract relevant keywords from user prompt for image search
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
        'looking', 'something', 'thing', 'things', 'way', 'all', 'each', 'every',
        'photography', 'gallery', 'photos', 'photo', 'images', 'image', 'pictures'
    ]);

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
        'art gallery', 'photo studio', 'video production',
        'pet shop', 'pet store'
    ];

    const p = prompt.toLowerCase();
    const compounds = compoundKeywords.filter(kw => p.includes(kw));

    const words = prompt
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));

    const filteredWords = words.filter(w =>
        !compounds.some(c => c.split(' ').includes(w))
    );

    const allKeywords = [...compounds, ...filteredWords];
    return allKeywords.slice(0, 4);
}

/**
 * Get context-aware images from Unsplash based on topic and niche
 * Uses niche-specific search queries for much better image quality
 */
async function getContextualImages(topic, count = 6, nicheName = null) {
    if (!UNSPLASH_API_KEY) {
        console.log('⚠️ Unsplash API key not configured, using fallback');
        return generateFallbackImages(topic, count);
    }

    try {
        // Use niche-specific curated search queries when available
        const nicheQueries = nicheName ? NICHE_SEARCH_QUERIES[nicheName] : null;

        if (nicheQueries && nicheQueries.length > 0) {
            console.log(`🖼️ Using niche-specific queries for: ${nicheName}`);
            return await fetchNicheImages(nicheQueries, count);
        }

        // Fallback: keyword-based search from prompt
        const keywords = extractKeywords(topic);
        const searchQuery = keywords.join(' ');

        console.log(`🖼️ Searching Unsplash for: "${searchQuery}"`);
        return await fetchFromUnsplash(searchQuery, count, keywords);

    } catch (error) {
        console.error('❌ Unsplash error:', error.message);
        return generateFallbackImages(topic, count);
    }
}

/**
 * Fetch images using niche-specific curated queries
 * Makes multiple targeted searches for diverse, high-quality results
 */
async function fetchNicheImages(queries, count) {
    const images = [];
    const usedUrls = new Set();
    // Shuffle queries for variety
    const shuffled = [...queries].sort(() => Math.random() - 0.5);

    // First pass: 1 image per query for diversity
    for (const query of shuffled) {
        if (images.length >= count) break;

        try {
            const response = await fetch(
                `${UNSPLASH_BASE_URL}/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape&content_filter=high&order_by=relevant`,
                {
                    headers: {
                        'Authorization': `Client-ID ${UNSPLASH_API_KEY}`
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    // Pick the first image not already used
                    for (const img of data.results) {
                        if (!usedUrls.has(img.urls.regular)) {
                            usedUrls.add(img.urls.regular);
                            images.push({
                                url: img.urls.regular,
                                thumb: img.urls.small,
                                alt: img.alt_description || img.description || query,
                                photographer: img.user.name,
                                photographerUrl: img.user.links.html
                            });
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            console.log(`⚠️ Query "${query}" failed:`, e.message);
        }
    }

    // Second pass: fill remaining slots if we didn't get enough
    if (images.length < count) {
        for (const query of shuffled) {
            if (images.length >= count) break;
            try {
                const response = await fetch(
                    `${UNSPLASH_BASE_URL}/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&content_filter=high&order_by=relevant`,
                    {
                        headers: { 'Authorization': `Client-ID ${UNSPLASH_API_KEY}` }
                    }
                );
                if (response.ok) {
                    const data = await response.json();
                    for (const img of (data.results || [])) {
                        if (images.length >= count) break;
                        if (!usedUrls.has(img.urls.regular)) {
                            usedUrls.add(img.urls.regular);
                            images.push({
                                url: img.urls.regular,
                                thumb: img.urls.small,
                                alt: img.alt_description || img.description || query,
                                photographer: img.user.name,
                                photographerUrl: img.user.links.html
                            });
                        }
                    }
                }
            } catch (e) { /* skip */ }
        }
    }

    if (images.length > 0) {
        console.log(`✅ Found ${images.length} niche-specific Unsplash images`);
        return images;
    }

    console.log('⚠️ Niche queries returned no results, trying general search');
    return await fetchFromUnsplash(queries[0], count, []);
}

/**
 * Standard Unsplash search with keyword fallback
 */
async function fetchFromUnsplash(searchQuery, count, keywords) {
    const response = await fetch(
        `${UNSPLASH_BASE_URL}/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=${count}&orientation=landscape&content_filter=high&order_by=relevant`,
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
    }

    // Retry with just the first keyword for broader results
    if (keywords && keywords.length > 1) {
        console.log('⚠️ No results, trying broader search with:', keywords[0]);
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
                return broadData.results.map(img => ({
                    url: img.urls.regular,
                    thumb: img.urls.small,
                    alt: img.alt_description || img.description || keywords[0],
                    photographer: img.user.name,
                    photographerUrl: img.user.links.html
                }));
            }
        }
    }

    console.log('⚠️ No results, using fallback');
    return generateFallbackImages(searchQuery, count);
}

/**
 * Generate reliable fallback images when Unsplash API is unavailable
 */
function generateFallbackImages(topic, count) {
    const keywords = extractKeywords(topic);
    const seedBase = keywords[0] || 'business';

    const images = [];
    for (let i = 0; i < count; i++) {
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
async function getHeroImage(topic, nicheName = null) {
    const images = await getContextualImages(topic, 1, nicheName);
    return images[0];
}

/**
 * Get gallery images for features/showcase sections
 */
async function getGalleryImages(topic, count = 6, nicheName = null) {
    return await getContextualImages(topic, count, nicheName);
}

module.exports = {
    getContextualImages,
    getHeroImage,
    getGalleryImages,
    extractKeywords
};
