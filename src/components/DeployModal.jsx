// src/components/DeployModal.jsx
import config from '../config';

import React, { useState, useEffect, useRef } from 'react';
import { X, Rocket, Globe, Check, Loader2, ExternalLink, Copy, ShoppingCart, Wifi, Link2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

const DeployModal = ({ isOpen, onClose, html, css, js }) => {
    const [step, setStep] = useState(1); // 1: Deploy, 2: Domain Search, 3: Purchase Progress
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployedUrl, setDeployedUrl] = useState(null);
    const [projectId, setProjectId] = useState(null);
    const [projectName, setProjectName] = useState('');
    const [error, setError] = useState(null);

    // Domain related state
    const [domainSearch, setDomainSearch] = useState('');
    const [domainResults, setDomainResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [copied, setCopied] = useState(false);

    // Purchase related state
    const [selectedDomain, setSelectedDomain] = useState(null);
    const [purchaseSteps, setPurchaseSteps] = useState([]);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [purchaseComplete, setPurchaseComplete] = useState(false);
    const [purchaseError, setPurchaseError] = useState(null);
    const [customUrl, setCustomUrl] = useState(null);

    // Contact info for domain registration
    const [contactInfo, setContactInfo] = useState({
        nameFirst: '',
        nameLast: '',
        email: '',
        phone: '',
        addressMailing: {
            address1: '',
            city: '',
            state: '',
            postalCode: '',
            country: 'US'
        }
    });
    const [showContactForm, setShowContactForm] = useState(false);

    const pollRef = useRef(null);

    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    if (!isOpen) return null;

    const handleDeploy = async () => {
        if (!projectName.trim()) {
            setError('Please enter a project name');
            return;
        }

        setIsDeploying(true);
        setError(null);

        try {
            const response = await fetch(`${config.apiUrl}/api/deploy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectName: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    html,
                    css,
                    js
                })
            });

            const data = await response.json();

            if (data.success) {
                setDeployedUrl(data.url);
                setProjectId(data.projectId || null);
                setStep(2);
            } else {
                setError(data.error || 'Deployment failed');
            }
        } catch (err) {
            setError('Failed to deploy. Please try again.');
        } finally {
            setIsDeploying(false);
        }
    };

    const handleSearchDomain = async () => {
        if (!domainSearch.trim()) return;

        setIsSearching(true);
        setDomainResults([]);

        try {
            const response = await fetch(`${config.apiUrl}/api/domains/search?query=${encodeURIComponent(domainSearch)}`);
            const data = await response.json();

            if (data.success) {
                setDomainResults(data.domains);
            }
        } catch (err) {
            console.error('Domain search failed:', err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(deployedUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleBuyDomain = (domain) => {
        setSelectedDomain(domain);
        setShowContactForm(true);
    };

    const handlePurchaseDomain = async () => {
        if (!selectedDomain) return;

        // Validate contact info
        if (!contactInfo.nameFirst || !contactInfo.nameLast || !contactInfo.email) {
            setPurchaseError('Please fill in all required contact fields.');
            return;
        }

        setShowContactForm(false);
        setStep(3);
        setIsPurchasing(true);
        setPurchaseError(null);
        setPurchaseComplete(false);

        // Animated purchase steps
        setPurchaseSteps([
            { id: 'purchase', label: 'Purchasing domain...', status: 'active', icon: 'cart' },
            { id: 'dns', label: 'Setting up DNS...', status: 'pending', icon: 'wifi' },
            { id: 'vercel', label: 'Linking to Vercel...', status: 'pending', icon: 'link' }
        ]);

        try {
            const response = await fetch(`${config.apiUrl}/api/domains/purchase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain: selectedDomain.name,
                    contactInfo,
                    projectId
                })
            });

            const data = await response.json();

            if (data.success) {
                // Update steps based on response
                const updatedSteps = data.steps || [];
                setPurchaseSteps(prev => prev.map(step => {
                    const result = updatedSteps.find(s => s.step === step.id);
                    if (result) {
                        return { ...step, status: result.status === 'success' ? 'done' : 'error' };
                    }
                    return { ...step, status: 'done' };
                }));

                setCustomUrl(data.customUrl);
                setPurchaseComplete(true);

                // If DNS or Vercel linking failed, note it
                const failedSteps = updatedSteps.filter(s => s.status === 'failed');
                if (failedSteps.length > 0) {
                    setPurchaseError(`Domain purchased! Some setup steps need retry: ${failedSteps.map(s => s.step).join(', ')}`);
                }
            } else {
                setPurchaseError(data.error || data.message || 'Purchase failed');
                setPurchaseSteps(prev => prev.map(s =>
                    s.status === 'active' ? { ...s, status: 'error' } : s
                ));
            }
        } catch (err) {
            setPurchaseError('Purchase request failed. Please try again.');
            setPurchaseSteps(prev => prev.map(s =>
                s.status === 'active' ? { ...s, status: 'error' } : s
            ));
        } finally {
            setIsPurchasing(false);
        }
    };

    const handleRetryLink = async () => {
        if (!selectedDomain || !projectId) return;

        setIsPurchasing(true);
        setPurchaseError(null);

        try {
            const response = await fetch(`${config.apiUrl}/api/domains/link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain: selectedDomain.name,
                    projectId
                })
            });

            const data = await response.json();

            if (data.success) {
                setPurchaseSteps(prev => prev.map(step => {
                    const result = data.steps.find(s => s.step === step.id);
                    if (result) {
                        return { ...step, status: result.status === 'success' ? 'done' : 'error' };
                    }
                    return step;
                }));

                if (data.fullyConfigured) {
                    setCustomUrl(data.customUrl);
                    setPurchaseError(null);
                }
            }
        } catch (err) {
            setPurchaseError('Retry failed. Please try again later.');
        } finally {
            setIsPurchasing(false);
        }
    };

    const handleClose = () => {
        setStep(1);
        setDeployedUrl(null);
        setProjectId(null);
        setProjectName('');
        setError(null);
        setDomainSearch('');
        setDomainResults([]);
        setSelectedDomain(null);
        setPurchaseSteps([]);
        setIsPurchasing(false);
        setPurchaseComplete(false);
        setPurchaseError(null);
        setCustomUrl(null);
        setShowContactForm(false);
        onClose();
    };

    const updateContact = (field, value) => {
        if (field.startsWith('address.')) {
            const addressField = field.replace('address.', '');
            setContactInfo(prev => ({
                ...prev,
                addressMailing: { ...prev.addressMailing, [addressField]: value }
            }));
        } else {
            setContactInfo(prev => ({ ...prev, [field]: value }));
        }
    };

    const getPurchaseStepIcon = (step) => {
        const iconMap = {
            cart: ShoppingCart,
            wifi: Wifi,
            link: Link2
        };
        const Icon = iconMap[step.icon] || Globe;

        if (step.status === 'done') return <CheckCircle2 size={20} className="step-icon done" />;
        if (step.status === 'error') return <AlertCircle size={20} className="step-icon error" />;
        if (step.status === 'active') return <Loader2 size={20} className="step-icon spinning" />;
        return <Icon size={20} className="step-icon pending" />;
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content deploy-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={handleClose}>
                    <X size={20} />
                </button>

                {/* Step 1: Deploy to Vercel */}
                {step === 1 && (
                    <>
                        <div className="modal-header">
                            <Rocket className="modal-icon" size={32} />
                            <h2>Deploy Your Website</h2>
                            <p>Make your website live in seconds</p>
                        </div>

                        <div className="modal-body">
                            <div className="input-group">
                                <label>Project Name</label>
                                <input
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    placeholder="my-awesome-website"
                                    className="modal-input"
                                />
                                <span className="input-hint">
                                    Your site will be at: {projectName || 'your-project'}.vercel.app
                                </span>
                            </div>

                            {error && <div className="modal-error">{error}</div>}

                            <button
                                className="deploy-button"
                                onClick={handleDeploy}
                                disabled={isDeploying}
                            >
                                {isDeploying ? (
                                    <>
                                        <Loader2 className="spinning" size={20} />
                                        Deploying...
                                    </>
                                ) : (
                                    <>
                                        <Rocket size={20} />
                                        Deploy Now
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}

                {/* Step 2: Domain Search */}
                {step === 2 && !showContactForm && (
                    <>
                        <div className="modal-header success">
                            <Check className="modal-icon success" size={32} />
                            <h2>Website Deployed!</h2>
                            <p>Your website is now live</p>
                        </div>

                        <div className="modal-body">
                            <div className="deployed-url-box">
                                <a href={deployedUrl} target="_blank" rel="noopener noreferrer">
                                    {deployedUrl}
                                    <ExternalLink size={16} />
                                </a>
                                <button className="copy-button" onClick={handleCopyUrl}>
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>

                            <div className="divider">
                                <span>Want a custom domain?</span>
                            </div>

                            <div className="domain-search">
                                <div className="search-input-group">
                                    <Globe size={20} />
                                    <input
                                        type="text"
                                        value={domainSearch}
                                        onChange={(e) => setDomainSearch(e.target.value)}
                                        placeholder="Search for a domain..."
                                        className="domain-input"
                                        onKeyPress={(e) => e.key === 'Enter' && handleSearchDomain()}
                                    />
                                    <button
                                        className="search-button"
                                        onClick={handleSearchDomain}
                                        disabled={isSearching}
                                    >
                                        {isSearching ? <Loader2 className="spinning" size={18} /> : 'Search'}
                                    </button>
                                </div>

                                {domainResults.length > 0 && (
                                    <div className="domain-results">
                                        {domainResults.map((domain, index) => (
                                            <div
                                                key={index}
                                                className={`domain-result ${domain.available ? 'available' : 'taken'}`}
                                            >
                                                <div className="domain-info">
                                                    <span className="domain-name">{domain.name}</span>
                                                    {domain.available ? (
                                                        <span className="domain-price">${domain.price}/yr</span>
                                                    ) : (
                                                        <span className="domain-taken">Taken</span>
                                                    )}
                                                </div>
                                                {domain.available && (
                                                    <button
                                                        className="buy-button"
                                                        onClick={() => handleBuyDomain(domain)}
                                                    >
                                                        Buy
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="manual-connect">
                                <h4>Already have a domain?</h4>
                                <p>Point your domain's DNS to:</p>
                                <code>76.76.21.21</code>
                                <p className="dns-hint">Add an A record pointing to this IP address</p>
                            </div>
                        </div>
                    </>
                )}

                {/* Step 2b: Contact Info Form (before purchase) */}
                {step === 2 && showContactForm && (
                    <>
                        <div className="modal-header">
                            <ShoppingCart className="modal-icon" size={32} />
                            <h2>Register {selectedDomain?.name}</h2>
                            <p>Enter your contact information for domain registration</p>
                        </div>

                        <div className="modal-body">
                            <div className="contact-form">
                                <div className="contact-row">
                                    <div className="contact-field">
                                        <label>First Name *</label>
                                        <input
                                            type="text"
                                            value={contactInfo.nameFirst}
                                            onChange={(e) => updateContact('nameFirst', e.target.value)}
                                            placeholder="John"
                                            className="modal-input"
                                        />
                                    </div>
                                    <div className="contact-field">
                                        <label>Last Name *</label>
                                        <input
                                            type="text"
                                            value={contactInfo.nameLast}
                                            onChange={(e) => updateContact('nameLast', e.target.value)}
                                            placeholder="Doe"
                                            className="modal-input"
                                        />
                                    </div>
                                </div>

                                <div className="contact-field">
                                    <label>Email *</label>
                                    <input
                                        type="email"
                                        value={contactInfo.email}
                                        onChange={(e) => updateContact('email', e.target.value)}
                                        placeholder="john@example.com"
                                        className="modal-input"
                                    />
                                </div>

                                <div className="contact-field">
                                    <label>Phone</label>
                                    <input
                                        type="tel"
                                        value={contactInfo.phone}
                                        onChange={(e) => updateContact('phone', e.target.value)}
                                        placeholder="+1.5551234567"
                                        className="modal-input"
                                    />
                                </div>

                                <div className="contact-field">
                                    <label>Street Address</label>
                                    <input
                                        type="text"
                                        value={contactInfo.addressMailing.address1}
                                        onChange={(e) => updateContact('address.address1', e.target.value)}
                                        placeholder="123 Main St"
                                        className="modal-input"
                                    />
                                </div>

                                <div className="contact-row">
                                    <div className="contact-field">
                                        <label>City</label>
                                        <input
                                            type="text"
                                            value={contactInfo.addressMailing.city}
                                            onChange={(e) => updateContact('address.city', e.target.value)}
                                            placeholder="New York"
                                            className="modal-input"
                                        />
                                    </div>
                                    <div className="contact-field">
                                        <label>State</label>
                                        <input
                                            type="text"
                                            value={contactInfo.addressMailing.state}
                                            onChange={(e) => updateContact('address.state', e.target.value)}
                                            placeholder="NY"
                                            className="modal-input"
                                        />
                                    </div>
                                </div>

                                <div className="contact-row">
                                    <div className="contact-field">
                                        <label>Postal Code</label>
                                        <input
                                            type="text"
                                            value={contactInfo.addressMailing.postalCode}
                                            onChange={(e) => updateContact('address.postalCode', e.target.value)}
                                            placeholder="10001"
                                            className="modal-input"
                                        />
                                    </div>
                                    <div className="contact-field">
                                        <label>Country</label>
                                        <input
                                            type="text"
                                            value={contactInfo.addressMailing.country}
                                            onChange={(e) => updateContact('address.country', e.target.value)}
                                            placeholder="US"
                                            className="modal-input"
                                        />
                                    </div>
                                </div>

                                {purchaseError && <div className="modal-error">{purchaseError}</div>}

                                <div className="purchase-summary">
                                    <div className="purchase-summary-row">
                                        <span>{selectedDomain?.name}</span>
                                        <span className="purchase-price">${selectedDomain?.price}/yr</span>
                                    </div>
                                </div>

                                <div className="contact-actions">
                                    <button
                                        className="action-button"
                                        onClick={() => setShowContactForm(false)}
                                    >
                                        Back
                                    </button>
                                    <button
                                        className="deploy-button"
                                        onClick={handlePurchaseDomain}
                                    >
                                        <ShoppingCart size={18} />
                                        Purchase Domain
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Step 3: Purchase Progress */}
                {step === 3 && (
                    <>
                        <div className="modal-header">
                            {purchaseComplete && !purchaseError ? (
                                <CheckCircle2 className="modal-icon success" size={32} />
                            ) : purchaseError && !isPurchasing ? (
                                <AlertCircle className="modal-icon error-icon" size={32} />
                            ) : (
                                <Globe className="modal-icon" size={32} />
                            )}
                            <h2>
                                {purchaseComplete && !purchaseError
                                    ? 'Domain Ready!'
                                    : purchaseError && !isPurchasing
                                    ? 'Setup Issue'
                                    : 'Setting Up Domain...'}
                            </h2>
                            <p>{selectedDomain?.name}</p>
                        </div>

                        <div className="modal-body">
                            <div className="purchase-progress">
                                {purchaseSteps.map((pStep, index) => (
                                    <div key={pStep.id} className={`purchase-step ${pStep.status}`}>
                                        <div className="purchase-step-icon">
                                            {getPurchaseStepIcon(pStep)}
                                        </div>
                                        <div className="purchase-step-content">
                                            <span className="purchase-step-label">{pStep.label}</span>
                                            {pStep.status === 'done' && (
                                                <span className="purchase-step-status success">Complete</span>
                                            )}
                                            {pStep.status === 'error' && (
                                                <span className="purchase-step-status error">Failed</span>
                                            )}
                                        </div>
                                        {index < purchaseSteps.length - 1 && (
                                            <div className={`purchase-step-line ${pStep.status === 'done' ? 'done' : ''}`} />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {purchaseError && (
                                <div className="modal-error" style={{ marginTop: '1.5rem' }}>
                                    {purchaseError}
                                </div>
                            )}

                            {purchaseComplete && customUrl && (
                                <div className="purchase-success">
                                    <div className="deployed-url-box" style={{ marginTop: '1.5rem' }}>
                                        <a href={customUrl} target="_blank" rel="noopener noreferrer">
                                            {customUrl}
                                            <ExternalLink size={16} />
                                        </a>
                                    </div>
                                    <p className="dns-propagation-note">
                                        DNS propagation may take up to 48 hours. SSL will be provisioned automatically.
                                    </p>
                                </div>
                            )}

                            {purchaseError && !isPurchasing && projectId && (
                                <button
                                    className="deploy-button"
                                    onClick={handleRetryLink}
                                    style={{ marginTop: '1rem' }}
                                >
                                    <RefreshCw size={18} />
                                    Retry DNS + Vercel Linking
                                </button>
                            )}

                            {purchaseComplete && (
                                <button
                                    className="deploy-button"
                                    onClick={handleClose}
                                    style={{ marginTop: '1rem' }}
                                >
                                    <Check size={18} />
                                    Done
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default DeployModal;
