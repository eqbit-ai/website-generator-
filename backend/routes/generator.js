// backend/routes/generator.js
// AI-Driven Premium Website Generator with Design System & Niche Intelligence

const express = require('express');
const router = express.Router();
const unsplashService = require('../services/unsplashService');

let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
    try {
        const Anthropic = require('@anthropic-ai/sdk');
        anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 10 * 60 * 1000 });
        console.log('✅ Generator: Anthropic ready');
    } catch (e) {
        console.log('⚠️ Generator: Anthropic not available');
    }
}

// Session storage with TTL cleanup
const designSessions = new Map();
const SESSION_TTL = 2 * 60 * 60 * 1000; // 2 hours
const SESSION_CLEANUP_INTERVAL = 30 * 60 * 1000; // Every 30 minutes

setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, session] of designSessions.entries()) {
        const age = now - new Date(session.createdAt).getTime();
        if (age > SESSION_TTL) {
            designSessions.delete(id);
            cleaned++;
        }
    }
    if (cleaned > 0) console.log(`🧹 Generator: Cleaned ${cleaned} expired sessions (${designSessions.size} active)`);
}, SESSION_CLEANUP_INTERVAL);

// ============================================
// NICHE DETECTION — Map business type to design parameters
// ============================================
function detectNiche(prompt) {
    const p = prompt.toLowerCase();

    const niches = [
        {
            name: 'restaurant',
            keywords: ['restaurant', 'food', 'cafe', 'bakery', 'pizza', 'sushi', 'dining', 'bistro', 'grill', 'kitchen', 'catering', 'chef', 'menu', 'bar', 'pub', 'brewery', 'coffee shop', 'tea house', 'patisserie', 'deli', 'diner', 'eatery', 'steakhouse', 'buffet'],
            design: {
                colors: 'Warm palette: deep burgundy (#722F37), warm amber (#D4A853), terracotta (#C76B4A), olive (#6B7B3A), cream background (#FDF8F0). NEVER use cold blues.',
                fonts: 'Heading: Playfair Display (weight 700, 800). Body: Lato (weight 300, 400). Import both from Google Fonts.',
                imagery: 'Close-up food photography, warm restaurant interiors with ambient lighting, plated dishes, fresh ingredients.',
                mood: 'Warm, inviting, appetizing, cozy, sophisticated.'
            }
        },
        {
            name: 'technology',
            keywords: ['tech', 'software', 'saas', 'app', 'startup', 'ai', 'artificial intelligence', 'cloud', 'platform', 'digital', 'cyber', 'data', 'analytics', 'automation', 'api', 'developer', 'code', 'machine learning', 'blockchain', 'devops', 'fintech'],
            design: {
                colors: 'Cool palette: electric indigo (#6366F1), deep navy (#0F172A), cyan accent (#06B6D4), subtle gray surfaces (#1E293B, #334155). Neon gradients on dark backgrounds.',
                fonts: 'Heading: Inter (weight 700, 800) or Space Grotesk (weight 600, 700). Body: Inter (weight 400). Import from Google Fonts.',
                imagery: 'Abstract tech visuals, gradient abstract shapes, dashboard mockups, minimal geometric illustrations.',
                mood: 'Cutting-edge, futuristic, clean, innovative, trustworthy.'
            }
        },
        {
            name: 'health',
            keywords: ['health', 'medical', 'doctor', 'clinic', 'hospital', 'dental', 'dentist', 'therapy', 'therapist', 'wellness', 'fitness', 'gym', 'yoga', 'spa', 'nutrition', 'pharmacy', 'physiotherapy', 'mental health', 'skincare', 'dermatology'],
            design: {
                colors: 'Calming palette: soft teal (#0D9488), gentle sage (#86EFAC), clean white (#FFFFFF), light mint surface (#F0FDF4), warm blue accent (#3B82F6). Avoid harsh reds.',
                fonts: 'Heading: Nunito (weight 700, 800). Body: Open Sans (weight 400). Import from Google Fonts.',
                imagery: 'Smiling medical professionals, clean clinical spaces, nature/wellness imagery, people exercising, calming environments.',
                mood: 'Trustworthy, clean, calming, professional, caring.'
            }
        },
        {
            name: 'legal',
            keywords: ['law', 'legal', 'attorney', 'lawyer', 'firm', 'advocate', 'justice', 'court', 'litigation', 'paralegal', 'barrister', 'solicitor', 'notary'],
            design: {
                colors: 'Authoritative palette: deep navy (#1E3A5F), charcoal (#2D3748), gold accent (#C9A84C), rich mahogany (#6B3A2A), ivory surface (#FFFFF0).',
                fonts: 'Heading: Libre Baskerville (weight 700) or Cormorant Garamond (weight 600, 700). Body: Source Sans 3 (weight 400). Import from Google Fonts.',
                imagery: 'Professional office interiors, confident attorneys, cityscapes, law books, scales of justice.',
                mood: 'Authoritative, trustworthy, sophisticated, established, prestigious.'
            }
        },
        {
            name: 'ecommerce',
            keywords: ['shop', 'store', 'ecommerce', 'e-commerce', 'product', 'buy', 'sell', 'retail', 'fashion', 'clothing', 'jewelry', 'accessories', 'marketplace', 'boutique', 'brand', 'apparel', 'shoes', 'cosmetics'],
            design: {
                colors: 'Clean palette: pure white surface (#FFFFFF), light gray (#F8FAFC), bold CTA (coral #FF6B6B or emerald #10B981), charcoal text (#1A1A2E). Minimal, let products shine.',
                fonts: 'Heading: Montserrat (weight 600, 700) or Poppins (weight 600, 700). Body: Inter (weight 400). Import from Google Fonts.',
                imagery: 'Clean product photography on white backgrounds, lifestyle shots, model photography, flat lay compositions.',
                mood: 'Clean, shoppable, visual-first, conversion-focused, modern.'
            }
        },
        {
            name: 'realestate',
            keywords: ['real estate', 'property', 'realty', 'homes', 'apartment', 'housing', 'mortgage', 'broker', 'agent', 'listing', 'rental', 'construction', 'builder', 'architect', 'interior design'],
            design: {
                colors: 'Sophisticated palette: slate blue (#475569), warm gold (#D4A853), clean white (#FFFFFF), charcoal (#1E293B), soft warm gray surface (#F8F6F3).',
                fonts: 'Heading: DM Serif Display (weight 400) or Playfair Display (weight 700). Body: Work Sans (weight 400) or Poppins (weight 400). Import from Google Fonts.',
                imagery: 'Luxury property exteriors, modern interiors, aerial neighborhood views, architectural details, happy families.',
                mood: 'Prestigious, aspirational, trustworthy, professional, warm.'
            }
        },
        {
            name: 'education',
            keywords: ['school', 'university', 'college', 'education', 'academy', 'learning', 'course', 'training', 'tutor', 'student', 'e-learning', 'online class', 'institute', 'coaching', 'workshop'],
            design: {
                colors: 'Energetic palette: vibrant blue (#3B82F6), warm orange accent (#F59E0B), fresh green (#22C55E), clean white (#FFFFFF), light blue surface (#EFF6FF).',
                fonts: 'Heading: Nunito (weight 700, 800) or Quicksand (weight 600, 700). Body: Open Sans (weight 400). Import from Google Fonts.',
                imagery: 'Students learning collaboratively, campus life, classrooms, graduation, books, digital learning.',
                mood: 'Inspiring, accessible, growth-oriented, welcoming, energetic.'
            }
        },
        {
            name: 'creative',
            keywords: ['portfolio', 'designer', 'photographer', 'artist', 'creative', 'studio', 'agency', 'graphic design', 'illustration', 'video', 'film', 'animation', 'music', 'band', 'gallery', 'freelance'],
            design: {
                colors: 'Bold palette: monochrome base (pure black #000000, white #FFFFFF) with ONE striking accent. OR unexpected pairings. Dark backgrounds to showcase work.',
                fonts: 'Heading: Space Grotesk (weight 500, 700) or Syne (weight 600, 700, 800). Body: DM Sans (weight 400). Import from Google Fonts.',
                imagery: 'Portfolio pieces, creative process shots, studio environments, artistic close-ups, work samples.',
                mood: 'Creative, bold, distinctive, visual-first, minimal, edgy.'
            }
        },
        {
            name: 'finance',
            keywords: ['finance', 'bank', 'investment', 'insurance', 'accounting', 'tax', 'wealth', 'fintech', 'crypto', 'trading', 'fund', 'capital', 'advisory', 'consultant'],
            design: {
                colors: 'Trust palette: deep blue (#1E40AF), forest green (#166534), silver-gray (#94A3B8), subtle gold (#B8860B), clean white surface (#FFFFFF).',
                fonts: 'Heading: DM Serif Display (weight 400) or Merriweather (weight 700). Body: Inter (weight 400). Import from Google Fonts.',
                imagery: 'Modern offices, financial charts/growth imagery, handshakes, city skylines, professional team photos.',
                mood: 'Trustworthy, stable, professional, growth-oriented, secure.'
            }
        },
        {
            name: 'travel',
            keywords: ['travel', 'hotel', 'resort', 'tourism', 'vacation', 'flight', 'booking', 'adventure', 'tour', 'cruise', 'destination', 'hostel', 'lodge', 'trip'],
            design: {
                colors: 'Vibrant palette: ocean blue (#0EA5E9), sunset coral (#FB923C), sandy warm (#D4A574), lush green (#16A34A), warm white surface (#FFFBF5).',
                fonts: 'Heading: Playfair Display (weight 700) or Josefin Sans (weight 600, 700). Body: Lato (weight 400). Import from Google Fonts.',
                imagery: 'Stunning landscapes, beach scenes, cultural landmarks, people exploring, aerial destination views.',
                mood: 'Adventurous, aspirational, warm, exciting, luxurious.'
            }
        },
        {
            name: 'nonprofit',
            keywords: ['nonprofit', 'non-profit', 'charity', 'foundation', 'ngo', 'donation', 'volunteer', 'cause', 'community', 'humanitarian', 'social impact', 'welfare'],
            design: {
                colors: 'Hopeful palette: warm earth tones (#92400E), vibrant orange (#EA580C), deep teal (#0F766E), warm cream surface (#FEF3C7), trust blue (#2563EB).',
                fonts: 'Heading: Nunito (weight 700) or Merriweather (weight 700). Body: Source Sans 3 (weight 400). Import from Google Fonts.',
                imagery: 'People being helped, community activities, volunteers in action, impactful moments, diverse groups, nature.',
                mood: 'Compassionate, hopeful, trustworthy, impactful, warm, inspiring.'
            }
        },
        {
            name: 'automotive',
            keywords: ['car', 'auto', 'vehicle', 'motor', 'dealer', 'dealership', 'garage', 'mechanic', 'motorcycle', 'truck', 'fleet', 'detailing', 'racing'],
            design: {
                colors: 'Bold palette: jet black (#0A0A0A), racing red (#DC2626), metallic silver (#CBD5E1), midnight blue (#1E293B). High contrast, dramatic.',
                fonts: 'Heading: Rajdhani (weight 600, 700) or Oswald (weight 500, 600). Body: Inter (weight 400) or Roboto (weight 400). Import from Google Fonts.',
                imagery: 'Sleek vehicle photography, showroom interiors, road/racing scenes, engine details, dramatic angles.',
                mood: 'Dynamic, powerful, sleek, premium, exciting, bold.'
            }
        },
        {
            name: 'wedding',
            keywords: ['wedding', 'bridal', 'event planning', 'florist', 'venue', 'celebration', 'planner', 'marriage', 'engagement'],
            design: {
                colors: 'Romantic palette: blush pink (#FBCFE8), soft gold (#D4A853), ivory (#FFFFF0), sage green (#86EFAC), champagne (#F5E6CC).',
                fonts: 'Heading: Cormorant Garamond (weight 500, 600) or Playfair Display (weight 400, 700). Body: Lato (weight 300, 400). Import from Google Fonts.',
                imagery: 'Elegant wedding scenes, floral arrangements, couples, venues, decorations, ceremony details.',
                mood: 'Romantic, elegant, timeless, joyful, dreamy, sophisticated.'
            }
        },
        {
            name: 'gaming',
            keywords: ['gaming', 'esports', 'game', 'gamer', 'stream', 'twitch', 'xbox', 'playstation', 'nintendo', 'rpg', 'mmorpg'],
            design: {
                colors: 'Electric palette: neon purple (#A855F7), electric cyan (#22D3EE), hot pink (#EC4899), deep black (#09090B), dark surface (#18181B). Glowing neon effects.',
                fonts: 'Heading: Rajdhani (weight 700) or Orbitron (weight 700, 800). Body: Inter (weight 400). Import from Google Fonts.',
                imagery: 'Gaming setups, esports events, game screenshots, controllers, neon-lit environments.',
                mood: 'High-energy, futuristic, bold, immersive, competitive, electric.'
            }
        }
    ];

    for (const niche of niches) {
        if (niche.keywords.some(kw => p.includes(kw))) {
            console.log(`🎯 Niche detected: ${niche.name}`);
            return niche;
        }
    }

    return {
        name: 'general',
        design: {
            colors: 'Analyze the business type and choose psychologically appropriate colors. Apply the 60-30-10 rule: 60% dominant surface color, 30% secondary, 10% accent for CTAs.',
            fonts: 'Choose two complementary Google Fonts — one distinctive heading font (personality) and one highly readable body font (clarity). Import both.',
            imagery: 'Professional, relevant imagery that matches the business context and target audience.',
            mood: 'Professional, polished, trustworthy, modern.'
        }
    };
}

