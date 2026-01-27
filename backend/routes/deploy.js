// backend/routes/deploy.js
// Website Deployment Routes

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Simple in-memory deployment storage (in production, use a real hosting service)
const deployments = new Map();

/**
 * Deploy a website
 * POST /api/deploy
 */
router.post('/', async (req, res) => {
    try {
        const { projectName, html, css, js } = req.body;

        if (!projectName || !html) {
            return res.status(400).json({
                success: false,
                error: 'Project name and HTML are required'
            });
        }

        // Sanitize project name
        const sanitizedName = projectName
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .substring(0, 50);

        // Generate deployment ID
        const deploymentId = `${sanitizedName}-${Date.now()}`;

        // Create full HTML file
        const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sanitizedName}</title>
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

        // Store deployment
        deployments.set(deploymentId, {
            id: deploymentId,
            projectName: sanitizedName,
            html: fullHTML,
            createdAt: new Date().toISOString(),
            visits: 0
        });

        // In a real implementation, you would:
        // 1. Upload to Vercel/Netlify/GitHub Pages
        // 2. Return the actual deployed URL
        // For now, we'll return a mock URL

        console.log(`✅ Deployed: ${sanitizedName} (${deploymentId})`);

        res.json({
            success: true,
            deploymentId,
            url: `https://${sanitizedName}.demo.app`, // Mock URL
            message: 'Website deployed successfully! (Demo mode - use Export HTML for production)'
        });

    } catch (error) {
        console.error('❌ Deployment error:', error);
        res.status(500).json({
            success: false,
            error: 'Deployment failed',
            message: error.message
        });
    }
});

/**
 * Get deployment
 * GET /api/deploy/:id
 */
router.get('/:id', (req, res) => {
    const deployment = deployments.get(req.params.id);

    if (!deployment) {
        return res.status(404).json({
            success: false,
            error: 'Deployment not found'
        });
    }

    // Increment visit counter
    deployment.visits++;

    res.send(deployment.html);
});

/**
 * List deployments
 * GET /api/deploy
 */
router.get('/', (req, res) => {
    const allDeployments = Array.from(deployments.values()).map(d => ({
        id: d.id,
        projectName: d.projectName,
        createdAt: d.createdAt,
        visits: d.visits
    }));

    res.json({
        success: true,
        count: allDeployments.length,
        deployments: allDeployments
    });
});

/**
 * Search domains (directs to Namecheap)
 * GET /api/domains/search
 */
router.get('/search', async (req, res) => {
    const query = req.query.query || '';

    if (!query) {
        return res.status(400).json({
            success: false,
            error: 'Search query required'
        });
    }

    // Mock domain search results - in frontend, clicking Buy redirects to Namecheap
    const tlds = ['.com', '.net', '.org', '.io', '.co'];
    const domains = tlds.map(tld => ({
        name: `${query}${tld}`,
        available: Math.random() > 0.5, // Random availability
        price: tld === '.com' ? 12.99 : tld === '.io' ? 39.99 : 19.99
    }));

    res.json({
        success: true,
        domains
    });
});

module.exports = router;
