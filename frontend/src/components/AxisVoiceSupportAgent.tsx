import React, { useEffect, useState, useCallback } from 'react';
import { useConversation } from '@elevenlabs/react';
import { getVoiceConfigApi } from '../utils/api';
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
  activeTab: _activeTab,
  onNavigate
}) => {
  const [agentId, setAgentId] = useState<string>(DEFAULT_AGENT_ID);
  const [actionHint, setActionHint] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      setMicError(null);
    },
    onDisconnect: () => {
      // Session ended cleanly
    },
    onError: (message: string) => {
      console.warn('Voice session error:', message);
      setMicError('Could not start voice session. Please check microphone permissions.');
    },
  });

  // Map ElevenLabs status to our UI status
  const status: 'idle' | 'connecting' | 'connected' =
    conversation.status === 'connected' ? 'connected'
    : conversation.status === 'connecting' ? 'connecting'
    : 'idle';

  // Fetch agent ID from backend config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await getVoiceConfigApi();
        if (res?.agent_id) setAgentId(res.agent_id);
      } catch {
        // fallback to DEFAULT_AGENT_ID
      }
    };
    fetchConfig();
  }, []);

  // Disconnect when modal is closed
  useEffect(() => {
    if (!isOpen && conversation.status === 'connected') {
      conversation.endSession();
    }
  }, [isOpen]);

  const startVoiceSession = useCallback(async () => {
    setMicError(null);
    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({ agentId: agentId || DEFAULT_AGENT_ID });
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setMicError('Microphone access was denied. Please allow microphone access in your browser settings.');
      } else {
        setMicError('Could not start voice session. Please try again.');
        console.error('Voice start error:', err);
      }
    }
  }, [agentId, conversation]);

  const stopVoiceSession = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const handleTopicClick = (tab: NavTab, topicQuery: string) => {
    onNavigate(tab);
    setActionHint(`Navigated to ${tab.toUpperCase()}. Try asking: "${topicQuery}"`);
    setTimeout(() => setActionHint(null), 4000);
  };

  if (!isOpen) return null;

  return (
    <div className="voice-agent-backdrop" style={styles.backdrop}>
      <div className="voice-agent-modal glass-card" style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={styles.agentAvatar}>
              <i className="fa-solid fa-microphone-lines" style={{ color: '#00d4ff', fontSize: '1.2rem' }}></i>
              <span
                className={`pulse-dot ${status === 'connected' ? 'active' : ''}`}
                style={styles.pulseDot}
              />
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

        {/* Visualizer & Status */}
        <div style={styles.visualizerContainer}>
          <div style={styles.statusBadge}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: status === 'connected' ? '#22c55e' : status === 'connecting' ? '#00d4ff' : '#64748b'
            }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>
              {status === 'idle'
                ? 'Ready to Start Voice Session'
                : status === 'connecting'
                ? 'Connecting...'
                : conversation.isSpeaking ? 'Agent is speaking...' : 'Listening...'}
            </span>
          </div>

          {/* Sound wave bars */}
          <div style={styles.soundWaveWrapper}>
            {[1, 2, 3, 4, 5, 6, 7].map((bar) => (
              <div
                key={bar}
                style={{
                  ...styles.soundBar,
                  height: status === 'connected' ? `${Math.sin(bar * 0.8) * 18 + 24}px` : '10px',
                  background: status === 'connected'
                    ? 'linear-gradient(180deg, #38bdf8, #0284c7)'
                    : 'rgba(255,255,255,0.2)',
                  transition: 'height 0.25s ease'
                }}
              />
            ))}
          </div>

          {/* Mic error */}
          {micError && (
            <div style={{ fontSize: '0.8rem', color: '#f87171', textAlign: 'center', padding: '0 8px' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>
              {micError}
            </div>
          )}

          {/* Start / Stop button */}
          {status === 'idle' || status === 'connecting' ? (
            <button
              onClick={startVoiceSession}
              disabled={status === 'connecting'}
              style={{ ...styles.primaryVoiceBtn, opacity: status === 'connecting' ? 0.7 : 1 }}
            >
              <i className={`fa-solid ${status === 'connecting' ? 'fa-circle-notch fa-spin' : 'fa-microphone'}`} style={{ marginRight: '8px' }}></i>
              {status === 'connecting' ? 'Connecting...' : 'Start Voice Session'}
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

        {/* Action hint toast */}
        {actionHint && (
          <div style={styles.hintBanner}>
            <i className="fa-solid fa-circle-info" style={{ color: '#00d4ff' }}></i>
            <span>{actionHint}</span>
          </div>
        )}

        {/* Suggested topics */}
        <div style={styles.quickGuideContainer}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.04em' }}>
            SUGGESTED TOPICS:
          </span>
          <div style={styles.quickButtonsGrid}>
            <button onClick={() => handleTopicClick('dashboard', 'Walk me through my dashboard metrics')} style={styles.quickBtn}>
              <i className="fa-solid fa-chart-pie" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Dashboard Guide
            </button>
            <button onClick={() => handleTopicClick('transactions', 'How do I record and audit ledger transactions?')} style={styles.quickBtn}>
              <i className="fa-solid fa-credit-card" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Ledger Guide
            </button>
            <button onClick={() => handleTopicClick('forecast', 'Explain the runway simulator')} style={styles.quickBtn}>
              <i className="fa-solid fa-chart-line" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Runway Simulator
            </button>
            <button onClick={() => handleTopicClick('inventory', 'How does inventory tracking work?')} style={styles.quickBtn}>
              <i className="fa-solid fa-boxes-stacked" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Inventory Management
            </button>
            <button onClick={() => handleTopicClick('agent', 'What can Axis Agent help me with?')} style={styles.quickBtn}>
              <i className="fa-solid fa-brain" style={{ color: '#00d4ff', marginRight: '6px' }}></i>
              Axis Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
  },
  modal: {
    width: '100%', maxWidth: '540px',
    background: 'rgba(13, 17, 23, 0.95)',
    border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: '20px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 212, 255, 0.15)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden'
  },
  header: {
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'rgba(255, 255, 255, 0.02)'
  },
  agentAvatar: {
    width: '42px', height: '42px', borderRadius: '12px',
    background: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
  },
  pulseDot: {
    position: 'absolute', top: '-2px', right: '-2px',
    width: '10px', height: '10px', borderRadius: '50%', background: '#00d4ff'
  },
  closeBtn: {
    background: 'transparent', border: 'none', color: '#94a3b8',
    fontSize: '1.2rem', cursor: 'pointer', padding: '0.4rem',
    borderRadius: '8px', transition: 'color 0.2s'
  },
  visualizerContainer: {
    padding: '1.5rem', background: 'rgba(0, 0, 0, 0.3)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px'
  },
  statusBadge: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '4px 12px', borderRadius: '20px',
    background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)'
  },
  soundWaveWrapper: { display: 'flex', alignItems: 'center', gap: '6px', height: '45px' },
  soundBar: { width: '5px', borderRadius: '4px' },
  primaryVoiceBtn: {
    background: 'linear-gradient(135deg, #00d4ff 0%, #3b82f6 100%)',
    color: '#090d16', border: 'none', borderRadius: '12px',
    padding: '0.75rem 1.6rem', fontWeight: 700, fontSize: '0.92rem',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(0, 212, 255, 0.3)',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  dangerVoiceBtn: {
    background: 'rgba(239, 68, 68, 0.2)', color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '12px',
    padding: '0.75rem 1.6rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer'
  },
  hintBanner: {
    padding: '8px 16px', background: 'rgba(0, 212, 255, 0.08)',
    borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
    fontSize: '0.8rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px'
  },
  quickGuideContainer: { padding: '1.25rem 1.5rem', background: 'rgba(0, 0, 0, 0.2)' },
  quickButtonsGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  quickBtn: {
    background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#cbd5e1', padding: '0.5rem 0.85rem', borderRadius: '8px',
    fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', transition: 'all 0.2s'
  }
};
