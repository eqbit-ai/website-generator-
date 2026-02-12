// src/App.js
// Main App with all modals properly connected

import React, { useState } from 'react';
import WebsiteGenerator from './components/WebsiteGenerator';
import Chatbot from './components/Chatbot';
import KnowledgeBase from './components/KnowledgeBase';
import VoiceAgent from './components/VoiceAgent';
import Logs from './components/Logs';
import TwoFactorSetup from './components/TwoFactorSetup';
import './App.css';

function App() {
  // Modal states
  const [showKB, setShowKB] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [show2FA, setShow2FA] = useState(false);

  return (
    <div className="app">
      {/* Main Content */}
      <WebsiteGenerator
        onShowKB={() => setShowKB(true)}
        onShowVoice={() => setShowVoice(true)}
        onShowLogs={() => setShowLogs(true)}
        onShow2FA={() => setShow2FA(true)}
      />

      {/* Chatbot - Renders its own button */}
      <Chatbot />

      {/* Modals */}
      <KnowledgeBase
        isOpen={showKB}
        onClose={() => setShowKB(false)}
      />

      {showVoice && (
        <VoiceAgent
          isOpen={showVoice}
          onClose={() => setShowVoice(false)}
        />
      )}


      {showLogs && (
        <Logs onClose={() => setShowLogs(false)} />
      )}

      {show2FA && (
        <div className="modal-overlay" onClick={() => setShow2FA(false)}>
          <div className="modal-content-2fa" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-button"
              onClick={() => setShow2FA(false)}
            >
              ×
            </button>
            <TwoFactorSetup onComplete={() => setShow2FA(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;