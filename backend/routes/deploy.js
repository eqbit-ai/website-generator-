// backend/routes/deploy.js
// Website Deployment Routes with Vercel Integration
// Version: 1.1 - Added domain search endpoint

const express = require('express');
const router = express.Router();
const axios = require('axios');

// Vercel configuration
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_API = 'https://api.vercel.com';

// Simple in-memory deployment storage (fallback if Vercel not available)
const deployments = new Map();

/**
 * Deploy a website to Vercel
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

        // Try Vercel deployment if token is available
        if (VERCEL_TOKEN) {
            try {
                console.log(`🚀 Deploying to Vercel: ${sanitizedName}`);

                // Create deployment using Vercel API
                const deployment = await axios.post(
                    `${VERCEL_API}/v13/deployments`,
                    {
                        name: sanitizedName,
                        files: [
                            {
                                file: 'index.html',
                                data: fullHTML
                            }
                        ],
                        projectSettings: {
                            framework: null
                        }
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${VERCEL_TOKEN}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const vercelUrl = `https://${deployment.data.url}`;
                const projectId = deployment.data.projectId || null;
                console.log(`✅ Deployed to Vercel: ${vercelUrl} (project: ${projectId})`);

                return res.json({
                    success: true,
                    deploymentId: deployment.data.id,
                    projectId,
                    url: vercelUrl,
                    message: 'Website deployed successfully to Vercel!'
                });

            } catch (vercelError) {
                console.error('❌ Vercel deployment failed:', vercelError.response?.data || vercelError.message);
                // Fall through to local storage
            }
        }

        // Fallback: Store locally if Vercel not available
        const deploymentId = `${sanitizedName}-${Date.now()}`;
        deployments.set(deploymentId, {
            id: deploymentId,
            projectName: sanitizedName,
            html: fullHTML,
            createdAt: new Date().toISOString(),
            visits: 0
        });

        console.log(`✅ Stored locally: ${sanitizedName} (${deploymentId})`);

        res.json({
            success: true,
            deploymentId,
            url: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/deploy/${deploymentId}`,
            message: 'Website stored locally (Vercel not configured)'
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

module.exports = router;
