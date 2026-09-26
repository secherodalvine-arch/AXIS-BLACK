import React, { useState, useEffect } from 'react';
import { getVoiceSignedUrlApi, getVoiceConfigApi } from '../utils/api';
import { NavTab } from '../types';

interface AxisVoiceSupportAgentProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
}

// Voice session is handled by the embedded conversational engine
const DEFAULT_AGENT_ID = 'agent_6601m1bjmavhem6a2a7epcx9rxzk';

export const AxisVoiceSupportAgent: React.FC<AxisVoiceSupportAgentProps> = ({
  isOpen,
  onClose,
  activeTab: _activeTab,
  onNavigate
}) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [agentId, setAgentId] = useState<string>(DEFAULT_AGENT_ID);
  const [actionHint, setActionHint] = useState<string | null>(null);

  // Load voice widget script silently in background
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

  // When modal closes, disconnect active voice session cleanly
  useEffect(() => {
    if (!isOpen && status !== 'idle') {
      stopVoiceSession();
    }
  }, [isOpen]);

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

  const triggerConvaiElement = (): boolean => {
    try {
      const convaiElement = document.querySelector('elevenlabs-convai');
      if (convaiElement) {
        const shadowBtn = convaiElement.shadowRoot?.querySelector('button');
        if (shadowBtn) {
          (shadowBtn as HTMLElement).click();
          return true;
        } else {
          (convaiElement as HTMLElement).click();
          return true;
        }
      }
    } catch (e) {
      console.log('Convai trigger exception:', e);
    }
    return false;
  };

  const startVoiceSession = async () => {
    setStatus('connecting');

    try {
      const urlRes = await getVoiceSignedUrlApi();
      if (urlRes && urlRes.status === 'success' && urlRes.agent_id) {
        setAgentId(urlRes.agent_id);
      }
    } catch (err) {
      console.warn('Backend signed URL check fallback:', err);
    }

    // Trigger voice engine
    setTimeout(() => {
      triggerConvaiElement();
      setStatus('connected');
    }, 300);
  };

  const stopVoiceSession = () => {
    triggerConvaiElement();
    setStatus('idle');
  };

  const handleTopicClick = (tab: NavTab, topicQuery: string) => {
    onNavigate(tab);
    setActionHint(`Navigated to ${tab.toUpperCase()}. Try asking: "${topicQuery}"`);
    setTimeout(() => setActionHint(null), 4000);
  };

  if (!isOpen) return null;

  return (
    <div className="voice-agent-backdrop" style={styles.backdrop}>
      {/* Voice Engine (hidden, handles audio & conversational stream) */}
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
              <span className={`pulse-dot ${status === 'connected' ? 'active' : ''}`} style={styles.pulseDot} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontFamily: 'Plus Jakarta Sans' }}>
                Axis Voice Support
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
                Axis Voice Assistant
              </p>
            </div>
          </div>

          <button onClick={onClose} style={styles.closeBtn} title="Close Voice Agent">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Visualizer & Status Banner */}
        <div style={styles.visualizerContainer}>
          <div style={styles.statusBadge} title="Voice Support Mode">
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: status === 'connected' ? '#22c55e' : status === 'connecting' ? '#00d4ff' : '#64748b'
            }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', textTransform: 'capitalize' }}>
              {status === 'idle'
                ? 'Ready to Start Voice Session'
                : status === 'connecting'
                ? 'Connecting...'
                : 'Voice Session Active'}
            </span>
          </div>

          {/* Sound Waves Animation */}
          <div style={styles.soundWaveWrapper}>
            {[1, 2, 3, 4, 5, 6, 7].map((bar) => (
              <div
                key={bar}
                style={{
                  ...styles.soundBar,
                  height: status === 'connected' ? `${Math.sin(bar * 0.8) * 18 + 24}px` : '10px',
                  background: status === 'connected' ? 'linear-gradient(180deg, #38bdf8, #0284c7)' : 'rgba(255,255,255,0.2)',
                  transition: 'height 0.25s ease'
                }}
              />
            ))}
          </div>

          {/* Voice Session Toggle Button */}
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

          {status === 'connected' && (
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', marginTop: '4px' }}>
              <i className="fa-solid fa-waveform-lines" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Speak into your microphone — Axis Voice is listening.
            </div>
          )}
        </div>

        {/* Action Hint Toast */}
        {actionHint && (
          <div style={styles.hintBanner}>
            <i className="fa-solid fa-circle-info" style={{ color: '#00d4ff' }}></i>
            <span>{actionHint}</span>
          </div>
        )}

        {/* Suggested Voice Topics */}
        <div style={styles.quickGuideContainer}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.04em' }}>
            SUGGESTED TOPICS:
          </span>
          <div style={styles.quickButtonsGrid}>
            <button onClick={() => handleTopicClick('dashboard', 'Walk me through the Executive Dashboard metrics and ARR growth pace')} style={styles.quickBtn}>
              <i className="fa-solid fa-chart-pie" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Executive Dashboard Guide
            </button>
            <button onClick={() => handleTopicClick('transactions', 'How do I record and audit ledger transactions?')} style={styles.quickBtn}>
              <i className="fa-solid fa-credit-card" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Ledger Guide
            </button>
            <button onClick={() => handleTopicClick('forecast', 'Explain the runway simulator and hiring scenario models')} style={styles.quickBtn}>
              <i className="fa-solid fa-chart-line" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Runway Simulator Guide
            </button>
            <button onClick={() => handleTopicClick('inventory', 'How does inventory turnover and warehouse tracking work?')} style={styles.quickBtn}>
              <i className="fa-solid fa-boxes-stacked" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Inventory Management
            </button>
            <button onClick={() => handleTopicClick('agent', 'What business intelligence capabilities can you provide?')} style={styles.quickBtn}>
              <i className="fa-solid fa-brain" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Axis AI Intelligence
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
    padding: '1.5rem',
    background: 'rgba(0, 0, 0, 0.3)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px'
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
    padding: '0.75rem 1.6rem',
    fontWeight: 700,
    fontSize: '0.92rem',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0, 212, 255, 0.3)',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  dangerVoiceBtn: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: '12px',
    padding: '0.75rem 1.6rem',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer'
  },
  hintBanner: {
    padding: '8px 16px',
    background: 'rgba(0, 212, 255, 0.08)',
    borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
    fontSize: '0.8rem',
    color: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  quickGuideContainer: {
    padding: '1.25rem 1.5rem',
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
    padding: '0.5rem 0.85rem',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'all 0.2s'
  }
};
