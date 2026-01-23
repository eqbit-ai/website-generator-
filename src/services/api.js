import config from '../config';

const API_BASE_URL = `${config.apiUrl}/api`;

export const generateWebsite = async (prompt, options = {}) => {
    try {
        const response = await fetch(`${API_BASE_URL}/generate/website`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, options }),
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

export const updateWebsite = async (currentCode, instructions) => {
    try {
        const response = await fetch(`${API_BASE_URL}/generate/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentCode, instructions }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to update website');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

export default {
    generateWebsite,
    updateWebsite
};
