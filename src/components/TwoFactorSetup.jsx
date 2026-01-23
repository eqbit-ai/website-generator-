// src/components/TwoFactorSetup.jsx
import config from '../config';

import React, { useState } from 'react';
import { Shield, CheckCircle, AlertCircle, Copy, Eye, EyeOff } from 'lucide-react';


const TwoFactorSetup = ({ onComplete }) => {
    const [email, setEmail] = useState('');
    const [qrCode, setQrCode] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [currentTestCode, setCurrentTestCode] = useState('');

    const setupTwoFactor = async () => {
        if (!email || !email.includes('@')) {
            setError('Please enter a valid email address');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${config.apiUrl}/api/voice/setup-2fa`, {

                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.toLowerCase() })
            });

            const data = await response.json();

            if (data.success) {
                setQrCode(data.qrCode);
                setSecretKey(data.manualEntry.secretKey);
                setCurrentTestCode(data.currentCode);
                setStep(2);
            } else {
                setError(data.error || 'Failed to setup 2FA');
            }
        } catch (err) {
            setError('Connection error. Please make sure the backend is running.');
        }

        setLoading(false);
    };

    const verifyCode = async () => {
        if (!verificationCode || verificationCode.length !== 6) {
            setError('Please enter a 6-digit code');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${config.apiUrl}/api/voice/verify-2fa-setup`, {

                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.toLowerCase(), code: verificationCode })
            });

            const data = await response.json();

            if (data.success) {
                setSuccess('Google Authenticator enabled successfully!');
                setStep(4);
            } else {
                setError(data.message || 'Invalid code. Please try again.');
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        }

        setLoading(false);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setSuccess('Copied to clipboard!');
        setTimeout(() => setSuccess(''), 2000);
    };

    const resetForm = () => {
        setStep(1);
        setEmail('');
        setQrCode('');
        setSecretKey('');
        setVerificationCode('');
        setError('');
        setSuccess('');
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <Shield size={32} color="#4CAF50" />
                <h2 style={styles.title}>Setup Google Authenticator</h2>
            </div>

            {error && (
                <div style={styles.errorBox}>
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div style={styles.successBox}>
                    <CheckCircle size={18} />
                    <span>{success}</span>
                </div>
            )}

            {/* Step 1: Enter Email */}
            {step === 1 && (
                <div style={styles.stepContent}>
                    <p style={styles.description}>
                        Enter your email to setup two-factor authentication for your account.
                    </p>

                    <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={styles.input}
                        onKeyPress={(e) => e.key === 'Enter' && setupTwoFactor()}
                    />

                    <button
                        onClick={setupTwoFactor}
                        disabled={loading}
                        style={styles.primaryButton}
                    >
                        {loading ? 'Setting up...' : 'Continue'}
                    </button>
                </div>
            )}

            {/* Step 2: Show QR Code */}
            {step === 2 && (
                <div style={styles.stepContent}>
                    <p style={styles.description}>
                        Scan this QR code with Google Authenticator app:
                    </p>

                    <div style={styles.qrContainer}>
                        <img src={qrCode} alt="QR Code" style={styles.qrCode} />
                    </div>

                    <div style={styles.manualEntryBox}>
                        <p style={styles.smallText}>Can't scan? Enter this key manually:</p>
                        <div style={styles.secretKeyContainer}>
                            <code style={styles.secretKey}>
                                {showSecret ? secretKey : '••••••••••••••••'}
                            </code>
                            <button
                                onClick={() => setShowSecret(!showSecret)}
                                style={styles.iconButton}
                                title={showSecret ? 'Hide' : 'Show'}
                            >
                                {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                            <button
                                onClick={() => copyToClipboard(secretKey)}
                                style={styles.iconButton}
                                title="Copy"
                            >
                                <Copy size={18} />
                            </button>
                        </div>
                    </div>

                    {currentTestCode && (
                        <div style={styles.testCodeBox}>
                            <p style={styles.smallText}>Current code (for testing):</p>
                            <code style={styles.testCode}>{currentTestCode}</code>
                        </div>
                    )}

                    <button
                        onClick={() => setStep(3)}
                        style={styles.primaryButton}
                    >
                        I've scanned the code →
                    </button>

                    <button onClick={resetForm} style={styles.linkButton}>
                        ← Start over
                    </button>
                </div>
            )}

            {/* Step 3: Verify Code */}
            {step === 3 && (
                <div style={styles.stepContent}>
                    <p style={styles.description}>
                        Enter the 6-digit code from your authenticator app to verify:
                    </p>

                    <input
                        type="text"
                        placeholder="000000"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                        style={styles.codeInput}
                        onKeyPress={(e) => e.key === 'Enter' && verifyCode()}
                    />

                    <button
                        onClick={verifyCode}
                        disabled={loading || verificationCode.length !== 6}
                        style={styles.primaryButton}
                    >
                        {loading ? 'Verifying...' : 'Verify & Enable'}
                    </button>

                    <button onClick={() => setStep(2)} style={styles.linkButton}>
                        ← Back to QR code
                    </button>
                </div>
            )}

            {/* Step 4: Success */}
            {step === 4 && (
                <div style={styles.stepContent}>
                    <div style={styles.successIcon}>
                        <CheckCircle size={64} color="#4CAF50" />
                    </div>

                    <h3 style={styles.successTitle}>All Set!</h3>

                    <p style={styles.description}>
                        Google Authenticator is now enabled for <strong>{email}</strong>.
                        You'll need to enter the code when accessing sensitive account information.
                    </p>

                    <div style={styles.tipsBox}>
                        <h4 style={styles.tipsTitle}>Important:</h4>
                        <ul style={styles.tipsList}>
                            <li>Keep your authenticator app installed</li>
                            <li>The code changes every 30 seconds</li>
                            <li>If you lose access, contact support</li>
                        </ul>
                    </div>

                    <button
                        onClick={() => {
                            resetForm();
                            if (onComplete) onComplete();
                        }}
                        style={styles.primaryButton}
                    >
                        Done
                    </button>
                </div>
            )}

            <div style={styles.footer}>
                <p style={styles.footerText}>
                    Don&apos;t have Google Authenticator?{' '}
                    <a
                        href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.link}
                    >
                        Android
                    </a>
                    {' | '}
                    <a
                        href="https://apps.apple.com/app/google-authenticator/id388497605"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.link}
                    >
                        iOS
                    </a>
                </p>
            </div>

        </div >
    );
};

