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
        let isTargetedEdit = false;

        if (isNewDesign) {
            // Reset history for new design
            session.conversationHistory = [];

            // Build image list for AI with explicit instructions
            const imageUrls = contextualImages.length > 0
                ? `🚨 MUST USE THESE EXACT URLS IN <img src="..."> TAGS - NO PLACEHOLDERS:\n${contextualImages.map((img, i) =>
                    `${i + 1}. ${img.url}\n   Alt text: "${img.alt}"`
                ).join('\n\n')}`
                : 'No images loaded - use source.unsplash.com URLs with relevant search terms';

            systemPrompt = `You are a senior UI/UX and front-end architect who creates stunning, premium websites with UNIQUE layouts.

LAYOUT SELECTION (CRITICAL):
You have 8 predefined website layout patterns. Analyze the user's prompt and SELECT ONE layout that best fits:

1. **Hero-led SaaS layout**: Large hero with CTA above fold, feature grid below, pricing, testimonials
   Best for: Software, apps, platforms, tech services

2. **Split-screen feature layout**: Alternating left/right image-text sections, each feature highlighted
   Best for: Product showcases, services with multiple benefits

3. **Dashboard-style app layout**: Card-based layout, data visualization feel, metrics/stats prominent
   Best for: Analytics, SaaS dashboards, data products

4. **Minimal portfolio layout**: Large white space, image-focused, elegant typography, simple navigation
   Best for: Creatives, designers, photographers, artists

5. **Content-first blog layout**: Article/card grid, sidebar, featured posts, category filters
   Best for: Blogs, news, content sites, magazines

6. **Conversion-focused landing page**: Single column, progressive disclosure, strong CTAs, urgency elements
   Best for: Product launches, lead generation, campaigns

7. **Marketplace/listing layout**: Grid of items/products, filters, search, category navigation
   Best for: E-commerce, directories, marketplaces, catalogs

8. **Storytelling brand layout**: Narrative flow, parallax, full-width sections, emotional design
   Best for: Brand sites, luxury products, storytelling businesses

PROCESS:
1. Analyze the business type from the prompt
2. SELECT ONE layout from above
3. Log your choice: "Using Layout #X: [name] because [reason]"
4. Generate the COMPLETE website using ONLY that layout pattern
5. DO NOT mix layouts - commit to your choice

CRITICAL FORMAT REQUIREMENTS (MUST FOLLOW EXACTLY):
1. Start with EXACTLY: <!-- HTML -->
2. Then ALL HTML code (body content only, no <html>, <head>, <body> tags)
3. Then EXACTLY: /* CSS */
4. Then ALL CSS code (complete styles for every element)
5. Then EXACTLY: // JavaScript
6. Then ALL JavaScript code (complete interactivity)

EXAMPLE FORMAT:
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

IMAGES - CRITICAL REQUIREMENT:
🚨 IMPORTANT: You MUST use the EXACT image URLs provided in the "CONTEXT-AWARE IMAGES PROVIDED" section below
- DO NOT use placeholder text like "Image Loading..." or "[Image will load here]"
- DO NOT use generic Unsplash URLs
- USE ONLY the specific URLs provided below in <img src="..."> tags
- Images are already contextually relevant to the topic
- Place them strategically throughout the design (hero section, features, gallery, etc.)
- Apply professional image treatments (overlays, filters, shapes, rounded corners, shadows, etc.)
- Ensure images are responsive with proper CSS (max-width: 100%, height: auto)
- Add loading="lazy" for performance
- Example: <img src="https://images.unsplash.com/photo-..." alt="..." class="hero-image" loading="lazy">

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

            userMessage = `Create a premium website for: ${prompt}

STEP 1 - SELECT LAYOUT (in your mind, don't output this):
- Analyze the business type
- Choose ONE of the 8 layouts that fits best
- If 2 layouts fit equally, pick one randomly
- Commit to that layout pattern

STEP 2 - GENERATE:
1. Use ONLY the chosen layout structure
2. Design appropriate visual style (colors, fonts, mood) for the business
3. 🚨 CRITICAL: Use the EXACT Unsplash image URLs provided above in <img src="..."> tags - NO placeholder text!
4. Ensure EVERY element has complete CSS styling
5. Include a functional contact form (always required)
6. Include a comprehensive footer (always required)
7. Make it fully responsive and interactive
8. Add smooth animations and modern effects

Generate COMPLETE code with HTML, CSS, and JavaScript.

Return in EXACT format:
<!-- HTML -->
[code]

/* CSS */
[code]

// JavaScript
[code]`;

        } else {
            // Iteration mode - Detect if it's a targeted edit or full redesign
            const targetedEditKeywords = [
                'add image', 'change image', 'replace image', 'update image',
                'change color', 'update color', 'make bigger', 'make smaller',
                'change text', 'update text', 'add button', 'change font',
                'hero section', 'header section', 'footer section',
                'fix', 'adjust', 'tweak', 'modify'
            ];

            isTargetedEdit = targetedEditKeywords.some(keyword =>
                prompt.toLowerCase().includes(keyword)
            );

            if (isTargetedEdit) {
                systemPrompt = `You are an expert front-end developer making TARGETED EDITS to an existing design.

🚨 CRITICAL: This is a SMALL CHANGE request. DO NOT redesign the website!

REQUIREMENTS:
1. Make ONLY the specific change requested by the user
2. Keep EVERYTHING else EXACTLY the same (layout, colors, fonts, spacing, animations, etc.)
3. Do NOT regenerate or rewrite sections that weren't mentioned
4. Return COMPLETE code (with your targeted changes applied)
5. Maintain the exact same design aesthetic
6. Return in EXACT format:
   <!-- HTML -->
   [complete HTML with targeted change]

   /* CSS */
   [complete CSS with targeted change]

   // JavaScript
   [complete JavaScript]

EXAMPLES OF TARGETED EDITS:
- "add image to hero" → Only change hero <img src="..."> URL, keep everything else
- "change color to blue" → Only update color CSS variables, keep layout/content
- "make heading bigger" → Only adjust font-size in CSS, keep everything else
- "fix button alignment" → Only tweak button CSS, keep rest intact

🚨 DO NOT:
- Redesign unrelated sections
- Change the overall layout
- Add new sections unless explicitly asked
- Remove existing features
- Change color schemes unless asked
- Modify animations unless asked`;
            } else {
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
            }

            userMessage = `Current website code:
${session.currentDesign}

User request: ${prompt}

${isTargetedEdit ? '🚨 REMINDER: Make ONLY the specific change requested. Keep everything else IDENTICAL!' : ''}

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
        console.log(`🤖 Calling Claude API... ${!isNewDesign && isTargetedEdit ? '(Targeted Edit Mode)' : ''}`);
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16000, // Increased for complete websites with CSS/JS
            temperature: !isNewDesign && isTargetedEdit ? 0.3 : 0.7, // Lower temp for targeted edits = more precise
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
            console.error('Response length:', generatedCode.length);
            console.error('Full response sample:');
            console.error(generatedCode.substring(0, 2000));
        } else if (css.length < 500) {
            console.warn('⚠️ WARNING: CSS seems too short (< 500 chars)');
            console.warn('CSS content:', css.substring(0, 200));
        }

        // CRITICAL: If CSS is missing or too short, return error
        if (!css || css.length < 100) {
            console.error('\n❌ ABORTING: CSS extraction failed completely');
            console.error('Cannot return website without CSS - would be unstyled');

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

        console.log(`✅ Generated ${html.length} chars HTML, ${css.length} chars CSS, ${js.length} chars JS\n`);

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

// Edit a single element (token-efficient)
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

        // Token-efficient prompt - only send the element, not the full page
        const systemPrompt = `You are an expert front-end developer making a TARGETED EDIT to a single HTML element.

TASK: Modify ONLY the provided element based on the user's request.

RULES:
1. Return ONLY the modified element HTML - nothing else
2. If CSS changes are needed, include them in a style attribute OR return a separate CSS block
3. Keep the element structure intact unless explicitly asked to change it
4. Preserve all existing classes, IDs, and attributes unless the change requires modifying them
5. Be precise - change only what's requested

RESPONSE FORMAT:
If only HTML changes:
<!-- ELEMENT -->
<modified element html here>

If CSS changes are also needed:
<!-- ELEMENT -->
<modified element html here>

/* ELEMENT_CSS */
.selector { property: value; }`;

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
            // Fallback: assume the whole response is the element
            newElementHtml = result.replace(/\/\*\s*ELEMENT_CSS\s*\*\/[\s\S]*$/, '').trim();
        }

        // Extract CSS if present
        const cssMatch = result.match(/\/\*\s*ELEMENT_CSS\s*\*\/([\s\S]*?)$/i);
        if (cssMatch) {
            newElementCss = cssMatch[1].trim();
        }

        // Clean up any markdown
        newElementHtml = newElementHtml.replace(/```html?\s*/gi, '').replace(/```\s*$/g, '').trim();
        newElementCss = newElementCss.replace(/```css?\s*/gi, '').replace(/```\s*$/g, '').trim();

        if (!newElementHtml) {
            return res.status(500).json({ error: 'Failed to generate element edit' });
        }

        // Replace the element in the full HTML
        let updatedHtml = currentHtml;
        let matchFound = false;

        // Method 1: Try exact match first
        if (currentHtml.includes(elementHtml)) {
            updatedHtml = currentHtml.replace(elementHtml, newElementHtml);
            matchFound = true;
            console.log('✅ Element replaced via exact match');
        }

        // Method 2: Try matching by opening tag (class/id based)
        if (!matchFound) {
            // Extract the opening tag from the original element
            const openingTagMatch = elementHtml.match(/^<(\w+)([^>]*)>/);
            if (openingTagMatch) {
                const tagName = openingTagMatch[1];
                const attributes = openingTagMatch[2];

                // Extract class and id for matching
                const classMatch = attributes.match(/class\s*=\s*["']([^"']+)["']/);
                const idMatch = attributes.match(/id\s*=\s*["']([^"']+)["']/);

                let searchPattern = null;

                if (idMatch) {
                    // Match by ID (most specific)
                    const escapedId = idMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    searchPattern = new RegExp(`<${tagName}[^>]*id\\s*=\\s*["']${escapedId}["'][^>]*>[\\s\\S]*?<\\/${tagName}>`, 'i');
                } else if (classMatch) {
                    // Match by class (get first class for specificity)
                    const firstClass = classMatch[1].split(/\s+/)[0];
                    const escapedClass = firstClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    searchPattern = new RegExp(`<${tagName}[^>]*class\\s*=\\s*["'][^"']*${escapedClass}[^"']*["'][^>]*>[\\s\\S]*?<\\/${tagName}>`, 'i');
                }

                if (searchPattern && searchPattern.test(currentHtml)) {
                    updatedHtml = currentHtml.replace(searchPattern, newElementHtml);
                    matchFound = true;
                    console.log('✅ Element replaced via tag/class/id match');
                }
            }
        }

        // Method 3: Try flexible whitespace matching
        if (!matchFound) {
            const escapedOriginal = elementHtml.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const flexibleRegex = new RegExp(escapedOriginal.replace(/\s+/g, '\\s*'), 'i');
            if (flexibleRegex.test(currentHtml)) {
                updatedHtml = currentHtml.replace(flexibleRegex, newElementHtml);
                matchFound = true;
                console.log('✅ Element replaced via flexible whitespace match');
            }
        }

        // Method 4: Try matching just by the element's text content (for simple elements)
        if (!matchFound && elementPath) {
            // For elements with unique identifiers in the path, try to find similar structure
            const pathParts = elementPath.split('.');
            if (pathParts.length > 1) {
                const className = pathParts[pathParts.length - 1];
                const tagName = pathParts[0].split('#')[0];

                // Find elements with this class
                const classRegex = new RegExp(`<${tagName}[^>]*class\\s*=\\s*["'][^"']*${className}[^"']*["'][^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gi');
                const matches = currentHtml.match(classRegex);

                if (matches && matches.length === 1) {
                    // Only one match, safe to replace
                    updatedHtml = currentHtml.replace(matches[0], newElementHtml);
                    matchFound = true;
                    console.log('✅ Element replaced via path-based class match');
                }
            }
        }

        if (!matchFound) {
            console.log('⚠️ Could not find element in HTML');
            // Instead of failing, return the new element and let the user know
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

        // Append new CSS if any
        let updatedCss = currentCss;
        if (newElementCss) {
            updatedCss = currentCss + '\n\n/* Element Edit */\n' + newElementCss;
            console.log('✅ CSS updated');
        }

        // Update session if it exists
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
