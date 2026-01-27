// src/components/DeployModal.jsx
import config from '../config';

import React, { useState } from 'react';
import { X, Rocket, Globe, Check, Loader2, ExternalLink, Copy } from 'lucide-react';

const DeployModal = ({ isOpen, onClose, html, css, js }) => {
    const [step, setStep] = useState(1); // 1: Deploy, 2: Domain
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployedUrl, setDeployedUrl] = useState(null);
    const [projectName, setProjectName] = useState('');
    const [error, setError] = useState(null);

    // Domain related state
    const [domainSearch, setDomainSearch] = useState('');
    const [domainResults, setDomainResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [copied, setCopied] = useState(false);

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
            const response = await fetch(`${config.apiUrl}/api/domains/search?query=${encodeURIComponent(domainSearch)}`)

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

    const handlePurchaseDomain = (domain) => {
        // Redirect to domain registrar
        const namecheapUrl = `https://www.namecheap.com/domains/registration/results/?domain=${domain.name}`;
        console.log('Opening Namecheap:', namecheapUrl);

        // Use window.location for more reliable opening (bypasses popup blockers)
        const newWindow = window.open(namecheapUrl, '_blank', 'noopener,noreferrer');

        // Fallback if popup blocked
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            console.warn('Popup blocked, using fallback');
            window.location.href = namecheapUrl;
        }
    };

    const handleClose = () => {
        // Reset state when closing
        setStep(1);
        setDeployedUrl(null);
        setProjectName('');
        setError(null);
        setDomainSearch('');
        setDomainResults([]);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={handleClose}>
                    <X size={20} />
                </button>

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

                {step === 2 && (
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
                                                        onClick={() => handlePurchaseDomain(domain)}
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
            </div>
        </div>
    );
};

export default DeployModal;