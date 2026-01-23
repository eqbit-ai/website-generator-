// src/App.js

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WebsiteGenerator from './components/WebsiteGenerator';
import Chatbot from './components/Chatbot';
import KnowledgeBase from './components/KnowledgeBase';
import VoiceAgent from './components/VoiceAgent';
import TwoFactorSetup from './components/TwoFactorSetup';
import { Database, Phone, Shield } from 'lucide-react';
import './App.css';

// Main App Component
function MainApp() {
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [showVoiceAgent, setShowVoiceAgent] = useState(false);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);

  return (
    <div className="app">
      <WebsiteGenerator />
      <Chatbot />

      {/* Knowledge Base Admin Button */}
      <button
        className="kb-admin-button"
        onClick={() => setShowKnowledgeBase(true)}
        title="Manage Knowledge Base"
      >
        <Database size={20} />
      </button>

      {/* Voice Agent Button */}
      <button
        className="voice-agent-button"
        onClick={() => setShowVoiceAgent(true)}
        title="Request Verification Call"
      >
        <Phone size={20} />
      </button>

      {/* 2FA Setup Button */}
      <button
        className="twofa-button"
        onClick={() => setShowTwoFactorSetup(true)}
        title="Setup Google Authenticator"
      >
        <Shield size={20} />
      </button>

      {/* Knowledge Base Modal */}
      <KnowledgeBase
        isOpen={showKnowledgeBase}
        onClose={() => setShowKnowledgeBase(false)}
      />

      {/* Voice Agent Modal */}
      <VoiceAgent
        isOpen={showVoiceAgent}
        onClose={() => setShowVoiceAgent(false)}
      />

      {/* 2FA Setup Modal */}
      {showTwoFactorSetup && (
        <div className="modal-overlay" onClick={() => setShowTwoFactorSetup(false)}>
          <div className="modal-content twofa-modal" onClick={e => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowTwoFactorSetup(false)}
            >
              ×
            </button>
            <TwoFactorSetup onComplete={() => setShowTwoFactorSetup(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

// Standalone 2FA Setup Page
function TwoFactorPage() {
  return (
    <div className="twofa-page">
      <TwoFactorSetup />
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/setup-2fa" element={<TwoFactorPage />} />
      </Routes>
    </Router>
  );
}

export default App;