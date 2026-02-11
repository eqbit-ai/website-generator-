// backend/routes/domains.js
// Domain search, purchase, DNS configuration, and Vercel linking

const express = require('express');
const router = express.Router();
const godaddyService = require('../services/godaddyService');

const TLDS = ['.com', '.net', '.org', '.io', '.co'];

/**
 * Search domain availability across 5 TLDs via GoDaddy
 * GET /api/domains/search?query=mybusiness
 */
router.get('/search', async (req, res) => {
    try {
        let query = req.query.query || '';

        if (!query) {
            return res.status(400).json({ success: false, error: 'Search query required' });
        }

        // Clean query - remove existing TLD and invalid chars
        query = query.toLowerCase()
            .replace(/\.(com|net|org|io|co|dev|app|xyz)$/i, '')
            .replace(/[^a-z0-9-]/g, '')
            .substring(0, 63);

        console.log(`🔍 Domain search for: ${query}`);

        if (!godaddyService.isConfigured()) {
            console.log('⚠️ GoDaddy not configured, returning mock results');
            const domains = TLDS.map(tld => ({
                name: `${query}${tld}`,
                available: Math.random() > 0.4,
                price: tld === '.com' ? 12.99 : tld === '.io' ? 39.99 : tld === '.co' ? 29.99 : 14.99,
                currency: 'USD',
                period: 1
            }));
            return res.json({ success: true, domains, mock: true });
        }

        // Build domain list for bulk check
        const domainList = TLDS.map(tld => `${query}${tld}`);

        try {
            const results = await godaddyService.checkBulkAvailability(domainList);

            const domains = results.domains
                ? results.domains.map(d => ({
                    name: d.domain,
                    available: d.available,
                    price: d.price ? (d.price / 1000000) : getPriceForTld(d.domain),
                    currency: d.currency || 'USD',
                    period: d.period || 1
                }))
                : domainList.map(domain => ({
                    name: domain,
                    available: false,
                    price: getPriceForTld(domain),
                    currency: 'USD',
                    period: 1
                }));

            // If bulk didn't work well, try individual checks
            if (!results.domains || results.domains.length === 0) {
                const individualResults = await Promise.allSettled(
                    domainList.map(d => godaddyService.checkAvailability(d))
                );

                const fallbackDomains = individualResults.map((result, i) => {
                    if (result.status === 'fulfilled') {
                        return {
                            name: result.value.domain,
                            available: result.value.available,
                            price: result.value.price ? (result.value.price / 1000000) : getPriceForTld(domainList[i]),
                            currency: result.value.currency || 'USD',
                            period: result.value.period || 1
                        };
                    }
                    return {
                        name: domainList[i],
                        available: false,
                        price: getPriceForTld(domainList[i]),
                        currency: 'USD',
                        period: 1
                    };
                });

                return res.json({ success: true, domains: fallbackDomains });
            }

            res.json({ success: true, domains });
        } catch (apiError) {
            console.error('❌ GoDaddy API error:', apiError.response?.data || apiError.message);

            // Fallback to mock data when GoDaddy API fails (invalid keys, access denied, etc.)
            console.log('⚠️ Falling back to mock domain results');
            const domains = TLDS.map(tld => ({
                name: `${query}${tld}`,
                available: Math.random() > 0.4,
                price: tld === '.com' ? 12.99 : tld === '.io' ? 39.99 : tld === '.co' ? 29.99 : 14.99,
                currency: 'USD',
                period: 1
            }));
            res.json({ success: true, domains, mock: true });
        }
    } catch (error) {
        console.error('❌ Domain search error:', error);
        res.status(500).json({ success: false, error: 'Domain search failed' });
    }
});

/**
 * Purchase domain + configure DNS + link to Vercel (all-in-one)
 * POST /api/domains/purchase
 * Body: { domain, contactInfo, projectId }
 */
