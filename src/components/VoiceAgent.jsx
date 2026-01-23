// src/components/VoiceAgent.jsx
import config from '../config';

import React, { useState } from 'react';
import { Phone, X, Loader2, CheckCircle, AlertCircle, Shield } from 'lucide-react';

const VoiceAgent = ({ isOpen, onClose }) => {
    const [step, setStep] = useState('form'); // form, calling, success, error
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [callInfo, setCallInfo] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        purpose: 'verification'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${config.apiUrl}/api/voice/initiate`, {

                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                setCallInfo(data);
                setStep('calling');
            } else {
                setError(data.error || 'Failed to initiate call');
                setStep('error');
            }
        } catch (err) {
            setError('Failed to connect to server');
            setStep('error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setStep('form');
        setFormData({ name: '', email: '', phone: '', purpose: 'verification' });
        setError(null);
        setCallInfo(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="voice-overlay" onClick={handleClose}>
            <div className="voice-modal" onClick={e => e.stopPropagation()}>
                <button className="voice-close" onClick={handleClose}>
                    <X size={20} />
                </button>

                {/* Form Step */}
                {step === 'form' && (
                    <>
                        <div className="voice-header">
                            <div className="voice-icon">
                                <Phone size={28} />
                            </div>
                            <h2>Request Verification Call</h2>
                            <p>We'll call you to verify your identity</p>
                        </div>

                        <form onSubmit={handleSubmit} className="voice-form">
                            <div className="voice-form-group">
                                <label>Full Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="John Doe"
                                    required
                                />
                            </div>

                            <div className="voice-form-group">
                                <label>Email *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="john@example.com"
                                    required
                                />
                            </div>

                            <div className="voice-form-group">
                                <label>Phone Number *</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+1234567890"
                                    required
                                />
                                <span className="input-hint">Include country code (e.g., +1 for US)</span>
                            </div>

                            <div className="voice-form-group">
                                <label>Purpose</label>
                                <select
                                    value={formData.purpose}
                                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                >
                                    <option value="verification">Identity Verification</option>
                                    <option value="account">Account Information</option>
                                    <option value="support">General Support</option>
                                </select>
                            </div>

                            <div className="voice-security-note">
                                <Shield size={16} />
                                <span>You'll receive an SMS code and may be asked for Google Authenticator verification</span>
                            </div>

                            <button type="submit" className="voice-submit" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="spinning" size={20} />
                                        Initiating Call...
                                    </>
                                ) : (
                                    <>
                                        <Phone size={20} />
                                        Request Call
                                    </>
                                )}
                            </button>
                        </form>
                    </>
                )}

                {/* Calling Step */}
                {step === 'calling' && (
                    <div className="voice-status">
                        <div className="voice-calling-animation">
                            <Phone size={48} />
                        </div>
                        <h2>Call Initiated!</h2>
                        <p>You will receive a call shortly at:</p>
                        <div className="voice-phone-display">{formData.phone}</div>

                        <div className="voice-instructions">
                            <h4>What to expect:</h4>
                            <ol>
                                <li>📱 You'll receive an SMS with a 6-digit code</li>
                                <li>📞 Answer the incoming call</li>
                                <li>🔢 Enter the SMS code using your phone keypad</li>
                                <li>❓ Ask questions about our services</li>
                                <li>🔐 For account info, you'll need Google Authenticator</li>
                            </ol>
                        </div>

                        <button className="voice-done-btn" onClick={handleClose}>
                            <CheckCircle size={20} />
                            Got it
                        </button>
                    </div>
                )}

                {/* Error Step */}
                {step === 'error' && (
                    <div className="voice-status error">
                        <AlertCircle size={48} />
                        <h2>Something went wrong</h2>
                        <p>{error}</p>
                        <button className="voice-retry-btn" onClick={() => setStep('form')}>
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoiceAgent;