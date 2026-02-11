// backend/services/godaddyService.js
// GoDaddy API wrapper for domain search, purchase, and DNS configuration

const axios = require('axios');

const GODADDY_API_KEY = process.env.GODADDY_API_KEY;
const GODADDY_API_SECRET = process.env.GODADDY_API_SECRET;
const GODADDY_API = process.env.GODADDY_API_URL || 'https://api.godaddy.com';
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_API = 'https://api.vercel.com';

// Vercel's IP for custom domains
const VERCEL_IP = '76.76.21.21';

function getHeaders() {
    return {
        'Authorization': `sso-key ${GODADDY_API_KEY}:${GODADDY_API_SECRET}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
}

/**
 * Check availability of a single domain
 */
async function checkAvailability(domain) {
    const response = await axios.get(
        `${GODADDY_API}/v1/domains/available`,
        {
            params: { domain },
            headers: getHeaders()
        }
    );
    return response.data;
}

/**
 * Check availability of multiple domains at once
 */
async function checkBulkAvailability(domains) {
    const response = await axios.post(
        `${GODADDY_API}/v1/domains/available`,
        domains,
        {
            params: { checkType: 'FAST' },
            headers: getHeaders()
        }
    );
    return response.data;
}

/**
 * Purchase a domain via GoDaddy
 * contactInfo should include: nameFirst, nameLast, email, phone, addressMailing (street1, city, state, postalCode, country)
 */
async function purchaseDomain(domain, contactInfo) {
    const purchaseBody = {
        domain,
        consent: {
            agreementKeys: ['DNRA'],
            agreedBy: contactInfo.email,
            agreedAt: new Date().toISOString()
        },
        contactAdmin: contactInfo,
        contactBilling: contactInfo,
        contactRegistrant: contactInfo,
        contactTech: contactInfo,
        period: 1,
        privacy: false,
        renewAuto: true
    };

    const response = await axios.post(
        `${GODADDY_API}/v1/domains/purchase`,
        purchaseBody,
        { headers: getHeaders() }
    );
    return response.data;
}

/**
 * Configure DNS records for a domain (set A record to Vercel IP)
 */
async function configureDns(domain, records) {
    const dnsRecords = records || [
        { type: 'A', name: '@', data: VERCEL_IP, ttl: 600 },
        { type: 'CNAME', name: 'www', data: 'cname.vercel-dns.com', ttl: 600 }
    ];

    const response = await axios.put(
        `${GODADDY_API}/v1/domains/${domain}/records`,
        dnsRecords,
        { headers: getHeaders() }
    );
    return response.data;
}

/**
 * Get domain status from GoDaddy
 */
async function getDomainStatus(domain) {
    const response = await axios.get(
        `${GODADDY_API}/v1/domains/${domain}`,
        { headers: getHeaders() }
    );
    return response.data;
}

/**
 * Add a custom domain to a Vercel project and trigger SSL provisioning
 */
async function addDomainToVercel(domain, projectId) {
    if (!VERCEL_TOKEN) {
        throw new Error('VERCEL_TOKEN not configured');
    }

    // Add domain to the Vercel project
    const response = await axios.post(
        `${VERCEL_API}/v10/projects/${projectId}/domains`,
        { name: domain },
        {
            headers: {
                'Authorization': `Bearer ${VERCEL_TOKEN}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return response.data;
}

/**
 * Check if GoDaddy API is configured
 */
function isConfigured() {
    return !!(GODADDY_API_KEY && GODADDY_API_SECRET);
}

module.exports = {
    checkAvailability,
    checkBulkAvailability,
    purchaseDomain,
    configureDns,
    getDomainStatus,
    addDomainToVercel,
    isConfigured
};