const styles = {
    container: {
        padding: '24px',
        maxWidth: '400px',
        margin: '0 auto'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px'
    },
    title: {
        margin: 0,
        fontSize: '24px',
        color: '#333'
    },
    description: {
        color: '#666',
        marginBottom: '20px',
        lineHeight: '1.5',
        textAlign: 'center'
    },
    stepContent: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    input: {
        width: '100%',
        padding: '14px 16px',
        fontSize: '16px',
        border: '2px solid #e0e0e0',
        borderRadius: '8px',
        marginBottom: '16px',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s'
    },
    codeInput: {
        width: '180px',
        padding: '16px',
        fontSize: '28px',
        textAlign: 'center',
        letterSpacing: '8px',
        border: '2px solid #e0e0e0',
        borderRadius: '8px',
        marginBottom: '20px',
        outline: 'none',
        fontFamily: 'monospace'
    },
    primaryButton: {
        width: '100%',
        padding: '14px 24px',
        fontSize: '16px',
        fontWeight: '600',
        color: 'white',
        backgroundColor: '#4CAF50',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        marginBottom: '12px'
    },
    linkButton: {
        padding: '10px',
        fontSize: '14px',
        color: '#666',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textDecoration: 'underline'
    },
    qrContainer: {
        backgroundColor: 'white',
        padding: '16px',
        borderRadius: '12px',
        marginBottom: '20px',
        border: '2px solid #e0e0e0',
        display: 'inline-block'
    },
    qrCode: {
        width: '200px',
        height: '200px',
        display: 'block'
    },
    manualEntryBox: {
        width: '100%',
        textAlign: 'center',
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
    },
    smallText: {
        fontSize: '13px',
        color: '#888',
        marginBottom: '8px'
    },
    secretKeyContainer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    },
    secretKey: {
        padding: '8px 12px',
        backgroundColor: '#e9ecef',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '14px'
    },
    iconButton: {
        padding: '6px',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: '#666',
        borderRadius: '4px'
    },
    testCodeBox: {
        marginBottom: '20px',
        padding: '12px',
        backgroundColor: '#e3f2fd',
        borderRadius: '8px',
        textAlign: 'center',
        width: '100%'
    },
    testCode: {
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#1976d2',
        letterSpacing: '4px'
    },
    errorBox: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        backgroundColor: '#ffebee',
        color: '#c62828',
        borderRadius: '8px',
        marginBottom: '16px'
    },
    successBox: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        backgroundColor: '#e8f5e9',
        color: '#2e7d32',
        borderRadius: '8px',
        marginBottom: '16px'
    },
    successIcon: {
        marginBottom: '16px'
    },
    successTitle: {
        color: '#2e7d32',
        marginBottom: '16px'
    },
    tipsBox: {
        width: '100%',
        padding: '16px',
        backgroundColor: '#fff3e0',
        borderRadius: '8px',
        marginBottom: '20px',
        textAlign: 'left'
    },
    tipsTitle: {
        margin: '0 0 8px 0',
        fontSize: '14px',
        color: '#e65100'
    },
    tipsList: {
        margin: 0,
        paddingLeft: '20px',
        fontSize: '13px',
        color: '#666'
    },
    footer: {
        marginTop: '24px',
        textAlign: 'center'
    },
    footerText: {
        fontSize: '13px',
        color: '#888'
    },
    link: {
        color: '#1976d2',
        textDecoration: 'none'
    }
};

export default TwoFactorSetup;