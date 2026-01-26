import config from '../config';

const API_BASE_URL = `${config.apiUrl}/api`;

// NEW: Premium generator with conversation context
export const generateWebsite = async (prompt, sessionId = null, style = null) => {
    try {
        const response = await fetch(`${API_BASE_URL}/generator/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, sessionId, style }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate website');
        }

        return data;
    } catch (error) {
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

export default {
    generateWebsite,
    getSession,
    clearSession
};
