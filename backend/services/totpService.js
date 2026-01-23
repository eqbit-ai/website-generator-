// backend/services/totpService.js
// TOTP (Time-based One-Time Password) Service for Google Authenticator

const OTPAuth = require('otpauth');
const QRCode = require('qrcode');

const ISSUER = 'MeydanFreeZone'; // Your company name (no spaces)

/**
 * Generate a new TOTP secret for a user
 * @returns {string} Base32 encoded secret
 */
function generateSecret() {
    const secret = new OTPAuth.Secret({ size: 20 });
    return secret.base32;
}

/**
 * Generate QR code data URL for Google Authenticator
 * @param {string} email - User's email
 * @param {string} secret - Base32 encoded secret
 * @returns {Promise<Object>} QR code data
 */
async function generateQRCode(email, secret) {
    try {
        const totp = new OTPAuth.TOTP({
            issuer: ISSUER,
            label: email,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(secret)
        });

        const otpauthUrl = totp.toString();

        // Generate QR code as data URL (base64 image)
        const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
            width: 256,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        return {
            secret,
            otpauthUrl,
            qrCodeDataUrl,
            manualEntry: {
                accountName: email,
                secretKey: secret,
                issuer: ISSUER
            }
        };
    } catch (error) {
        console.error('QR Code generation error:', error);
        throw error;
    }
}

/**
 * Verify a TOTP code
 * @param {string} secret - Base32 encoded secret
 * @param {string} code - 6-digit code from authenticator app
 * @returns {boolean} True if valid
 */
function verifyCode(secret, code) {
    try {
        if (!secret || !code) {
            return false;
        }

        const totp = new OTPAuth.TOTP({
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(secret)
        });

        // Validate with window of 1 (allows ±30 seconds for clock drift)
        const delta = totp.validate({ token: code, window: 1 });

        // delta is null if invalid, number if valid
        return delta !== null;
    } catch (error) {
        console.error('TOTP verification error:', error);
        return false;
    }
}

/**
 * Generate current code (for testing purposes)
 * @param {string} secret - Base32 encoded secret
 * @returns {string|null} Current 6-digit code
 */
function generateCurrentCode(secret) {
    try {
        if (!secret) {
            return null;
        }

        const totp = new OTPAuth.TOTP({
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(secret)
        });

        return totp.generate();
    } catch (error) {
        console.error('TOTP generation error:', error);
        return null;
    }
}

/**
 * Get time remaining until code changes
 * @returns {number} Seconds remaining
 */
function getTimeRemaining() {
    return 30 - (Math.floor(Date.now() / 1000) % 30);
}

module.exports = {
    generateSecret,
    generateQRCode,
    verifyCode,
    generateCurrentCode,
    getTimeRemaining
};