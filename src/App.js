// src/App.js
// Main App with all modals properly connected

import React, { useState } from 'react';
import { Database, Phone, FileText, Shield } from 'lucide-react';
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
      <WebsiteGenerator />

      {/* Bottom Left - Admin Buttons */}
      <div className="bottom-left-buttons">
        {/* Knowledge Base Button */}
        <button
          className="fab-button kb-button"
          onClick={() => setShowKB(true)}
          title="Knowledge Base"
        >
          <Database size={22} />
        </button>

        {/* Voice Agent Button */}
        <button
          className="fab-button voice-button"
          onClick={() => setShowVoice(true)}
          title="Voice Agent"
        >
          <Phone size={22} />
        </button>

        {/* Logs Button */}
        <button
          className="fab-button logs-button"
          onClick={() => setShowLogs(true)}
          title="View Logs"
        >
          <FileText size={22} />
        </button>
      </div>

      {/* Bottom Right - 2FA Button */}
      <div className="bottom-right-buttons">
        <button
          className="twofa-fab"
          onClick={() => setShow2FA(true)}
          title="2FA Setup"
        >
          <Shield size={22} />
        </button>
      </div>

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
        <TwoFactorSetup onClose={() => setShow2FA(false)} />
      )}
    </div>
  );
}

export default App;