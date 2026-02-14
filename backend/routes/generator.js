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
            name: 'fitness',
            keywords: ['gym', 'fitness', 'workout', 'exercise', 'crossfit', 'bodybuilding', 'personal trainer', 'strength training', 'powerlifting', 'weightlifting', 'athletic', 'sports training', 'muscle', 'boxing', 'martial arts', 'pilates', 'spinning', 'hiit', 'yoga', 'yoga studio'],
            design: {
                colors: 'Bold energetic palette: electric orange (#FF6B00), deep charcoal (#1A1A1A), vibrant red (#E53E3E), steel gray (#2D3748), pure white (#FFFFFF). High contrast, powerful.',
                fonts: 'Heading: Oswald (weight 600, 700) or Montserrat (weight 700, 800, 900). Body: Roboto (weight 400). Import from Google Fonts.',
                imagery: 'People training in gym, weightlifting, athletic movements, gym equipment, dynamic action shots, motivation.',
                mood: 'Powerful, energetic, motivating, bold, intense, disciplined.'
            }
        },
        {
            name: 'health',
            keywords: ['health', 'medical', 'doctor', 'clinic', 'hospital', 'dental', 'dentist', 'therapy', 'therapist', 'wellness', 'spa', 'nutrition', 'pharmacy', 'physiotherapy', 'mental health', 'skincare', 'dermatology'],
            design: {
                colors: 'Calming palette: trust blue (#3B82F6), gentle sky (#BFDBFE), clean white (#FFFFFF), light blue surface (#EFF6FF), soft teal accent (#0D9488). PRIMARY must be blue, NOT teal/green.',
                fonts: 'Heading: Nunito (weight 700, 800). Body: Open Sans (weight 400). Import from Google Fonts.',
                imagery: 'Smiling medical professionals, clean clinical spaces, nature/wellness imagery, calming environments.',
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
            name: 'pets',
            keywords: ['pet', 'pets', 'pet shop', 'pet store', 'vet', 'veterinary', 'dog', 'cat', 'puppy', 'kitten', 'pet grooming', 'pet care', 'kennel', 'aquarium', 'animal', 'doggy daycare'],
            design: {
                colors: 'Warm playful palette: vibrant orange (#F97316), sunny yellow (#FACC15), soft cream (#FFF7ED), warm brown (#78350F), warm peach surface (#FFF1F2). Friendly and warm. PRIMARY must be orange, NOT teal/green.',
                fonts: 'Heading: Nunito (weight 700, 800). Body: Open Sans (weight 400). Import both from Google Fonts.',
                imagery: 'Cute dogs and cats, pet store interiors, veterinary care, pets playing, grooming sessions, aquarium fish.',
                mood: 'Warm, playful, friendly, caring, joyful, trustworthy.'
            }
        },
        {
            name: 'beauty',
            keywords: ['beauty', 'salon', 'hair salon', 'nail salon', 'barber', 'barbershop', 'makeup', 'lashes', 'brows', 'facial', 'hairdresser', 'cosmetology', 'aesthetics', 'skincare clinic'],
            design: {
                colors: 'Elegant palette: rose gold (#B76E79), soft blush (#FDF2F8), champagne (#F5E6CC), charcoal (#1A1A2E), warm white (#FFFBF5). Luxurious and feminine.',
                fonts: 'Heading: Cormorant Garamond (weight 500, 600, 700). Body: Lato (weight 300, 400). Import both from Google Fonts.',
                imagery: 'Salon interiors, hair styling, makeup artistry, nail art, beauty products, spa-like environments.',
                mood: 'Elegant, luxurious, feminine, polished, sophisticated, pampering.'
            }
        },
        {
            name: 'homeservices',
            keywords: ['plumber', 'plumbing', 'electrician', 'hvac', 'cleaning service', 'landscaping', 'roofing', 'handyman', 'painter', 'pest control', 'moving company', 'locksmith', 'home repair', 'pressure washing', 'carpet cleaning', 'garage door'],
            design: {
                colors: 'Reliable palette: trustworthy blue (#2563EB), vibrant orange (#F97316), clean white (#FFFFFF), dark slate (#1E293B), light gray surface (#F8FAFC). Professional and dependable.',
                fonts: 'Heading: Montserrat (weight 600, 700, 800). Body: Open Sans (weight 400). Import both from Google Fonts.',
                imagery: 'Professional workers on the job, tools and equipment, clean homes, before/after transformations, team photos.',
                mood: 'Reliable, professional, trustworthy, skilled, dependable, local.'
            }
        },
        {
            name: 'church',
            keywords: ['church', 'mosque', 'temple', 'synagogue', 'ministry', 'worship', 'religious', 'faith', 'congregation', 'parish', 'prayer', 'sermon', 'pastor', 'imam', 'rabbi', 'spiritual'],
            design: {
                colors: 'Peaceful palette: deep purple (#7C3AED), warm gold (#D4A853), soft lavender (#F5F3FF), warm cream (#FFFBEB), dark navy (#1E1B4B). Serene and welcoming.',
                fonts: 'Heading: Merriweather (weight 700, 900). Body: Source Sans 3 (weight 400). Import both from Google Fonts.',
                imagery: 'Beautiful worship spaces, community gatherings, peaceful architecture, nature scenes, volunteers helping.',
                mood: 'Peaceful, welcoming, warm, hopeful, spiritual, community-focused.'
            }
        },
        {
            name: 'sports',
            keywords: ['sports club', 'swimming', 'tennis', 'football', 'basketball', 'cricket', 'golf', 'soccer', 'athletics', 'stadium', 'sports academy', 'league', 'tournament', 'recreation center'],
            design: {
                colors: 'Energetic palette: vibrant green (#16A34A), dynamic blue (#2563EB), white (#FFFFFF), dark charcoal (#18181B), light green surface (#F0FDF4). Active and competitive.',
                fonts: 'Heading: Montserrat (weight 700, 800, 900). Body: Roboto (weight 400). Import both from Google Fonts.',
                imagery: 'Sports facilities, athletes in action, team celebrations, well-maintained fields and courts, trophy moments.',
                mood: 'Energetic, competitive, dynamic, team-spirited, active, inspiring.'
            }
        },
        {
            name: 'food',
            keywords: ['food truck', 'ice cream', 'juice bar', 'smoothie', 'bakery', 'pastry', 'dessert', 'donut', 'chocolate', 'candy', 'confectionery', 'food delivery', 'cupcake', 'gelato'],
            design: {
                colors: 'Appetizing palette: warm pink (#EC4899), rich amber (#F59E0B), cream (#FFF7ED), chocolate brown (#78350F), soft peach surface (#FFF1F2). Fun and delicious.',
                fonts: 'Heading: Quicksand (weight 600, 700). Body: Lato (weight 400). Import both from Google Fonts.',
                imagery: 'Colorful food photography, artisan baked goods, ice cream scoops, juice preparations, cozy shop interiors.',
                mood: 'Appetizing, fun, colorful, artisan, inviting, delightful.'
            }
        },
        {
            name: 'consulting',
            keywords: ['consulting', 'consultant', 'advisory', 'strategy', 'management consulting', 'coaching', 'mentoring', 'professional services', 'business consulting', 'life coach', 'career coach'],
            design: {
                colors: 'Authoritative palette: deep navy (#1E3A5F), warm gold (#D4A853), clean white (#FFFFFF), slate gray (#475569), light warm surface (#F8F6F3). Sophisticated and credible.',
                fonts: 'Heading: DM Serif Display (weight 400). Body: Inter (weight 400). Import both from Google Fonts.',
                imagery: 'Professional meetings, strategy sessions, modern offices, confident professionals, collaborative teamwork.',
                mood: 'Authoritative, sophisticated, strategic, credible, professional, results-driven.'
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

        // Get context-aware images from Unsplash (niche-aware)
        // Always request 7: 1 for hero background + 6 for content (perfect 3-column x 2-row grid)
        let contextualImages = [];
        if (isNewDesign) {
            try {
                contextualImages = await unsplashService.getContextualImages(prompt, 7, niche.name);
                console.log(`🖼️ Loaded ${contextualImages.length} contextual images [niche: ${niche.name}]`);
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

            // Build image list with explicit usage instructions
            const contentImages = contextualImages.slice(1);
            // Ensure content images are a multiple of 3 for perfect grid alignment
            const gridImages = contentImages.length >= 6 ? contentImages.slice(0, 6)
                             : contentImages.length >= 3 ? contentImages.slice(0, 3)
                             : contentImages;

            const imageUrls = contextualImages.length > 0
                ? `USE THESE EXACT URLS — NO PLACEHOLDERS, NO OTHER URLS:

HERO IMAGE (USE AS CSS background-image on .hero section — NOT an <img> tag):
${contextualImages[0].url}

CONTENT IMAGES (USE AS <img> TAGS — place in gallery/features grid):
${gridImages.map((img, i) =>
    `${i + 1}. ${img.url}\n   Alt: "${img.alt}"`
).join('\n')}

GRID RULE: You have ${gridImages.length} content images. Use a ${gridImages.length <= 3 ? '3-column' : '3-column'} CSS grid. NEVER leave an orphan image alone in a row — always fill complete rows of 3.`
                : 'No pre-loaded images — use direct Unsplash URLs with relevant search terms: https://images.unsplash.com/photo-[id]?w=800&fit=crop';

            systemPrompt = `Role: You are an Awwwards-winning Front-end Developer and UI/UX Designer. You create "Site of the Day" quality websites — NOT generic corporate templates.

DETECTED NICHE: ${niche.name.toUpperCase()}

NICHE-SPECIFIC DESIGN DIRECTION:
- Color Psychology: ${niche.design.colors}
- Font Pairing: ${niche.design.fonts}
- Image Style: ${niche.design.imagery}
- Mood & Feel: ${niche.design.mood}

ANIMATION LIBRARIES (pre-loaded in environment — use directly):
- GSAP 3.12 + ScrollTrigger — for ALL animations (entrance, scroll, parallax, text reveals)
- Lenis — for buttery smooth scrolling
- Do NOT add <script> CDN tags — libraries are already loaded globally.

DESIGN PHILOSOPHY — "Awwwards" quality means:

1. TYPOGRAPHY — Go bold and dramatic:
   - Hero headline: massive viewport-sized type (font-size: clamp(3rem, 8vw, 8rem)), tight letter-spacing (-0.04em), font-weight 800-900
   - Section headings: large and expressive (clamp(2rem, 5vw, 4rem))
   - Body text: generous line-height (1.8), good readability
   - Each niche gets a UNIQUE Google Font pairing from the niche direction above

2. LAYOUT — Forget boring grids. Think editorial:
   - Asymmetric CSS Grid layouts with overlapping elements
   - Generous whitespace — let content breathe (padding: clamp(4rem, 10vw, 10rem))
   - Full-width sections mixed with contained sections
   - Staggered/offset image placements, not everything centered
   - Each section should feel like a different "scene"

3. COLOR — EACH NICHE IS VISUALLY DISTINCT:
   - Use the EXACT hex colors from the niche direction above
   - NEVER default to teal/green for everything
   - Dark sections use the niche's secondary/primary-dark color, not generic black
   - Backgrounds should alternate: light → tinted → dark brand → light. No two adjacent same color.

4. SCROLL ANIMATIONS (use GSAP + ScrollTrigger):
   - Hero elements: staggered fade-up entrance on load using gsap.from() with stagger
   - Section headings: reveal/clip animation triggered on scroll
   - Images: parallax movement (y: -50 on scroll), or scale from 0.8 to 1
   - Cards/items: stagger in from bottom as user scrolls
   - Stats/numbers: countUp animation triggered by ScrollTrigger
   - Use scrub for smooth scroll-linked animations where appropriate

5. MICRO-INTERACTIONS:
   - Custom cursor: a small circle (20px) that follows the mouse, scales up on hover over links/buttons
   - Buttons: magnetic hover effect (subtle translate toward cursor) OR scale+shadow lift
   - Images: reveal on hover with clip-path or overlay transition
   - Links: underline animation (width from 0 to 100% on hover)

6. SMOOTH SCROLLING (use Lenis):
   - Initialize Lenis with default settings
   - Sync with GSAP ScrollTrigger via lenis.on('scroll', ScrollTrigger.update)
   - Use requestAnimationFrame loop for Lenis

NICHE ADAPTATION — design must MATCH the business type:
- Luxury/Fashion/Beauty/Wedding: high contrast, serif fonts, black/white space, slow elegant animations, minimal
- Tech/Startup/Gaming: dark mode backgrounds, gradients, glassmorphism, grotesque sans-serifs, sharp edges
- Food/Restaurant/Bakery/Pets: warm colors, organic rounded shapes, soft shadows, playful cursor effects
- Professional/Legal/Finance/Consulting: structured layouts, muted palettes, subtle animations, trust-building
- Sports/Fitness/Automotive: bold typography, high energy colors, dynamic angles, fast animations
- Health/Church/Nonprofit: calming colors, gentle animations, warm and welcoming feel

${DESIGN_SYSTEM}

SIZE CONSTRAINT — CRITICAL:
- MAXIMUM 6 sections: navbar + hero + 3-4 content + footer
- Max 3 cards per row. Max 3 stats. Keep it tight but impactful.
- Simple SVG icons only (24x24 viewBox, 1-2 paths max)
- Quality over quantity — fewer sections, more polish

ELEMENT CLASS NAMING (CRITICAL FOR EDITING):
- BEM-lite: .section-name, .section-name__element, .section-name--modifier
- EVERY element MUST have a descriptive class name

FORMAT (MUST FOLLOW EXACTLY):
1. Start with EXACTLY: <!-- HTML -->
2. Then ALL HTML (body content ONLY — NO <html>, <head>, <body>, <link>, <meta>, <script>, <!DOCTYPE>)
3. Then EXACTLY: /* CSS */
4. Then ALL CSS (@import Google Fonts, then :root tokens, then styles)
5. Then EXACTLY: // JavaScript
6. Then ALL JavaScript

REQUIRED SECTIONS:

1. NAVBAR — position: fixed, z-index: 1000, backdrop-filter: blur, transparent or niche-colored
   - Hamburger toggle for mobile with animated open/close
   - Style must match niche personality

2. HERO — Full viewport, background-image from provided URL, niche-colored overlay
   - .hero::before overlay MUST use niche brand colors (NOT generic black/gray)
   - Massive headline with GSAP entrance animation
   - Staggered subtitle and CTA button animations
   - body padding-top for fixed navbar offset

3. CONTENT SECTIONS — 3-4 sections, each with DIFFERENT layout:
   - Use mix of: cards with hover effects, split image+text, dark stats banner, testimonials, gallery
   - ONE dark section mandatory (use niche secondary color, NOT black)
   - Images in grids with parallax or reveal effects
   - Alternating backgrounds — NEVER two same-color adjacent sections

4. CONTACT — Form with name, email, message, submit. JS validation. Beautiful focus states.

5. FOOTER — Brand, links, SVG social icons (FB, X, Instagram, LinkedIn), copyright 2026

IMAGES:
- Use ONLY the exact URLs provided below — NO placeholders
- HERO: CSS background-image on .hero (NOT <img>)
- CONTENT: <img> tags with src, alt, class, loading="lazy"
- Apply parallax, hover zoom, or reveal effects on images
- Grid images: 3-column, complete rows only (no orphans)

JAVASCRIPT — GSAP + LENIS + INTERACTIVITY:
- Initialize Lenis smooth scroll and sync with ScrollTrigger
- gsap.registerPlugin(ScrollTrigger)
- Hero entrance: gsap.from() with stagger on title, subtitle, buttons
- Scroll reveals: ScrollTrigger.batch() for cards, images, text blocks
- Parallax: gsap.to(image, { y: -50, scrollTrigger: { scrub: true } })
- Custom cursor: small circle div, gsap.to for smooth follow on mousemove
- Mobile menu toggle with GSAP timeline for smooth open/close
- Form validation (email regex, required fields, visual feedback)
- Sticky header class on scroll
- Number counter animation for stats using ScrollTrigger
- ALL querySelector calls: null checks. Wrap everything in try-catch.
- NO console errors.

CONTEXT-AWARE IMAGES PROVIDED:
${imageUrls}

ABSOLUTE RULES:
- NO text/explanations outside code sections. NO markdown blocks.
- NO <html>/<head>/<body>/<link>/<meta>/<script src> tags in HTML
- EVERY element: class name + fully styled. ZERO browser defaults.
- NO placeholder text — realistic, contextual content only.
- COMPLETE code — never truncate.`;

            userMessage = `Create an Awwwards-quality ${niche.name !== 'general' ? niche.name + ' ' : ''}website for: ${prompt}

EXECUTION CHECKLIST:
1. Choose niche-appropriate Google Font pairing from direction above
2. Set :root with ALL tokens using EXACT niche hex colors (NOT teal/green unless niche specifies it)
3. Write navbar with niche-appropriate style (transparent, dark, minimal, etc.)
4. Write hero with background-image, niche-colored ::before overlay, massive headline
5. Write 3-4 content sections — EACH different layout, ONE dark section mandatory
6. Alternating backgrounds: light → tinted → dark brand → light
7. Write contact form + footer with SVG social icons
8. Write JS: Lenis smooth scroll → GSAP ScrollTrigger → hero animations → scroll reveals → parallax → custom cursor → form validation → mobile menu
9. VERIFY: every niche looks COMPLETELY different (colors, fonts, layout, button shapes, animations)

Return COMPLETE code:
<!-- HTML -->
[body content — no wrapper tags, no script CDN tags]

/* CSS */
[@import fonts → :root tokens → reset → all styles with niche colors]

// JavaScript
[Lenis + GSAP + ScrollTrigger + all interactivity in try-catch]`;

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
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 64000,
            temperature: !isNewDesign && isTargetedEdit ? 0.3 : 0.7,
            system: systemPrompt,
            messages: conversationMessages
        });

        const generatedCode = response.content[0].text;
        const stopReason = response.stop_reason;
        const wasTruncated = stopReason === 'max_tokens';

        // Log preview for debugging
        console.log(`📝 Response preview (stop_reason: ${stopReason}, truncated: ${wasTruncated}):`);
        console.log(generatedCode.substring(0, 500));

        if (wasTruncated) {
            console.warn('⚠️ RESPONSE TRUNCATED — hit max_tokens limit. CSS/JS may be incomplete.');
        }

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

        // ============================================
        // TRUNCATION RECOVERY — Fix incomplete CSS/JS
        // ============================================
        if (wasTruncated) {
            // Fix truncated CSS — close any unclosed braces
            if (css) {
                let openBraces = 0;
                for (const ch of css) {
                    if (ch === '{') openBraces++;
                    else if (ch === '}') openBraces--;
                }
                if (openBraces > 0) {
                    console.log(`🔧 Fixing ${openBraces} unclosed CSS brace(s) from truncation`);
                    css += '\n' + '}'.repeat(openBraces);
                }
            }
        }

        // CSS SAFETY NET — Ensure critical elements always have base styles
        // This prevents giant unstyled elements when AI CSS is incomplete
        const cssSafetyNet = `
/* Safety net — base styles for elements the AI may have missed */
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; padding: 0; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
img { max-width: 100%; height: auto; display: block; object-fit: cover; }
button, .btn, [class*="btn"], [class*="cta"] { cursor: pointer; font-family: inherit; }
a { text-decoration: none; color: inherit; }
ul, ol { list-style: none; padding: 0; margin: 0; }
h1, h2, h3, h4, h5, h6 { margin: 0; line-height: 1.2; overflow-wrap: break-word; }
p { margin: 0; }
section, .section { overflow: hidden; }
input, textarea, select { font-family: inherit; font-size: inherit; max-width: 100%; }
`;
        // Only prepend safety net if CSS doesn't already have a universal reset
        if (css && !css.includes('*, *::before, *::after')) {
            css = cssSafetyNet + '\n' + css;
            console.log('🛡️ CSS safety net prepended');
        }

        // HERO FIX — Ensure hero is always full viewport height with proper navbar offset
        if (html && css) {
            const hasFixedNav = css.includes('position: fixed') || css.includes('position:fixed') ||
                                css.includes('position: sticky') || css.includes('position:sticky');

            const heroFixes = [];

            // Fix 1: Hero must be full viewport height
            if (!css.includes('.hero') || !(/\.hero[^{]*\{[^}]*min-height\s*:\s*100vh/i.test(css))) {
                heroFixes.push('.hero, [class*="hero"] { min-height: 100vh; display: flex; align-items: center; justify-content: center; position: relative; }');
                console.log('🔧 Hero min-height: 100vh injected');
            }

            // Fix 2: Fixed navbar offset
            if (hasFixedNav) {
                heroFixes.push('.hero, [class*="hero"], section:first-of-type { padding-top: 100px; }');
                console.log('🔧 Fixed navbar offset injected');
            }

            // Fix 3: Hero overlay for text readability on background images — NICHE-COLORED
            if (!css.includes('.hero::before') && !css.includes('.hero:before')) {
                const overlayMap = {
                    pets: 'linear-gradient(135deg, rgba(249,115,22,0.8), rgba(120,53,15,0.6))',
                    beauty: 'linear-gradient(135deg, rgba(183,110,121,0.8), rgba(26,26,46,0.6))',
                    homeservices: 'linear-gradient(135deg, rgba(37,99,235,0.8), rgba(30,41,59,0.6))',
                    church: 'linear-gradient(135deg, rgba(124,58,237,0.8), rgba(30,27,75,0.6))',
                    sports: 'linear-gradient(135deg, rgba(22,163,74,0.8), rgba(24,24,27,0.6))',
                    food: 'linear-gradient(135deg, rgba(236,72,153,0.8), rgba(120,53,15,0.6))',
                    consulting: 'linear-gradient(135deg, rgba(30,58,95,0.85), rgba(71,85,105,0.6))',
                    restaurant: 'linear-gradient(135deg, rgba(114,47,55,0.85), rgba(212,168,83,0.5))',
                    technology: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(99,102,241,0.6))',
                    fitness: 'linear-gradient(135deg, rgba(26,26,26,0.85), rgba(255,107,0,0.5))',
                    health: 'linear-gradient(135deg, rgba(59,130,246,0.8), rgba(13,148,136,0.5))',
                    legal: 'linear-gradient(135deg, rgba(30,58,95,0.85), rgba(107,58,42,0.5))',
                    ecommerce: 'linear-gradient(135deg, rgba(26,26,46,0.8), rgba(16,185,129,0.4))',
                    realestate: 'linear-gradient(135deg, rgba(71,85,105,0.85), rgba(212,168,83,0.4))',
                    education: 'linear-gradient(135deg, rgba(59,130,246,0.8), rgba(245,158,11,0.4))',
                    creative: 'linear-gradient(135deg, rgba(0,0,0,0.85), rgba(0,0,0,0.6))',
                    finance: 'linear-gradient(135deg, rgba(30,64,175,0.85), rgba(22,101,52,0.5))',
                    travel: 'linear-gradient(135deg, rgba(14,165,233,0.8), rgba(251,146,60,0.5))',
                    nonprofit: 'linear-gradient(135deg, rgba(146,64,14,0.8), rgba(15,118,110,0.5))',
                    automotive: 'linear-gradient(135deg, rgba(10,10,10,0.9), rgba(220,38,38,0.5))',
                    wedding: 'linear-gradient(135deg, rgba(183,110,121,0.7), rgba(212,168,83,0.4))',
                    gaming: 'linear-gradient(135deg, rgba(9,9,11,0.9), rgba(168,85,247,0.6))'
                };
                const overlay = overlayMap[niche.name] || 'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6))';
                heroFixes.push(`.hero::before, [class*="hero"]::before { content: ""; position: absolute; inset: 0; background: ${overlay}; z-index: 1; }`);
                heroFixes.push('.hero > *, [class*="hero"] > * { position: relative; z-index: 2; }');
                console.log(`🔧 Hero overlay injected [niche: ${niche.name}]`);
            }

            if (heroFixes.length > 0) {
                css += '\n/* Auto-fix: hero section guarantees */\n' + heroFixes.join('\n') + '\n';
            }
        }

        // HERO STRUCTURE GUARANTEE — Ensure hero ALWAYS has proper wrapper and background image
        if (html && isNewDesign && contextualImages.length > 0) {
            const heroImageUrl = contextualImages[0].url;

            // Check if HTML has a proper hero section/header/main wrapper with "hero" in class
            const hasHeroSection = /<(?:section|header|main)\s+[^>]*class\s*=\s*["'][^"']*hero/i.test(html);

            if (!hasHeroSection) {
                // Look for orphaned hero content (div with "hero" in class but no section wrapper)
                const heroContentRegex = /<div\s+[^>]*class\s*=\s*["'][^"']*hero[^"']*["'][^>]*>/i;
                const heroContentMatch = html.match(heroContentRegex);

                if (heroContentMatch) {
                    const startIndex = html.indexOf(heroContentMatch[0]);
                    let depth = 1; // Already found the opening <div
                    let searchFrom = startIndex + heroContentMatch[0].length;
                    let endIndex = -1;

                    while (searchFrom < html.length) {
                        const nextOpen = html.indexOf('<div', searchFrom);
                        const nextClose = html.indexOf('</div>', searchFrom);

                        if (nextClose === -1) break;

                        if (nextOpen !== -1 && nextOpen < nextClose) {
                            depth++;
                            searchFrom = nextOpen + 4;
                        } else {
                            depth--;
                            if (depth === 0) {
                                endIndex = nextClose + 6;
                                break;
                            }
                            searchFrom = nextClose + 6;
                        }
                    }

                    if (endIndex !== -1) {
                        const heroContent = html.substring(startIndex, endIndex);
                        const heroWrapper = `<section class="hero" id="home">\n${heroContent}\n</section>`;
                        html = html.substring(0, startIndex) + heroWrapper + html.substring(endIndex);
                        console.log('🔧 Hero wrapper injected — wrapped orphaned hero content in <section class="hero">');
                    }
                } else {
                    // No hero content found at all — inject after navbar
                    const navEnd = html.match(/<\/nav>/i);
                    if (navEnd) {
                        const insertAt = html.indexOf(navEnd[0]) + navEnd[0].length;
                        const heroSection = `\n<section class="hero" id="home">\n  <div class="hero__container">\n    <h1 class="hero__title">Welcome</h1>\n    <p class="hero__subtitle">Experience excellence in everything we do</p>\n    <a href="#contact" class="hero__cta">Get Started</a>\n  </div>\n</section>`;
                        html = html.substring(0, insertAt) + heroSection + html.substring(insertAt);
                        console.log('🔧 Hero section injected — no hero found, added after navbar');
                    }
                }
            }

            // Ensure CSS has hero background-image
            const hasHeroBgInHtml = /class\s*=\s*["'][^"']*hero[^"']*["'][^>]*style\s*=\s*["'][^"']*background-image/i.test(html);
            const hasHeroBgInCss = /\.hero[^}]*background-image\s*:\s*url/i.test(css);

            if (!hasHeroBgInHtml && !hasHeroBgInCss && css) {
                css += `\n/* Auto-fix: hero background image */\n.hero, [class*="hero-section"], [class*="hero-banner"] {\n  background-image: url('${heroImageUrl}');\n  background-size: cover;\n  background-position: center;\n  background-attachment: fixed;\n}\n`;
                console.log('🔧 Hero background-image injected from contextual images');
            }
        }

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

        // JS RECOVERY — If JS is missing (usually from truncation), generate it separately
        if (!js && html && isNewDesign) {
            console.log('🔧 JS missing — generating separately...');
            try {
                const jsResponse = await anthropic.messages.create({
                    model: 'claude-sonnet-4-5-20250929',
                    max_tokens: 2000,
                    temperature: 0.3,
                    system: 'You are a frontend JavaScript expert. Generate ONLY vanilla JavaScript code. No explanations, no markdown, no code blocks. Just raw JavaScript.',
                    messages: [{
                        role: 'user',
                        content: `Add interactivity to this website HTML. Include: mobile menu toggle, smooth scroll for anchor links, scroll-triggered animations (fade-in on scroll using IntersectionObserver), and active nav link highlighting. Wrap everything in DOMContentLoaded and try-catch.\n\nHTML structure:\n${html.substring(0, 3000)}`
                    }]
                });

                js = jsResponse.content[0].text
                    .replace(/```(?:javascript|js)?\s*/gi, '')
                    .replace(/```\s*/g, '')
                    .trim();

                console.log(`✅ JS recovered separately: ${js.length} chars`);
            } catch (jsErr) {
                console.warn('⚠️ JS recovery failed:', jsErr.message);
            }
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
1. Return ONLY the modified element with its SAME tag — do not change the outer tag type or wrap it in a parent
2. If CSS changes are needed, include them in a /* ELEMENT_CSS */ block with COMPLETE property declarations
3. Keep the element structure intact unless explicitly asked to change it
4. Preserve all existing classes, IDs, and attributes unless the change requires modifying them
5. Ensure the element has a descriptive class name
6. Be precise — change only what's requested
7. The modified element must be complete and valid HTML
8. If the user asks about spacing, overlap, or positioning issues, provide COMPLETE CSS rules that fix the root cause (padding, margin, z-index, position, top, etc.) — not just a single property
9. If removing an element, replace it with an empty <div> with the SAME class and style="display:none" — do NOT change the tag type
10. NEVER return a parent container when only the child element was selected — keep scope tight

RESPONSE FORMAT:
If only HTML changes:
<!-- ELEMENT -->
<modified element html here>

If CSS changes are also needed:
<!-- ELEMENT -->
<modified element html here>

/* ELEMENT_CSS */
.selector {
  property: value;
  property: value;
}

NO explanations, NO markdown, NO extra text — just the element code.`;

        // Extract relevant CSS rules for this element to give AI context
        let relevantCss = '';
        const elementClassMatch = elementHtml.match(/class\s*=\s*["']([^"']+)["']/);
        if (currentCss && elementClassMatch) {
            const className = elementClassMatch[1].split(/\s+/)[0];
            const cssRuleRegex = new RegExp(`\\.${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{]*\\{[^}]*\\}`, 'gi');
            const cssMatches = currentCss.match(cssRuleRegex);
            if (cssMatches) {
                relevantCss = cssMatches.join('\n');
            }
        }

        const userMessage = `ELEMENT TO EDIT (${elementPath}):
${elementHtml}

${relevantCss ? `CURRENT CSS FOR THIS ELEMENT:\n${relevantCss}\n` : ''}
USER REQUEST: ${prompt}

Return the modified element. If you need to add/modify CSS, include COMPLETE CSS rules in a /* ELEMENT_CSS */ block.`;

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
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
