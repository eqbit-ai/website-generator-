// backend/routes/generator.js
// Premium Website Generator with Conversation Context

const express = require('express');
const router = express.Router();

let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
    try {
        const Anthropic = require('@anthropic-ai/sdk');
        anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        console.log('✅ Generator: Anthropic ready');
    } catch (e) {
        console.log('⚠️ Generator: Anthropic not available');
    }
}

// Session storage (in production, use Redis or database)
const designSessions = new Map();

// Design style templates
const DESIGN_STYLES = {
    modern: 'Clean, minimalist design with subtle animations, glassmorphism effects, modern gradients',
    premium: 'Luxury design with elegant typography, sophisticated color palette, premium feel',
    corporate: 'Professional business design with structured layout, trust-building elements',
    creative: 'Bold, artistic design with unique layouts, vibrant colors, creative typography',
    tech: 'Futuristic tech design with dark theme, neon accents, tech-inspired elements',
    minimal: 'Ultra-minimalist with lots of whitespace, simple typography, subtle colors'
};

// Professional color palettes
const COLOR_PALETTES = [
    { name: 'Ocean', colors: '#0A2463, #3E92CC, #FFFAFF, #D8315B, #1E1B18' },
    { name: 'Sunset', colors: '#F72585, #B5179E, #7209B7, #560BAD, #480CA8' },
    { name: 'Forest', colors: '#2D6A4F, #40916C, #52B788, #74C69D, #95D5B2' },
    { name: 'Midnight', colors: '#03045E, #023E8A, #0077B6, #0096C7, #00B4D8' },
    { name: 'Elegance', colors: '#22223B, #4A4E69, #9A8C98, #C9ADA7, #F2E9E4' }
];

function getRandomPalette() {
    return COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)];
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
            createdAt: new Date().toISOString()
        });
    }

    return designSessions.get(sessionId);
}

// Check if user wants a new design
function wantsNewDesign(prompt) {
    const newDesignKeywords = [
        'new design',
        'start over',
        'create new',
        'make new',
        'different design',
        'another design',
        'fresh design',
        'from scratch'
    ];

    const p = prompt.toLowerCase();
    return newDesignKeywords.some(keyword => p.includes(keyword));
}