// ============================================
// DESIGN TOKEN SYSTEM
// ============================================
const DESIGN_SYSTEM = `
MANDATORY DESIGN TOKEN SYSTEM — You MUST define these CSS custom properties in :root BEFORE any other styles:

:root {
  /* Font Families — choose Google Fonts based on niche */
  --font-heading: '[heading font name]', [serif/sans-serif fallback];
  --font-body: '[body font name]', sans-serif;

  /* Type Scale (Major Third 1.25 ratio) — use these for ALL font sizes */
  --text-xs: 0.75rem;    /* 12px — captions, fine print */
  --text-sm: 0.875rem;   /* 14px — small labels, metadata */
  --text-base: 1rem;     /* 16px — body text baseline */
  --text-lg: 1.125rem;   /* 18px — emphasized body, lead text */
  --text-xl: 1.25rem;    /* 20px — large body, card titles */
  --text-2xl: 1.5rem;    /* 24px — section subtitles */
  --text-3xl: 1.875rem;  /* 30px — small section headings */
  --text-4xl: 2.25rem;   /* 36px — section headings */
  --text-5xl: 3rem;      /* 48px — page headings */
  --text-6xl: 3.75rem;   /* 60px — hero heading mobile */
  --text-7xl: 4.5rem;    /* 72px — hero heading desktop */

  /* Spacing Scale (4px base unit) — use these for ALL margin, padding, gap */
  --space-1: 0.25rem;    /* 4px */
  --space-2: 0.5rem;     /* 8px */
  --space-3: 0.75rem;    /* 12px */
  --space-4: 1rem;       /* 16px */
  --space-5: 1.25rem;    /* 20px */
  --space-6: 1.5rem;     /* 24px */
  --space-8: 2rem;       /* 32px */
  --space-10: 2.5rem;    /* 40px */
  --space-12: 3rem;      /* 48px */
  --space-16: 4rem;      /* 64px */
  --space-20: 5rem;      /* 80px */
  --space-24: 6rem;      /* 96px */
  --space-32: 8rem;      /* 128px */

  /* Color System — 60-30-10 Rule — fill in based on niche/mood */
  --color-primary: ;         /* Brand color for CTAs, links, highlights */
  --color-primary-light: ;   /* Lighter tint — hovers, active states, soft backgrounds */
  --color-primary-dark: ;    /* Darker shade — text on light surfaces, pressed states */
  --color-secondary: ;       /* Supporting color — 30% of visual weight */
  --color-accent: ;          /* Pop color — 10% — attention-grabbing highlights */
  --color-bg: ;              /* Page background */
  --color-surface: ;         /* Cards, panels, elevated content */
  --color-surface-alt: ;     /* Alternating section backgrounds */
  --color-text: ;            /* Primary text */
  --color-text-muted: ;      /* Secondary/supporting text */
  --color-text-inverse: ;    /* Text on dark or colored backgrounds */
  --color-border: ;          /* Subtle borders and dividers */

  /* Elevation — consistent shadow system */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);

  /* Border Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --radius-full: 9999px;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Layout */
  --container-max: 1280px;
  --section-spacing: var(--space-24);
}

TOKEN USAGE RULES — MANDATORY:
- ALWAYS use var(--token) in CSS — NEVER hardcode px, rem, or color values
- Every heading: font-family: var(--font-heading) + appropriate --text-* size
- Every body text: font-family: var(--font-body) + --text-base or --text-lg
- Every spacing: var(--space-*) for margin, padding, gap
- Every color: var(--color-*) tokens
- Every shadow: var(--shadow-*) tokens
- Every border-radius: var(--radius-*) tokens
- Every transition: var(--transition-*) tokens
- Container: max-width: var(--container-max) with margin: 0 auto
- Section padding: var(--section-spacing) 0
`;

