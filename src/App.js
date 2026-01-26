// src/App.js
// Main App with properly connected modals

import React, { useState } from 'react';
import { Database, Phone } from 'lucide-react';
import WebsiteGenerator from './components/WebsiteGenerator';
import Chatbot from './components/Chatbot';
import KnowledgeBase from './components/KnowledgeBase';
import VoiceAgent from './components/VoiceAgent';
import './App.css';

function App() {
  const [showKB, setShowKB] = useState(false);
  const [showVoice, setShowVoice] = useState(false);

  return (
    <div className="app">
      {/* Main Content */}
      <WebsiteGenerator />

      {/* Chatbot - Bottom Right */}
      <Chatbot />

      {/* Admin Buttons - Bottom Left */}
      <div className="bottom-left-buttons">
        <button
          className="fab-button kb-button"
          onClick={() => setShowKB(true)}
          title="Knowledge Base"
        >
          <Database size={22} />
        </button>

        <button
          className="fab-button voice-button"
          onClick={() => setShowVoice(true)}
          title="Voice Agent"
        >
          <Phone size={22} />
        </button>
      </div>

      {/* Knowledge Base Modal */}
      <KnowledgeBase
        isOpen={showKB}
        onClose={() => setShowKB(false)}
      />

      {/* Voice Agent Modal */}
      {showVoice && (
        <VoiceAgent onClose={() => setShowVoice(false)} />
      )}
    </div>
  );
}

export default App;