router.post('/purchase', async (req, res) => {
    try {
        const { domain, contactInfo, projectId } = req.body;

        if (!domain) {
            return res.status(400).json({ success: false, error: 'Domain is required' });
        }

        if (!godaddyService.isConfigured()) {
            return res.status(400).json({ success: false, error: 'GoDaddy API not configured. Set GODADDY_API_KEY and GODADDY_API_SECRET.' });
        }

        console.log(`🛒 Purchasing domain: ${domain}`);

        const steps = [];

        // Step 1: Purchase domain
        try {
            const purchaseResult = await godaddyService.purchaseDomain(domain, contactInfo);
            steps.push({ step: 'purchase', status: 'success', data: purchaseResult });
            console.log(`✅ Domain purchased: ${domain}`);
        } catch (purchaseError) {
            console.error('❌ Purchase failed:', purchaseError.response?.data || purchaseError.message);
            return res.status(400).json({
                success: false,
                error: 'Domain purchase failed',
                message: purchaseError.response?.data?.message || purchaseError.message,
                steps
            });
        }

        // Step 2: Configure DNS (A record → Vercel IP)
        try {
            await godaddyService.configureDns(domain);
            steps.push({ step: 'dns', status: 'success' });
            console.log(`✅ DNS configured for: ${domain}`);
        } catch (dnsError) {
            console.error('⚠️ DNS config failed (can retry):', dnsError.message);
            steps.push({ step: 'dns', status: 'failed', error: dnsError.message });
        }

        // Step 3: Add domain to Vercel project
        if (projectId) {
            try {
                const vercelResult = await godaddyService.addDomainToVercel(domain, projectId);
                steps.push({ step: 'vercel', status: 'success', data: vercelResult });
                console.log(`✅ Domain linked to Vercel: ${domain}`);
            } catch (vercelError) {
                console.error('⚠️ Vercel linking failed (can retry):', vercelError.message);
                steps.push({ step: 'vercel', status: 'failed', error: vercelError.message });
            }
        }

        const allSuccess = steps.every(s => s.status === 'success');

        res.json({
            success: true,
            domain,
            fullyConfigured: allSuccess,
            steps,
            customUrl: `https://${domain}`
        });

    } catch (error) {
        console.error('❌ Purchase error:', error);
        res.status(500).json({ success: false, error: 'Purchase failed', message: error.message });
    }
});

/**
 * Check domain status (purchase + DNS + Vercel linking)
 * GET /api/domains/status?domain=example.com
 */
router.get('/status', async (req, res) => {
    try {
        const { domain } = req.query;

        if (!domain) {
            return res.status(400).json({ success: false, error: 'Domain is required' });
        }

        if (!godaddyService.isConfigured()) {
            return res.status(400).json({ success: false, error: 'GoDaddy API not configured' });
        }

        const status = await godaddyService.getDomainStatus(domain);

        res.json({
            success: true,
            domain,
            status: status.status,
            expirationDate: status.expires,
            nameServers: status.nameServers,
            locked: status.locked,
            renewable: status.renewable
        });

    } catch (error) {
        console.error('❌ Status check error:', error);
        res.status(500).json({ success: false, error: 'Status check failed', message: error.message });
    }
});

/**
 * Retry DNS/Vercel linking if initial attempt failed
 * POST /api/domains/link
 * Body: { domain, projectId }
 */
router.post('/link', async (req, res) => {
    try {
        const { domain, projectId } = req.body;

        if (!domain || !projectId) {
            return res.status(400).json({ success: false, error: 'Domain and projectId are required' });
        }

        const steps = [];

        // Retry DNS configuration
        try {
            await godaddyService.configureDns(domain);
            steps.push({ step: 'dns', status: 'success' });
            console.log(`✅ DNS re-configured for: ${domain}`);
        } catch (dnsError) {
            steps.push({ step: 'dns', status: 'failed', error: dnsError.message });
        }

        // Retry Vercel linking
        try {
            const vercelResult = await godaddyService.addDomainToVercel(domain, projectId);
            steps.push({ step: 'vercel', status: 'success', data: vercelResult });
            console.log(`✅ Domain re-linked to Vercel: ${domain}`);
        } catch (vercelError) {
            steps.push({ step: 'vercel', status: 'failed', error: vercelError.message });
        }

        const allSuccess = steps.every(s => s.status === 'success');

        res.json({
            success: true,
            domain,
            fullyConfigured: allSuccess,
            steps,
            customUrl: `https://${domain}`
        });

    } catch (error) {
        console.error('❌ Link error:', error);
        res.status(500).json({ success: false, error: 'Linking failed', message: error.message });
    }
});

// Helper: default price estimates by TLD
function getPriceForTld(domain) {
    if (domain.endsWith('.com')) return 12.99;
    if (domain.endsWith('.io')) return 39.99;
    if (domain.endsWith('.co')) return 29.99;
    if (domain.endsWith('.net')) return 14.99;
    if (domain.endsWith('.org')) return 12.99;
    return 19.99;
}

module.exports = router;
