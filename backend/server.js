// backend/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Vercel token
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// WEBSITE GENERATION - SPLIT APPROACH
// ============================================

// Step 1: Generate HTML structure
async function generateHTML(prompt, options) {
    const systemPrompt = `You are an expert web developer specializing in semantic HTML5.

YOUR TASK: Generate ONLY the HTML body content for a website.

REQUIREMENTS:
- Use semantic HTML5 tags (header, nav, main, section, article, footer)
- Include proper class names for styling
- Add placeholder text content that matches the website purpose
- Use https://picsum.photos/WIDTH/HEIGHT for images (e.g., https://picsum.photos/800/600)
- Include proper alt text for images
- Structure content logically with sections
- Add id attributes for navigation anchors
- DO NOT include <html>, <head>, or <body> tags - only the inner content

OUTPUT: Return ONLY raw HTML code, no markdown, no code blocks, no explanations.`;

    const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
            {
                role: 'user',
                content: `Create HTML for: ${prompt}\n\nReturn ONLY the HTML code.`
            }
        ],
    });

    let html = message.content[0].text.trim();
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    return html;
}

// Step 2: Generate CSS based on HTML
async function generateCSS(html, prompt, options) {
    const systemPrompt = `You are an expert CSS developer specializing in modern, responsive design.

YOUR TASK: Generate complete CSS for the provided HTML.

REQUIREMENTS:
- Start with CSS reset/normalization
- Use CSS custom properties (variables) for colors and spacing
- Implement mobile-first responsive design
- Use flexbox and CSS grid for layouts
- Add smooth transitions and hover effects
- Include @import for Google Fonts at the very top
- Create a cohesive color scheme that matches the website purpose
- Add subtle animations for visual polish
- Ensure accessibility (good contrast, focus states)
- Style all elements present in the HTML

OUTPUT: Return ONLY raw CSS code, no markdown, no code blocks, no explanations.`;

    const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
            {
                role: 'user',
                content: `Website type: ${prompt}

HTML to style:
${html}

Style preferences: ${options.style || 'modern, clean, professional'}
Color scheme: ${options.colors || 'choose appropriate colors for the website type'}

Return ONLY the CSS code.`
            }
        ],
    });

    let css = message.content[0].text.trim();
    css = css.replace(/^```css?\n?/i, '').replace(/\n?```$/i, '').trim();

    return css;
}

// Step 3: Generate JavaScript
async function generateJS(html, prompt) {
    const systemPrompt = `You are an expert JavaScript developer.

YOUR TASK: Generate vanilla JavaScript for interactivity.

REQUIREMENTS:
- Use modern ES6+ syntax
- Add smooth scroll for anchor links
- Add mobile menu toggle if navigation exists
- Add form validation if forms exist
- Add scroll animations (intersection observer)
- Add any other relevant interactivity based on the HTML
- Wrap code in DOMContentLoaded event listener
- Keep code clean and well-organized

OUTPUT: Return ONLY raw JavaScript code, no markdown, no code blocks, no explanations.
If no JavaScript is needed, return just: // No JavaScript required`;

    const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
            {
                role: 'user',
                content: `Website type: ${prompt}

HTML:
${html}

Generate appropriate JavaScript. Return ONLY the code.`
            }
        ],
    });

    let js = message.content[0].text.trim();
    js = js.replace(/^```javascript?\n?/i, '').replace(/\n?```$/i, '').trim();

    return js;
}

// Main generate endpoint
app.post('/api/generate/website', async (req, res) => {
    try {
        const { prompt, options = {} } = req.body;

        if (!prompt || !prompt.trim()) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        console.log('='.repeat(50));
        console.log('Generating website for:', prompt.substring(0, 100));
        console.log('='.repeat(50));

        console.log('Step 1/3: Generating HTML...');
        const html = await generateHTML(prompt, options);
        console.log('HTML generated:', html.length, 'characters');

        console.log('Step 2/3: Generating CSS...');
        const css = await generateCSS(html, prompt, options);
        console.log('CSS generated:', css.length, 'characters');

        console.log('Step 3/3: Generating JavaScript...');
        const js = await generateJS(html, prompt);
        console.log('JavaScript generated:', js.length, 'characters');

        console.log('='.repeat(50));
        console.log('Website generation complete!');
        console.log('='.repeat(50));

        res.json({
            success: true,
            website: {
                html,
                css,
                js,
                title: prompt.substring(0, 50),
                description: `Website generated from: ${prompt}`
            }
        });

    } catch (error) {
        console.error('Error generating website:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate website'
        });
    }
});

// ============================================
// UPDATE WEBSITE
// ============================================

