import React, { useEffect, useState, useCallback } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { getVoiceConfigApi, getVoiceSignedUrlApi } from '../utils/api';
import { NavTab } from '../types';

interface AxisVoiceSupportAgentProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
}

const DEFAULT_AGENT_ID = 'agent_6601m1bjmavhem6a2a7epcx9rxzk';

// ── Inner component that uses the hook (must be inside ConversationProvider) ──
const VoiceModal: React.FC<Omit<AxisVoiceSupportAgentProps, 'isOpen'> & { onClose: () => void }> = ({
  onClose,
  onNavigate,
}) => {
  const [actionHint, setActionHint] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => setMicError(null),
    onError: () => setMicError('Could not connect. Please check microphone permissions and try again.'),
  });

  const statusLabel =
    conversation.status === 'connected'
      ? conversation.isSpeaking ? 'Agent is speaking...' : 'Listening...'
      : conversation.status === 'connecting'
      ? 'Connecting...'
      : 'Ready to Start Voice Session';

  const dotColor =
    conversation.status === 'connected' ? '#22c55e'
    : conversation.status === 'connecting' ? '#00d4ff'
    : '#64748b';

  const startSession = useCallback(async () => {
    setMicError(null);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      conversation.startSession();
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setMicError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else {
        setMicError('Could not start voice session. Please try again.');
      }
    }
  }, [conversation]);

  const handleTopicClick = (tab: NavTab, query: string) => {
    onNavigate(tab);
    setActionHint(`Navigated to ${tab.toUpperCase()}. Try asking: "${query}"`);
    setTimeout(() => setActionHint(null), 4000);
  };

  return (
    <div className="voice-modal-card" style={styles.modal} onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="voice-modal-header" style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="voice-agent-avatar" style={styles.agentAvatar}>
            <i className="fa-solid fa-microphone-lines voice-avatar-icon" style={{ fontSize: '1.2rem' }}></i>
            <span style={{ ...styles.pulseDot, background: dotColor }} />
          </div>
          <div>
            <h3 className="voice-modal-title" style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main, #ffffff)', fontFamily: 'Plus Jakarta Sans', fontWeight: 700 }}>
              Axis Voice Support
            </h3>
            <p className="voice-modal-subtitle" style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>
              Axis Voice Assistant
            </p>
          </div>
        </div>
        <button onClick={onClose} className="voice-modal-close-btn" style={styles.closeBtn} title="Close Voice Agent">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* Visualizer & Status */}
      <div className="voice-visualizer-container" style={styles.visualizerContainer}>
        <div className="voice-status-badge" style={styles.statusBadge}>
          <span className="voice-status-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor }} />
          <span className="voice-status-text" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main, #e2e8f0)' }}>{statusLabel}</span>
        </div>

        {/* Sound wave bars */}
        <div className="voice-soundwave-wrapper" style={styles.soundWaveWrapper}>
          {[1, 2, 3, 4, 5, 6, 7].map((bar) => (
            <div
              key={bar}
              className={`voice-sound-bar ${conversation.status === 'connected' ? 'active' : ''}`}
              style={{
                ...styles.soundBar,
                height: conversation.status === 'connected' ? `${Math.sin(bar * 0.8) * 18 + 24}px` : '10px',
                background: conversation.status === 'connected'
                  ? 'linear-gradient(180deg, #38bdf8, #0284c7)'
                  : 'var(--glass-border-light, rgba(255,255,255,0.2))',
                transition: 'height 0.25s ease',
              }}
            />
          ))}
        </div>

        {micError && (
          <div className="voice-mic-error" style={{ fontSize: '0.8rem', textAlign: 'center', padding: '0 8px' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>
            {micError}
          </div>
        )}

        {conversation.status !== 'connected' ? (
          <button
            onClick={startSession}
            disabled={conversation.status === 'connecting'}
            className="voice-primary-btn"
            style={{ ...styles.primaryVoiceBtn, opacity: conversation.status === 'connecting' ? 0.7 : 1 }}
          >
            <i
              className={`fa-solid ${conversation.status === 'connecting' ? 'fa-circle-notch fa-spin' : 'fa-microphone'}`}
              style={{ marginRight: '8px' }}
            ></i>
            {conversation.status === 'connecting' ? 'Connecting...' : 'Start Voice Session'}
          </button>
        ) : (
          <button onClick={() => conversation.endSession()} className="voice-danger-btn" style={styles.dangerVoiceBtn}>
            <i className="fa-solid fa-microphone-slash" style={{ marginRight: '8px' }}></i>
            Disconnect Voice Agent
          </button>
        )}

        {conversation.status === 'connected' && (
          <div className="voice-listening-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', textAlign: 'center', marginTop: '4px' }}>
            <i className="fa-solid fa-waveform-lines" style={{ color: 'var(--secondary-cyan, #00d4ff)', marginRight: '6px' }}></i>
            Speak into your microphone — Axis Voice is listening.
          </div>
        )}
      </div>

      {/* Action hint toast */}
      {actionHint && (
        <div className="voice-hint-banner" style={styles.hintBanner}>
          <i className="fa-solid fa-circle-info" style={{ color: 'var(--secondary-cyan, #00d4ff)' }}></i>
          <span>{actionHint}</span>
        </div>
      )}

      {/* Suggested topics */}
      <div className="voice-quick-guide-container" style={styles.quickGuideContainer}>
        <span className="voice-quick-guide-title" style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.04em' }}>
          SUGGESTED TOPICS:
        </span>
        <div className="voice-quick-buttons-grid" style={styles.quickButtonsGrid}>
          {[
            { tab: 'dashboard' as NavTab, label: 'Dashboard Guide', icon: 'fa-chart-pie', q: 'Walk me through my dashboard metrics' },
            { tab: 'transactions' as NavTab, label: 'Ledger Guide', icon: 'fa-credit-card', q: 'How do I record and audit ledger transactions?' },
            { tab: 'forecast' as NavTab, label: 'Runway Simulator', icon: 'fa-chart-line', q: 'Explain the runway simulator' },
            { tab: 'inventory' as NavTab, label: 'Inventory', icon: 'fa-boxes-stacked', q: 'How does inventory tracking work?' },
            { tab: 'agent' as NavTab, label: 'Axis Agent', icon: 'fa-brain', q: 'What can Axis Agent help me with?' },
          ].map(({ tab, label, icon, q }) => (
            <button key={tab} onClick={() => handleTopicClick(tab, q)} className="voice-quick-btn" style={styles.quickBtn}>
              <i className={`fa-solid ${icon}`} style={{ marginRight: '6px' }}></i>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Outer wrapper — fetches signed URL, provides ConversationProvider ──
export const AxisVoiceSupportAgent: React.FC<AxisVoiceSupportAgentProps> = (props) => {
  const { isOpen, onClose } = props;
  const [agentId, setAgentId] = useState<string>(DEFAULT_AGENT_ID);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setSessionReady(false);

    const fetchSession = async () => {
      try {
        // Try to get a signed URL (requires convai_write on the API key)
        const urlRes = await getVoiceSignedUrlApi();
        if (urlRes?.status === 'success' && urlRes?.signed_url) {
          setSignedUrl(urlRes.signed_url);
          setAgentId('');
        } else {
          // Fallback: use public agent ID
          const cfgRes = await getVoiceConfigApi();
          if (cfgRes?.agent_id) setAgentId(cfgRes.agent_id);
          setSignedUrl(null);
        }
      } catch {
        // Last resort fallback
        setSignedUrl(null);
      } finally {
        setSessionReady(true);
      }
    };

    fetchSession();
  }, [isOpen]);

  if (!isOpen || !sessionReady) return null;

  // Pass signedUrl for private agents, agentId for public agents
  const providerProps = signedUrl
    ? { signedUrl }
    : { agentId: agentId || DEFAULT_AGENT_ID };

  return (
    <div
      className="voice-modal-backdrop"
      style={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <ConversationProvider {...providerProps}>
        <VoiceModal {...props} />
      </ConversationProvider>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
  },
  modal: {
    width: '100%', maxWidth: '540px',
    background: 'var(--dropdown-bg, #141418)',
    border: '1px solid var(--dropdown-border, rgba(0, 212, 255, 0.25))', borderRadius: '20px',
    boxShadow: 'var(--dropdown-shadow, 0 20px 60px rgba(0, 0, 0, 0.8))',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  header: {
    padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--header-border, rgba(255, 255, 255, 0.08))',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'var(--bg-surface-low, rgba(255, 255, 255, 0.02))',
  },
  agentAvatar: {
    width: '42px', height: '42px', borderRadius: '12px',
    background: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  pulseDot: {
    position: 'absolute', top: '-2px', right: '-2px',
    width: '10px', height: '10px', borderRadius: '50%',
  },
  closeBtn: {
    background: 'transparent', border: 'none', color: 'var(--text-dim, #94a3b8)',
    fontSize: '1.2rem', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px',
  },
  visualizerContainer: {
    padding: '1.5rem', background: 'var(--modal-msg-bg, rgba(0, 0, 0, 0.3))',
    borderBottom: '1px solid var(--header-border, rgba(255, 255, 255, 0.06))',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
  },
  statusBadge: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px',
    borderRadius: '20px', background: 'var(--card-sub-bg, rgba(255, 255, 255, 0.05))',
    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
  },
  soundWaveWrapper: { display: 'flex', alignItems: 'center', gap: '6px', height: '45px' },
  soundBar: { width: '5px', borderRadius: '4px' },
  primaryVoiceBtn: {
    background: 'linear-gradient(135deg, #00d4ff 0%, #3b82f6 100%)',
    color: '#090d16', border: 'none', borderRadius: '12px',
    padding: '0.75rem 1.6rem', fontWeight: 700, fontSize: '0.92rem',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(0, 212, 255, 0.3)',
  },
  dangerVoiceBtn: {
    background: 'rgba(239, 68, 68, 0.2)', color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '12px',
    padding: '0.75rem 1.6rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
  },
  hintBanner: {
    padding: '8px 16px', background: 'rgba(0, 212, 255, 0.08)',
    borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
    fontSize: '0.8rem', color: 'var(--text-main, #e2e8f0)', display: 'flex', alignItems: 'center', gap: '8px',
  },
  quickGuideContainer: { padding: '1.25rem 1.5rem', background: 'var(--dropdown-bg, rgba(0, 0, 0, 0.2))' },
  quickButtonsGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  quickBtn: {
    background: 'var(--header-btn-bg, rgba(255, 255, 255, 0.04))', border: '1px solid var(--header-btn-border, rgba(255, 255, 255, 0.08))',
    color: 'var(--text-main, #cbd5e1)', padding: '0.5rem 0.85rem', borderRadius: '8px',
    fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center',
  },
};

