import React, { useState, useEffect, useRef } from 'react';
import { getVoiceSignedUrlApi, getVoiceConfigApi, processVoiceCommandApi } from '../utils/api';
import { NavTab } from '../types';

interface AxisVoiceSupportAgentProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
}

const DEFAULT_AGENT_ID = 'agent_6601m1bjmavhem6a2a7epcx9rxzk';

export const AxisVoiceSupportAgent: React.FC<AxisVoiceSupportAgentProps> = ({
  isOpen,
  onClose,
  activeTab,
  onNavigate
}) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'listening' | 'speaking'>('idle');
  const [agentId, setAgentId] = useState<string>(DEFAULT_AGENT_ID);
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'agent'; text: string; time: string }>>([
    {
      sender: 'agent',
      text: 'Hello! I am your Axis Black Voice Support Agent. Tap start or speak directly to ask about platform features or voice log transactions.',
      time: 'Just now'
    }
  ]);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Load ElevenLabs Convai Widget Script silently in background
  useEffect(() => {
    const scriptId = 'elevenlabs-convai-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
      script.async = true;
      script.type = 'text/javascript';
      document.body.appendChild(script);
    }

    fetchVoiceConfig();
  }, []);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, status]);

  const fetchVoiceConfig = async () => {
    try {
      const res = await getVoiceConfigApi();
      if (res && res.agent_id) {
        setAgentId(res.agent_id);
      }
    } catch (e) {
      console.warn('Voice config check fallback to default agent:', e);
    }
  };

  const startVoiceSession = async () => {
    setStatus('connecting');

    // Trigger hidden ElevenLabs Convai custom element if present in background
    try {
      const convaiElement = document.querySelector('elevenlabs-convai');
      if (convaiElement) {
        const shadowBtn = convaiElement.shadowRoot?.querySelector('button');
        if (shadowBtn) {
          (shadowBtn as HTMLElement).click();
        } else {
          (convaiElement as HTMLElement).click();
        }
      }
    } catch (e) {
      console.log('Convai background trigger:', e);
    }

    try {
      const urlRes = await getVoiceSignedUrlApi();
      if (urlRes && urlRes.status === 'success' && urlRes.agent_id) {
        setAgentId(urlRes.agent_id);
      }
    } catch (err) {
      console.warn('Backend signed URL check fallback:', err);
    }

    setupBrowserSpeechFallback();
  };

  const setupBrowserSpeechFallback = () => {
    setStatus('listening');
    setIsListening(true);
    addAgentMessage("Voice Support Session Active. Speak your question or tap a quick topic below!");

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          await handleUserQuery(transcript);
        }
      };

      recognition.onerror = () => {
        setStatus('connected');
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (e) {
        console.log('Recognition start error:', e);
      }
    }
  };

  const stopVoiceSession = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setStatus('idle');
    setIsListening(false);
  };

  const addUserMessage = (text: string) => {
    setMessages(prev => [...prev, { sender: 'user', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
  };

  const addAgentMessage = (text: string) => {
    setMessages(prev => [...prev, { sender: 'agent', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    speakResponse(text);
  };

  const speakResponse = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onstart = () => setStatus('speaking');
      utterance.onend = () => setStatus('connected');
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleUserQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    addUserMessage(queryText);
    setStatus('speaking');

    try {
      const res = await processVoiceCommandApi(queryText, activeTab);
      if (res && res.spoken_response) {
        addAgentMessage(res.spoken_response);
        if (res.status === 'navigation' && res.target_tab) {
          setTimeout(() => {
            onNavigate(res.target_tab as NavTab);
          }, 1500);
        }
      } else {
        addAgentMessage("I understand your question about " + queryText + ". Axis Black provides full telemetry and intelligence tools for your SME operations.");
      }
    } catch (e) {
      addAgentMessage("I heard: '" + queryText + "'. You can navigate across Dashboard, Transactions, Inventory, Analytics, Runway Simulator, and Settings.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="voice-agent-backdrop" style={styles.backdrop}>
      {/* Hidden ElevenLabs Convai Engine (No default widget UI shown on screen) */}
      <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', opacity: 0, pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }}>
        {React.createElement('elevenlabs-convai', {
          'agent-id': agentId || DEFAULT_AGENT_ID
        })}
      </div>

      <div className="voice-agent-modal glass-card" style={styles.modal}>
        {/* Custom Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={styles.agentAvatar}>
              <i className="fa-solid fa-microphone-lines" style={{ color: '#00d4ff', fontSize: '1.2rem' }}></i>
              <span className={`pulse-dot ${status !== 'idle' || isListening ? 'active' : ''}`} style={styles.pulseDot} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontFamily: 'Plus Jakarta Sans' }}>
                Axis Voice Support Agent
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>
                Axis Financial Intelligence Support • Currently on <span style={{ color: '#00d4ff', fontWeight: 600 }}>{activeTab.toUpperCase()}</span>
              </p>
            </div>
          </div>

          <button onClick={onClose} style={styles.closeBtn} title="Close Voice Agent">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Visualizer & Custom Status Banner */}
        <div style={styles.visualizerContainer}>
          <div style={styles.statusBadge} title="Voice Support Mode">
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: status === 'speaking' ? '#a855f7' : (status === 'listening' || isListening) ? '#00d4ff' : status === 'connected' ? '#22c55e' : '#64748b'
            }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', textTransform: 'capitalize' }}>
              {status === 'idle' ? 'Ready to Start Voice Session' : status}
            </span>
          </div>

          {/* Sound Waves Animation */}
          <div style={styles.soundWaveWrapper}>
            {[1, 2, 3, 4, 5, 6, 7].map((bar) => (
              <div
                key={bar}
                style={{
                  ...styles.soundBar,
                  height: status === 'speaking' || status === 'listening' || isListening ? `${Math.sin(bar * 0.8) * 18 + 24}px` : '10px',
                  background: status === 'speaking' ? 'linear-gradient(180deg, #c084fc, #9333ea)' : (status === 'listening' || isListening) ? 'linear-gradient(180deg, #38bdf8, #0284c7)' : 'rgba(255,255,255,0.2)',
                  transition: 'height 0.25s ease'
                }}
              />
            ))}
          </div>

          {/* Custom Voice Session Toggle Button */}
          {status === 'idle' ? (
            <button onClick={startVoiceSession} style={styles.primaryVoiceBtn}>
              <i className="fa-solid fa-microphone" style={{ marginRight: '8px' }}></i>
              Start Voice Session
            </button>
          ) : (
            <button onClick={stopVoiceSession} style={styles.dangerVoiceBtn}>
              <i className="fa-solid fa-microphone-slash" style={{ marginRight: '8px' }}></i>
              Disconnect Voice Agent
            </button>
          )}
        </div>

        {/* Conversation Stream */}
        <div style={styles.chatStream}>
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                ...styles.chatBubble,
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                background: msg.sender === 'user' ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: msg.sender === 'user' ? '1px solid rgba(0, 212, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>
                {msg.sender === 'user' ? 'You' : 'Axis Support Agent'} • {msg.time}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#f8fafc', lineHeight: 1.45 }}>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={chatBottomRef} />
        </div>

        {/* Quick Platform Guides with Real Icons (No Emojis) */}
        <div style={styles.quickGuideContainer}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            QUICK PLATFORM GUIDES & NAVIGATION:
          </span>
          <div style={styles.quickButtonsGrid}>
            <button onClick={() => handleUserQuery("How do I use the Executive Dashboard?")} style={styles.quickBtn}>
              <i className="fa-solid fa-chart-pie" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Executive Dashboard Guide
            </button>
            <button onClick={() => handleUserQuery("How to log expenses or revenues in Transactions?")} style={styles.quickBtn}>
              <i className="fa-solid fa-credit-card" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Log Transactions
            </button>
            <button onClick={() => handleUserQuery("Explain Runway Simulator scenario modeling")} style={styles.quickBtn}>
              <i className="fa-solid fa-chart-line" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Runway Simulator Guide
            </button>
            <button onClick={() => handleUserQuery("How does Inventory & Warehouse tracking work?")} style={styles.quickBtn}>
              <i className="fa-solid fa-boxes-stacked" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Inventory Management
            </button>
            <button onClick={() => handleUserQuery("What can Axis Agent AI do?")} style={styles.quickBtn}>
              <i className="fa-solid fa-robot" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Axis AI Co-Pilot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem'
  },
  modal: {
    width: '100%',
    maxWidth: '540px',
    maxHeight: '90vh',
    background: 'rgba(13, 17, 23, 0.95)',
    border: '1px solid rgba(0, 212, 255, 0.25)',
    borderRadius: '20px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 212, 255, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(255, 255, 255, 0.02)'
  },
  agentAvatar: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: 'rgba(0, 212, 255, 0.1)',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  pulseDot: {
    position: 'absolute',
    top: '-2px',
    right: '-2px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#00d4ff'
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '0.4rem',
    borderRadius: '8px',
    transition: 'color 0.2s'
  },
  visualizerContainer: {
    padding: '1rem 1.5rem',
    background: 'rgba(0, 0, 0, 0.3)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px'
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 12px',
    borderRadius: '20px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)'
  },
  soundWaveWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    height: '45px'
  },
  soundBar: {
    width: '5px',
    borderRadius: '4px'
  },
  primaryVoiceBtn: {
    background: 'linear-gradient(135deg, #00d4ff 0%, #3b82f6 100%)',
    color: '#090d16',
    border: 'none',
    borderRadius: '12px',
    padding: '0.65rem 1.4rem',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0, 212, 255, 0.3)',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  dangerVoiceBtn: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: '12px',
    padding: '0.65rem 1.4rem',
    fontWeight: 600,
    fontSize: '0.88rem',
    cursor: 'pointer'
  },
  chatStream: {
    padding: '1.25rem 1.5rem',
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '260px'
  },
  chatBubble: {
    padding: '0.85rem 1.1rem',
    borderRadius: '14px',
    maxWidth: '85%'
  },
  quickGuideContainer: {
    padding: '1rem 1.5rem 1.25rem 1.5rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    background: 'rgba(0, 0, 0, 0.2)'
  },
  quickButtonsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  quickBtn: {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#cbd5e1',
    padding: '0.45rem 0.85rem',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'all 0.2s'
  }
};