// ============================================
// OUTPUT SANITIZER — Strip artifacts, validate clean output
// ============================================
function sanitizeOutput(html, css, js) {
    const stripArtifacts = (str) => str
        .replace(/<!--\s*HTML\s*-->/gi, '')
        .replace(/\/\*\s*CSS\s*\*\//gi, '')
        .replace(/\/\/\s*JavaScript\s*/gi, '')
        .replace(/```(?:html|css|javascript|js)?\s*/gi, '')
        .replace(/```\s*/g, '');

    html = stripArtifacts(html).trim();
    css = stripArtifacts(css).trim();
    js = stripArtifacts(js).trim();

    // Remove AI explanation text before first HTML tag
    if (html && !html.startsWith('<')) {
        const firstTag = html.indexOf('<');
        if (firstTag > 0) {
            html = html.substring(firstTag);
        }
    }

    // Remove AI explanation text after last HTML closing tag
    if (html) {
        const lastTag = html.lastIndexOf('>');
        if (lastTag !== -1) {
            const remainder = html.substring(lastTag + 1).trim();
            if (remainder && !/^</.test(remainder)) {
                html = html.substring(0, lastTag + 1);
            }
        }
    }

    // Remove <html>, <head>, <body>, <meta>, <!DOCTYPE> tags from HTML (Preview.jsx handles these)
    html = html
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<\/?html[^>]*>/gi, '')
        .replace(/<\/?head[^>]*>/gi, '')
        .replace(/<\/?body[^>]*>/gi, '')
        .replace(/<meta[^>]*\/?>/gi, '')
        .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');

    // Remove @charset from CSS (unnecessary in <style> tags)
    css = css.replace(/@charset\s+["'][^"']*["']\s*;?/gi, '');

    return { html: html.trim(), css: css.trim(), js: js.trim() };
}

