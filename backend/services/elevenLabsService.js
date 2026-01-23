// backend/services/elevenLabsService.js

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ElevenLabsService {
    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY;
        this.voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel
        this.audioDir = path.join(__dirname, '..', 'audio');

        // Create audio directory
        if (!fs.existsSync(this.audioDir)) {
            fs.mkdirSync(this.audioDir, { recursive: true });
        }
    }

    async textToSpeech(text) {
        if (!this.apiKey) {
            console.log('[ElevenLabs] No API key, using Twilio TTS instead');
            return null;
        }

        try {
            const response = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'Content-Type': 'application/json',
                        'xi-api-key': this.apiKey
                    },
                    body: JSON.stringify({
                        text,
                        model_id: 'eleven_monolingual_v1',
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75
                        }
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`ElevenLabs API error: ${response.status}`);
            }

            // Save audio file
            const audioBuffer = await response.arrayBuffer();
            const filename = `${uuidv4()}.mp3`;
            const filepath = path.join(this.audioDir, filename);

            fs.writeFileSync(filepath, Buffer.from(audioBuffer));

            console.log(`[ElevenLabs] Generated audio: ${filename}`);

            return {
                filename,
                filepath,
                url: `/audio/${filename}`
            };

        } catch (error) {
            console.error('[ElevenLabs] Error:', error.message);
            return null;
        }
    }

    // Get available voices
    async getVoices() {
        if (!this.apiKey) return [];

        try {
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: { 'xi-api-key': this.apiKey }
            });

            const data = await response.json();
            return data.voices || [];
        } catch (error) {
            console.error('[ElevenLabs] Get voices error:', error.message);
            return [];
        }
    }
}

module.exports = new ElevenLabsService();