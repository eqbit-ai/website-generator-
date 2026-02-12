import config from '../config';

const API_BASE_URL = `${config.apiUrl}/api`;

// AI-Driven generator with conversation context
export const generateWebsite = async (prompt, sessionId = null, signal = null) => {
    try {
        const response = await fetch(`${API_BASE_URL}/generator/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, sessionId }),
            signal,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate website');
        }

        return data;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Generation cancelled');
        }
        console.error('API Error:', error);
        throw error;
    }
};

// Get session info
export const getSession = async (sessionId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/generator/session/${sessionId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to get session');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

// Clear session (start fresh)
export const clearSession = async (sessionId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/generator/session/${sessionId}`, {
            method: 'DELETE'
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to clear session');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

// Edit a single element (token-efficient)
export const editElement = async (sessionId, elementHtml, elementPath, prompt, currentCode) => {
    try {
        const response = await fetch(`${API_BASE_URL}/generator/edit-element`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                elementHtml,
                elementPath,
                prompt,
                currentHtml: currentCode.html,
                currentCss: currentCode.css
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to edit element');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

// Search domains via GoDaddy
export const searchDomains = async (query) => {
    try {
        const response = await fetch(`${API_BASE_URL}/domains/search?query=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Domain search failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

// Purchase domain + configure DNS + link to Vercel
export const purchaseDomain = async (domain, contactInfo, projectId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/domains/purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain, contactInfo, projectId }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Domain purchase failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

// Check domain status
export const getDomainStatus = async (domain) => {
    try {
        const response = await fetch(`${API_BASE_URL}/domains/status?domain=${encodeURIComponent(domain)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Status check failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

// Retry DNS/Vercel linking
export const linkDomain = async (domain, projectId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/domains/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain, projectId }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Domain linking failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

const api = {
    generateWebsite,
    getSession,
    clearSession,
    editElement,
    searchDomains,
    purchaseDomain,
    getDomainStatus,
    linkDomain
};

export default api;