// Generate website
router.post('/generate', async (req, res) => {
    try {
        const { prompt, sessionId, style } = req.body;

        if (!prompt || !prompt.trim()) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        if (!anthropic) {
            return res.status(500).json({ error: 'AI service not available' });
        }

        // Set timeout to 5 minutes
        req.setTimeout(300000);
        res.setTimeout(300000);

        const session = getSession(sessionId);
        const isNewDesign = !session.currentDesign || wantsNewDesign(prompt);

        console.log(`🎨 ${isNewDesign ? 'NEW DESIGN' : 'ITERATING'}: "${prompt.substring(0, 50)}..."`);

        // Choose design style and palette
        if (isNewDesign || !session.style) {
            session.style = style || Object.keys(DESIGN_STYLES)[Math.floor(Math.random() * Object.keys(DESIGN_STYLES).length)];
            session.palette = getRandomPalette();
            session.conversationHistory = []; // Reset history for new design
        }

        const styleDescription = DESIGN_STYLES[session.style] || DESIGN_STYLES.modern;
        const paletteInfo = session.palette;

        // Build conversation history
        const conversationMessages = [...session.conversationHistory];

        // Create the prompt based on whether it's new or iteration
        let systemPrompt, userMessage;

        if (isNewDesign) {
            systemPrompt = `You are an expert front-end developer and UI/UX designer specializing in creating premium, professional landing pages.

CRITICAL REQUIREMENTS:
1. Generate COMPLETE, PRODUCTION-READY code in a SINGLE response
2. Return code in this EXACT format:
   <!-- HTML -->
   [complete HTML here]

   /* CSS */
   [complete CSS here]

   // JavaScript
   [complete JavaScript here]

3. NO markdown code blocks (no \`\`\`html, \`\`\`css, etc.)
4. NO explanations, comments, or text outside the code
5. HTML must be complete body content (no <html>, <head>, <body> tags)

DESIGN PRINCIPLES:
- Premium, professional quality that looks expensive
- Modern design trends: glassmorphism, gradients, animations
- Fully responsive (mobile-first)
- Proper spacing, typography hierarchy, visual balance
- Smooth animations and micro-interactions
- Use Google Fonts (import at top of CSS)
- Real placeholder images from https://images.unsplash.com (specific, relevant)
- Accessible (ARIA labels, semantic HTML)

STYLE: ${styleDescription}
COLOR PALETTE: ${paletteInfo.name} - Use these colors: ${paletteInfo.colors}

STRUCTURE:
- Hero section with strong visual impact
- Clear value proposition
- Feature sections with icons/images
- Social proof (testimonials/stats)
- Call-to-action sections
- Footer

INTERACTIVE ELEMENTS:
- Smooth scroll animations (on scroll reveal)
- Hover effects on buttons and cards
- Mobile menu toggle
- Form validation if forms present
- Parallax effects where appropriate

NEVER include incomplete code, placeholders, or TODO comments.`;

            userMessage = `Create a premium landing page for: ${prompt}

Generate COMPLETE code with:
- Professional HTML structure
- Full CSS styling with animations
- Interactive JavaScript
- Real images from Unsplash (specific to the topic)
- Mobile-responsive design

Return in format:
<!-- HTML -->
[code]

/* CSS */
[code]

// JavaScript
[code]`;

        } else {
            // Iteration mode
            systemPrompt = `You are an expert front-end developer iterating on an existing design.

CRITICAL REQUIREMENTS:
1. Modify the existing code based on the user's request
2. Return COMPLETE code (not just changes)
3. Return code in this EXACT format:
   <!-- HTML -->
   [complete modified HTML]

   /* CSS */
   [complete modified CSS]

   // JavaScript
   [complete modified JavaScript]

4. NO markdown code blocks
5. NO explanations outside the code
6. Maintain the existing design style: ${styleDescription}
7. Keep the color palette: ${paletteInfo.name} - ${paletteInfo.colors}

WHEN MODIFYING:
- Preserve the overall design aesthetic
- Make requested changes cleanly
- Don't break existing functionality
- Keep responsive behavior
- Maintain animations and interactions`;

            userMessage = `Current website code:
${session.currentDesign}

User request: ${prompt}

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
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8192,
            temperature: 0.7,
            system: systemPrompt,
            messages: conversationMessages
        });

        const generatedCode = response.content[0].text;

        // Parse the response
        const htmlMatch = generatedCode.match(/<!-- HTML -->([\s\S]*?)(?=\/\* CSS \*\/|$)/);
        const cssMatch = generatedCode.match(/\/\* CSS \*\/([\s\S]*?)(?=\/\/ JavaScript|$)/);
        const jsMatch = generatedCode.match(/\/\/ JavaScript([\s\S]*?)$/);

        let html = htmlMatch ? htmlMatch[1].trim() : '';
        let css = cssMatch ? cssMatch[1].trim() : '';
        let js = jsMatch ? jsMatch[1].trim() : '';

        // Fallback: if sections not found, try to extract by patterns
        if (!html || !css) {
            console.log('⚠️ Using fallback extraction');
            // Try to find any HTML tags
            const bodyMatch = generatedCode.match(/<(?:div|section|header|nav|main|footer)[^>]*>[\s\S]*<\/(?:div|section|header|nav|main|footer)>/);
            if (bodyMatch) html = bodyMatch[0];

            // Try to find CSS (anything with selectors and braces)
            const cssPattern = /(?:@import[^;]+;)?[\s\S]*?(?:[.#][\w-]+|[\w-]+)\s*\{[^}]+\}/g;
            const cssMatches = generatedCode.match(cssPattern);
            if (cssMatches) css = cssMatches.join('\n');

            // Try to find JS
            const jsPattern = /(?:document\.|window\.|function\s+|const\s+|let\s+|var\s+)[\s\S]*?[;}]/g;
            const jsMatches = generatedCode.match(jsPattern);
            if (jsMatches) js = jsMatches.join('\n');
        }

        // Store in session
        session.currentDesign = generatedCode;
        session.conversationHistory.push(
            { role: 'user', content: userMessage },
            { role: 'assistant', content: generatedCode }
        );

        console.log(`✅ Generated ${html.length} chars HTML, ${css.length} chars CSS, ${js.length} chars JS`);

        res.json({
            success: true,
            sessionId: session.id,
            isNewDesign,
            style: session.style,
            palette: session.palette.name,
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
            messageCount: session.conversationHistory.length,
            createdAt: session.createdAt
        }
    });
});

// Clear session (start fresh)
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
