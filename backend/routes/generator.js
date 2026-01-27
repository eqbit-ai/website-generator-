// backend/routes/generator.js
// AI-Driven Premium Website Generator with Context-Aware Images

const express = require('express');
const router = express.Router();
const unsplashService = require('../services/unsplashService');

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
        const { prompt, sessionId } = req.body;

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

        // Create the prompt based on whether it's new or iteration
        let systemPrompt, userMessage;

        if (isNewDesign) {
            // Reset history for new design
            session.conversationHistory = [];

            // Build image list for AI
            const imageUrls = contextualImages.map((img, i) =>
                `Image ${i + 1}: ${img.url} (${img.alt})`
            ).join('\n');

            systemPrompt = `You are an elite front-end developer and UI/UX designer who creates stunning, premium websites that make users say "WOW".

CRITICAL FORMAT REQUIREMENTS (MUST FOLLOW EXACTLY):
1. Start your response with EXACTLY: <!-- HTML -->
2. Then write ALL the HTML code (body content only, no <html>, <head>, <body> tags)
3. Then write EXACTLY: /* CSS */
4. Then write ALL the CSS code (complete styles for every element)
5. Then write EXACTLY: // JavaScript
6. Then write ALL the JavaScript code (complete interactivity)

EXAMPLE FORMAT (FOLLOW THIS EXACTLY):
<!-- HTML -->
<nav>...</nav>
<header>...</header>
...all HTML here...

/* CSS */
* { margin: 0; padding: 0; }
body { font-family: 'Poppins', sans-serif; }
...all CSS here...

// JavaScript
document.addEventListener('DOMContentLoaded', function() {
  ...all JS here...
});

CRITICAL RULES:
- NO explanations before or after code
- NO markdown code blocks (\`\`\`html, \`\`\`css, \`\`\`)
- NO text outside the three sections
- ALL code must be COMPLETE and PRODUCTION-READY

DESIGN PHILOSOPHY - CREATE PREMIUM, UNIQUE DESIGNS:
- You have COMPLETE CREATIVE FREEDOM to design based on the user's prompt
- Analyze the prompt and create a design style that perfectly matches the business/topic
- Choose colors, fonts, layouts, and animations that fit the brand identity
- Make it PREMIUM - sophisticated, polished, professional, expensive-looking
- Make it UNIQUE - avoid generic templates, create something memorable
- EVERY element must be fully styled - NO unstyled HTML elements
- NO default browser styling should be visible anywhere

CSS COVERAGE - CRITICAL:
- Style EVERY SINGLE element: divs, sections, headers, paragraphs, lists, links, buttons, forms, inputs, labels, etc.
- Set font-family on body AND specific elements
- Define colors, backgrounds, padding, margins, borders for ALL elements
- Add hover states, transitions, animations throughout
- Ensure ALL text has proper typography (size, weight, line-height, letter-spacing)
- NO element should look like plain HTML

MODERN DESIGN TECHNIQUES:
- CSS Grid and Flexbox for layouts
- Glassmorphism, gradients, shadows, backdrop filters
- Smooth animations (scroll reveals, hover effects, transitions)
- Modern typography (Google Fonts - choose appropriate fonts for the brand)
- Micro-interactions and delightful details
- Parallax effects, image overlays, creative shapes
- Professional color schemes (analyze the business and choose appropriately)
- Premium spacing and visual hierarchy

RESPONSIVE DESIGN:
- Mobile-first approach
- Fluid typography and spacing
- Responsive images and layouts
- Mobile navigation (hamburger menu)
- Touch-friendly buttons and interactive elements
- Test breakpoints: 320px, 768px, 1024px, 1440px

REQUIRED SECTIONS (ALWAYS INCLUDE):
1. Navigation bar (sticky/fixed)
2. Hero section (attention-grabbing, full viewport height)
3. Content sections (features, services, about, etc. - based on prompt)
4. Contact form section with:
   - Name input field
   - Email input field
   - Message/Subject textarea
   - Submit button
   - Full form validation (JavaScript)
   - Beautiful styling
5. Footer section with:
   - Placeholder for company info
   - Social media links (placeholders)
   - Copyright notice
   - Additional footer content as appropriate

IMAGES (Use provided contextual images):
- Use the specific Unsplash URLs provided below
- Images are already contextually relevant to the topic
- Place them strategically throughout the design
- Apply professional image treatments (overlays, filters, shapes, etc.)
- Ensure images are responsive and optimized

JAVASCRIPT INTERACTIVITY:
- Smooth scroll navigation
- Scroll reveal animations (IntersectionObserver)
- Mobile menu toggle
- Form validation (comprehensive)
- Interactive hover effects
- Parallax scrolling effects
- Any other interactions that enhance the experience

ACCESSIBILITY:
- Semantic HTML5 tags
- ARIA labels where appropriate
- Keyboard navigation support
- Sufficient color contrast
- Alt text for images

CONTEXT-AWARE IMAGES PROVIDED:
${imageUrls || 'No images loaded - use fallback Unsplash URLs with relevant search terms'}

Remember: The user should look at this website and be AMAZED. Make it premium, unique, and fully polished.`;

            userMessage = `Create a premium, unique, fully-styled website for: ${prompt}

Based on this prompt, you should:
1. Analyze what type of business/topic this is
2. Design an appropriate visual style (colors, fonts, layout, mood)
3. Create a unique, memorable design that fits the brand
4. Use the provided Unsplash images contextually
5. Ensure EVERY element has complete CSS styling
6. Include a functional contact form
7. Include a comprehensive footer
8. Make it responsive and interactive
9. Add smooth animations and modern effects

Generate COMPLETE code with HTML, CSS, and JavaScript.

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

WHEN MODIFYING:
- If user says "new design" or "different design", create a completely new design
- For minor changes, preserve the overall design aesthetic
- Ensure ALL elements remain fully styled (NO unstyled HTML)
- Make requested changes cleanly and professionally
- Don't break existing functionality
- Keep responsive behavior
- Maintain animations and interactions
- If adding new elements, style them completely
- Always maintain contact form and footer sections`;

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
        console.log('🤖 Calling Claude API...');
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16000, // Increased for complete websites with CSS/JS
            temperature: 0.7, // Balanced creativity and instruction following
            system: systemPrompt,
            messages: conversationMessages
        });

        const generatedCode = response.content[0].text;

        // Log first 500 chars to debug format
        console.log('📝 Response preview:', generatedCode.substring(0, 500));

        // Enhanced parsing with multiple pattern attempts
        let html = '', css = '', js = '';

        // Method 1: Try exact delimiters
        let htmlMatch = generatedCode.match(/<!--\s*HTML\s*-->([\s\S]*?)(?=\/\*\s*CSS\s*\*\/|$)/i);
        let cssMatch = generatedCode.match(/\/\*\s*CSS\s*\*\/([\s\S]*?)(?=\/\/\s*JavaScript|$)/i);
        let jsMatch = generatedCode.match(/\/\/\s*JavaScript([\s\S]*?)$/i);

        if (htmlMatch) html = htmlMatch[1].trim();
        if (cssMatch) css = cssMatch[1].trim();
        if (jsMatch) js = jsMatch[1].trim();

        // Method 2: Try with markdown code blocks
        if (!html || !css) {
            console.log('⚠️ Trying markdown block extraction');
            const htmlBlockMatch = generatedCode.match(/```html\s*([\s\S]*?)```/i);
            const cssBlockMatch = generatedCode.match(/```css\s*([\s\S]*?)```/i);
            const jsBlockMatch = generatedCode.match(/```(?:javascript|js)\s*([\s\S]*?)```/i);

            if (htmlBlockMatch && !html) html = htmlBlockMatch[1].trim();
            if (cssBlockMatch && !css) css = cssBlockMatch[1].trim();
            if (jsBlockMatch && !js) js = jsBlockMatch[1].trim();
        }

        // Method 3: Smart extraction by identifying sections
        if (!html || !css) {
            console.log('⚠️ Using smart section extraction');

            // Split by common delimiters
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

        // Method 4: Pattern-based fallback extraction
        if (!html || !css) {
            console.log('⚠️ Using pattern-based fallback');

            // Extract HTML: Look for opening tags to end of last closing tag
            if (!html) {
                const htmlPattern = /<(?:nav|header|div|section|main|footer)[^>]*>[\s\S]*<\/(?:nav|header|div|section|main|footer)>/i;
                const htmlFallback = generatedCode.match(htmlPattern);
                if (htmlFallback) html = htmlFallback[0];
            }

            // Extract CSS: Everything between style rules
            if (!css) {
                // Look for @import or first CSS rule to last closing brace
                const cssStart = generatedCode.search(/(@import|[.#\w][\w-]*\s*\{)/);
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

            // Extract JS: Look for common JS patterns
            if (!js) {
                const jsPattern = /((?:document\.|window\.|const\s+|let\s+|var\s+|function\s+)[\s\S]*)/;
                const jsFallback = generatedCode.match(jsPattern);
                if (jsFallback) js = jsFallback[1].trim();
            }
        }

        // Clean up any remaining delimiters or markdown
        html = html.replace(/```html\s*/gi, '').replace(/```\s*$/g, '').trim();
        css = css.replace(/```css\s*/gi, '').replace(/```\s*$/g, '').trim();
        js = js.replace(/```(?:javascript|js)\s*/gi, '').replace(/```\s*$/g, '').trim();

        // Validate extraction
        if (!html) {
            console.error('❌ CRITICAL: No HTML extracted!');
            console.error('Response length:', generatedCode.length);
            console.error('First 1000 chars:', generatedCode.substring(0, 1000));
        }
        if (!css) {
            console.error('❌ CRITICAL: No CSS extracted!');
            console.error('Response length:', generatedCode.length);
        }

        // Store in session
        session.currentDesign = generatedCode;
        session.conversationHistory.push(
            { role: 'user', content: userMessage },
            { role: 'assistant', content: generatedCode }
        );

        console.log(`✅ Generated ${html.length} chars HTML, ${css.length} chars CSS, ${js.length} chars JS`);

        // Warn if CSS extraction seems incomplete (but still return what we have)
        if (!css || css.length < 100) {
            console.error('⚠️ WARNING: CSS extraction failed or incomplete');
            console.error('Response sample:', generatedCode.substring(0, 1000));
        }

        res.json({
            success: true,
            sessionId: session.id,
            isNewDesign,
            style: 'AI-Generated',
            palette: 'Custom',
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