app.post('/api/generate/update', async (req, res) => {
    try {
        const { currentCode, instructions } = req.body;

        if (!instructions || !instructions.trim()) {
            return res.status(400).json({ error: 'Instructions are required' });
        }

        console.log('Updating website with instructions:', instructions.substring(0, 100));

        const systemPrompt = `You are an expert web developer. Update the provided code based on the instructions.

IMPORTANT:
- Maintain the existing structure where not affected by changes
- Keep all existing functionality
- Only modify what the instructions ask for
- Return ONLY the code, no markdown, no explanations`;

        // Update HTML
        const htmlMessage = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: `Current HTML:\n${currentCode.html}\n\nInstructions: ${instructions}\n\nReturn the updated HTML only.`
                }
            ],
        });
        let html = htmlMessage.content[0].text.trim();
        html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

        // Update CSS
        const cssMessage = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: `Current CSS:\n${currentCode.css}\n\nUpdated HTML:\n${html}\n\nInstructions: ${instructions}\n\nReturn the updated CSS only.`
                }
            ],
        });
        let css = cssMessage.content[0].text.trim();
        css = css.replace(/^```css?\n?/i, '').replace(/\n?```$/i, '').trim();

        // Update JS if needed
        let js = currentCode.js || '';
        if (instructions.toLowerCase().includes('javascript') ||
            instructions.toLowerCase().includes('interactive') ||
            instructions.toLowerCase().includes('animation') ||
            instructions.toLowerCase().includes('click') ||
            instructions.toLowerCase().includes('form')) {
            const jsMessage = await anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: `Current JavaScript:\n${currentCode.js || '// none'}\n\nUpdated HTML:\n${html}\n\nInstructions: ${instructions}\n\nReturn the updated JavaScript only.`
                    }
                ],
            });
            js = jsMessage.content[0].text.trim();
            js = js.replace(/^```javascript?\n?/i, '').replace(/\n?```$/i, '').trim();
        }

        res.json({
            success: true,
            website: {
                html,
                css,
                js,
                title: 'Updated Website',
                description: `Updated with: ${instructions.substring(0, 100)}`
            }
        });

    } catch (error) {
        console.error('Error updating website:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update website'
        });
    }
});

// ============================================
// REAL VERCEL DEPLOYMENT
// ============================================

app.post('/api/deploy', async (req, res) => {
    try {
        const { projectName, html, css, js } = req.body;

        if (!projectName) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        if (!html) {
            return res.status(400).json({ error: 'HTML content is required' });
        }

        if (!VERCEL_TOKEN) {
            return res.status(500).json({ error: 'Vercel token not configured. Add VERCEL_TOKEN to .env file.' });
        }

        console.log('='.repeat(50));
        console.log('Deploying to Vercel:', projectName);
        console.log('='.repeat(50));

        // Create full HTML file
        const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Website created with AI Website Generator">
  <title>${projectName}</title>
  <style>
${css || ''}
  </style>
</head>
<body>
${html}
  <script>
${js || ''}
  </script>
</body>
</html>`;

        // Sanitize project name for Vercel
        const sanitizedName = projectName
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);

        // Create deployment using Vercel API
        const deploymentResponse = await fetch('https://api.vercel.com/v13/deployments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VERCEL_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: sanitizedName,
                files: [
                    {
                        file: 'index.html',
                        data: Buffer.from(fullHTML).toString('base64'),
                        encoding: 'base64'
                    }
                ],
                projectSettings: {
                    framework: null
                },
                target: 'production'
            })
        });

        const deploymentData = await deploymentResponse.json();

        if (!deploymentResponse.ok) {
            console.error('Vercel API Error:', deploymentData);
            throw new Error(deploymentData.error?.message || 'Failed to deploy to Vercel');
        }

        console.log('Deployment created:', deploymentData.id);
        console.log('URL:', deploymentData.url);

        // Wait for deployment to be ready (poll status)
        let deploymentUrl = `https://${deploymentData.url}`;
        let isReady = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max wait

        while (!isReady && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

            const statusResponse = await fetch(`https://api.vercel.com/v13/deployments/${deploymentData.id}`, {
                headers: {
                    'Authorization': `Bearer ${VERCEL_TOKEN}`,
                }
            });

            const statusData = await statusResponse.json();

            if (statusData.readyState === 'READY') {
                isReady = true;
                deploymentUrl = `https://${statusData.url}`;
                console.log('Deployment is ready!');
            } else if (statusData.readyState === 'ERROR') {
                throw new Error('Deployment failed on Vercel');
            }

            attempts++;
        }

        if (!isReady) {
            console.log('Deployment still processing, returning URL anyway');
        }

        // Also save locally as backup
        const deploysDir = path.join(__dirname, 'deploys');
        if (!fs.existsSync(deploysDir)) {
            fs.mkdirSync(deploysDir, { recursive: true });
        }
        const projectDir = path.join(deploysDir, sanitizedName);
        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir, { recursive: true });
        }
        fs.writeFileSync(path.join(projectDir, 'index.html'), fullHTML);

        console.log('='.repeat(50));
        console.log('Deployment successful!');
        console.log('URL:', deploymentUrl);
        console.log('='.repeat(50));

        res.json({
            success: true,
            url: deploymentUrl,
            deploymentId: deploymentData.id,
            message: 'Website deployed successfully to Vercel!'
        });

    } catch (error) {
        console.error('Deploy error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Deployment failed'
        });
    }
});

// ============================================
// DOMAIN SEARCH (Mock - for real, integrate with registrar API)
// ============================================

app.get('/api/domains/search', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const cleanDomain = query.toLowerCase().replace(/[^a-z0-9-]/g, '');

        // Mock domain results
        // For real implementation, use Namecheap/GoDaddy/Cloudflare API
        const extensions = ['.com', '.io', '.co', '.dev', '.app', '.site'];
        const domains = extensions.map(ext => ({
            name: cleanDomain + ext,
            available: Math.random() > 0.3,
            price: ext === '.com' ? 12.99 : ext === '.io' ? 39.99 : ext === '.dev' ? 14.99 : 9.99
        }));

        res.json({
            success: true,
            domains
        });

    } catch (error) {
        console.error('Domain search error:', error);
        res.status(500).json({
            success: false,
            error: 'Domain search failed'
        });
    }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📦 Vercel deployment: ${VERCEL_TOKEN ? 'Enabled' : 'Disabled (add VERCEL_TOKEN to .env)'}`);
});