// Fix escaped HTML that appears as text
function fixEscapedHtml(content) {
    if (!content) return content;
    return content
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

// Create or get session
function getSession(sessionId) {
    if (!sessionId) {
        sessionId = 'gen_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    if (!designSessions.has(sessionId)) {
        designSessions.set(sessionId, {
            id: sessionId,
            conversationHistory: [],
            currentDesign: null,
            style: null,
            palette: null,
            niche: null,
            createdAt: new Date().toISOString()
        });
    }

    return designSessions.get(sessionId);
}

// Check if user wants a new design
function wantsNewDesign(prompt) {
    const p = prompt.toLowerCase().trim();

    const explicitKeywords = [
        'new design', 'start over', 'create new', 'make new',
        'different design', 'another design', 'fresh design',
        'from scratch', 'redesign', 'rebuild'
    ];
    if (explicitKeywords.some(keyword => p.includes(keyword))) return true;

    const fullWebsitePatterns = [
        /(?:need|want|give|create|build|make|design|generate)\s+(?:a|an|me\s+a)\s+.*(?:website|site|page|portfolio|landing|homepage|blog)/i,
        /(?:website|site|page|portfolio|landing|homepage|blog)\s+(?:for|about|with)\s+/i,
        /(?:dark|light|modern|minimal|futuristic|elegant|professional|creative)\s+.*(?:website|site|page|portfolio|design)/i
    ];
    if (fullWebsitePatterns.some(pattern => pattern.test(p))) return true;

    return false;
}

// ============================================
// GENERATE WEBSITE
// ============================================
router.post('/generate', async (req, res) => {
    try {
        const { prompt, sessionId } = req.body;

        if (!prompt || !prompt.trim()) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        if (!anthropic) {
            return res.status(500).json({ error: 'AI service not available' });
        }

        // 8 minute timeout for safety
        req.setTimeout(480000);
        res.setTimeout(480000);

        const session = getSession(sessionId);
        const isNewDesign = !session.currentDesign || wantsNewDesign(prompt);

        console.log(`🎨 ${isNewDesign ? 'NEW DESIGN' : 'ITERATING'}: "${prompt.substring(0, 60)}..."`);

        // Detect niche for design intelligence
        const niche = detectNiche(prompt);

        // Get context-aware images from Unsplash
        let contextualImages = [];
        if (isNewDesign) {
            try {
                contextualImages = await unsplashService.getContextualImages(prompt, 8);
                console.log(`🖼️ Loaded ${contextualImages.length} contextual images`);
            } catch (error) {
                console.error('⚠️ Image loading failed, continuing without:', error.message);
            }
        }

        // Build conversation history
        const conversationMessages = [...session.conversationHistory];

        let systemPrompt, userMessage;
        let isTargetedEdit = false;

        if (isNewDesign) {
            // Reset history for new design
            session.conversationHistory = [];
            session.niche = niche;

            // Build image list
            const imageUrls = contextualImages.length > 0
                ? `USE THESE EXACT URLS IN <img src="..."> TAGS — NO PLACEHOLDERS:\n${contextualImages.map((img, i) =>
                    `${i + 1}. ${img.url}\n   Alt: "${img.alt}"\n   Credit: ${img.photographer}`
                ).join('\n\n')}`
                : 'No pre-loaded images — use direct Unsplash URLs with relevant search terms: https://images.unsplash.com/photo-[id]?w=800&fit=crop';

            systemPrompt = `You are a world-class UI/UX designer and front-end architect with 20 years of experience. You create stunning, production-ready websites that look like they cost $10,000+ to build. Zero errors, zero visible code, zero unstyled elements.

DETECTED NICHE: ${niche.name.toUpperCase()}

NICHE-SPECIFIC DESIGN DIRECTION:
- Color Psychology: ${niche.design.colors}
- Font Pairing: ${niche.design.fonts}
- Image Style: ${niche.design.imagery}
- Mood & Feel: ${niche.design.mood}

${DESIGN_SYSTEM}

TYPOGRAPHY HIERARCHY — Apply consistently:
- h1 (hero): font-family: var(--font-heading); font-size: var(--text-7xl); font-weight: 800; letter-spacing: -0.025em; line-height: 1.1
  → Mobile: font-size: var(--text-5xl)
- h2 (section titles): font-family: var(--font-heading); font-size: var(--text-5xl); font-weight: 700; letter-spacing: -0.02em; line-height: 1.2
  → Mobile: font-size: var(--text-4xl)
- h3 (subsections): font-family: var(--font-heading); font-size: var(--text-3xl); font-weight: 600; line-height: 1.3
- h4 (card titles): font-family: var(--font-heading); font-size: var(--text-2xl); font-weight: 600
- Body text: font-family: var(--font-body); font-size: var(--text-lg); line-height: 1.7; color: var(--color-text)
- Small/muted: font-size: var(--text-sm); color: var(--color-text-muted)
- Buttons: font-size: var(--text-base); font-weight: 600; letter-spacing: 0.01em
- Nav links: font-size: var(--text-sm); font-weight: 500; letter-spacing: 0.03em; text-transform: uppercase

LAYOUT SELECTION — Analyze the prompt and pick the BEST fit:
1. Hero-led SaaS: big hero + CTA above fold, feature grid, pricing, testimonials, stats
2. Split-screen features: alternating left/right image-text blocks, each benefit highlighted
3. Dashboard-style: card-based, metrics/stats prominent, data visualization feel
4. Minimal portfolio: large whitespace, image-focused, elegant type, simple nav
5. Content-first blog: article/card grid, sidebar, featured posts, categories
6. Conversion landing: single column, progressive disclosure, strong CTAs, urgency
7. Marketplace/catalog: product grid, filters, category navigation, search bar
8. Storytelling brand: narrative flow, parallax, full-width sections, emotional design

ELEMENT CLASS NAMING — CRITICAL FOR EDITING:
- Give EVERY element a unique, descriptive class name
- Use BEM-lite convention: .section-name, .section-name__element, .section-name--modifier
- Examples: .hero, .hero__title, .hero__subtitle, .hero__cta, .features, .features__card, .features__icon
- NEVER leave elements without class names — this breaks the element editor

CRITICAL FORMAT REQUIREMENTS (MUST FOLLOW EXACTLY):
1. Start with EXACTLY: <!-- HTML -->
2. Then ALL HTML (body content ONLY — NO <html>, <head>, <body>, <link>, <meta>, <!DOCTYPE> tags)
3. Then EXACTLY: /* CSS */
4. Then ALL CSS (start with @import for Google Fonts, then :root tokens, then reset, then all styles)
5. Then EXACTLY: // JavaScript
6. Then ALL JavaScript (complete interactivity)

FORMAT EXAMPLE:
<!-- HTML -->
<nav class="navbar">
  <div class="navbar__container">
    <a href="#" class="navbar__logo">Brand</a>
    <ul class="navbar__menu">...</ul>
  </div>
</nav>
<header class="hero">...</header>
<section class="features">...</section>
...more sections...
<section class="contact">
  <form class="contact__form">...</form>
</section>
<footer class="footer">...</footer>

/* CSS */
@import url('https://fonts.googleapis.com/css2?family=...&display=swap');

:root {
  --font-heading: 'ChosenFont', sans-serif;
  --font-body: 'ChosenFont', sans-serif;
  --text-xs: 0.75rem;
  ...all design tokens...
  --color-primary: #...;
  ...all colors...
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font-body); color: var(--color-text); background: var(--color-bg); }
...all styles using var() tokens...

// JavaScript
document.addEventListener('DOMContentLoaded', function() {
  try {
    ...all JS with error handling...
  } catch(e) { console.warn(e); }
});

ABSOLUTE RULES — VIOLATION = FAILURE:
- NO text, explanations, or comments outside the three code sections
- NO markdown code blocks (\`\`\`html, \`\`\`css, \`\`\`)
- NO <html>, <head>, <body>, <link>, <meta> tags in HTML section
- ALL code must be COMPLETE — NEVER truncate (finish footer, finish JS)
- EVERY element MUST have a descriptive class name
- EVERY element MUST be fully styled — ZERO default browser styling visible
- NO Times New Roman, NO blue underlined links, NO unstyled bullets, NO browser-default anything
- NO visible code artifacts, broken elements, or error text in the rendered page
- NO placeholder text like "Lorem ipsum" — use realistic, contextual content

CSS COVERAGE — EVERY ELEMENT MUST BE STYLED:
- Universal reset: *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
- Body: font-family, color, background, line-height, -webkit-font-smoothing: antialiased
- ALL headings (h1-h6): font-family, font-size, font-weight, line-height, letter-spacing, color, margin
- ALL paragraphs: font-size, line-height, color, margin-bottom, max-width (for readability — max 70ch)
- ALL links: color, text-decoration: none, transition, hover state with color change
- ALL buttons: background, color, border, padding, border-radius, font-family, font-weight, cursor: pointer, hover (transform + shadow), active state, transition
- ALL form inputs/textareas: width, padding, border, border-radius, font-family, font-size, background, color, focus state (outline/ring), placeholder styling, transition
- ALL images: max-width: 100%, height: auto, object-fit: cover, display: block, border-radius
- ALL lists: list-style: none, padding: 0
- ALL cards: background, border-radius, box-shadow, padding, transition, hover (lift + shadow increase)
- ALL sections: padding using var(--section-spacing), alternating backgrounds using var(--color-bg) and var(--color-surface-alt)

MODERN DESIGN TECHNIQUES:
- CSS Grid and Flexbox for ALL layouts (no floats)
- Gradients, box-shadows, backdrop-filter for depth
- Smooth scroll-reveal animations using IntersectionObserver (staggered, not all at once)
- Hero entrance animations (fade-up, subtle scale)
- Hover micro-interactions on buttons (lift 2px + shadow), cards (lift 4px + shadow), links (color shift)
- Sticky navigation with backdrop-filter: blur(12px) and subtle border-bottom on scroll
- Clean section transitions — never abrupt color changes between sections
- Image treatments: overlays, rounded corners, subtle shadows, hover zoom on gallery images

RESPONSIVE DESIGN — MOBILE FIRST:
- Start with mobile layout, enhance for larger screens
- Breakpoints: @media (min-width: 480px), (min-width: 768px), (min-width: 1024px), (min-width: 1280px)
- Mobile: single column, stacked layout, touch targets min 44px, hamburger menu
- Tablet: 2-column grids, adjusted spacing
- Desktop: full multi-column layouts, max-width container
- Navigation: full menu on desktop, hamburger toggle on mobile (with slide-in or dropdown animation)
- Typography: scale down headings on mobile (h1: --text-5xl, h2: --text-4xl)
- Images: 100% width on mobile, constrained on desktop
- Cards: 1 column on mobile, 2 on tablet, 3-4 on desktop
- Form: full width on mobile, max-width 600px centered on desktop

REQUIRED SECTIONS (ALWAYS INCLUDE):
1. Navigation bar (sticky top, logo + links + CTA button, mobile hamburger)
2. Hero section (full viewport height, compelling heading, subheading, CTA button, background image or gradient)
3. 3-5 content sections appropriate for the niche (features, services, about, stats, testimonials, gallery, team, etc.)
4. Contact form section with:
   - Name input, Email input, Message/Subject textarea, Submit button
   - Full JavaScript validation (email regex, required fields, visual error/success feedback)
   - Beautiful styling with focus states and transitions
5. Footer section with:
   - Company name and brief description
   - Quick navigation links
   - Social media icon links (use inline SVG icons — Facebook, Twitter/X, Instagram, LinkedIn)
   - Copyright notice with current year
   - Styled consistently with the design

IMAGES — CRITICAL REQUIREMENT:
- USE ONLY the exact image URLs provided in the "CONTEXT-AWARE IMAGES" section below
- DO NOT use placeholder text like "Image Loading..." or "[Image will load here]"
- DO NOT use generic source.unsplash.com URLs
- Every <img> tag MUST have: src, alt, class, loading="lazy"
- Place images strategically: hero background/feature, feature sections, testimonials, gallery
- Apply professional treatments: object-fit: cover, border-radius, box-shadow, optional CSS filter or overlay

JAVASCRIPT — COMPLETE AND ERROR-FREE:
- Wrap ALL code in DOMContentLoaded and try-catch
- Smooth scroll for anchor links (document.querySelectorAll('a[href^="#"]'))
- Scroll reveal using IntersectionObserver (add .revealed class, stagger with transitionDelay)
- Mobile menu toggle (hamburger click, close on link click, close on outside click)
- Form validation (email regex, required fields, show error messages, show success on valid submit)
- Sticky header effect (add class on scroll for background/shadow change)
- Counter animation for stats/numbers (if applicable — use IntersectionObserver to trigger)
- ALL querySelector calls must have null checks
- NO errors in console — defensive coding throughout

ACCESSIBILITY:
- Semantic HTML5 tags (nav, header, main, section, article, footer)
- ARIA labels on interactive elements (menu button, form inputs, social links)
- Keyboard navigation support (visible focus states)
- Sufficient color contrast (4.5:1 minimum for text)
- Alt text on all images (descriptive, not "image1")

CONTEXT-AWARE IMAGES PROVIDED:
${imageUrls}

THE STANDARD: A client should look at this and say "This looks like a $10,000 custom design." Zero errors. Zero unstyled elements. Every pixel intentional.`;

            userMessage = `Create a premium ${niche.name !== 'general' ? niche.name + ' ' : ''}website for: ${prompt}

EXECUTION CHECKLIST:
1. Select ONE layout pattern (1-8) that best fits this niche
2. Apply the ${niche.name} design direction (colors, fonts, mood)
3. Define ALL CSS custom properties in :root FIRST
4. Use ONLY var(--token) references throughout CSS — zero hardcoded values
5. Give every element a unique descriptive class name (BEM-lite)
6. Use the EXACT Unsplash image URLs provided above
7. Include contact form with full validation + comprehensive footer
8. Write complete JavaScript with error handling (try-catch, null checks)
9. Fully responsive: mobile hamburger, fluid grids, scaled typography
10. ZERO visible code, ZERO unstyled elements, ZERO browser defaults

Return COMPLETE code in EXACT format:
<!-- HTML -->
[body content only — no <html>/<head>/<body> tags]

/* CSS */
[@import Google Fonts → :root tokens → reset → all styles]

// JavaScript
[complete interactivity wrapped in DOMContentLoaded + try-catch]`;

        } else {
            // Iteration mode
            const targetedEditKeywords = [
                'add image', 'change image', 'replace image', 'update image',
                'change color', 'update color', 'make bigger', 'make smaller',
                'change text', 'update text', 'add button', 'change font',
                'hero section', 'header section', 'footer section', 'nav section',
                'change background', 'add section', 'remove section',
                'fix', 'adjust', 'tweak', 'modify', 'move', 'align',
                'increase', 'decrease', 'update', 'replace'
            ];

            isTargetedEdit = targetedEditKeywords.some(keyword =>
                prompt.toLowerCase().includes(keyword)
            );

            const nicheContext = session.niche ? `\nThis is a ${session.niche.name} website using the design token system (var(--color-*), var(--space-*), var(--text-*), etc.).\nMaintain the existing design tokens and niche styling.` : '';

            if (isTargetedEdit) {
                systemPrompt = `You are an expert front-end developer making a TARGETED EDIT to an existing design.
${nicheContext}

CRITICAL: This is a SMALL CHANGE request. DO NOT redesign the website!

REQUIREMENTS:
1. Make ONLY the specific change requested
2. Keep EVERYTHING else EXACTLY the same (layout, colors, fonts, spacing, animations)
3. USE existing CSS custom properties (var(--color-*), var(--space-*), etc.) — do NOT hardcode new values
4. Do NOT regenerate sections that weren't mentioned
5. Maintain all existing class names
6. Return COMPLETE code (with your targeted change applied)

Return in EXACT format:
<!-- HTML -->
[complete HTML with targeted change]

/* CSS */
[complete CSS with targeted change]

// JavaScript
[complete JavaScript]

DO NOT:
- Redesign unrelated sections
- Change the overall layout or color scheme
- Add new sections unless explicitly asked
- Remove existing features or animations
- Change fonts or typography unless asked
- Break the responsive behavior`;
            } else {
                systemPrompt = `You are an expert front-end developer iterating on an existing design.
${nicheContext}

REQUIREMENTS:
1. Modify the existing code based on the user's request
2. Return COMPLETE code (not just changes)
3. USE existing CSS custom properties — do NOT replace the design token system
4. Maintain all element class names unless the change requires modifying them
5. Keep responsive behavior, animations, and hover effects
6. Always maintain contact form and footer sections

Return in EXACT format:
<!-- HTML -->
[complete modified HTML]

/* CSS */
[complete modified CSS]

// JavaScript
[complete modified JavaScript]

NO markdown code blocks. NO explanations outside code. COMPLETE and PRODUCTION-READY.`;
            }

            userMessage = `Current website code:
${session.currentDesign}

User request: ${prompt}

${isTargetedEdit ? 'REMINDER: Make ONLY the specific change requested. Keep everything else IDENTICAL. Use existing var(--token) values.' : ''}

Return the COMPLETE modified code in format:
<!-- HTML -->
[code]

/* CSS */
[code]

// JavaScript
[code]`;
        }

        conversationMessages.push({ role: 'user', content: userMessage });

        // Generate with Claude
        console.log(`🤖 Calling Claude API... [Niche: ${niche.name}] ${!isNewDesign && isTargetedEdit ? '(Targeted Edit)' : ''}`);
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16000,
            temperature: !isNewDesign && isTargetedEdit ? 0.3 : 0.7,
            system: systemPrompt,
            messages: conversationMessages
        });

        const generatedCode = response.content[0].text;

        // Log preview for debugging
        console.log('📝 Response preview:', generatedCode.substring(0, 500));

        // ============================================
        // PARSE — Multi-method extraction
        // ============================================
        let html = '', css = '', js = '';

        // Method 1: Exact delimiters
        let htmlMatch = generatedCode.match(/<!--\s*HTML\s*-->([\s\S]*?)(?=\/\*\s*CSS\s*\*\/|$)/i);
        let cssMatch = generatedCode.match(/\/\*\s*CSS\s*\*\/([\s\S]*?)(?=\/\/\s*JavaScript|$)/i);
        let jsMatch = generatedCode.match(/\/\/\s*JavaScript([\s\S]*?)$/i);

        if (htmlMatch) html = htmlMatch[1].trim();
        if (cssMatch) css = cssMatch[1].trim();
        if (jsMatch) js = jsMatch[1].trim();

        // Method 2: Markdown code blocks
        if (!html || !css) {
            console.log('⚠️ Trying markdown block extraction');
            const htmlBlockMatch = generatedCode.match(/```html\s*([\s\S]*?)```/i);
            const cssBlockMatch = generatedCode.match(/```css\s*([\s\S]*?)```/i);
            const jsBlockMatch = generatedCode.match(/```(?:javascript|js)\s*([\s\S]*?)```/i);

            if (htmlBlockMatch && !html) html = htmlBlockMatch[1].trim();
            if (cssBlockMatch && !css) css = cssBlockMatch[1].trim();
            if (jsBlockMatch && !js) js = jsBlockMatch[1].trim();
        }

        // Method 3: Smart section split
        if (!html || !css) {
            console.log('⚠️ Using smart section extraction');
            const sections = generatedCode.split(/(?=<!--\s*HTML\s*-->|\/\*\s*CSS\s*\*\/|\/\/\s*JavaScript)/i);

            for (const section of sections) {
                if (/<!--\s*HTML\s*-->/i.test(section) && !html) {
                    html = section.replace(/<!--\s*HTML\s*-->/i, '').trim();
                } else if (/\/\*\s*CSS\s*\*\//i.test(section) && !css) {
                    css = section.replace(/\/\*\s*CSS\s*\*\//i, '').trim();
                } else if (/\/\/\s*JavaScript/i.test(section) && !js) {
                    js = section.replace(/\/\/\s*JavaScript/i, '').trim();
                }
            }
        }

        // Method 4: Pattern-based fallback
        if (!html || !css) {
            console.log('⚠️ Using pattern-based fallback');

            if (!html) {
                const htmlPattern = /<(?:nav|header|div|section|main|footer)[^>]*>[\s\S]*<\/(?:nav|header|div|section|main|footer)>/i;
                const htmlFallback = generatedCode.match(htmlPattern);
                if (htmlFallback) html = htmlFallback[0];
            }

            if (!css) {
                const cssStart = generatedCode.search(/(@import|:root\s*\{|[.#\w][\w-]*\s*\{)/);
                if (cssStart !== -1) {
                    let braceCount = 0;
                    let cssEnd = cssStart;
                    let foundOpen = false;

                    for (let i = cssStart; i < generatedCode.length; i++) {
                        if (generatedCode[i] === '{') {
                            braceCount++;
                            foundOpen = true;
                        } else if (generatedCode[i] === '}') {
                            braceCount--;
                            if (foundOpen && braceCount === 0) {
                                cssEnd = i + 1;
                            }
                        }
                    }

                    if (cssEnd > cssStart) {
                        css = generatedCode.substring(cssStart, cssEnd).trim();
                    }
                }
            }

            if (!js) {
                const jsPattern = /((?:document\.|window\.|const\s+|let\s+|var\s+|function\s+)[\s\S]*)/;
                const jsFallback = generatedCode.match(jsPattern);
                if (jsFallback) js = jsFallback[1].trim();
            }
        }

        // Clean markdown artifacts
        html = html.replace(/```html\s*/gi, '').replace(/```\s*$/g, '').trim();
        css = css.replace(/```css\s*/gi, '').replace(/```\s*$/g, '').trim();
        js = js.replace(/```(?:javascript|js)\s*/gi, '').replace(/```\s*$/g, '').trim();

        // Fix escaped HTML entities
        html = fixEscapedHtml(html);
        css = fixEscapedHtml(css);

        // Sanitize output — strip all artifacts, validate clean code
        const sanitized = sanitizeOutput(html, css, js);
        html = sanitized.html;
        css = sanitized.css;
        js = sanitized.js;

        // Validate extraction
        console.log('\n📊 EXTRACTION RESULTS:');
        console.log(`HTML: ${html.length} chars ${html ? '✅' : '❌'}`);
        console.log(`CSS: ${css.length} chars ${css ? '✅' : '❌'}`);
        console.log(`JS: ${js.length} chars ${js ? '✅' : '❌'}`);

        if (!html) {
            console.error('❌ CRITICAL: No HTML extracted!');
            console.error('Response length:', generatedCode.length);
            console.error('First 1000 chars:', generatedCode.substring(0, 1000));
        }

        if (!css) {
            console.error('❌ CRITICAL: No CSS extracted!');
            console.error('Full response sample:', generatedCode.substring(0, 2000));
        } else if (css.length < 500) {
            console.warn('⚠️ WARNING: CSS seems too short (< 500 chars)');
            console.warn('CSS content:', css.substring(0, 200));
        }

        // CRITICAL: If CSS is missing or too short, return error
        if (!css || css.length < 100) {
            console.error('\n❌ ABORTING: CSS extraction failed');
            return res.status(500).json({
                success: false,
                error: 'CSS generation failed',
                message: 'The AI did not generate proper CSS. Please try again or use a different prompt.',
                debug: {
                    htmlExtracted: html.length > 0,
                    cssExtracted: css.length,
                    jsExtracted: js.length > 0,
                    responseLength: generatedCode.length,
                    responseSample: generatedCode.substring(0, 500)
                }
            });
        }

        // Store in session
        session.currentDesign = generatedCode;
        session.conversationHistory.push(
            { role: 'user', content: userMessage },
            { role: 'assistant', content: generatedCode }
        );

        console.log(`✅ Generated: ${html.length} HTML, ${css.length} CSS, ${js.length} JS [Niche: ${niche.name}]\n`);

        res.json({
            success: true,
            sessionId: session.id,
            isNewDesign,
            style: 'AI-Generated',
            palette: 'Custom',
            niche: niche.name,
            website: { html, css, js }
        });

    } catch (error) {
        console.error('❌ Generator error:', error);
        res.status(500).json({
            error: 'Generation failed',
            message: error.message
        });
    }
});

// ============================================
// EDIT SINGLE ELEMENT (token-efficient)
// ============================================
router.post('/edit-element', async (req, res) => {
    try {
        const { sessionId, elementHtml, elementPath, prompt, currentHtml, currentCss } = req.body;

        if (!elementHtml || !prompt || !currentHtml) {
            return res.status(400).json({ error: 'Element HTML, prompt, and current HTML are required' });
        }

        if (!anthropic) {
            return res.status(500).json({ error: 'AI service not available' });
        }

        console.log(`🎯 Element Edit: "${elementPath}" - "${prompt.substring(0, 50)}..."`);

        // Detect if design tokens are in use
        const usesDesignTokens = currentCss && currentCss.includes(':root') && currentCss.includes('--color-');

        const systemPrompt = `You are an expert front-end developer making a TARGETED EDIT to a single HTML element.
${usesDesignTokens ? '\nThis website uses a CSS design token system. USE the existing CSS custom properties (var(--color-primary), var(--space-4), var(--text-lg), etc.) in your edits — do NOT hardcode values.' : ''}

TASK: Modify ONLY the provided element based on the user's request.

RULES:
1. Return ONLY the modified element HTML — nothing else
2. If CSS changes are needed, include them in a /* ELEMENT_CSS */ block
3. Keep the element structure intact unless explicitly asked to change it
4. Preserve all existing classes, IDs, and attributes unless the change requires modifying them
5. Ensure the element has a descriptive class name
6. Be precise — change only what's requested
7. The modified element must be complete and valid HTML

RESPONSE FORMAT:
If only HTML changes:
<!-- ELEMENT -->
<modified element html here>

If CSS changes are also needed:
<!-- ELEMENT -->
<modified element html here>

/* ELEMENT_CSS */
.selector { property: value; }

NO explanations, NO markdown, NO extra text — just the element code.`;

        const userMessage = `ELEMENT TO EDIT (${elementPath}):
${elementHtml}

USER REQUEST: ${prompt}

Return the modified element. If you need to add/modify CSS, include it in a /* ELEMENT_CSS */ block.`;

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            temperature: 0.3,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }]
        });

        const result = response.content[0].text;
        console.log('📝 Element edit response:', result.substring(0, 200));

        // Parse the response
        let newElementHtml = '';
        let newElementCss = '';

        // Extract element HTML
        const elementMatch = result.match(/<!--\s*ELEMENT\s*-->([\s\S]*?)(?=\/\*\s*ELEMENT_CSS\s*\*\/|$)/i);
        if (elementMatch) {
            newElementHtml = elementMatch[1].trim();
        } else {
            newElementHtml = result.replace(/\/\*\s*ELEMENT_CSS\s*\*\/[\s\S]*$/, '').trim();
        }

        // Extract CSS if present
        const editCssMatch = result.match(/\/\*\s*ELEMENT_CSS\s*\*\/([\s\S]*?)$/i);
        if (editCssMatch) {
            newElementCss = editCssMatch[1].trim();
        }

        // Clean up markdown and fix escaped HTML
        newElementHtml = newElementHtml.replace(/```html?\s*/gi, '').replace(/```\s*$/g, '').trim();
        newElementCss = newElementCss.replace(/```css?\s*/gi, '').replace(/```\s*$/g, '').trim();
        newElementHtml = fixEscapedHtml(newElementHtml);
        newElementCss = fixEscapedHtml(newElementCss);

        // Strip any artifacts from element HTML
        newElementHtml = newElementHtml
            .replace(/<!--\s*ELEMENT\s*-->/gi, '')
            .replace(/<!--\s*HTML\s*-->/gi, '')
            .trim();

        if (!newElementHtml) {
            return res.status(500).json({ error: 'Failed to generate element edit' });
        }

        // ============================================
        // ELEMENT MATCHING & REPLACEMENT (10 methods)
        // ============================================
        let updatedHtml = currentHtml;
        let matchFound = false;

        // Fix escaped HTML in current HTML first
        updatedHtml = fixEscapedHtml(updatedHtml);
        const wasHtmlFixed = updatedHtml !== currentHtml;
        if (wasHtmlFixed) {
            console.log('🔧 Fixed escaped HTML entities in current HTML');
        }

        // Void elements (self-closing)
        const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

        // Extract tag name and attributes
        const openingTagMatch = elementHtml.match(/^<(\w+)([^>]*)>/);
        const tagName = openingTagMatch ? openingTagMatch[1].toLowerCase() : '';
        const attributes = openingTagMatch ? openingTagMatch[2] : '';
        const isVoidElement = voidElements.includes(tagName);

        // Pre-extract attributes for matching
        const srcMatch = attributes.match(/src\s*=\s*["']([^"']+)["']/);
        const hrefMatch = attributes.match(/href\s*=\s*["']([^"']+)["']/);
        const idMatch = attributes.match(/id\s*=\s*["']([^"']+)["']/);
        const classMatch = attributes.match(/class\s*=\s*["']([^"']+)["']/);
        const altMatch = attributes.match(/alt\s*=\s*["']([^"']+)["']/);

        console.log(`🔍 Element matching: tag=${tagName}, id=${idMatch?.[1]}, class=${classMatch?.[1]}, src=${srcMatch ? 'yes' : 'no'}, void=${isVoidElement}`);

        // Method 1: Exact match
        if (currentHtml.includes(elementHtml)) {
            updatedHtml = currentHtml.replace(elementHtml, newElementHtml);
            matchFound = true;
            console.log('✅ Element replaced via exact match');
        }

        // Method 2: Match by src attribute (img, video, audio, iframe)
        if (!matchFound && srcMatch) {
            const srcUrl = srcMatch[1];
            const srcIdentifier = srcUrl.split('/').pop().split('?')[0];
            const escapedSrc = srcIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            if (escapedSrc.length > 5) {
                let srcPattern;
                if (isVoidElement) {
                    srcPattern = new RegExp(`<${tagName}[^>]*src\\s*=\\s*["'][^"']*${escapedSrc}[^"']*["'][^>]*/?>`, 'i');
                } else {
                    srcPattern = new RegExp(`<${tagName}[^>]*src\\s*=\\s*["'][^"']*${escapedSrc}[^"']*["'][^>]*>[\\s\\S]*?<\\/${tagName}>`, 'i');
                }

                const srcResult = currentHtml.match(srcPattern);
                if (srcResult) {
                    console.log('🔍 Matched by src:', srcResult[0].substring(0, 150));
                    updatedHtml = currentHtml.replace(srcPattern, newElementHtml);
                    if (updatedHtml !== currentHtml) {
                        matchFound = true;
                        console.log('✅ Element replaced via src attribute match');
                    }
                }
            }

            // Fallback: full src URL match
            if (!matchFound) {
                const fullEscapedSrc = srcUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                let fullSrcPattern;
                if (isVoidElement) {
                    fullSrcPattern = new RegExp(`<${tagName}[^>]*src\\s*=\\s*["']${fullEscapedSrc}["'][^>]*/?>`, 'i');
                } else {
                    fullSrcPattern = new RegExp(`<${tagName}[^>]*src\\s*=\\s*["']${fullEscapedSrc}["'][^>]*>[\\s\\S]*?<\\/${tagName}>`, 'i');
                }

                const fullSrcResult = currentHtml.match(fullSrcPattern);
                if (fullSrcResult) {
                    updatedHtml = currentHtml.replace(fullSrcPattern, newElementHtml);
                    if (updatedHtml !== currentHtml) {
                        matchFound = true;
                        console.log('✅ Element replaced via full src URL match');
                    }
                }
            }
        }

        // Method 3: Match by id (most specific)
        if (!matchFound && idMatch) {
            const escapedId = idMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let searchPattern;
            if (isVoidElement) {
                searchPattern = new RegExp(`<${tagName}[^>]*id\\s*=\\s*["']${escapedId}["'][^>]*/?>`, 'i');
            } else {
                searchPattern = new RegExp(`<${tagName}[^>]*id\\s*=\\s*["']${escapedId}["'][^>]*>[\\s\\S]*?<\\/${tagName}>`, 'i');
            }

            if (searchPattern.test(currentHtml)) {
                const matchResult = currentHtml.match(searchPattern);
                console.log('🔍 Matched by id:', matchResult[0].substring(0, 200));
                updatedHtml = currentHtml.replace(searchPattern, newElementHtml);
                if (updatedHtml !== currentHtml) {
                    matchFound = true;
                    console.log('✅ Element replaced via id match');
                }
            }
        }

        // Method 4: Match by class
        if (!matchFound && classMatch) {
            const firstClass = classMatch[1].split(/\s+/)[0];
            const escapedClass = firstClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let searchPattern;
            if (isVoidElement) {
                searchPattern = new RegExp(`<${tagName}[^>]*class\\s*=\\s*["'][^"']*${escapedClass}[^"']*["'][^>]*/?>`, 'i');
            } else {
                searchPattern = new RegExp(`<${tagName}[^>]*class\\s*=\\s*["'][^"']*${escapedClass}[^"']*["'][^>]*>[\\s\\S]*?<\\/${tagName}>`, 'i');
            }

            if (searchPattern.test(currentHtml)) {
                const matchResult = currentHtml.match(searchPattern);
                console.log('🔍 Matched by class:', matchResult[0].substring(0, 200));
                updatedHtml = currentHtml.replace(searchPattern, newElementHtml);
                if (updatedHtml !== currentHtml) {
                    matchFound = true;
                    console.log('✅ Element replaced via class match');
                }
            }
        }

        // Method 5: Match by alt text (images)
        if (!matchFound && altMatch && tagName === 'img') {
            const escapedAlt = altMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const altPattern = new RegExp(`<img[^>]*alt\\s*=\\s*["']${escapedAlt}["'][^>]*/?>`, 'i');

            const altResult = currentHtml.match(altPattern);
            if (altResult) {
                updatedHtml = currentHtml.replace(altPattern, newElementHtml);
                if (updatedHtml !== currentHtml) {
                    matchFound = true;
                    console.log('✅ Element replaced via alt text match');
                }
            }
        }

        // Method 6: Match by href (links)
        if (!matchFound && hrefMatch) {
            const escapedHref = hrefMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let hrefPattern;
            if (isVoidElement) {
                hrefPattern = new RegExp(`<${tagName}[^>]*href\\s*=\\s*["']${escapedHref}["'][^>]*/?>`, 'i');
            } else {
                hrefPattern = new RegExp(`<${tagName}[^>]*href\\s*=\\s*["']${escapedHref}["'][^>]*>[\\s\\S]*?<\\/${tagName}>`, 'i');
            }

            const hrefResult = currentHtml.match(hrefPattern);
            if (hrefResult) {
                updatedHtml = currentHtml.replace(hrefPattern, newElementHtml);
                if (updatedHtml !== currentHtml) {
                    matchFound = true;
                    console.log('✅ Element replaced via href match');
                }
            }
        }

        // Method 7: Flexible whitespace matching
        if (!matchFound) {
            const escapedOriginal = elementHtml.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const flexibleRegex = new RegExp(escapedOriginal.replace(/\s+/g, '\\s*'), 'i');
            if (flexibleRegex.test(currentHtml)) {
                updatedHtml = currentHtml.replace(flexibleRegex, newElementHtml);
                matchFound = true;
                console.log('✅ Element replaced via flexible whitespace match');
            }
        }

        // Method 8: Match by text content
        if (!matchFound && !isVoidElement && elementHtml) {
            const textContent = elementHtml.replace(/<[^>]*>/g, '').trim();
            if (textContent.length > 10 && textContent.length < 200) {
                const escapedText = textContent.substring(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const textPattern = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?${escapedText}[\\s\\S]*?<\\/${tagName}>`, 'i');
                const textMatches = currentHtml.match(new RegExp(textPattern.source, 'gi'));

                if (textMatches && textMatches.length === 1) {
                    updatedHtml = currentHtml.replace(textPattern, newElementHtml);
                    if (updatedHtml !== currentHtml) {
                        matchFound = true;
                        console.log('✅ Element replaced via text content match');
                    }
                }
            }
        }

        // Method 9: Path-based class match
        if (!matchFound && elementPath) {
            const pathParts = elementPath.split('.');
            if (pathParts.length > 1) {
                const className = pathParts[pathParts.length - 1];
                const pathTagName = pathParts[0].split('#')[0];

                let classRegex;
                if (voidElements.includes(pathTagName.toLowerCase())) {
                    classRegex = new RegExp(`<${pathTagName}[^>]*class\\s*=\\s*["'][^"']*${className}[^"']*["'][^>]*/?>`, 'gi');
                } else {
                    classRegex = new RegExp(`<${pathTagName}[^>]*class\\s*=\\s*["'][^"']*${className}[^"']*["'][^>]*>[\\s\\S]*?<\\/${pathTagName}>`, 'gi');
                }
                const matches = currentHtml.match(classRegex);

                if (matches && matches.length === 1) {
                    updatedHtml = currentHtml.replace(matches[0], newElementHtml);
                    matchFound = true;
                    console.log('✅ Element replaced via path-based class match');
                }
            }
        }

        // Method 10: Void element by tag + position context
        if (!matchFound && isVoidElement) {
            const allTagPattern = new RegExp(`<${tagName}[^>]*/?>`, 'gi');
            const allMatches = [];
            let match;
            while ((match = allTagPattern.exec(currentHtml)) !== null) {
                allMatches.push({ html: match[0], index: match.index });
            }

            if (allMatches.length === 1) {
                updatedHtml = currentHtml.replace(allMatches[0].html, newElementHtml);
                matchFound = true;
                console.log('✅ Element replaced via single-instance void element match');
            } else if (allMatches.length > 1 && srcMatch) {
                const srcDomain = srcMatch[1].split('/').slice(0, 3).join('/');
                const bestMatch = allMatches.find(m => m.html.includes(srcDomain));
                if (bestMatch) {
                    updatedHtml = currentHtml.substring(0, bestMatch.index) + newElementHtml + currentHtml.substring(bestMatch.index + bestMatch.html.length);
                    matchFound = true;
                    console.log('✅ Element replaced via partial src domain match');
                }
            }
        }

        if (!matchFound) {
            if (wasHtmlFixed) {
                console.log('✅ HTML fixed (escaped entities corrected), returning fixed HTML');
                matchFound = true;
            } else {
                console.log('⚠️ Could not find element in HTML');
                return res.json({
                    success: true,
                    warning: 'Could not auto-replace element. Here is the edited element:',
                    website: {
                        html: currentHtml,
                        css: currentCss
                    },
                    editedElement: newElementHtml,
                    editedCss: newElementCss,
                    manualReplace: true
                });
            }
        }

        // Append new CSS if any
        let updatedCss = currentCss;
        if (newElementCss) {
            updatedCss = currentCss + '\n\n/* Element Edit */\n' + newElementCss;
            console.log('✅ CSS updated with element edit styles');
        }

        // Update session
        if (sessionId) {
            const session = designSessions.get(sessionId);
            if (session) {
                session.currentDesign = `<!-- HTML -->\n${updatedHtml}\n\n/* CSS */\n${updatedCss}`;
            }
        }

        console.log(`✅ Element edit complete: ${newElementHtml.length} chars HTML, ${newElementCss.length} chars CSS`);

        res.json({
            success: true,
            website: {
                html: updatedHtml,
                css: updatedCss
            },
            elementPath,
            tokensUsed: 'minimal'
        });

    } catch (error) {
        console.error('❌ Element edit error:', error);
        res.status(500).json({
            error: 'Element edit failed',
            message: error.message
        });
    }
});

// Get session info
router.get('/session/:sessionId', (req, res) => {
    const session = designSessions.get(req.params.sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
        success: true,
        session: {
            id: session.id,
            style: session.style,
            palette: session.palette,
            niche: session.niche?.name || null,
            messageCount: session.conversationHistory.length,
            createdAt: session.createdAt
        }
    });
});

// Clear session
router.delete('/session/:sessionId', (req, res) => {
    designSessions.delete(req.params.sessionId);
    res.json({ success: true, message: 'Session cleared' });
});

// Health check
router.get('/health', (req, res) => {
    res.json({
        ok: true,
        ai: !!anthropic,
        sessions: designSessions.size
    });
});

module.exports = router;
